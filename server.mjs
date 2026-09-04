// Workflux production static server (zero dependencies).
// Serves the built SPA from ./dist with client-side-route fallback.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "dist");
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".webmanifest.json": "application/manifest+json",
  ".xml": "application/xml",
  ".webp": "image/webp",
  ".wasm": "application/wasm",
};

const server = createServer(async (req, res) => {
  try {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      pathname = "/";
    }
    if (pathname === "/") pathname = "/index.html";

    const filePath = normalize(join(root, pathname));
    // Guard against path traversal outside the dist root.
    const rootPrefix = root.endsWith(sep) ? root : root + sep;
    if (filePath !== root && !filePath.startsWith(rootPrefix)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    let file;
    try {
      file = await readFile(filePath);
    } catch {
      if (!extname(pathname)) {
        // SPA fallback for client-side routes (e.g. /login, /dashboard/...)
        file = await readFile(join(root, "index.html"));
      } else {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
    }

    const isHtml = filePath.endsWith(".html") || (file === undefined && false);
    res.writeHead(200, {
      "Content-Type": MIME[extname(filePath)] || "application/octet-stream",
      "Cache-Control": isHtml ? "no-cache" : "public, max-age=31536000, immutable",
      "Content-Disposition": "inline",
    });
    res.end(file);
  } catch {
    res.writeHead(500);
    res.end("Internal Server Error");
  }
});

server.listen(port, host, () => {
  console.log(`[workflux-web] serving ${root} on http://${host}:${port}`);
});
