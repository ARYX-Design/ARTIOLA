// Local preview: serves the site and the /api functions like Vercel does.
//   ADMIN_PASSWORD=yourpassword npm run dev   → http://localhost:3000
// Bookings are stored in .data/bookings.json when no Redis is configured.
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);
const port = Number(process.env.PORT) || 3000;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    const api = url.pathname.match(/^\/api\/([a-z-]+)$/);
    if (api) {
      const mod = await import(path.join(root, "api", api[1] + ".js"));
      return await mod.default(req, res);
    }
    let file = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
    if (!file.startsWith(root) || /\/(\.|api\/|node_modules)/.test(file.slice(root.length))) { res.writeHead(404); return res.end("Not found"); }
    const stat = await fs.stat(file).catch(() => null);
    if (stat?.isDirectory()) file = path.join(file, "index.html");
    else if (!stat) file += ".html";
    const body = await fs.readFile(file);
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch (err) {
    if (err.code !== "ENOENT") console.error(err);
    res.writeHead(err.code === "ENOENT" ? 404 : 500); res.end(err.code === "ENOENT" ? "Not found" : "Server error");
  }
}).listen(port, () => console.log(`Artiola running at http://localhost:${port}`));
