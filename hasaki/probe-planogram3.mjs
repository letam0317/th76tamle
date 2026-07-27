/** probe-planogram3.mjs — READ-ONLY: chot endpoint LIST schedule-requests + ten param loc. */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const EXT = "https://wms-gw-external.hasaki.vn/api/v1";
const today = "2026-07-24";
const cands = [
  ["list plain", `${EXT}/planogram/schedule-requests?page=1&size=3`],
  ["list wh863", `${EXT}/planogram/schedule-requests?page=1&size=3&warehouse_id=863`],
  ["list wh+date", `${EXT}/planogram/schedule-requests?page=1&size=5&warehouse_id=863&request_time=${today}`],
  ["list wh+from/to", `${EXT}/planogram/schedule-requests?page=1&size=5&warehouse_id=863&from_date=${today}&to_date=${today}`],
  ["list wh+status3", `${EXT}/planogram/schedule-requests?page=1&size=5&warehouse_id=863&status_id=3`],
  ["list group", `${EXT}/planogram/schedule-requests?page=1&size=3&is_schedule_group=true`],
  ["schedule detail 508195", `${EXT}/planogram/schedule/location-schedules/detail/508195?page=1&size=3`],
];
const token = await layTokenSongWms(DIR, log);
if (!token) { log("✗ Khong token."); process.exit(2); }
const OUT = path.join(DIR, ".exports", "probe-planogram3.json"); const results = [];
for (const [ten, url] of cands) {
  try {
    const r = await fetch(url, { headers: { authorization: token, accept: "application/json" } });
    const txt = await r.text(); let js = null; try { js = JSON.parse(txt); } catch {}
    const cnt = js && (js.count != null ? js.count : (js.data && js.data.count));
    log(`[${r.status}] ${ten}  count=${cnt}`);
    if (r.status === 200) log("     " + txt.slice(0, 260).replace(/\s+/g, " "));
    results.push({ ten, url, status: r.status, count: cnt, body: txt.slice(0, 5000) });
  } catch (e) { log(`[ERR] ${ten}: ${e.message}`); }
}
fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
log("Da luu:", OUT); process.exit(0);
