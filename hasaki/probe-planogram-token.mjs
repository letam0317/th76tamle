/**
 * probe-planogram-token.mjs — KIỂM CHỨNG (read-only) feasibility đọc dữ liệu planogram.
 *
 * CHỈ GET, KHÔNG đăng nhập, KHÔNG tạo phiên → không đá phiên ai (an toàn tuyệt đối).
 * Lấy token phiên SỐNG của operator qua kênh chung (kho token / bridge — session-rules.js),
 * rồi thử GET vài endpoint trên wms-gw-external.hasaki.vn để xem token WMS nội bộ có
 * được cổng external chấp nhận không, và trả về data khai báo vệ sinh dạng gì.
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ID = process.argv[2] || "23632957";
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

const EXT = "https://wms-gw-external.hasaki.vn/api/v1";
const endpoints = [
  ["get-me (external)", `${EXT}/auth/user/get-me`],
  ["detail location-schedules (id=schedule)", `${EXT}/planogram/schedule/location-schedules/detail/${ID}?page=1&size=20`],
  ["detail + is_view_schedule", `${EXT}/planogram/schedule/location-schedules/detail/${ID}?page=1&size=20&is_view_schedule=true`],
  ["detail as request_id (schedule=?)", `${EXT}/planogram/schedule/location-schedules/detail/0?page=1&size=20&request_id=${ID}`],
  ["list location-schedules", `${EXT}/planogram/schedule/location-schedules?page=1&size=5`],
  ["standard-evaluates", `${EXT}/planogram/standard-evaluates/list?page=1&size=5`],
];

const token = await layTokenSongWms(DIR, log);
if (!token) { log("✗ Khong co token phien song (kho + bridge deu rong). Dung lai — khong dang nhap moi."); process.exit(2); }

const OUT = path.join(DIR, ".exports", "probe-planogram.json");
const results = [];
for (const [ten, url] of endpoints) {
  try {
    const r = await fetch(url, { headers: { authorization: token, accept: "application/json" } });
    const txt = await r.text();
    let js = null; try { js = JSON.parse(txt); } catch {}
    log(`[${r.status}] ${ten}`);
    results.push({ ten, url, status: r.status, body: txt.slice(0, 4000) });
    if (r.status === 200 && js) {
      const keys = js && js.data ? Object.keys(js.data) : Object.keys(js || {});
      log("       keys: " + keys.slice(0, 20).join(", "));
    }
  } catch (e) { log(`[ERR] ${ten}: ${e.message}`); results.push({ ten, url, error: e.message }); }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), id: ID, results }, null, 2));
log("Da luu:", OUT);
process.exit(0);
