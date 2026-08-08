/**
 * probe-a8-dung-0708.mjs — READ-ONLY: vì sao F0-A8 ngừng phát yêu cầu vệ sinh từ 07/08/2026?
 *
 * Khác điều tra 07/08 (sync-a8-thieu-lich.mjs, lo 50 vị trí đã im từ 07/07): lần này soi
 * ĐÚNG NHÓM CÒN SỐNG (18 vị trí) — gồm ví dụ F0-A8-501-03-01-01 — xem chúng dừng lúc nào và
 * vì sao. Có NHÓM ĐỐI CHỨNG (toàn kho 863 + khu A1) để biết đây là bệnh riêng A8 hay cả kho.
 *
 * Chạy: node probe-a8-dung-0708.mjs [F0-A8-501-03-01-01]
 */
import "dotenv/config";
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms, fetchThuLai } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const VIDU = process.argv[2] || "F0-A8-501-03-01-01";
const log = (...a) => console.log(...a);
const EXT = "https://wms-gw-external.hasaki.vn/api/v1";
const CTY = 1001, WH = 863;

const token = await layTokenSongWms(DIR, (...a) => log(...a));
if (!token) { log("✗ Không có token phiên sống — dừng."); process.exit(2); }
const HX = { authorization: token, "Company-Ids": String(CTY), accept: "application/json" };
const gj = async (u) => { try { const r = await fetchThuLai(u, { headers: HX }); const t = await r.text(); try { return { s: r.status, j: JSON.parse(t) }; } catch { return { s: r.status, j: null, t }; } } catch (e) { return { s: "ERR " + e.message, j: null }; } };

/* ══ 1) Nhịp phát yêu cầu 14 ngày: A8 vs toàn kho ══ */
log("\n═══ 1) Số yêu cầu phát ra mỗi ngày (14 ngày) — A8 so với toàn kho 863 ═══");
const ngays = [];
for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000); ngays.push(d.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" })); }
const dem = async (ngay, loc) => {
  const t0 = new Date(ngay + "T00:00:00+07:00").getTime(), t1 = new Date(ngay + "T23:59:59+07:00").getTime();
  const u = `${EXT}/planogram/schedule-requests?company_ids=${CTY}&warehouse_ids=${WH}&from_date=${t0}&to_date=${t1}&page=1&size=1` + (loc ? `&location_description=${loc}` : "");
  const { j } = await gj(u); return j?.count ?? -1;
};
log("  ngày         toàn kho    F0-A8    F0-A1");
for (const d of ngays) {
  const [all, a8, a1] = [await dem(d), await dem(d, "F0-A8"), await dem(d, "F0-A1")];
  log(`  ${d}  ${String(all).padStart(8)} ${String(a8).padStart(8)} ${String(a1).padStart(8)}`);
}

/* ══ 2) Toàn bộ yêu cầu F0-A8 (mọi thời điểm) → ngày cuối cùng của TỪNG vị trí ══ */
log("\n═══ 2) Yêu cầu gần nhất của từng vị trí F0-A8 ═══");
const all = [];
for (let p = 1; p <= 200; p++) {
  const { j } = await gj(`${EXT}/planogram/schedule-requests?company_ids=${CTY}&warehouse_ids=${WH}&keyword_type=sku_or_barcode&location_description=F0-A8&page=${p}&size=100`);
  const r = j?.records || []; all.push(...r);
  if (!r.length || all.length >= (j?.count || 0)) break;
}
log(`  kéo ${all.length} yêu cầu F0-A8.`);
const ngayCua = (r) => String(r.request_time || "").slice(0, 10);
const byLoc = {};
for (const r of all) { const L = r.location_description || ""; if (!/^F0-A8/i.test(L)) continue; (byLoc[L] = byLoc[L] || []).push(r); }
const cuoi = Object.entries(byLoc).map(([loc, rs]) => {
  rs.sort((a, b) => String(b.request_time).localeCompare(String(a.request_time)));
  return { loc, ngay: ngayCua(rs[0]), n: rs.length, r: rs[0] };
}).sort((a, b) => b.ngay.localeCompare(a.ngay) || a.loc.localeCompare(b.loc));
const nhomNgay = {}; cuoi.forEach(x => nhomNgay[x.ngay] = (nhomNgay[x.ngay] || 0) + 1);
log("  vị trí theo NGÀY CÓ YÊU CẦU CUỐI CÙNG: " + JSON.stringify(nhomNgay));
log("\n  10 vị trí dừng muộn nhất:");
cuoi.slice(0, 10).forEach(x => log(`   ${x.loc.padEnd(20)} cuối ${x.ngay}  (${x.n} yc)  sched=${x.r.schedule_id} st=${x.r.status_id} ${x.r.status_name}`));

/* ══ 3) Nhóm "còn sống tới 06/08" — lịch gốc của họ giờ thế nào? ══ */
const conSong = cuoi.filter(x => x.ngay >= "2026-08-01");
log(`\n═══ 3) ${conSong.length} vị trí còn phát yêu cầu trong tháng 8 — tra lịch gốc ═══`);
const schs = [];
for (let p = 1; p <= 20; p++) {
  const { j } = await gj(`${EXT}/planogram/schedule/location-schedules?page=${p}&size=100&company_ids=${CTY}&warehouse_ids=${WH}`);
  const r = j?.records || []; schs.push(...r);
  if (!r.length || schs.length >= (j?.count || 0)) break;
}
const songTheoLoc = {};
schs.filter(s => /^F0-A8/i.test(s.location_description || "")).forEach(s => {
  const cu = songTheoLoc[s.location_description];
  if (!cu || s.schedule_id > cu.schedule_id) songTheoLoc[s.location_description] = s;
});
log(`  lịch đang sống toàn kho: ${schs.length} · thuộc F0-A8: ${Object.keys(songTheoLoc).length}`);
const nAnh = (a) => (a || []).filter(x => String(x.image || "").trim()).length;
const detail = async (id) => (await gj(`${EXT}/planogram/schedule/location-schedules/detail/${id}?page=1&size=20&is_view_schedule=true`)).j?.item || null;
for (const x of conSong) {
  const s = songTheoLoc[x.loc];
  const d = await detail(x.r.schedule_id);
  log(`   ${x.loc.padEnd(20)} cuối ${x.ngay} | lịch YC #${x.r.schedule_id}: ${d ? d.loc_sched_status_id + " " + d.loc_sched_status_id_name + " (updated " + String(d.updated_at || "").slice(0, 19) + ", ảnh " + nAnh(d.standard_image) + "/" + (d.standard_image || []).length + ", type " + (d.schedule_type_name || d.schedule_type || "?") + ")" : "(không tra được)"}`
    + ` | lịch sống: ${s ? "#" + s.schedule_id + " " + s.loc_sched_status_id + " " + s.loc_sched_status_id_name + " ảnh " + nAnh(s.standard_image) + "/" + (s.standard_image || []).length : "(không còn)"}`);
}

/* ══ 4) Soi kỹ vị trí ví dụ ══ */
log(`\n═══ 4) ${VIDU} — chi tiết ═══`);
const rs = (byLoc[VIDU] || []);
log(`  tổng ${rs.length} yêu cầu · 12 lượt gần nhất:`);
rs.slice(0, 12).forEach(r => log(`   ${String(r.request_time).slice(0, 19)}  ${r.schedule_request_code}  st=${r.status_id} ${r.status_name}  sched=${r.schedule_id}  ảnh ${nAnh(r.standard_image)}/${(r.standard_image || []).length}  bởi ${r.executed_by_name || "-"}`));
const sVidu = songTheoLoc[VIDU];
log(`  lịch đang sống: ${sVidu ? JSON.stringify({ id: sVidu.schedule_id, st: sVidu.loc_sched_status_id + " " + sVidu.loc_sched_status_id_name, tao: sVidu.created_at, sua: sVidu.updated_at, anh: nAnh(sVidu.standard_image) + "/" + (sVidu.standard_image || []).length }) : "(không còn lịch nào sống)"}`);
const idsVidu = [...new Set(rs.map(r => r.schedule_id))];
for (const id of idsVidu.slice(0, 5)) {
  const d = await detail(id);
  if (!d) { log(`   lịch #${id}: (không tra được)`); continue; }
  log(`   lịch #${id}: ${d.loc_sched_status_id} ${d.loc_sched_status_id_name} · type=${d.schedule_type_name || d.schedule_type || "?"} · duration=${d.duration} · hiệu lực ${String(d.from_date || "").slice(0, 10)}→${String(d.to_date || "").slice(0, 10)} · tạo ${String(d.created_at || "").slice(0, 19)} bởi ${d.created_by_name || d.created_by || "?"} · sửa ${String(d.updated_at || "").slice(0, 19)} bởi ${d.updated_by_name || d.updated_by || "?"} · ảnh ${nAnh(d.standard_image)}/${(d.standard_image || []).length}`);
  if (sVidu && id === sVidu.schedule_id) log(`     (đây chính là lịch đang sống)`);
}
if (sVidu) {
  const d = await detail(sVidu.schedule_id);
  if (d) log(`   [lịch sống #${sVidu.schedule_id}] chi tiết: ${JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k]) => /status|date|type|duration|created|updated|active|apply|frequen|repeat|day|time/i.test(k))))}`);
}

fs.writeFileSync(path.join(DIR, ".exports", "a8-dung-0708.json"), JSON.stringify({ at: new Date().toISOString(), nhomNgay, cuoi: cuoi.map(x => ({ loc: x.loc, ngay: x.ngay, n: x.n, sched: x.r.schedule_id })), vidu: { loc: VIDU, rs: rs.slice(0, 12) } }, null, 1));
log("\n→ .exports/a8-dung-0708.json");
process.exit(0);
