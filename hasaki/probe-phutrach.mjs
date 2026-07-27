/** probe-phutrach.mjs — READ-ONLY: kiem chung nguon cho sheet "Phu trach quay ke".
 *  (1) endpoint tra Code+Name tu email executed_by  (2) phu song executor F0-A1/F0-A8 theo cua so ngay. */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const EXT = "https://wms-gw-external.hasaki.vn/api/v1";
const token = await layTokenSongWms(DIR, log);
if (!token) { log("✗ Khong token."); process.exit(2); }
const H = { authorization: token, accept: "application/json", "Company-Ids": "1001" };
const g = async (u) => { const r = await fetch(u, { headers: H }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { s: r.status, t, j }; };

// (1) cac endpoint HR ung vien
log("=== HR lookup endpoints ===");
for (const u of [
  `${EXT}/planogram/hr?page=1&size=3`,
  `${EXT}/planogram/hr?page=1&size=3&keyword=duonglt`,
  `${EXT}/wms/master-data/staff?page=1&size=3`,
]) {
  const { s, t } = await g(u);
  log(`[${s}] ${u.replace(EXT, "")}`);
  if (s === 200) log("     " + t.slice(0, 320).replace(/\s+/g, " "));
}

// (2) cua so 40 ngay, quet toan bo request SHOP-170 (ca 2 purpose), gom executor theo location F0-A1/F0-A8
log("\n=== Phu song executor F0-A1 / F0-A8 (40 ngay) ===");
const DAY = 24 * 3600 * 1000;
const to = Date.UTC(2026, 6, 24, 16, 59, 59) + 999;
const from = to - 40 * DAY;
const byLoc = {}; let page = 1, total = 0, scanned = 0;
for (; page <= 60; page++) {
  const { s, j } = await g(`${EXT}/planogram/schedule-requests?company_ids=1001&warehouse_ids=863&from_date=${from}&to_date=${to}&page=${page}&size=200`);
  if (s !== 200 || !j || !j.records || !j.records.length) { total = j && j.count; break; }
  for (const r of j.records) {
    scanned++;
    const loc = String(r.location_description || "");
    if (!/^F0-A1|^F0-A8/.test(loc)) continue;
    if (!r.executed_by_name) continue;
    const cur = byLoc[loc];
    const at = r.executed_at || "";
    if (!cur || at > cur.at) byLoc[loc] = { at, email: r.executed_by_name, by: r.executed_by, pur: r.purpose_type };
  }
  if (j.records.length < 200) { total = j.count; break; }
}
const locs = Object.keys(byLoc).sort();
const a1 = locs.filter(l => l.startsWith("F0-A1")).length, a8 = locs.filter(l => l.startsWith("F0-A8")).length;
log(`Quet ${scanned} request (count server=${total}). Vi tri co executor: ${locs.length} (F0-A1=${a1}, F0-A8=${a8}).`);
log("Vi du 12 dong:");
locs.slice(0, 12).forEach(l => log(`  ${l}  <=  ${byLoc[l].email}  (pur ${byLoc[l].pur}, ${byLoc[l].at})`));
const emails = [...new Set(locs.map(l => byLoc[l].email))];
log(`So executor phan biet: ${emails.length} -> ${emails.slice(0, 15).join(", ")}`);
fs.writeFileSync(path.join(DIR, ".exports", "probe-phutrach.json"), JSON.stringify({ at: new Date().toISOString(), byLoc, emails }, null, 2));
log("Da luu .exports/probe-phutrach.json");
process.exit(0);
