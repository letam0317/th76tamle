/**
 * sync-a8-thieu-lich.mjs — Vị trí F0-A8 ĐÃ NGỪNG PHÁT YÊU CẦU VỆ SINH → tab Sheet factory.
 *
 * BỐI CẢNH (07/08/2026): F0-A8 có 68 vị trí từng có yêu cầu vệ sinh, nhưng chỉ 18 vị trí còn
 * được phát yêu cầu. 50 vị trí còn lại im lặng — 43 vị trí dừng đúng 07/07/2026, 7 vị trí dừng
 * từ 09–10/2025. Nguyên nhân tìm được: 08/07/2026 15:22–15:27 `api@hasaki.vn` CHUYỂN HÀNG LOẠT
 * lịch gốc (location-schedules) sang **Canceled**, rồi tạo lịch Draft thay thế chỉ khai báo
 * **1 ảnh tiêu chuẩn** ("Trực diện") và KHÔNG duyệt → không lịch Approved ⇒ không sinh yêu cầu.
 *
 * BỘ ẢNH TIÊU CHUẨN: mỗi schedule-request đóng băng `standard_image[]` lúc phát. Bản ĐANG
 * HIỆU LỰC nằm ở lịch gốc. Script so 3 bộ để trả lời "mã yêu cầu này có mang ảnh mới nhất không":
 *   (a) ảnh đóng băng trong yêu cầu   (b) ảnh của CHÍNH lịch đó lúc này (detail schedule_id)
 *   (c) ảnh của lịch ĐANG SỐNG cùng vị trí (list location-schedules, nếu còn)
 *
 * Chỉ GET trên WMS (token phiên sống — không đăng nhập, không đá ai) + 1 POST ghi Sheet.
 *   node sync-a8-thieu-lich.mjs          → ghi tab A8-THIEU-LICH-VESINH của Sheet factory
 *   node sync-a8-thieu-lich.mjs --dry    → chỉ in ra, không ghi Sheet
 */
import "dotenv/config";
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms, fetchThuLai } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes("--dry");
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const EXT = "https://wms-gw-external.hasaki.vn/api/v1";
const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
/* Sheet "Tồn mã vị trí — stocklocationfactory" (nơi đã có tab history của dự án factory) */
const SHEET_ID = process.env.STOCK_SHEET_ID || "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const TAB = "A8-THIEU-LICH-VESINH";
const CACHE = path.join(DIR, ".exports", "a8-requests.json");

/* Mốc xét: 3 ngày gần nhất tính từ 07/08/2026 */
const MOC = "2026-08-07";
const BA_NGAY = ["2026-08-05", "2026-08-06", "2026-08-07"];

if (!APPSCRIPT_KEY && !DRY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

const token = await layTokenSongWms(DIR, log);
if (!token) { log("✗ Không có token phiên sống — chạy lại khi operator online."); process.exit(2); }
const HX = { authorization: token, "Company-Ids": "1001", accept: "application/json" };

/* ---------- 1) Toàn bộ yêu cầu F0-A8 (mọi trạng thái, mọi thời điểm) ---------- */
let all = null;
try {
  const c = JSON.parse(fs.readFileSync(CACHE, "utf8"));
  if (Date.now() - c.at < 30 * 60000 && !process.env.FRESH) { all = c.records; log(`↺ Cache ${all.length} yêu cầu F0-A8.`); }
} catch { /* chưa có cache */ }
if (!all) {
  const base = `${EXT}/planogram/schedule-requests?company_ids=1001&warehouse_ids=863&keyword_type=sku_or_barcode&location_description=F0-A8`;
  all = [];
  for (let p = 1; p <= 200; p++) {
    const j = await (await fetchThuLai(`${base}&page=${p}&size=100`, { headers: HX })).json();
    all.push(...(j.records || []));
    if (all.length >= (j.count || 0) || !(j.records || []).length) break;
  }
  log(`✓ Kéo ${all.length} yêu cầu F0-A8.`);
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify({ at: Date.now(), records: all }));
}

/* ---------- 2) Lịch gốc ĐANG SỐNG của kho 863 (list chỉ trả lịch chưa bị huỷ) ---------- */
const schs = [];
for (let p = 1; p <= 20; p++) {
  const j = await (await fetchThuLai(`${EXT}/planogram/schedule/location-schedules?page=${p}&size=100&company_ids=1001&warehouse_ids=863`, { headers: HX })).json();
  schs.push(...(j.records || []));
  if (schs.length >= (j.count || 0) || !(j.records || []).length) break;
}
const schSong = {};   // location -> lịch đang sống MỚI NHẤT
schs.filter((s) => /^F0-A8/i.test(s.location_description || "")).forEach((s) => {
  const cu = schSong[s.location_description];
  if (!cu || s.schedule_id > cu.schedule_id) schSong[s.location_description] = s;
});
log(`✓ Lịch gốc đang sống: ${schs.length} toàn kho · ${Object.keys(schSong).length} vị trí F0-A8.`);

/* ---------- 3) Chọn 50 vị trí "mất lịch" + yêu cầu gần nhất của mỗi vị trí ---------- */
const ngayCua = (r) => String(r.request_time || "").slice(0, 10);
const byLoc = {};
all.forEach((r) => { if (/^F0-A8/i.test(r.location_description || "")) (byLoc[r.location_description] = byLoc[r.location_description] || []).push(r); });
const chon = [];
Object.keys(byLoc).sort().forEach((loc) => {
  const rs = byLoc[loc].slice().sort((a, b) => String(b.request_time).localeCompare(String(a.request_time)));
  if (BA_NGAY.some((d) => rs.some((r) => ngayCua(r) === d))) return;   // còn phát yêu cầu → bỏ
  chon.push({ loc, r: rs[0], tong: rs.length });
});
log(`✓ Vị trí F0-A8 không có yêu cầu ${BA_NGAY[0]}–${BA_NGAY[2]}: ${chon.length}/${Object.keys(byLoc).length}.`);

/* ---------- 4) Lịch CỦA CHÍNH yêu cầu đó, hiện đang ở trạng thái nào? ---------- */
const chuKy = (arr) => (arr || []).map((x) => (x.image_name || "") + "::" + String(x.image || "").split("/").pop()).sort().join("|");
const detailCache = {};
async function lichCua(id) {
  if (detailCache[id] !== undefined) return detailCache[id];
  try {
    const j = await (await fetchThuLai(`${EXT}/planogram/schedule/location-schedules/detail/${id}?page=1&size=20&is_view_schedule=true`, { headers: HX })).json();
    detailCache[id] = (j && j.item) || null;
  } catch { detailCache[id] = null; }
  return detailCache[id];
}
for (const c of chon) { c.lichYc = await lichCua(c.r.schedule_id); }
log("✓ Đã tra trạng thái lịch gốc của 50 yêu cầu.");

/* ---------- 5) Dựng dòng ---------- */
const soNgay = (d) => Math.round((new Date(MOC) - new Date(d)) / 86400000);
const nAnh = (a) => (a || []).filter((x) => String(x.image || "").trim()).length;
const HEADER = ["STT", "Schedule request code", "Location", "Mô tả", "YC gần nhất", "Số ngày không có YC",
  "Trạng thái YC", "Ảnh tiêu chuẩn (YC)", "Request ID", "Schedule ID",
  "Trạng thái lịch của YC", "Lịch cập nhật lúc", "Lịch đang sống", "Trạng thái lịch đang sống",
  "Ảnh tiêu chuẩn (lịch đang sống)", "Ảnh chuẩn mới nhất?", "Diễn giải", "Tên ảnh tiêu chuẩn (YC)", "Link planogram"];

const rows = chon.map((c, i) => {
  const r = c.r, lYc = c.lichYc, lSong = schSong[c.loc] || null;
  const ckYc = chuKy(r.standard_image);
  const ckLichYc = lYc ? chuKy(lYc.standard_image) : "";
  const ckSong = lSong ? chuKy(lSong.standard_image) : "";
  /* "Mới nhất" = bộ ảnh đóng băng trong yêu cầu vẫn là bộ ảnh tiêu chuẩn ĐẦY ĐỦ mới nhất của
     vị trí. Ba tình huống, và tình huống giữa mới là cái dễ đọc nhầm:
       (a) vị trí KHÔNG còn lịch sống → không có bản khai báo nào mới hơn ⇒ vẫn là mới nhất.
       (b) có lịch Draft mới hơn nhưng nó CHƯA TẢI ẢNH NÀO (0/n) → bản "mới" rỗng, không thay thế
           được gì ⇒ bộ ảnh trong yêu cầu vẫn là bộ đầy đủ mới nhất (chỉ cảnh báo có draft dở dang).
       (c) lịch mới có bộ ảnh THẬT và khác ⇒ ảnh trong yêu cầu đã cũ. */
  const nSong = nAnh(lSong && lSong.standard_image);
  let moiNhat, dienGiai;
  if (!lSong) {
    moiNhat = ckYc === ckLichYc || !ckLichYc ? "Có" : "Không";
    dienGiai = ckYc === ckLichYc || !ckLichYc
      ? "Vị trí không còn lịch nào đang sống — bộ ảnh trong yêu cầu là bản khai báo mới nhất còn tồn tại."
      : "Lịch gốc đã đổi ảnh sau khi phát yêu cầu.";
  } else if (ckYc === ckSong) {
    moiNhat = "Có"; dienGiai = "Trùng khớp bộ ảnh của lịch đang sống #" + lSong.schedule_id + ".";
  } else if (nSong === 0) {
    moiNhat = "Có";
    dienGiai = "Lịch mới #" + lSong.schedule_id + " (" + (lSong.loc_sched_status_id_name || "?") + ", tạo " +
      String(lSong.created_at || "").slice(0, 10) + ") mới dựng khung " + (lSong.standard_image || []).length +
      " mục (" + (lSong.standard_image || []).map((x) => x.image_name).join(" / ") + ") và CHƯA TẢI ẢNH NÀO" +
      " — bộ ảnh trong yêu cầu vẫn là bản đầy đủ mới nhất.";
  } else {
    moiNhat = "Không";
    dienGiai = "Lịch đang sống #" + lSong.schedule_id + " (" + (lSong.loc_sched_status_id_name || "?") + ", tạo " +
      String(lSong.created_at || "").slice(0, 10) + ") đã khai báo lại bộ ảnh khác gồm " + nSong + " ảnh: " +
      (lSong.standard_image || []).map((x) => x.image_name).join(" / ") + ".";
  }
  return [
    i + 1, r.schedule_request_code, c.loc, r.description || "", ngayCua(r), soNgay(ngayCua(r)),
    r.status_id + " " + (r.status_name || ""), nAnh(r.standard_image) + "/" + (r.standard_image || []).length,
    r.request_id, r.schedule_id,
    lYc ? (lYc.loc_sched_status_id + " " + (lYc.loc_sched_status_id_name || "")) : "(không tra được)",
    lYc ? (lYc.updated_at || "") : "",
    /* Cột này phải THUẦN SỐ: trộn số với chữ thì gviz suy cột thành number rồi trả null cho mọi
       ô chữ — dashboard/đối chiếu sau này sẽ đọc ra rỗng. Chữ "(không còn lịch)" dồn sang cột
       trạng thái bên cạnh (vốn đã là cột chữ), không mất thông tin nào. */
    lSong ? lSong.schedule_id : "",
    lSong ? (lSong.loc_sched_status_id + " " + (lSong.loc_sched_status_id_name || "")) : "(không còn lịch)",
    lSong ? nAnh(lSong.standard_image) + "/" + (lSong.standard_image || []).length : "",
    moiNhat, dienGiai,
    (r.standard_image || []).map((x) => x.image_name).join(" / "),
    "https://planogram.hasaki.vn/asset-management/request-of-declaration/details/" + r.request_id,
  ];
});

const co = rows.filter((x) => x[15] === "Có").length;
log("");
log(`── Ảnh tiêu chuẩn mới nhất?  Có: ${co} · Không: ${rows.length - co}`);
const nhom = {}; rows.forEach((x) => { const k = x[13] || "(không còn lịch)"; nhom[k] = (nhom[k] || 0) + 1; });
log("── Trạng thái lịch đang sống:", JSON.stringify(nhom));
log("");
rows.forEach((x) => log(`${String(x[0]).padStart(2)}. ${x[1]}  ${x[2].padEnd(19)} ${x[4]}  ${String(x[5]).padStart(3)}n  ảnh YC ${x[7]}  → mới nhất: ${x[15]}  | lịch sống: ${x[12]} ${x[13]} ${x[14]}`));

/* ---------- 6) Ghi Sheet factory ---------- */
fs.writeFileSync(path.join(DIR, ".exports", "a8-thieu-lich-rows.json"), JSON.stringify({ at: new Date().toISOString(), header: HEADER, rows }, null, 2));
if (DRY) { log(""); log("(--dry) Không ghi Sheet."); process.exit(0); }

const apiAt = Date.now();
const body = JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, tab: TAB, sheetId: SHEET_ID, header: HEADER, rows, append: false, apiAt });
const rp = await fetchThuLai(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body });
const jp = JSON.parse(await rp.text());
if (jp.status !== "success") { log("✗ Apps Script từ chối: " + (jp.message || "?")); process.exit(4); }
log("");
log(`✓ Đã ghi tab "${TAB}" (${rows.length} dòng × ${HEADER.length} cột) vào Sheet factory.`);
log(`  https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`);
process.exit(0);
