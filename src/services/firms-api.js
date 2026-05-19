import { addDays, toDateInput } from "../utils/date.js";

export async function fetchFirmsArea({ mapKey, source, bbox, endDate, rangeDays, proxyUrl = "" }) {
  const chunks = buildFirmsChunks(endDate, rangeDays);
  const allRows = [];

  for (const chunk of chunks) {
    const area = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
    const csv = await requestFirmsCsv({
      mapKey,
      source,
      area,
      days: chunk.days,
      start: chunk.start,
      proxyUrl
    });
    allRows.push(...parseFirmsCsv(csv, source));
  }

  return allRows;
}

async function requestFirmsCsv(request) {
  const attempts = buildRequestAttempts(request);
  let lastError = null;
  let directFetchBlocked = false;

  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, {
        headers: { Accept: "text/csv" }
      });
      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        const message = await response.text();
        if (attempt.isLocalProxy && response.status === 404) {
          lastError = new Error("로컬 FIRMS 프록시를 찾을 수 없습니다.");
          continue;
        }
        if (attempt.isProxy && isHtmlErrorResponse(contentType, message)) {
          throw new Error(
            "프록시 URL이 HTML 페이지를 반환했습니다. GitHub Pages 주소가 아니라 Cloudflare Worker/Vercel/FastAPI API 주소를 입력하세요."
          );
        }
        throw new Error(formatHttpError(attempt.label, response.status, message));
      }
      return response.text();
    } catch (error) {
      lastError = error;
      if (isFetchBlocked(error)) {
        if (attempt.isProxy) {
          throw new Error(`${attempt.label}에 연결할 수 없습니다. 프록시 주소와 CORS 허용 설정을 확인하세요.`);
        }
        directFetchBlocked = true;
        continue;
      }
      throw error;
    }
  }

  if (directFetchBlocked) {
    throw new Error("NASA FIRMS 직접 호출이 브라우저에서 차단되었습니다. 로컬 서버 또는 별도 FIRMS 프록시 URL로 실행하세요.");
  }
  throw lastError || new Error("FIRMS 요청에 실패했습니다.");
}

function buildRequestAttempts({ mapKey, source, area, days, start, proxyUrl }) {
  const directUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(
    mapKey
  )}/${encodeURIComponent(source)}/${area}/${days}/${start}`;
  const attempts = [];

  if (proxyUrl) {
    attempts.push({
      url: buildProxyRequestUrl(proxyUrl, { mapKey, source, area, days, start }),
      isProxy: true,
      isLocalProxy: false,
      label: "FIRMS 프록시"
    });
    return attempts;
  }

  if (shouldUseLocalProxy()) {
    attempts.push({
      url: buildProxyRequestUrl("/api/firms/area", { mapKey, source, area, days, start }),
      isProxy: true,
      isLocalProxy: true,
      label: "로컬 FIRMS 프록시"
    });
  }

  attempts.push({ url: directUrl, isProxy: false, isLocalProxy: false, label: "NASA FIRMS" });
  return attempts;
}

function buildProxyRequestUrl(baseUrl, { mapKey, source, area, days, start }) {
  const url = new URL(baseUrl, window.location.href);
  if (mapKey) {
    url.searchParams.set("mapKey", mapKey);
  }
  url.searchParams.set("source", source);
  url.searchParams.set("area", area);
  url.searchParams.set("days", String(days));
  url.searchParams.set("date", start);
  return url.toString();
}

function shouldUseLocalProxy() {
  if (typeof window === "undefined") {
    return false;
  }
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function isFetchBlocked(error) {
  return error instanceof TypeError || /failed to fetch/i.test(error.message || "");
}

function isHtmlErrorResponse(contentType, body) {
  return /text\/html/i.test(contentType) || /^\s*<!doctype html/i.test(body) || /^\s*<html/i.test(body);
}

function formatHttpError(label, status, message) {
  const detail = String(message || "").trim().replace(/\s+/g, " ").slice(0, 160);
  return detail ? `${label} HTTP ${status}: ${detail}` : `${label} HTTP ${status}`;
}

export function buildFirmsChunks(endDate, rangeDays) {
  const chunks = [];
  let remaining = rangeDays;
  let start = addDays(endDate, -(rangeDays - 1));

  while (remaining > 0) {
    const days = Math.min(10, remaining);
    chunks.push({ start: toDateInput(start), days });
    start = addDays(start, days);
    remaining -= days;
  }

  return chunks;
}

export function parseFirmsCsv(csv, source) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) {
    return [];
  }

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const row = Object.fromEntries(headers.map((header, valueIndex) => [header, values[valueIndex]]));
    const lat = Number(row.latitude);
    const lng = Number(row.longitude);
    const brightnessKelvin = Number(row.bright_ti4 || row.brightness || row.bright_t31 || row.bright_ti5 || 0);

    return {
      id: `firms-${lat}-${lng}-${row.acq_date}-${row.acq_time}-${index}`,
      lat,
      lng,
      acqDate: row.acq_date,
      acqTime: row.acq_time || "",
      source,
      satellite: row.satellite || row.instrument || source,
      confidence: normalizeConfidence(row.confidence),
      frp: Number(row.frp || 0),
      brightnessKelvin,
      scanKm: Number(row.scan || 0),
      trackKm: Number(row.track || 0),
      fireType: row.type || "",
      daynight: row.daynight || ""
    };
  });
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function normalizeConfidence(value) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }
  const lower = String(value).toLowerCase();
  if (lower === "h" || lower === "high") {
    return 85;
  }
  if (lower === "n" || lower === "nominal") {
    return 55;
  }
  if (lower === "l" || lower === "low") {
    return 25;
  }
  return 0;
}
