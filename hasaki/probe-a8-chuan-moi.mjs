/**
 * probe-a8-chuan-moi.mjs — READ-ONLY: 50 mã yêu cầu A8 "mất lịch" có mang ẢNH TIÊU CHUẨN
 * MỚI NHẤT không?
 *
 * Ảnh tiêu chuẩn trong record schedule-request là ẢNH ĐÓNG BĂNG lúc phát yêu cầu. Bản ĐANG
 * HIỆU LỰC nằm ở LỊCH GỐC: GET /planogram/schedule/location-schedules (240 lịch của kho 863)
 * — mỗi vị trí có thể có NHIỀU lịch qua các đời (Draft/Approved/Inactive), lịch mới có thể
 * khai báo lại bộ ảnh khác. So 2 bộ theo (image_name + tên file ảnh).
 *
 * Chỉ GET, token phiên sống — không đăng nhập, không đá ai.
 */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms, fetchThuLai } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const EXT = "https://wms-gw-external.hasaki.vn/api/v1";
const OUT = path.join(DIR, ".exports", "a8-chuan-moi.json");

const token = await layTokenSongWms(DIR, log);
if (!token) { log("✗ Không có token phiên sống."); process.exit(2); }
const HX = { authorization: token, "Company-Ids": "1001", accept: "application/json" };

/* ---------- 1. Toàn bộ lịch gốc của kho 863 ---------- */
const sch = [];
for (let p = 1; p <= 20; p++) {
  const r = await fetchThuLai(`${EXT}/planogram/schedule/location-schedules?page=${p}&size=100&company_ids=1001&warehouse_ids=863`, { headers: HX });
  const j = await r.json();
  sch.push(...(j.records || []));
  if (p === 1) log(`Lịch gốc kho 863: count = ${j.count}`);
  if (sch.length >= (j.count || 0) || !(j.records || []).length) break;
}
log(`✓ Kéo ${sch.length} lịch gốc.`);
const schA8 = sch.filter((s) => /^F0-A8/i.test(s.location_description || ""));
log(`  F0-A8: ${schA8.length} lịch / ${new Set(schA8.map((s) => s.location_description)).size} vị trí.`);

/* ---------- 2. So bộ ảnh ---------- */
const chuKy = (arr) => (arr || []).map((x) => (x.image_name || "") + "::" + String(x.image || "").split("/").pop()).sort().join("|");
const tenAnh = (arr) => (arr || []).map((x) => x.image_name).join(" / ");

const kq = JSON.parse(fs.readFileSync(path.join(DIR, ".exports", "a8-tieuchuan-ketqua.json"), "utf8"));
const all = JSON.parse(fs.readFileSync(path.join(DIR, ".exports", "a8-requests.json"), "utf8")).records;
const byCode = {}; all.forEach((r) => (byCode[r.schedule_request_code] = r));

const byLocSch = {};
schA8.forEach((s) => (byLocSch[s.location_description] = byLocSch[s.location_description] || []).push(s));

const rows = kq.thoa.slice().sort((a, b) => a.loc.localeCompare(b.loc)).map((k) => {
  const r = byCode[k.code];
  const ds = (byLocSch[k.loc] || []).slice().sort((a, b) => b.schedule_id - a.schedule_id);
  const moi = ds[0] || null;                                  // lịch MỚI NHẤT của vị trí (id lớn nhất)
  const cuaYc = ds.find((s) => s.schedule_id === r.schedule_id) || null;   // lịch mà yêu cầu này sinh ra từ
  const ckYc = chuKy(r.standard_image);
  const ckMoi = moi ? chuKy(moi.standard_image) : "";
  return {
    code: k.code, loc: k.loc, mota: k.mota, ngayYc: k.ngayMoiNhat, soNgay: k.soNgayCach,
    status: r.status_id + " " + r.status_name, request_id: r.request_id,
    schYc: r.schedule_id, schMoi: moi ? moi.schedule_id : null,
    schMoiTt: moi ? (moi.loc_sched_status_id + " " + (moi.loc_sched_status_id_name || "")) : "",
    schYcTt: cuaYc ? (cuaYc.loc_sched_status_id + " " + (cuaYc.loc_sched_status_id_name || "")) : "(lịch đã bị xoá/ẩn)",
    soLich: ds.length,
    nAnhYc: (r.standard_image || []).length, nAnhMoi: moi ? (moi.standard_image || []).length : 0,
    khop: !!moi && ckYc === ckMoi,
    laLichMoiNhat: !!moi && moi.schedule_id === r.schedule_id,
    tenAnhYc: tenAnh(r.standard_image), tenAnhMoi: moi ? tenAnh(moi.standard_image) : "",
  };
});

const khop = rows.filter((x) => x.khop), lech = rows.filter((x) => !x.khop);
log("");
log(`── Ảnh tiêu chuẩn của 50 mã yêu cầu so với LỊCH MỚI NHẤT cùng vị trí`);
log(`   ✓ trùng khớp (đã là ảnh mới nhất): ${khop.length}`);
log(`   ✗ LỆCH (lịch mới đã đổi bộ ảnh)  : ${lech.length}`);
log("");
if (lech.length) {
  lech.forEach((x) => {
    log(`✗ ${x.code}  ${x.loc}`);
    log(`     lịch của YC   : #${x.schYc} [${x.schYcTt}] — ${x.nAnhYc} ảnh: ${x.tenAnhYc.slice(0, 110)}`);
    log(`     lịch MỚI NHẤT : #${x.schMoi} [${x.schMoiTt}] — ${x.nAnhMoi} ảnh: ${x.tenAnhMoi.slice(0, 110)}`);
  });
  log("");
}
const nhomTt = {}; rows.forEach((x) => { const k = x.laLichMoiNhat ? "YC sinh từ chính lịch mới nhất" : "vị trí có lịch mới hơn"; nhomTt[k] = (nhomTt[k] || 0) + 1; });
log("Phân bố:", JSON.stringify(nhomTt));
const ttLich = {}; rows.forEach((x) => (ttLich[x.schMoiTt] = (ttLich[x.schMoiTt] || 0) + 1));
log("Trạng thái lịch mới nhất:", JSON.stringify(ttLich));

fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), rows, khop: khop.length, lech: lech.length, schA8 }, null, 2));
log("Đã lưu:", OUT);
process.exit(0);
