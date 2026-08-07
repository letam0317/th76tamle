/**
 * probe-kpi-vesinh-kho.mjs — READ-ONLY: đối soát CUỐI CÙNG.
 * 170 QUOC LO 1A (HR location_id 398) gồm NHIỀU kho planogram (SHOP + WH KT1..KT8 + KT HN1/HN2).
 * Gộp phiếu vệ sinh ĐÃ BÁO CÁO (status 3+4) của TẤT CẢ kho đó trong tháng, so với KPI
 * COS-KPI-007-T14 (Asset_Schedule_Declaration_Time_Personal, giây).
 * Chạy: node probe-kpi-vesinh-kho.mjs [YYYY-MM]
 */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(...a);
const OUT = path.join(DIR, ".exports");
const THANG = process.argv[2] || "2026-07";
const LOC_HR = 398;
const T0 = new Date(THANG + "-01T00:00:00+07:00").getTime();
const d0 = new Date(T0); const T1 = new Date(d0.getFullYear(), d0.getMonth() + 1, 1).getTime() - 1;
const wms = await layTokenSongWms(DIR, () => { });
const HW = { authorization: wms, accept: "application/json", "Company-Ids": "1001" };
const EX = "https://wms-gw-external.hasaki.vn/api/v1";
const gj = async (u, ms = 120000) => { const ac = new AbortController(); const to = setTimeout(() => ac.abort(), ms); try { const r = await fetch(u, { headers: HW, signal: ac.signal }); const t = await r.text(); clearTimeout(to); let j = null; try { j = JSON.parse(t); } catch { } return { s: r.status, j }; } catch (e) { clearTimeout(to); return { s: "ERR " + e.name, j: null }; } };

/* 1) mọi kho planogram thuộc HR location 398 */
let khos = [];
try { khos = JSON.parse(fs.readFileSync(path.join(OUT, "probe-kpi-khos.json"), "utf8")); }
catch { khos = (await gj(`${EX}/wms/master-data/warehouse/by-user?types=SPA,WH,SHOP&page=1&size=1000`)).j?.records || []; fs.writeFileSync(path.join(OUT, "probe-kpi-khos.json"), JSON.stringify(khos, null, 1)); }
const cua398 = khos.filter(k => String(k.location_id) === String(LOC_HR));
log(`170 QUOC LO 1A (HR location ${LOC_HR}) gồm ${cua398.length} kho planogram:`);
cua398.forEach(k => log(`   wh ${k.warehouse_id} · code ${k.warehouse_code} · ${k.type} · ${k.warehouse_name} (status ${k.status})`));

/* 2) gộp phiếu đã báo cáo của tất cả kho đó */
const CACHE = path.join(OUT, "probe-kpi-duration-cache.json");
let dur = {}; try { dur = JSON.parse(fs.readFileSync(CACHE, "utf8")); } catch { }
const tatCa = [];
for (const k of cua398) {
  const rows = [];
  for (let page = 1; page <= 100; page++) {
    const { s, j } = await gj(`${EX}/planogram/schedule-requests?company_ids=1001&warehouse_ids=${k.warehouse_id}&from_date=${T0}&to_date=${T1}&page=${page}&size=200`);
    const r = j?.records || []; if (s !== 200) break; rows.push(...r); if (r.length < 200) break;
  }
  const bc = rows.filter(p => p.executed_by_name && [3, 4].includes(Number(p.status_id)));
  log(`   wh ${k.warehouse_id} ${k.warehouse_name}: ${rows.length} phiếu · ${bc.length} đã báo cáo`);
  tatCa.push(...bc);
}
log(`⇒ tổng phiếu ĐÃ BÁO CÁO cả site trong ${THANG}: ${tatCa.length}`);

const can = [...new Set(tatCa.map(p => p.schedule_id))].filter(id => dur[id] == null);
if (can.length) {
  log(`   tra duration ${can.length} lịch mới...`);
  for (let i = 0; i < can.length; i++) { const { j } = await gj(`${EX}/planogram/schedule/location-schedules/detail/${can[i]}`, 45000); dur[can[i]] = Number(j?.item?.duration || 0); }
  fs.writeFileSync(CACHE, JSON.stringify(dur));
}

/* 3) đối soát với KPI */
const kpi = {}; for (const x of JSON.parse(fs.readFileSync(path.join(OUT, `probe-kpi-quet-${THANG}.json`), "utf8")).co) kpi[x.email.toLowerCase()] = x;
const gop = {};
for (const p of tatCa) { const k = String(p.executed_by_name).toLowerCase(); gop[k] = gop[k] || { n: 0, giay: 0, kho: new Set() }; gop[k].n++; gop[k].giay += dur[p.schedule_id] || 0; gop[k].kho.add(p.warehouse_name); }
log(`\n═══ Đối soát ${Object.keys(kpi).length} người có KPI > 0 (tháng ${THANG}) ═══`);
let khop = 0, lech = 0;
for (const [k, x] of Object.entries(kpi).sort((a, b) => b[1].giay - a[1].giay)) {
  const v = gop[k]; const ok = v && v.giay === x.giay;
  ok ? khop++ : lech++;
  log(`   ${k.padEnd(26)} KPI ${String(x.giay).padStart(6)}s (${String(x.gio).padStart(5)}h) | phiếu ${v ? String(v.n).padStart(3) + " → " + String(v.giay).padStart(6) + "s" : "  0 →      0s"} ${ok ? "✓" : "✗ lệch " + (x.giay - (v ? v.giay : 0)) + "s"}`);
}
log(`\n⇒ khớp ${khop}/${Object.keys(kpi).length} · lệch ${lech}`);
const chiPhieu = Object.keys(gop).filter(k => !kpi[k]);
if (chiPhieu.length) log(`⚠ CÓ báo cáo nhưng KHÔNG được cộng KPI (${chiPhieu.length}): ` + chiPhieu.map(k => k + "=" + gop[k].n + " phiếu").join("  "));
fs.writeFileSync(path.join(OUT, `probe-kpi-doisoat-site-${THANG}.json`), JSON.stringify({ thang: THANG, khos: cua398.map(k => ({ id: k.warehouse_id, ten: k.warehouse_name })), soPhieuBaoCao: tatCa.length, khop, lech, chiPhieu }, null, 1));
process.exit(0);
