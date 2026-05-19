const VWORLD_ENDPOINT = "https://api.vworld.kr/req/data";
const VWORLD_DATASET = "LT_C_KFDRSSIGUGRADE";
const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const VWORLD_COLUMNS = ["ymd", ...HOURS.flatMap((hour) => [`value${hour}h`, `class${hour}h`]), "ag_geom"].join(",");

export async function fetchVworldFireRisk({ apiKey, domain, site, date }) {
  const key = String(apiKey || "").trim();
  if (!key) {
    throw new Error("V-World 인증키가 필요합니다.");
  }

  const url = buildVworldUrl({
    apiKey: key,
    domain,
    lat: site.lat,
    lng: site.lng,
    date
  });
  let response;
  try {
    response = await fetch(url.toString(), { method: "GET" });
  } catch (error) {
    throw new Error(
      "V-World 직접 호출이 차단되었습니다. 인증키에 등록된 도메인과 화면의 V-World 도메인 값이 일치하는지 확인하세요."
    );
  }
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`V-World HTTP ${response.status}: ${text.slice(0, 160)}`);
  }

  const properties = parseVworldResponse(text, response.headers.get("content-type") || "");
  return buildRiskFromProperties(properties, site, url.toString());
}

export function getDefaultVworldDomain(locationLike = window.location) {
  const origin = locationLike.origin || "";
  const pathname = locationLike.pathname || "";
  if (!origin) {
    return "https://hopesound.github.io/fire-stone";
  }
  if (origin.includes("github.io")) {
    const firstSegment = pathname.split("/").filter(Boolean)[0];
    return firstSegment ? `${origin}/${firstSegment}` : origin;
  }
  return origin;
}

function buildVworldUrl({ apiKey, domain, lat, lng, date }) {
  const params = new URLSearchParams({
    service: "data",
    version: "2.0",
    request: "GetFeature",
    key: apiKey,
    format: "json",
    errorformat: "json",
    size: "10",
    page: "1",
    data: VWORLD_DATASET,
    geomfilter: `POINT(${Number(lng).toFixed(12)} ${Number(lat).toFixed(12)})`,
    attrfilter: `ymd:like:${toVworldDate(date)}`,
    columns: VWORLD_COLUMNS,
    geometry: "true",
    attribute: "true",
    buffer: "10",
    crs: "EPSG:4326",
    domain: normalizeDomain(domain)
  });
  return new URL(`${VWORLD_ENDPOINT}?${params.toString()}`);
}

function parseVworldResponse(text, contentType) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("V-World 응답이 비어 있습니다.");
  }

  if (contentType.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseJsonResponse(JSON.parse(trimmed));
  }
  return parseXmlResponse(trimmed);
}

function parseJsonResponse(payload) {
  const response = payload.response || payload;
  const status = String(response.status || "").toUpperCase();
  if (status && status !== "OK") {
    const message =
      response.error?.text ||
      response.error?.message ||
      response.error ||
      response.status ||
      "V-World 응답 상태가 OK가 아닙니다.";
    throw new Error(String(message));
  }

  const features =
    response.result?.featureCollection?.features ||
    response.result?.features ||
    response.featureCollection?.features ||
    payload.features ||
    [];
  const feature = Array.isArray(features) ? features[0] : null;
  const properties = feature?.properties || feature?.attributes || response.result?.properties || {};
  if (!Object.keys(properties).length) {
    throw new Error("V-World 산불위험예측 데이터가 없습니다. 날짜 또는 좌표를 확인하세요.");
  }
  return properties;
}

function parseXmlResponse(text) {
  const document = new DOMParser().parseFromString(text, "application/xml");
  const parserError = document.querySelector("parsererror");
  if (parserError) {
    throw new Error("V-World XML 응답을 해석하지 못했습니다.");
  }
  const errorText = findXmlText(document, ["text", "message", "ExceptionText"]);
  const status = findXmlText(document, ["status"]);
  if (status && status.toUpperCase() !== "OK" && errorText) {
    throw new Error(errorText);
  }

  const properties = {};
  ["ymd", ...HOURS.flatMap((hour) => [`value${hour}h`, `class${hour}h`])].forEach((name) => {
    const value = findXmlText(document, [name]);
    if (value !== "") {
      properties[name] = value;
    }
  });
  if (!Object.keys(properties).length) {
    throw new Error("V-World 산불위험예측 데이터가 없습니다. 날짜 또는 좌표를 확인하세요.");
  }
  return properties;
}

function buildRiskFromProperties(properties, site, requestUrl) {
  const hourly = HOURS.map((hour) => {
    const value = parseNumber(properties[`value${hour}h`]);
    const riskClass = parseNumber(properties[`class${hour}h`]);
    return {
      hour,
      value,
      riskClass
    };
  }).filter((item) => Number.isFinite(item.value) || Number.isFinite(item.riskClass));

  if (!hourly.length) {
    throw new Error("V-World 시간대별 산불위험 값이 없습니다.");
  }

  const maxClass = Math.max(...hourly.map((item) => Number.isFinite(item.riskClass) ? item.riskClass : 0));
  const maxValue = Math.max(...hourly.map((item) => Number.isFinite(item.value) ? item.value : 0));
  const peak = hourly
    .slice()
    .sort((a, b) => (b.riskClass || 0) - (a.riskClass || 0) || (b.value || 0) - (a.value || 0))[0];
  const baseScore = Math.round((maxClass * 4 + maxValue * 0.05) * 10) / 10;
  const multiplier = Math.round((1 + maxClass * 0.025) * 1000) / 1000;

  return {
    siteId: site.id,
    ymd: String(properties.ymd || ""),
    maxClass,
    maxValue,
    peakHour: peak?.hour || "",
    baseScore,
    multiplier,
    label: labelForClass(maxClass),
    hourly,
    requestUrl
  };
}

function findXmlText(document, names) {
  const lowered = new Set(names.map((name) => name.toLowerCase()));
  const element = Array.from(document.getElementsByTagName("*")).find((item) => lowered.has(item.localName.toLowerCase()));
  return element?.textContent?.trim() || "";
}

function toVworldDate(date) {
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  }
  return String(date || "").replaceAll("-", "").slice(0, 8);
}

function normalizeDomain(domain) {
  const value = String(domain || "").trim();
  return value.replace(/\/$/, "");
}

function parseNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function labelForClass(value) {
  if (value >= 5) {
    return "산불위험 심각";
  }
  if (value >= 4) {
    return "산불위험 매우높음";
  }
  if (value >= 3) {
    return "산불위험 높음";
  }
  if (value >= 2) {
    return "산불위험 보통";
  }
  if (value >= 1) {
    return "산불위험 낮음";
  }
  return "산불위험 미확인";
}
