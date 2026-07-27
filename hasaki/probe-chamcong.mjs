/** probe-chamcong.mjs — READ-ONLY: tim location/major SHOP-170 + kiem chung timesheet qua token bridge. */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const token = await layTokenSongWms(DIR, log);
if (!token) { log("✗ Khong token."); process.exit(2); }
const H = { authorization: token };

// 1) Danh ba wshr -> tra executor emails ve loc/major/dept
const dir = (await (await fetch("https://wshr.hasaki.vn/api/news/staff/search-for-dropdown?limit=10000&sort=staff_id", { headers: H })).json()).data || [];
const byEmail = {}; for (const s of dir) if (s.staff_email) byEmail[String(s.staff_email).toLowerCase()] = s;
const probe = JSON.parse(fs.readFileSync(path.join(DIR, ".exports", "probe-phutrach.json"), "utf8"));
const emails = probe.emails || [];
const cntLoc = {}, cntWloc = {}, cntMajor = {}, cntDept = {};
let sampled = 0;
for (const e of emails) {
  const s = byEmail[e.toLowerCase()]; if (!s) continue; sampled++;
  cntLoc[s.staff_loc_id] = (cntLoc[s.staff_loc_id] || 0) + 1;
  cntWloc[s.working_loc_id] = (cntWloc[s.working_loc_id] || 0) + 1;
  cntMajor[s.major_id] = (cntMajor[s.major_id] || 0) + 1;
  cntDept[s.staff_dept_id] = (cntDept[s.staff_dept_id] || 0) + 1;
}
const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => k + ":" + v).join("  ");
log("Executor sampled:", sampled, "/", emails.length);
log("staff_loc_id   :", top(cntLoc));
log("working_loc_id :", top(cntWloc));
log("major_id       :", top(cntMajor));
log("staff_dept_id  :", top(cntDept));
log("Field mau 1 executor:", JSON.stringify(Object.fromEntries(Object.entries(byEmail[emails[0].toLowerCase()] || {}).filter(([k]) => /loc|major|dept|title|code|name|email/i.test(k)))));

// 2) Kiem chung timesheet qua token bridge (location suy ra tu tren)
const LOC = Object.entries(cntWloc).sort((a, b) => b[1] - a[1])[0]?.[0];
const today = "2026-07-24";
log("\n== Thu timesheet (working_loc_id=" + LOC + ", " + today + ") ==");
for (const q of [
  `https://wshr.hasaki.vn/api/hr/timesheet?location_id=${LOC}&from_date=${today}&to_date=${today}&limit=5&offset=0`,
  `https://wshr.hasaki.vn/api/hr/timesheet?location_id=${LOC}&from_date=${today}&to_date=${today}&limit=2000&offset=0`,
]) {
  try {
    const r = await fetch(q, { headers: H }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
    const rows = j && j.data && j.data.rows;
    log(`[${r.status}] rows=${rows ? rows.length : "?"} total=${j && j.data && j.data.total}`);
    if (rows && rows[0]) log("  mau: " + JSON.stringify(rows[0]).slice(0, 400));
  } catch (e) { log("  ERR " + e.message); }
}
fs.writeFileSync(path.join(DIR, ".exports", "probe-chamcong.json"), JSON.stringify({ cntLoc, cntWloc, cntMajor, cntDept, LOC }, null, 2));
process.exit(0);
