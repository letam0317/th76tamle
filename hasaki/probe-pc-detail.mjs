/**
 * probe-pc-detail.mjs — KIỂM CHỨNG (read-only) endpoint API DETAIL của phiếu physical-count.
 *
 * Trang FE: wms.inshasaki.com/physical-count/result/location/{checklist_id}?page=1&size=20
 * List đã có (checklists/type-location) nhưng KHÔNG có dòng SKU bên trong phiếu — dò xem
 * API nào trả các dòng detail (No/Location/SKU/Product name/Qty count/Inventory/Diff/Status).
 *
 * CHỈ GET bằng token phiên sống (kho token / bridge) — không đăng nhập, không đá phiên ai.
 *   node probe-pc-detail.mjs [checklist_id]   (mặc định 768840)
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ID = process.argv[2] || "768840";
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

const GW = "https://wms-gw.inshasaki.com/api/v1/wms";
const Q = "?page=1&size=20";
/* Bundle SPA (index-a02da192.js — trang result/location/:id) dùng hook query
   "/wms/counting-plan/checklist/tracking" với params {checklist_id, page, size};
   sửa qty gọi ".../checklist/tracking/update" body {checklist_id, tracking_id, qty_by_user, exp_by_user}. */
const endpoints = [
  ["checklist/tracking?checklist_id", `${GW}/counting-plan/checklist/tracking${Q}&checklist_id=${ID}`],
  ["checklists/type-location + checklist_id (đối chứng header phiếu)", `${GW}/counting-plan/checklists/type-location${Q}&checklist_id=${ID}`],
];

const token = await layTokenSongWms(DIR, log);
if (!token) { log("✗ Khong co token phien song (kho + bridge deu rong). Dung lai — khong dang nhap moi."); process.exit(2); }

const OUT = path.join(DIR, ".exports", "probe-pc-detail.json");
const results = [];
for (const [ten, url] of endpoints) {
  try {
    const r = await fetch(url, { headers: { authorization: token, accept: "application/json" } });
    const txt = await r.text();
    let js = null; try { js = JSON.parse(txt); } catch {}
    log(`[${r.status}] ${ten}`);
    results.push({ ten, url, status: r.status, body: txt.slice(0, 6000) });
    if (r.status === 200 && js) {
      const d = js.data || js;
      const recs = d.records || d.rows || d.content || (Array.isArray(d) ? d : null);
      log("       keys: " + Object.keys(d).slice(0, 20).join(", "));
      if (recs && recs[0]) log("       record[0] keys: " + Object.keys(recs[0]).join(", "));
    }
  } catch (e) { log(`[ERR] ${ten}: ${e.message}`); results.push({ ten, url, error: e.message }); }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), id: ID, results }, null, 2));
log("Da luu:", OUT);
process.exit(0);
