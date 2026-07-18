/**
 * dev-server.mjs — Static server nội bộ cho BẢN NHÁP portal kiemsoatkho.
 *  Vì sao: chạy qua file:/// bị trình duyệt chặn fetch file tĩnh tương đối (summary/*.json)
 *  → bẫy CORS âm thầm. Server này phục vụ thư mục kiemsoatkho/ tại http://localhost:8080.
 *
 *  Chạy:  node dev-server.mjs          (hoặc bấm DEV-KIEMSOATKHO.bat)
 *  Mở:    http://localhost:8080/?company=factory&tab=fstock&dev=1
 *  (?dev=1 → module chặn nút sync production, hiện badge DEV)
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GOC = path.join(path.dirname(fileURLToPath(import.meta.url)), "kiemsoatkho");
const PORT = Number(process.env.PORT || 8080);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

http.createServer((req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    const file = path.normalize(path.join(GOC, p));
    if (!file.startsWith(GOC)) { res.writeHead(403); res.end("403"); return; }   // chặn path traversal
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("404 " + p); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
  } catch (e) { res.writeHead(500); res.end(String(e.message)); }
}).listen(PORT, () => {
  console.log("Dev server: http://localhost:" + PORT + "/?company=factory&tab=fstock&dev=1");
  console.log("(Ctrl+C để tắt — phục vụ thư mục " + GOC + ")");
});
