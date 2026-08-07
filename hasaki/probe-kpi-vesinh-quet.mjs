/** probe-kpi-vesinh-quet.mjs — READ-ONLY: quét TOÀN BỘ nhân sự kho 398 (SHOP-170 QUOC LO 1A)
 *  xem ai có mục KPI COS-KPI-007-T14 "Thời gian vệ sinh cửa hàng" > 0 trong tháng.
 *  Chạy: node probe-kpi-vesinh-quet.mjs [YYYY-MM] [--majors=26,103]  (mặc định tháng hiện tại) */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWork } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const OUT = path.join(DIR, ".exports");
const THANG = (process.argv.find(a => /^\d{4}-\d{2}$/.test(a)) || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).slice(0, 7));
const majorsArg = (process.argv.find(a => a.startsWith("--majors=")) || "").split("=")[1];
const LOC = 398, MA_KPI = "COS-KPI-007-T14";
const work = await layTokenSongWork(DIR, log);
if (!work) { log("✗ Thiếu token work/hr — dừng."); process.exit(2); }
const HH = { authorization: work, accept: "application/json" };
const V1 = "https://wshr.hasaki.vn/api";
const gj = async (u, ms = 90000) => {
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(u, { headers: HH, signal: ac.signal }); const t = await r.text(); clearTimeout(to); let j = null; try { j = JSON.parse(t); } catch { } return { s: r.status, j }; }
  catch (e) { clearTimeout(to); return { s: "ERR " + e.name, j: null }; }
};

const dir = (await gj(`${V1}/news/staff/search-for-dropdown?limit=10000&sort=staff_id`)).j?.data || [];
const tai398 = dir.filter(s => String(s.staff_loc_id) === String(LOC) || String(s.working_loc_id) === String(LOC));
const theoMajor = {};
for (const s of tai398) theoMajor[s.major_id] = (theoMajor[s.major_id] || 0) + 1;
log(`Danh bạ: ${dir.length} NV · tại kho ${LOC}: ${tai398.length}`);
log("  theo nghiệp vụ: " + Object.entries(theoMajor).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m}=${n}`).join("  "));
const majors = majorsArg ? majorsArg.split(",") : Object.keys(theoMajor);
const quet = tai398.filter(s => majors.includes(String(s.major_id)));
log(`Sẽ quét ${quet.length} NV (nghiệp vụ ${majors.join(",")}) · tháng ${THANG} · tìm ${MA_KPI}`);

const co = [], khong = [], loi = [];
for (let i = 0; i < quet.length; i++) {
  const s = quet[i];
  const ss = await gj(`${V1}/hr/sheet-summary?from_date=${THANG}-01&to_date=${THANG}-31&staff_id=${s.staff_id}&limit=50`);
  const b = (ss.j?.data?.rows || []).filter(r => String(r.month || "").startsWith(THANG))[0];
  if (ss.s !== 200) { loi.push({ s, vi: "HTTP " + ss.s }); }
  else if (!b) { khong.push({ s, vi: "không có bảng KPI tháng" }); }
  else {
    const t14 = b.kpis?.[MA_KPI];
    if (t14 && Number(t14.kpi) > 0) {
      const giay = Number(t14.value?.Asset_Schedule_Declaration_Time_Personal || 0);
      co.push({ s, giay, gio: Number(t14.kpi), final: b.final_kpi });
      log(`  ✓ ${s.staff_email} · ${s.staff_name} · major ${s.major_id} → ${giay}s = ${t14.kpi}h  (final_kpi ${b.final_kpi})`);
    } else khong.push({ s, vi: t14 ? "có mục nhưng = " + t14.kpi : "không có mục" });
  }
  if ((i + 1) % 20 === 0) log(`  … ${i + 1}/${quet.length}`);
}
log(`\n⇒ CHỐT tháng ${THANG}, kho ${LOC} (SHOP-170 QUOC LO 1A):`);
log(`   ${co.length} người ĐƯỢC CỘNG KPI qua ${MA_KPI}; ${khong.length} người không; ${loi.length} lỗi truy vấn.`);
co.sort((a, b) => b.giay - a.giay).forEach(x => log(`   ${x.s.staff_email} · ${x.s.staff_name} · code ${x.s.code} · major ${x.s.major_id} · ${x.giay}s = ${x.gio}h`));
const tongGiay = co.reduce((t, x) => t + x.giay, 0);
log(`   Tổng: ${tongGiay}s = ${(tongGiay / 3600).toFixed(2)}h  ⇒ ${Math.round(tongGiay / 600)} lượt khai báo (600s/lượt).`);
const nhomKhong = {};
for (const k of khong) nhomKhong[k.vi] = (nhomKhong[k.vi] || 0) + 1;
log("   lý do không có: " + JSON.stringify(nhomKhong));
fs.writeFileSync(path.join(OUT, `probe-kpi-quet-${THANG}.json`), JSON.stringify({ thang: THANG, loc: LOC, maKpi: MA_KPI, co: co.map(x => ({ email: x.s.staff_email, ten: x.s.staff_name, code: x.s.code, major: x.s.major_id, giay: x.giay, gio: x.gio, final_kpi: x.final })), soKhong: khong.length, loi: loi.map(x => x.s.staff_email) }, null, 1));
process.exit(0);
