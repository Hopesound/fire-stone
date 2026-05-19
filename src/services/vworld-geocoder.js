const VWORLD_ADDRESS_ENDPOINT = "https://api.vworld.kr/req/address";

export async function fetchVworldAddressCoord({ apiKey, domain, address }) {
  const key = String(apiKey || "").trim();
  if (!key) {
    throw new Error("V-World 인증키가 필요합니다.");
  }

  const candidates = buildAddressCandidates(address);
  const attempts = [];

  for (const candidate of candidates) {
    for (const type of ["PARCEL", "ROAD"]) {
      attempts.push({ address: candidate, type });
    }
  }

  let lastError = "주소좌표 변환 결과가 없습니다.";
  for (const attempt of attempts) {
    try {
      const result = await requestAddressCoord({ apiKey: key, domain, ...attempt });
      if (result) {
        return result;
      }
    } catch (error) {
      lastError = error.message;
    }
  }

  throw new Error(lastError);
}

function buildAddressCandidates(address) {
  const clean = String(address || "").replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
  const withoutBeonji = clean.replace(/번지/g, "").replace(/\s+/g, " ").trim();
  const withProvince = /^(충남|충청남도)\s/.test(withoutBeonji) ? withoutBeonji : `충청남도 ${withoutBeonji}`;
  const expandedProvince = withProvince.replace(/^충남\s/, "충청남도 ");
  return Array.from(new Set([expandedProvince, withProvince, withoutBeonji, clean].filter(Boolean)));
}

async function requestAddressCoord({ apiKey, domain, address, type }) {
  const url = new URL(VWORLD_ADDRESS_ENDPOINT);
  url.search = new URLSearchParams({
    service: "address",
    request: "getCoord",
    version: "2.0",
    crs: "EPSG:4326",
    address,
    refine: "true",
    simple: "false",
    format: "json",
    type,
    key: apiKey,
    domain: String(domain || "").trim().replace(/\/$/, "")
  }).toString();

  let response;
  try {
    response = await fetch(url.toString(), { method: "GET" });
  } catch {
    throw new Error("V-World 주소좌표 변환 호출이 차단되었습니다. 인증키 도메인 등록값을 확인하세요.");
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`V-World 주소좌표 HTTP ${response.status}`);
  }

  const payload = JSON.parse(text);
  const root = payload.response || payload;
  const status = String(root.status || "").toUpperCase();
  if (status && status !== "OK") {
    const message = root.error?.text || root.error?.message || root.status || "주소좌표 변환 실패";
    throw new Error(String(message));
  }

  const point = root.result?.point || root.result?.[0]?.point;
  const lng = Number(point?.x);
  const lat = Number(point?.y);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    lat,
    lng,
    matchedAddress: address,
    type,
    coordinateAccuracy: "V-World 주소좌표 변환"
  };
}
