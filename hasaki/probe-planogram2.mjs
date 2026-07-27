/** probe-planogram2.mjs — READ-ONLY: chot endpoint request-of-declaration + list report.
 *  Chi GET, khong dang nhap, khong tao phien. */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ID = process.argv[2] || "23632957";
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const EXT = "https://wms-gw-external.hasaki.vn/api/v1";

const cands = [
  // request detail (URL id = request_id) — cac bien the ten
  ["req-detail A", `${EXT}/planogram/schedule/location-schedule-requests/detail/${ID}`],
  ["req-detail B", `${EXT}/planogram/schedule/location-schedules/request/detail/${ID}`],
  ["req-detail C", `${EXT}/planogram/schedule/location-schedules/request/${ID}`],
  ["req-detail D", `${EXT}/planogram/schedule/requests/detail/${ID}`],
  ["req-detail E", `${EXT}/planogram/schedule/location-schedules/requests/${ID}`],
  ["req-detail F", `${EXT}/planogram/schedule/location-schedule-requests/${ID}`],
  // request LIST — noi tab se doc report da nop
  ["req-list A", `${EXT}/planogram/schedule/location-schedule-requests?page=1&size=3`],
  ["req-list B", `${EXT}/planogram/schedule/location-schedules/requests?page=1&size=3`],
  ["req-list C", `${EXT}/planogram/schedule/requests?page=1&size=3`],
  ["req-list D", `${EXT}/planogram/schedule/location-schedules/request/list?page=1&size=3`],
  // list schedule loc theo warehouse + purpose (dò ten param loc)
  ["sched by purpose=1", `${EXT}/planogram/schedule/location-schedules?page=1&size=2&purpose_type=1`],
  ["warehouse by-user", `${EXT}/wms/master-data/warehouse/by-user?page=1&size=500`],
];

const token = await layTokenSongWms(DIR, log);
if (!token) { log("✗ Khong co token phien song. Dung."); process.exit(2); }

const OUT = path.join(DIR, ".exports", "probe-planogram2.json");
const results = [];
for (const [ten, url] of cands) {
  try {
    const r = await fetch(url, { headers: { authorization: token, accept: "application/json" } });
    const txt = await r.text();
    log(`[${r.status}] ${ten}  ${txt.length>2?"":"(rong)"}`);
    if (r.status === 200) log("       " + txt.slice(0, 240).replace(/\s+/g, " "));
    results.push({ ten, url, status: r.status, body: txt.slice(0, 6000) });
  } catch (e) { log(`[ERR] ${ten}: ${e.message}`); results.push({ ten, url, error: e.message }); }
}
fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), id: ID, results }, null, 2));
log("Da luu:", OUT);
process.exit(0);
