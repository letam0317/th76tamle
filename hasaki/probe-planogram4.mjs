/** probe-planogram4.mjs — READ-ONLY: chot param loc dung (epoch ms) cho list schedule-requests. */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const EXT = "https://wms-gw-external.hasaki.vn/api/v1";
// 2026-07-24 00:00:00 .. 23:59:59 gio VN (UTC+7)
const from = Date.UTC(2026, 6, 23, 17, 0, 0);      // 24/7 00:00 VN
const to = Date.UTC(2026, 6, 24, 16, 59, 59) + 999; // 24/7 23:59 VN
const cands = [
  ["wh863 date-ms", `${EXT}/planogram/schedule-requests?page=1&size=8&company_ids=1001&warehouse_ids=863&from_date=${from}&to_date=${to}`],
  ["wh863 purpose1", `${EXT}/planogram/schedule-requests?page=1&size=8&company_ids=1001&warehouse_ids=863&from_date=${from}&to_date=${to}&purpose_types=1`],
  ["wh863 purpose2", `${EXT}/planogram/schedule-requests?page=1&size=8&company_ids=1001&warehouse_ids=863&from_date=${from}&to_date=${to}&purpose_types=2`],
];
const token = await layTokenSongWms(DIR, log);
if (!token) { log("✗ Khong token."); process.exit(2); }
const OUT = path.join(DIR, ".exports", "probe-planogram4.json"); const results = [];
for (const [ten, url] of cands) {
  try {
    const r = await fetch(url, { headers: { authorization: token, accept: "application/json" } });
    const txt = await r.text(); let js = null; try { js = JSON.parse(txt); } catch {}
    log(`[${r.status}] ${ten}  count=${js && js.count}`);
    if (js && js.records) js.records.slice(0, 6).forEach(x =>
      log(`     #${x.request_id} wh=${x.warehouse_id} st=${x.status_id} pur=${x.purpose_type} exec_by=${x.executed_by_name||"-"} at=${x.executed_at||"-"} loc=${x.location_description||"-"}`));
    results.push({ ten, url, status: r.status, count: js && js.count, body: txt.slice(0, 6000) });
  } catch (e) { log(`[ERR] ${ten}: ${e.message}`); }
}
fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
log("Da luu:", OUT); process.exit(0);
