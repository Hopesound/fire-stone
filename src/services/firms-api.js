import { addDays, toDateInput } from "../utils/date.js";

export async function fetchFirmsArea({ mapKey, source, bbox, endDate, rangeDays }) {
  const chunks = buildFirmsChunks(endDate, rangeDays);
  const allRows = [];

  for (const chunk of chunks) {
    const area = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
    const csv = await requestFirmsCsv({
      mapKey,
      source,
      area,
      days: chunk.days,
      start: chunk.start
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
        const message = await response.text();
        if (attempt.isProxy && response.status === 404) {
          lastError = new Error("로컬 FIRMS 프록시를 찾을 수 없습니다.");
          continue;
        }
        throw new Error(formatHttpError(response.status, message));
      }
      return response.text();
    } catch (error) {
      lastError = error;
      if (isFetchBlocked(error)) {
        directFetchBlocked = !attempt.isProxy || directFetchBlocked;
        continue;
      }
      if (attempt.isProxy && attempts.length > 1 && isFetchBlocked(error)) {
        continue;
      }
      throw error;
    }
  }

  if (directFetchBlocked) {
    throw new Error("NASA FIRMS 직접 호출이 브라우저에서 차단되었습니다. 로컬 서버의 FIRMS 프록시로 실행하세요.");
  }
  throw lastError || new Error("FIRMS 요청에 실패했습니다.");
}

function buildRequestAttempts({ mapKey, source, area, days, start }) {
  const directUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(
    mapKey
  )}/${encodeURIComponent(source)}/${area}/${days}/${start}`;
  const attempts = [];

  if (shouldUseLocalProxy()) {
    const proxyUrl = new URL("/api/firms/area", window.location.href);
    proxyUrl.searchParams.set("mapKey", mapKey);
    proxyUrl.searchParams.set("source", source);
    proxyUrl.searchParams.set("area", area);
    proxyUrl.searchParams.set("days", String(days));
    proxyUrl.searchParams.set("date", start);
    attempts.push({ url: proxyUrl.toString(), isProxy: true });
  }

  attempts.push({ url: directUrl, isProxy: false });
  return attempts;
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

function formatHttpError(status, message) {
  const detail = String(message || "").trim().replace(/\s+/g, " ").slice(0, 160);
  return detail ? `FIRMS HTTP ${status}: ${detail}` : `FIRMS HTTP ${status}`;
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
