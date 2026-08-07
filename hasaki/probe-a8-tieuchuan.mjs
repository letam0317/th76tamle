/**
 * probe-a8-tieuchuan.mjs — READ-ONLY: trả lời câu hỏi operator (07/08/2026)
 *   Schedule request code nào thoả CẢ 3:
 *     (1) location bắt đầu bằng F0-A8
 *     (2) KHÔNG có yêu cầu vệ sinh trong 3 ngày gần nhất tính từ 07/08 (05,06,07/08)
 *     (3) CÓ ĐỦ ảnh tiêu chuẩn ở mục Standard (standard_image[] đủ URL ảnh)
 *
 * Chỉ GET trên wms-gw-external, token phiên sống (kho/bridge) — không đăng nhập, không đá ai.
 * Quét TOÀN BỘ trạng thái (không lọc status_ids) để câu (2) đúng nghĩa "không có yêu cầu nào".
 */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms, fetchThuLai } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const EXT = "https://wms-gw-external.hasaki.vn/api/v1";
const CACHE = path.join(DIR, ".exports", "a8-requests.json");
const OUT = path.join(DIR, ".exports", "a8-tieuchuan-ketqua.json");

const MOC = "2026-08-07";
const BA_NGAY = ["2026-08-05", "2026-08-06", "2026-08-07"];
const ST_LINK = new Set([2, 3, 4, 5, 7]);   // bộ status của link operator

/* ---------- 1. Kéo toàn bộ yêu cầu F0-A8 (cache theo ngày) ---------- */
let all = null;
if (!process.env.FRESH) {
  try {
    const c = JSON.parse(fs.readFileSync(CACHE, "utf8"));
    if (Date.now() - c.at < 30 * 60000) { all = c.records; log(`↺ Dùng cache ${all.length} bản ghi (${new Date(c.at).toLocaleTimeString("vi-VN")}).`); }
  } catch { /* chưa có cache */ }
}
if (!all) {
  const token = await layTokenSongWms(DIR, log);
  if (!token) { log("✗ Không có token phiên sống."); process.exit(2); }
  const HX = { authorization: token, "Company-Ids": "1001", accept: "application/json" };
  const base = `${EXT}/planogram/schedule-requests?company_ids=1001&warehouse_ids=863` +
    `&keyword_type=sku_or_barcode&location_description=F0-A8`;
  all = [];
  for (let p = 1; p <= 200; p++) {
    const r = await fetchThuLai(`${base}&page=${p}&size=100`, { headers: HX });
    const j = await r.json();
    const rec = j.records || [];
    all.push(...rec);
    if (p === 1) log(`count tổng = ${j.count}`);
    if (all.length >= (j.count || 0) || !rec.length) break;
    if (p % 10 === 0) log(`  … ${all.length}`);
  }
  log(`✓ Kéo xong ${all.length} bản ghi F0-A8.`);
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify({ at: Date.now(), records: all }));
}

/* ---------- 2. Gom theo vị trí ---------- */
const ngayCua = (r) => String(r.request_time || "").slice(0, 10);
const byLoc = {};
for (const r of all) {
  if (!/^F0-A8/i.test(r.location_description || "")) continue;
  (byLoc[r.location_description] = byLoc[r.location_description] || []).push(r);
}
const locs = Object.keys(byLoc).sort();
log(`Vị trí F0-A8: ${locs.length} · bản ghi: ${all.length}`);

/* ---------- 3. Xét từng vị trí ---------- */
/* "Đủ ảnh tiêu chuẩn": standard_image[] không rỗng VÀ mọi mục (ít nhất mọi mục is_required)
   đều có URL ảnh thật. Trả cả số liệu để đối chiếu tay trên UI. */
function xetChuan(r) {
  const st = r.standard_image || [];
  const req = st.filter((s) => s.is_required !== false);
  const coAnh = (s) => !!String(s.image || "").trim();
  return {
    n: st.length, nReq: req.length,
    nCoAnh: st.filter(coAnh).length, nReqCoAnh: req.filter(coAnh).length,
    du: st.length > 0 && st.every(coAnh),
    duReq: req.length > 0 && req.every(coAnh),
  };
}

const kq = [];
for (const loc of locs) {
  const rs = byLoc[loc].slice().sort((a, b) => String(b.request_time).localeCompare(String(a.request_time)));
  const ngay = new Set(rs.map(ngayCua));
  const coGanDay = BA_NGAY.some((d) => ngay.has(d));
  const ganDayLink = rs.some((r) => BA_NGAY.includes(ngayCua(r)) && ST_LINK.has(r.status_id));
  const moiNhat = rs[0];
  const c = xetChuan(moiNhat);
  kq.push({
    loc, tong: rs.length,
    ngayMoiNhat: ngayCua(moiNhat),
    soNgayCach: Math.round((new Date(MOC) - new Date(ngayCua(moiNhat))) / 86400000),
    coGanDay, ganDayLink,
    code: moiNhat.schedule_request_code, request_id: moiNhat.request_id,
    schedule_id: moiNhat.schedule_id,
    status_id: moiNhat.status_id, status_name: moiNhat.status_name,
    mota: moiNhat.description, executed_by: moiNhat.executed_by_name || "",
    chuan: c,
    // code gần nhất THUỘC bộ status của link (để mở đúng danh sách operator đang xem)
    codeLink: (rs.find((r) => ST_LINK.has(r.status_id)) || {}).schedule_request_code || "",
  });
}

const thoa = kq.filter((k) => !k.coGanDay && k.chuan.du);
const thoaThieuAnh = kq.filter((k) => !k.coGanDay && !k.chuan.du);

log("");
log(`── Vị trí F0-A8 KHÔNG có yêu cầu 05–07/08: ${kq.filter((k) => !k.coGanDay).length}/${locs.length}`);
log(`   ├ đủ ảnh tiêu chuẩn : ${thoa.length}`);
log(`   └ thiếu ảnh tiêu chuẩn: ${thoaThieuAnh.length}`);
log("");
log("STT | Schedule request code | Location            | YC gần nhất | Cách | Std | Mô tả");
thoa.sort((a, b) => a.loc.localeCompare(b.loc)).forEach((k, i) => {
  log(`${String(i + 1).padStart(3)} | ${k.code} | ${k.loc.padEnd(19)} | ${k.ngayMoiNhat} | ${String(k.soNgayCach).padStart(3)}n | ${k.chuan.nCoAnh}/${k.chuan.n} | ${String(k.mota || "").slice(0, 40)}`);
});
if (thoaThieuAnh.length) {
  log("");
  log("(Loại vì THIẾU ảnh tiêu chuẩn)");
  thoaThieuAnh.forEach((k) => log(`    ${k.code} | ${k.loc.padEnd(19)} | ${k.ngayMoiNhat} | ${k.chuan.nCoAnh}/${k.chuan.n} ảnh | ${String(k.mota || "").slice(0, 40)}`));
}

fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), moc: MOC, baNgay: BA_NGAY, tongBanGhi: all.length, soViTri: locs.length, tatCa: kq, thoa, thoaThieuAnh }, null, 2));
log("");
log("Đã lưu:", OUT);
process.exit(0);
