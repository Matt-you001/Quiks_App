import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";

const variant = process.argv[2] ?? "children";
const port = Number(process.argv[3] ?? 4173);
if (!["children", "teens", "uni"].includes(variant) || !Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("Usage: node scripts/preview-hosting.mjs children|teens|uni [port]");
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "web-hosting", variant);
const mime = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2", ".mp3": "audio/mpeg" };
await stat(resolve(root, "index.html"));
http.createServer(async (req, res) => {
  if (!["GET", "HEAD"].includes(req.method)) { res.writeHead(405).end(); return; }
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    let file = resolve(root, "." + decodeURIComponent(url.pathname));
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const info = await stat(file);
    if (info.isDirectory()) {
      if (!url.pathname.endsWith("/")) { res.writeHead(302, { Location: url.pathname + "/" + url.search }).end(); return; }
      file = resolve(file, "index.html");
    }
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch { res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found"); }
}).listen(port, "127.0.0.1", () => console.log(`Quiks ${variant}: http://localhost:${port}/ — backend: quiks-app.onrender.com. Press Ctrl+C to stop.`));
