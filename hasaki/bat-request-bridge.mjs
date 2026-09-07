/** bat-request-bridge.mjs — LISTENER CỤC BỘ để bắt payload request từ extension wms-bridge.
 *  Extension (bản có thêm móc CAPTURE tạm) đẩy MỌI request KHÁC GET tới wshr.hasaki.vn về đây,
 *  ta ghi ra .exports/bridge-captured.json để đọc payload thao tác "điều hướng" trên web thật —
 *  KHÔNG cần đăng nhập lại (dùng đúng phiên sống của operator qua extension).
 *
 *  Chạy nền, để mở trong lúc bạn bấm "điều hướng" 1 task trên Edge. Ctrl+C để dừng.
 *  Chỉ nghe 127.0.0.1 (không mở ra mạng).
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, ".exports", "bridge-captured.json");
const PORT = 8799;
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
let items = [];
try { items = JSON.parse(fs.readFileSync(OUT, "utf8")).items || []; } catch { /* file mới */ }

const server = http.createServer((req, res) => {
  // CORS mở cho fetch từ service worker extension (origin chrome-extension://…)
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  if (req.method !== "POST") { res.writeHead(200); return res.end("bat-request-bridge OK"); }
  let body = "";
  req.on("data", (c) => { body += c; if (body.length > 5e6) req.destroy(); });
  req.on("end", () => {
    let ev = null; try { ev = JSON.parse(body); } catch { ev = { _raw: body.slice(0, 2000) }; }
    ev.at = new Date().toISOString();
    items.push(ev);
    try { fs.writeFileSync(OUT, JSON.stringify({ updatedAt: ev.at, items }, null, 1)); } catch (e) { log("ghi lỗi:", e.message); }
    const u = String(ev.url || "").replace(/^https?:\/\/wshr\.hasaki\.vn/, "");
    log("● " + (ev.method || "?") + " " + u.slice(0, 90) + (ev.body ? "  body: " + String(ev.body).slice(0, 200) : ""));
    res.writeHead(200); res.end("ok");
  });
});
server.listen(PORT, "127.0.0.1", () => {
  log("Listener bắt request bridge: http://127.0.0.1:" + PORT + "  → ghi " + OUT);
  log("→ Reload extension trong edge://extensions rồi BẤM ĐIỀU HƯỚNG 1 task trên web. Ctrl+C để dừng.");
});
