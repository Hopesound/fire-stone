import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const port = Number(process.argv[2] || 5173);
const root = normalize(process.cwd());
const rootPrefix = `${root}${process.platform === "win32" ? "\\" : "/"}`;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);

  if (url.pathname === "/api/firms/area") {
    await proxyFirmsArea(url, response);
    return;
  }

  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = normalize(join(root, requestedPath));

  if (
    (filePath !== root && !filePath.startsWith(rootPrefix)) ||
    !existsSync(filePath) ||
    !statSync(filePath).isFile()
  ) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": types[extname(filePath)] || "application/octet-stream"
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, "127.0.0.1");

async function proxyFirmsArea(url, response) {
  const mapKey = url.searchParams.get("mapKey") || "";
  const source = url.searchParams.get("source") || "";
  const area = url.searchParams.get("area") || "";
  const days = Number(url.searchParams.get("days") || 0);
  const date = url.searchParams.get("date") || "";

  if (!mapKey || !source || !area || !Number.isInteger(days) || days < 1 || days > 10 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    response.end("Missing or invalid FIRMS proxy parameters");
    return;
  }

  const firmsUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(
    mapKey
  )}/${encodeURIComponent(source)}/${encodeURIComponent(area)}/${days}/${date}`;

  try {
    const upstream = await fetch(firmsUrl, {
      headers: { Accept: "text/csv" }
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, {
      "content-type": upstream.headers.get("content-type") || "text/csv; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(body);
  } catch (error) {
    response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    response.end(`FIRMS proxy failed: ${error.message}`);
  }
}
