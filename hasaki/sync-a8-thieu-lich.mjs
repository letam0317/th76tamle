/**
 * sync-a8-thieu-lich.mjs — TOÀN BỘ vị trí F0-A8 + tình trạng phát yêu cầu vệ sinh → tab Sheet factory.
 *
 * BỐI CẢNH — HAI ĐỢT LỊCH GỐC BỊ SỬA HÀNG LOẠT bởi `api@hasaki.vn` (user id 1001):
 *   • 08/07/2026 15:22–15:27 — chuyển hàng loạt lịch A8 sang Canceled (43 vị trí dừng từ 07/07),
 *     tạo lịch Draft thay thế chỉ dựng khung 1 mục "Trực diện" và KHÔNG tải ảnh ⇒ không duyệt được.
 *   • 07/08/2026 16:28–16:35 — sửa tiếp ~90 lịch kho 863 (A3/A4/A5/A6/A7/A8): **17 lịch A8 đang
 *     Approved rớt về `loc_sched_status_id=2` "Waiting for approve"** ⇒ A8 từ 18 yêu cầu/ngày còn 1
 *     (chỉ F0-A8-511-01-01-04 #484980 — lịch duy nhất do tamlc@hasaki.vn duyệt tay, không bị đụng).
 *     Kèm theo: **17 yêu cầu ngày 07/08 đang ở trạng thái New bị XOÁ** (ảnh chụp 07/08 10:44 còn đủ
 *     18 yêu cầu ngày đó — giữ tại `.exports/a8-requests-anhchup-20260807-1044.json`).
 *   ⇒ Luật: CHỈ lịch **Approved (3)** mới sinh yêu cầu hằng ngày. Rớt về 2/1 là tắt ngay.
 *
 * BẢN 08/08/2026 — hai thay đổi so với bản đầu:
 *   1) Liệt kê **TẤT CẢ** vị trí F0-A8 (hợp của: từng có yêu cầu ∪ đang có lịch gốc), không chỉ
 *      nhóm đã im lặng — vì nay gần như cả khu đều dừng, danh sách "im lặng" không còn ý nghĩa.
 *   2) Mã yêu cầu đại diện mỗi vị trí = yêu cầu mang **BỘ ẢNH TIÊU CHUẨN ĐẦY ĐỦ NHẤT, và mới nhất
 *      trong nhóm đầy đủ đó** (vd 8/8 ảnh), thay vì yêu cầu gần nhất theo ngày — yêu cầu gần nhất
 *      có thể mang bộ ảnh cũ/thiếu. Cột "YC gần nhất" vẫn là ngày yêu cầu SAU CÙNG (mốc ngừng phát);
 *      khi hai mốc lệch nhau, cột Diễn giải nói rõ.
 *
 * Chỉ GET trên WMS (token phiên sống — không đăng nhập, không đá ai) + 1 POST ghi Sheet.
 *   node sync-a8-thieu-lich.mjs          → ghi tab A8-THIEU-LICH-VESINH của Sheet factory
 *   node sync-a8-thieu-lich.mjs --dry    → chỉ in ra, không ghi Sheet
 *   FRESH=1 node sync-a8-thieu-lich.mjs  → bỏ cache yêu cầu, kéo lại từ WMS
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
const CTY = 1001, WH = 863;

/* Mốc xét = HÔM NAY theo giờ VN (trước đây hard-code 07/08 → "số ngày không có YC" đứng im). */
const MOC = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });

if (!APPSCRIPT_KEY && !DRY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

const token = await layTokenSongWms(DIR, log);
if (!token) { log("✗ Không có token phiên sống — chạy lại khi operator online."); process.exit(2); }
const HX = { authorization: token, "Company-Ids": String(CTY), accept: "application/json" };

/* ---------- 1) Toàn bộ yêu cầu F0-A8 (mọi trạng thái, mọi thời điểm) ---------- */
let all = null;
try {
  const c = JSON.parse(fs.readFileSync(CACHE, "utf8"));
  if (Date.now() - c.at < 30 * 60000 && !process.env.FRESH) { all = c.records; log(`↺ Cache ${all.length} yêu cầu F0-A8.`); }
} catch { /* chưa có cache */ }
if (!all) {
  const base = `${EXT}/planogram/schedule-requests?company_ids=${CTY}&warehouse_ids=${WH}&keyword_type=sku_or_barcode&location_description=F0-A8`;
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
  const j = await (await fetchThuLai(`${EXT}/planogram/schedule/location-schedules?page=${p}&size=100&company_ids=${CTY}&warehouse_ids=${WH}`, { headers: HX })).json();
  schs.push(...(j.records || []));
  if (schs.length >= (j.count || 0) || !(j.records || []).length) break;
}
const schSong = {};   // location -> lịch đang sống MỚI NHẤT
schs.filter((s) => /^F0-A8/i.test(s.location_description || "")).forEach((s) => {
  const cu = schSong[s.location_description];
  if (!cu || s.schedule_id > cu.schedule_id) schSong[s.location_description] = s;
});
log(`✓ Lịch gốc đang sống: ${schs.length} toàn kho · ${Object.keys(schSong).length} vị trí F0-A8.`);

/* ---------- 3) TẤT CẢ vị trí A8 = (từng có yêu cầu) ∪ (đang có lịch gốc) ---------- */
const nAnh = (a) => (a || []).filter((x) => String(x.image || "").trim()).length;
const ngayCua = (r) => String(r.request_time || "").slice(0, 10);
const byLoc = {};
all.forEach((r) => { if (/^F0-A8/i.test(r.location_description || "")) (byLoc[r.location_description] = byLoc[r.location_description] || []).push(r); });
const dsLoc = [...new Set([...Object.keys(byLoc), ...Object.keys(schSong)])].sort();
const chuaTungYC = dsLoc.filter((l) => !byLoc[l]);
log(`✓ Vị trí F0-A8: ${dsLoc.length} (từng có yêu cầu ${Object.keys(byLoc).length} · có lịch gốc ${Object.keys(schSong).length}` +
  (chuaTungYC.length ? ` · chưa từng có yêu cầu ${chuaTungYC.length}` : "") + ")");

/* Yêu cầu ĐẠI DIỆN: bộ ảnh ĐẦY ĐỦ NHẤT, mới nhất trong nhóm đó (yêu cầu KÈM ẢNH, không phải mới nhất theo ngày). */
const chon = dsLoc.map((loc) => {
  const rs = (byLoc[loc] || []).slice().sort((a, b) => String(b.request_time).localeCompare(String(a.request_time)));
  if (!rs.length) return { loc, r: null, rMoi: null, tong: 0, maxAnh: 0 };
  const maxAnh = Math.max(...rs.map((r) => nAnh(r.standard_image)));
  const r = rs.find((x) => nAnh(x.standard_image) === maxAnh) || rs[0];   // rs đã sắp giảm dần theo ngày
  return { loc, r, rMoi: rs[0], tong: rs.length, maxAnh };
});
const lech = chon.filter((c) => c.r && c.rMoi && c.r.request_id !== c.rMoi.request_id).length;
log(`✓ Chọn mã yêu cầu theo bộ ảnh đầy đủ nhất — ${lech} vị trí có mã chọn KHÁC yêu cầu gần nhất.`);

/* ---------- 4) Lịch của yêu cầu đại diện hiện đang ở trạng thái nào? (4 luồng/đợt) ---------- */
const detailCache = {};
async function lichCua(id) {
  if (!id) return null;
  if (detailCache[id] !== undefined) return detailCache[id];
  try {
    const j = await (await fetchThuLai(`${EXT}/planogram/schedule/location-schedules/detail/${id}?page=1&size=20&is_view_schedule=true`, { headers: HX })).json();
    detailCache[id] = (j && j.item) || null;
  } catch { detailCache[id] = null; }
  return detailCache[id];
}
const canTra = [...new Set(chon.map((c) => c.r && c.r.schedule_id).filter(Boolean))];
for (let i = 0; i < canTra.length; i += 4) {
  await Promise.all(canTra.slice(i, i + 4).map(lichCua));
  if (i + 4 < canTra.length) await new Promise((r) => setTimeout(r, 200));
}
for (const c of chon) c.lichYc = c.r ? detailCache[c.r.schedule_id] || null : null;
log(`✓ Đã tra trạng thái lịch gốc của ${canTra.length} yêu cầu.`);

/* ---------- 5) Dựng dòng (GIỮ NGUYÊN 19 cột của template hôm qua) ---------- */
const chuKy = (arr) => (arr || []).map((x) => (x.image_name || "") + "::" + String(x.image || "").split("/").pop()).sort().join("|");
const soNgay = (d) => (d ? Math.round((new Date(MOC) - new Date(d)) / 86400000) : "");
const HEADER = ["STT", "Schedule request code", "Location", "Mô tả", "YC gần nhất", "Số ngày không có YC",
  "Trạng thái YC", "Ảnh tiêu chuẩn (YC)", "Request ID", "Schedule ID",
  "Trạng thái lịch của YC", "Lịch cập nhật lúc", "Lịch đang sống", "Trạng thái lịch đang sống",
  "Ảnh tiêu chuẩn (lịch đang sống)", "Ảnh chuẩn mới nhất?", "Diễn giải", "Tên ảnh tiêu chuẩn (YC)", "Link planogram"];

const rows = chon.map((c, i) => {
  const r = c.r, lYc = c.lichYc, lSong = schSong[c.loc] || null;
  const ckYc = r ? chuKy(r.standard_image) : "";
  const ckLichYc = lYc ? chuKy(lYc.standard_image) : "";
  const ckSong = lSong ? chuKy(lSong.standard_image) : "";
  const nSong = nAnh(lSong && lSong.standard_image);
  const ngayMoi = c.rMoi ? ngayCua(c.rMoi) : "";
  const conPhat = ngayMoi === MOC;

  /* Cột 16 "Ảnh chuẩn mới nhất?" — bộ ảnh trong yêu cầu ĐẠI DIỆN có còn là bản đầy đủ mới nhất không.
     Ba tình huống, tình huống giữa mới là cái dễ đọc nhầm:
       (a) vị trí KHÔNG còn lịch sống → không có bản khai báo nào mới hơn ⇒ vẫn là mới nhất.
       (b) có lịch mới hơn nhưng CHƯA TẢI ẢNH NÀO (0/n) → bản "mới" rỗng, không thay thế được gì.
       (c) lịch mới có bộ ảnh THẬT và khác ⇒ ảnh trong yêu cầu đã cũ. */
  let moiNhat, ghiAnh;
  if (!r) { moiNhat = ""; ghiAnh = "Vị trí chưa từng phát yêu cầu vệ sinh nào."; }
  else if (!lSong) {
    moiNhat = ckYc === ckLichYc || !ckLichYc ? "Có" : "Không";
    ghiAnh = ckYc === ckLichYc || !ckLichYc
      ? "Vị trí không còn lịch nào đang sống — bộ ảnh trong yêu cầu là bản khai báo mới nhất còn tồn tại."
      : "Lịch gốc đã đổi ảnh sau khi phát yêu cầu.";
  } else if (ckYc === ckSong) { moiNhat = "Có"; ghiAnh = "Trùng khớp bộ ảnh của lịch đang sống #" + lSong.schedule_id + "."; }
  else if (nSong === 0) {
    moiNhat = "Có";
    ghiAnh = "Lịch mới #" + lSong.schedule_id + " (" + (lSong.loc_sched_status_id_name || "?") + ", tạo " +
      String(lSong.created_at || "").slice(0, 10) + ") mới dựng khung " + (lSong.standard_image || []).length +
      " mục (" + (lSong.standard_image || []).map((x) => x.image_name).join(" / ") + ") và CHƯA TẢI ẢNH NÀO" +
      " — bộ ảnh trong yêu cầu vẫn là bản đầy đủ mới nhất.";
  } else {
    moiNhat = "Không";
    ghiAnh = "Lịch đang sống #" + lSong.schedule_id + " (" + (lSong.loc_sched_status_id_name || "?") + ", tạo " +
      String(lSong.created_at || "").slice(0, 10) + ") đã khai báo lại bộ ảnh khác gồm " + nSong + " ảnh: " +
      (lSong.standard_image || []).map((x) => x.image_name).join(" / ") + ".";
  }

  /* Cột 17 "Diễn giải" — LÝ DO DỪNG đứng trước, rồi mới tới ghi chú ảnh. Bốn nhóm, phân biệt bằng
     trạng thái lịch đang sống: chỉ Approved(3) mới sinh yêu cầu. */
  const stSong = lSong ? Number(lSong.loc_sched_status_id) : null;
  let lyDo;
  if (conPhat && stSong === 3) lyDo = "ĐANG CHẠY — lịch #" + lSong.schedule_id + " Approved, vẫn phát yêu cầu hằng ngày.";
  else if (stSong === 2) lyDo = "DỪNG vì CHỜ DUYỆT — lịch #" + lSong.schedule_id + " bị đẩy về 'Waiting for approve' lúc " +
    String(lSong.updated_at || "").slice(0, 16) + " bởi " + (lSong.updated_by_name || "?") + ". Ảnh đã đủ " + nSong + "/" +
    (lSong.standard_image || []).length + " ⇒ CHỈ CẦN DUYỆT LẠI là phát lại.";
  else if (stSong === 1 && nSong === 0) lyDo = "DỪNG vì THIẾU ẢNH — lịch #" + lSong.schedule_id + " còn Draft và chưa tải ảnh nào (0/" +
    (lSong.standard_image || []).length + ") ⇒ phải tải đủ ảnh tiêu chuẩn rồi mới trình duyệt được.";
  else if (stSong === 1) lyDo = "DỪNG vì CHƯA TRÌNH DUYỆT — lịch #" + lSong.schedule_id + " còn Draft (ảnh " + nSong + "/" +
    (lSong.standard_image || []).length + ").";
  else if (stSong === 3) lyDo = "Lịch #" + lSong.schedule_id + " Approved nhưng chưa thấy yêu cầu hôm nay — theo dõi thêm.";
  else if (!lSong) lyDo = "DỪNG vì KHÔNG CÒN LỊCH — vị trí không còn lịch gốc nào đang sống, phải tạo lịch mới.";
  else lyDo = "Lịch #" + lSong.schedule_id + " ở trạng thái " + stSong + " " + (lSong.loc_sched_status_id_name || "") + ".";

  const ghiChon = r && c.rMoi && r.request_id !== c.rMoi.request_id
    ? " [Mã YC ở cột B là bộ ảnh ĐẦY ĐỦ NHẤT (" + nAnh(r.standard_image) + "/" + (r.standard_image || []).length +
      ", ngày " + ngayCua(r) + "); yêu cầu sau cùng ngày " + ngayMoi + " chỉ có " + nAnh(c.rMoi.standard_image) + " ảnh.]"
    : "";

  return [
    i + 1, r ? r.schedule_request_code : "", c.loc, (r && r.description) || (lSong && lSong.description) || "",
    ngayMoi, conPhat ? 0 : soNgay(ngayMoi),
    r ? r.status_id + " " + (r.status_name || "") : "",
    r ? nAnh(r.standard_image) + "/" + (r.standard_image || []).length : "",
    r ? r.request_id : "", r ? r.schedule_id : "",
    lYc ? (lYc.loc_sched_status_id + " " + (lYc.loc_sched_status_id_name || "")) : (r ? "(không tra được)" : ""),
    lYc ? (lYc.updated_at || "") : "",
    /* Cột này phải THUẦN SỐ: trộn số với chữ thì gviz suy cột thành number rồi trả null cho mọi
       ô chữ — dashboard/đối chiếu sau này sẽ đọc ra rỗng. Chữ "(không còn lịch)" dồn sang cột
       trạng thái bên cạnh (vốn đã là cột chữ), không mất thông tin nào. */
    lSong ? lSong.schedule_id : "",
    lSong ? (lSong.loc_sched_status_id + " " + (lSong.loc_sched_status_id_name || "")) : "(không còn lịch)",
    lSong ? nAnh(lSong.standard_image) + "/" + (lSong.standard_image || []).length : "",
    moiNhat, lyDo + ghiChon + " " + ghiAnh,
    r ? (r.standard_image || []).map((x) => x.image_name).join(" / ") : "",
    r ? "https://planogram.hasaki.vn/asset-management/request-of-declaration/details/" + r.request_id : "",
  ];
});

/* ---------- 6) Tổng kết + ghi Sheet ---------- */
const iDG = HEADER.indexOf("Diễn giải");   // lấy index từ HEADER — đếm bằng số cứng đã sai một lần
const dem = (f) => rows.filter(f).length;
const batDau = (s) => (x) => String(x[iDG]).startsWith(s);
log("");
log(`── Tổng ${rows.length} vị trí F0-A8`);
log(`   đang chạy (Approved, có YC hôm nay): ${dem(batDau("ĐANG CHẠY"))}`);
log(`   dừng vì CHỜ DUYỆT (ảnh đủ):         ${dem(batDau("DỪNG vì CHỜ DUYỆT"))}`);
log(`   dừng vì THIẾU ẢNH (Draft 0 ảnh):    ${dem(batDau("DỪNG vì THIẾU ẢNH"))}`);
log(`   dừng vì chưa trình duyệt:           ${dem(batDau("DỪNG vì CHƯA"))}`);
log(`   dừng vì không còn lịch:             ${dem(batDau("DỪNG vì KHÔNG"))}`);
log(`── Ảnh tiêu chuẩn mới nhất?  Có: ${dem((x) => x[15] === "Có")} · Không: ${dem((x) => x[15] === "Không")}`);
const bo = {}; rows.forEach((x) => { if (x[7]) bo[x[7]] = (bo[x[7]] || 0) + 1; });
log(`── Bộ ảnh của mã YC được chọn: ${JSON.stringify(bo)}`);
log("");
rows.forEach((x) => log(`${String(x[0]).padStart(2)}. ${String(x[1]).padEnd(17)} ${x[2].padEnd(20)} YC cuối ${x[4]} ${String(x[5]).padStart(3)}n  ảnh ${String(x[7]).padEnd(5)} | lịch sống ${String(x[12]).padEnd(7)} ${x[13]}`));

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
