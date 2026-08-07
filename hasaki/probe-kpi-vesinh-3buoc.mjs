/**
 * probe-kpi-vesinh-3buoc.mjs — READ-ONLY: KPI vệ sinh theo 3 BƯỚC của 1 yêu cầu
 *   (1) chưa hoàn tất  (2) đã báo cáo, chờ duyệt  (3) đã duyệt  — và trường hợp BỊ TỪ CHỐI.
 * Chạy: node probe-kpi-vesinh-3buoc.mjs [request_id] [email] [YYYY-MM]
 */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms, layTokenSongWork } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(...a);
const OUT = path.join(DIR, ".exports");
const RID = process.argv[2] || "23932745";
const EMAIL = (process.argv[3] || "vannnt@hasaki.vn").toLowerCase();
const THANG = process.argv[4] || "2026-07";
const WH = 863, CTY = 1001;
const T0 = new Date(THANG + "-01T00:00:00+07:00").getTime();
const d0 = new Date(T0); const T1 = new Date(d0.getFullYear(), d0.getMonth() + 1, 1).getTime() - 1;
const wms = await layTokenSongWms(DIR, () => { });
const work = await layTokenSongWork(DIR, () => { });
if (!wms || !work) { log("✗ Thiếu token sống — dừng."); process.exit(2); }
const HW = { authorization: wms, accept: "application/json", "Company-Ids": String(CTY) };
const HH = { authorization: work, accept: "application/json" };
const EX = "https://wms-gw-external.hasaki.vn/api/v1", V1 = "https://wshr.hasaki.vn/api";
const gj = async (u, h, ms = 120000) => { const ac = new AbortController(); const to = setTimeout(() => ac.abort(), ms); try { const r = await fetch(u, { headers: h, signal: ac.signal }); const t = await r.text(); clearTimeout(to); let j = null; try { j = JSON.parse(t); } catch { } return { s: r.status, j, t }; } catch (e) { clearTimeout(to); return { s: "ERR " + e.name, j: null, t: "" }; } };

/* ═══ 1) Yêu cầu bị từ chối ═══ */
log(`═══ 1) Yêu cầu ${RID} ═══`);
const yc = await gj(`${EX}/planogram/schedule-requests/${RID}?page=1&size=20&is_schedule_group=false`, HW);
const it = yc.j?.item || {};
log(`[${yc.s}] status_id=${it.status_id} (${it.status_name}) · vị trí ${it.location_description} · ${it.purpose_type_name}`);
log(`   người báo cáo: ${it.executed_by_name} @ ${it.executed_at} · người xử lý cuối: ${it.updated_by_name} @ ${it.updated_at}`);
const sc = await gj(`${EX}/planogram/schedule/location-schedules/detail/${it.schedule_id}`, HW);
const DUR_YC = Number(sc.j?.item?.duration || 0);
log(`   lịch ${it.schedule_id} · duration = ${DUR_YC}s`);
fs.writeFileSync(path.join(OUT, `probe-kpi-req-${RID}.json`), yc.t || "");

/* ═══ 2) Kéo MỌI phiếu tháng, gộp theo người × trạng thái ═══ */
log(`\n═══ 2) Mọi phiếu ${THANG} · SHOP-170 (wh ${WH}) ═══`);
const phieu = [];
for (let page = 1; page <= 200; page++) {
  const { s, j } = await gj(`${EX}/planogram/schedule-requests?company_ids=${CTY}&warehouse_ids=${WH}&from_date=${T0}&to_date=${T1}&page=${page}&size=200`, HW);
  const r = j?.records || []; if (s !== 200) { log(`  [${s}] dừng page ${page}`); break; }
  if (page === 1) log(`  tổng: ${j?.count}`);
  phieu.push(...r); if (r.length < 200) break;
}
const tt = {}; for (const p of phieu) tt[`${p.status_id} ${p.status_name}`] = (tt[`${p.status_id} ${p.status_name}`] || 0) + 1;
log("  trạng thái: " + JSON.stringify(tt, null, 1).replace(/\s+/g, " "));

/* duration theo lịch (cache) */
const CACHE = path.join(OUT, "probe-kpi-duration-cache.json");
let dur = {}; try { dur = JSON.parse(fs.readFileSync(CACHE, "utf8")); } catch { }
const can = [...new Set(phieu.map(p => p.schedule_id))].filter(id => dur[id] == null);
if (can.length) {
  log(`  tra duration ${can.length} lịch mới...`);
  for (const id of can) { const { j } = await gj(`${EX}/planogram/schedule/location-schedules/detail/${id}`, HW, 45000); dur[id] = Number(j?.item?.duration || 0); }
  fs.writeFileSync(CACHE, JSON.stringify(dur));
}
/* lịch trả duration=0 nhưng KPI vẫn tính 360s/lượt (kiểm chứng 31/07) */
const giay = (p) => dur[p.schedule_id] || 360;

const theoNguoi = {};
for (const p of phieu) {
  if (!p.executed_by_name) continue;
  const k = String(p.executed_by_name).toLowerCase();
  theoNguoi[k] = theoNguoi[k] || {};
  const st = Number(p.status_id);
  theoNguoi[k][st] = theoNguoi[k][st] || { n: 0, giay: 0 };
  theoNguoi[k][st].n++; theoNguoi[k][st].giay += giay(p);
}

/* ═══ 3) KPI hiện tại của từng người ═══ */
log(`\n═══ 3) KPI COS-KPI-007-T14 hiện tại (${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}) ═══`);
const dirNS = (await gj(`${V1}/news/staff/search-for-dropdown?limit=10000&sort=staff_id`, HH)).j?.data || [];
const byEmail = {}; for (const s of dirNS) if (s.staff_email) byEmail[String(s.staff_email).toLowerCase()] = s;
const layKPI = async (email) => {
  const st = byEmail[email]; if (!st) return { thieu: "không có trong danh bạ" };
  const ss = await gj(`${V1}/hr/sheet-summary?from_date=${THANG}-01&to_date=${THANG}-31&staff_id=${st.staff_id}&limit=50`, HH);
  const b = (ss.j?.data?.rows || []).filter(r => String(r.month || "").startsWith(THANG))[0];
  if (!b) return { st, thieu: "không có bảng KPI tháng" };
  const t14 = b.kpis?.["COS-KPI-007-T14"];
  return { st, t14, giay: Number(t14?.value?.Asset_Schedule_Declaration_Time_Personal || 0), gio: Number(t14?.kpi || 0), final: b.final_kpi, coMuc: !!t14 };
};

const ai = Object.keys(theoNguoi).sort((a, b) => (theoNguoi[b][3]?.n || 0) + (theoNguoi[b][4]?.n || 0) - (theoNguoi[a][3]?.n || 0) - (theoNguoi[a][4]?.n || 0));
const bang = [];
for (const e of ai) {
  const k = await layKPI(e);
  const g = theoNguoi[e];
  const s3 = g[3] || { n: 0, giay: 0 }, s4 = g[4] || { n: 0, giay: 0 };
  const tuChoi = Object.entries(g).filter(([st]) => ![1, 2, 3, 4].includes(Number(st))).reduce((t, [, v]) => ({ n: t.n + v.n, giay: t.giay + v.giay }), { n: 0, giay: 0 });
  bang.push({ email: e, ten: k.st?.staff_name || "", major: k.st?.major_id ?? "", s3, s4, tuChoi, kpiGiay: k.giay || 0, kpiGio: k.gio || 0, coMuc: !!k.coMuc, thieu: k.thieu || "" });
}
fs.writeFileSync(path.join(OUT, `probe-kpi-3buoc-${THANG}.json`), JSON.stringify({ luc: new Date().toISOString(), trangThai: tt, bang }, null, 1));

const P = (n, w) => String(n).padStart(w);
log("\n  email                      major | chờ duyệt(3)  | đã duyệt(4)  | từ chối     | KPI thật    | khớp với");
log("  " + "-".repeat(112));
for (const r of bang) {
  const t34 = r.s3.giay + r.s4.giay;
  const khop = r.kpiGiay === t34 ? "3+4 ✓" : r.kpiGiay === r.s4.giay ? "chỉ 4" : r.kpiGiay === t34 + r.tuChoi.giay ? "3+4+từ chối" : "—";
  log(`  ${r.email.padEnd(26)} ${P(r.major, 5)} | ${P(r.s3.n, 3)}p ${P(r.s3.giay, 6)}s | ${P(r.s4.n, 3)}p ${P(r.s4.giay, 5)}s | ${P(r.tuChoi.n, 2)}p ${P(r.tuChoi.giay, 5)}s | ${P(r.kpiGiay, 6)}s ${r.coMuc ? "" : "(không có mục)"} | ${khop}`);
}
const co34 = bang.filter(r => r.coMuc && r.kpiGiay === r.s3.giay + r.s4.giay).length;
const chi4 = bang.filter(r => r.coMuc && r.kpiGiay === r.s4.giay && r.s3.giay > 0).length;
log(`\n⇒ khớp "3+4 (chỉ cần báo cáo)": ${co34} người · khớp "chỉ 4 (phải được duyệt)": ${chi4} người`);

/* ═══ 4) Người anh hỏi + so với ẢNH CHỤP 14:54 hôm nay ═══ */
log(`\n═══ 4) ${EMAIL} ═══`);
const me = bang.find(r => r.email === EMAIL);
if (me) {
  log(`   ${me.ten} · major ${me.major}`);
  log(`   phiếu: chờ duyệt ${me.s3.n} (${me.s3.giay}s) · đã duyệt ${me.s4.n} (${me.s4.giay}s) · bị từ chối ${me.tuChoi.n} (${me.tuChoi.giay}s)`);
  log(`   KPI COS-KPI-007-T14 = ${me.kpiGiay}s = ${me.kpiGio}h`);
  log(`   → tổng 3+4 = ${me.s3.giay + me.s4.giay}s ${me.kpiGiay === me.s3.giay + me.s4.giay ? "= KPI ✓ (phiếu bị từ chối KHÔNG được tính)" : "≠ KPI"}`);
  log(`   → nếu cộng cả phiếu từ chối = ${me.s3.giay + me.s4.giay + me.tuChoi.giay}s ${me.kpiGiay === me.s3.giay + me.s4.giay + me.tuChoi.giay ? "= KPI ✓ (từ chối VẪN được tính)" : "≠ KPI"}`);
}
try {
  const cu = JSON.parse(fs.readFileSync(path.join(OUT, `probe-kpi-quet-${THANG}.json`), "utf8"));
  const cuMap = {}; for (const x of cu.co) cuMap[x.email.toLowerCase()] = x.giay;
  log("\n═══ 5) So với ảnh chụp KPI lúc 14:54 hôm nay (ai TĂNG) ═══");
  let tang = 0;
  for (const r of bang) {
    const truoc = cuMap[r.email]; if (truoc == null) continue;
    if (r.kpiGiay !== truoc) { tang++; log(`   ${r.email.padEnd(26)} ${P(truoc, 6)}s → ${P(r.kpiGiay, 6)}s  (${r.kpiGiay > truoc ? "+" : ""}${r.kpiGiay - truoc}s) · chờ duyệt ${r.s3.n}p · đã duyệt ${r.s4.n}p`); }
  }
  if (!tang) log("   (chưa ai đổi — bảng KPI chưa chạy lại)");
} catch { log("\n(không có ảnh chụp cũ để so)"); }
process.exit(0);
