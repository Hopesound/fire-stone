import { addDays, toDateInput } from "../utils/date.js";

export async function fetchFirmsArea({ mapKey, source, bbox, endDate, rangeDays }) {
  const chunks = buildFirmsChunks(endDate, rangeDays);
  const allRows = [];

  for (const chunk of chunks) {
    const area = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(
      mapKey
    )}/${source}/${area}/${chunk.days}/${chunk.start}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`FIRMS HTTP ${response.status}`);
    }
    const csv = await response.text();
    allRows.push(...parseFirmsCsv(csv, source));
  }

  return allRows;
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
