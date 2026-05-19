const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type, accept"
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "GET") {
      return textResponse("Method not allowed", 405);
    }

    const url = new URL(request.url);
    const mapKey = url.searchParams.get("mapKey") || env.FIRMS_MAP_KEY || "";
    const source = url.searchParams.get("source") || "";
    const area = url.searchParams.get("area") || "";
    const days = Number(url.searchParams.get("days") || 0);
    const date = url.searchParams.get("date") || "";

    if (
      !mapKey ||
      !source ||
      !area ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > 10 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      return textResponse("Missing or invalid FIRMS proxy parameters", 400);
    }

    const firmsUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(
      mapKey
    )}/${encodeURIComponent(source)}/${encodeURIComponent(area)}/${days}/${date}`;
    const upstream = await fetch(firmsUrl, {
      headers: { accept: "text/csv" }
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...CORS_HEADERS,
        "cache-control": "no-store",
        "content-type": upstream.headers.get("content-type") || "text/csv; charset=utf-8"
      }
    });
  }
};

function textResponse(message, status) {
  return new Response(message, {
    status,
    headers: {
      ...CORS_HEADERS,
      "content-type": "text/plain; charset=utf-8"
    }
  });
}
