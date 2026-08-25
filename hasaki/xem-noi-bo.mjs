/**
 * xem-noi-bo.mjs — TRANG DUYỆT BẢN NỘI BỘ trước khi push live (yêu cầu user 23/08/2026:
 * "hoàn tất cải tiến thì cho xem bản nội bộ trước khi push live / commit lên link").
 *
 * Phục vụ THẲNG file trên đĩa (bản đã sửa, CHƯA push) qua HTTP nội bộ:
 *   · máy này  : http://localhost:8123/factory/          (Audit Factory)
 *                http://localhost:8123/kiemsoatkho/      (Kiểm soát kho 5S)
 *   · điện thoại (cùng Wi-Fi): thay localhost bằng IP LAN in ra bên dưới.
 * gviz + Apps Script gọi được bình thường (JSONP/CORS *), nên trang nội bộ chạy với DỮ LIỆU THẬT.
 * Service worker chỉ đăng ký trên localhost/https — xem qua IP LAN thì SW không chạy (đúng chủ đích,
 * bản duyệt không được cache đè bản live).
 *
 * Chạy: node xem-noi-bo.mjs   (Ctrl+C để tắt — hoặc dùng XEM-BAN-NOI-BO.bat)
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));      // hasaki/
const GOC = path.resolve(DIR, "..");                            // thư mục dự án
const PORT = Number(process.env.NOIBO_PORT || 8123);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".pdf": "application/pdf" };

// Chỉ phục vụ 2 thư mục dashboard — không mở cả ổ đĩa (hasaki/ có .env, log, PII)
const CHO_PHEP = { factory: path.join(GOC, "factory"), kiemsoatkho: path.join(GOC, "hasaki", "kiemsoatkho") };

const server = http.createServer((req, res) => {
  try {
    const u = decodeURIComponent((req.url || "/").split("?")[0]);
    const m = u.match(/^\/(factory|kiemsoatkho)(\/.*)?$/);
    if (!m) {
      res.writeHead(302, { Location: "/factory/" });
      return res.end();
    }
    const goc = CHO_PHEP[m[1]];
    let rel = (m[2] || "/").replace(/\/+$/, "/");
    if (rel === "/" || rel === "") rel = "/index.html";
    const file = path.normalize(path.join(goc, rel));
    if (!file.startsWith(goc)) { res.writeHead(403); return res.end("403"); }   // chặn ../
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("404 " + rel); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store" });   // bản duyệt LUÔN đọc từ đĩa — sửa file là F5 thấy ngay
    fs.createReadStream(file).pipe(res);
  } catch (e) { res.writeHead(500); res.end(String(e && e.message || e)); }
});

server.listen(PORT, () => {
  const ips = Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
  console.log("BẢN NỘI BỘ đang phục vụ (Ctrl+C để tắt):");
  console.log("  Máy này     : http://localhost:" + PORT + "/factory/   ·   http://localhost:" + PORT + "/kiemsoatkho/");
  ips.forEach((ip) => console.log("  Điện thoại  : http://" + ip + ":" + PORT + "/factory/   (cùng Wi-Fi; nếu không vào được thì Windows Firewall đang chặn cổng " + PORT + ")"));
});
