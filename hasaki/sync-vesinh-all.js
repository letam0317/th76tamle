/**
 * sync-vesinh-all.js — BỘ ĐỒNG BỘ VỆ SINH GỘP (SHOP - 170 QUOC LO 1A)
 * ============================================================================
 *  THAY THẾ 2 bộ cũ (sync-phutrach-quayke.js + sync-chamcong-vesinh.js) để
 *  TỐI ƯU TẢI HỆ THỐNG WMS/HR: chỉ QUÉT PLANOGRAM 1 LẦN + GỌI DANH BẠ 1 LẦN
 *  + TIMESHEET 1 LẦN, rồi sinh CẢ HAI tập dữ liệu.
 *  (Trước đây 2 bộ quét planogram 2 lần + gọi danh bạ 2 lần mỗi lượt cụm.)
 *
 *  Sinh 7 tab trên Google Sheet 5S (vẫn CHỈ 1 lượt quét planogram + 1 danh bạ + 1 timesheet):
 *   • PHU-TRACH-QUAY-KE : Location | Executed By | Code | Name
 *       - mọi vị trí F0-A1 (quầy kệ) + F0-A8 (không gian làm việc) + người phụ trách gần nhất.
 *       - 03/08/2026: danh sách vị trí lấy từ DANH MỤC CỘNG DỒN (.danhmuc-vitri.json) chứ không
 *         còn từ chính lượt quét → cửa sổ quét hẹp (poller 10 ngày) không làm mất vị trí nào.
 *   • CHAMCONG-VESINH   : Code | Name | Email | Major | Giờ vào | Giờ ra | Đã vệ sinh hôm nay | Vị trí gần nhất | Trạng thái
 *       - đội vệ sinh × chấm công hôm nay × đã vệ sinh hôm nay ("đi làm nhưng chưa vệ sinh").
 *   • VESINH-YEUCAU     : từng YÊU CẦU vệ sinh (7 ngày) — Status ID, người thực hiện + giờ, phụ
 *       trách dự kiến × chấm công. 03/08/2026 CẮT 5 cột suy được (−54% payload, xem HEADER_YC).
 *   • VESINH-ANH        : Request ID | Ngày | Ảnh — ảnh báo cáo tách khỏi VESINH-YEUCAU để tab
 *       nặng nhất lúc mở dashboard nhẹ đi 44KB; dashboard nạp bậc 3 (chỉ khi cần xem ảnh).
 *   • VESINH-NHATKY     : nhật ký NV × NGÀY × khu vực → danh sách vị trí đã vệ sinh (60 ngày,
 *       dựng từ VESINH-LICHSU cộng dồn) — pop-up "tra cứu 1 nhân viên làm ở đâu theo ngày".
 *   • VESINH-LICHSU     : LỊCH SỬ TỪNG LƯỢT BÁO CÁO theo VỊ TRÍ + GIỜ, cửa sổ TRƯỢT 60 NGÀY
 *       (Ngày | Giờ | Location | Executed By | Code | Name | Request ID). Đây là bộ nhớ BỀN của
 *       dự án: 3 tab kia đều bị cắt cửa sổ (YEUCAU 7 ngày · quét planogram 45 ngày) và PHU-TRACH
 *       chỉ giữ lượt GẦN NHẤT mỗi vị trí, nên trước đây không có cách nào đối chiếu "ai đã làm ô
 *       này, lúc nào" quá 45 ngày — pop-up vị trí đành hiện "không rõ ngày".
 *       CỘNG DỒN chứ không quét lại: mỗi lượt gộp lượt mới vào lịch sử cũ (.lichsu-vesinh.json,
 *       bootstrap từ chính tab nếu máy mới) rồi TỰ XOÁ mọi dòng rơi sang ngày thứ 61 → giữ đúng
 *       60 ngày gần nhất mà KHÔNG phải nới cửa sổ quét WMS (45 ngày như cũ).
 *   • VESINH-CHAMCONG-NGAY : CHẤM CÔNG THEO NGÀY (giờ vào ca + giờ ra cuối) của cả bộ phận,
 *       cửa sổ trượt 60 ngày, gói theo người: Code | Name | Email | Số ngày | "yyyy-mm-dd HH:MM-HH:MM | …".
 *       Trả lời câu quan trọng nhất khi xem lại MỘT NGÀY CŨ trên sơ đồ: hôm đó người phụ trách
 *       CÓ ĐI LÀM mà không báo cáo (đáng truy), hay nghỉ (phải bố trí người khác)? Tab
 *       CHAMCONG-VESINH chỉ có HÔM NAY nên không làm được việc này.
 *
 *  AN TOÀN PHIÊN: chỉ token phiên SỐNG (layTokenSongWms) — không login mới, không đá phiên.
 *  Không có token sống → HOÃN (exit 75) để sync-guard chạy lại (cụm 8h40, sau các bộ đã nạp token).
 *
 *  node sync-vesinh-all.js [--dry]
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenSongWms, DeferError, thoatTheoLoi, fetchThuLai, ghiMocBuoc, boQuaNeuDaTuoi, hashTab, tabKhongDoi, luuHashTab, chamMocTabs, docTabGas, gasPhucVuTab } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const SHEET_HASAKI = "1FWffWi75aATbokfqIcqjByEPzkJLQBngTXp5aPOIbLM";   // Sheet 5S (dashboard đọc)
const TAB_PT = "PHU-TRACH-QUAY-KE";
const TAB_CC = "CHAMCONG-VESINH";
const TAB_YC = "VESINH-YEUCAU";
const TAB_NK = "VESINH-NHATKY";
const TAB_LS = "VESINH-LICHSU";
const TAB_CCN = "VESINH-CHAMCONG-NGAY";
const TAB_ANH = "VESINH-ANH";
const EXT = "https://wms-gw-external.hasaki.vn/api/v1";
const WSHR_DIR = "https://wshr.hasaki.vn/api/news/staff/search-for-dropdown?limit=10000&sort=staff_id";
const TIMESHEET = "https://wshr.hasaki.vn/api/hr/timesheet";
const WAREHOUSE_ID = process.env.PHUTRACH_WH || "863";      // SHOP - 170 QUOC LO 1A
const HR_LOCATION = process.env.VS_HR_LOC || "398";
const HR_DEPT = process.env.VS_HR_DEPT || "121";
const COMPANY_IDS = "1001";
const AREA_RE = /^F0-A1|^F0-A8/i;
/* CỬA SỔ QUÉT PLANOGRAM. 45 ngày cho lượt cụm 8h40; nhịp poller 15' truyền PHUTRACH_DAYS=10
 * (03/08/2026) — quét 45 ngày lại từ đầu mỗi 15' là ~7 trang × 96 lượt/ngày dội WMS vô ích, trong
 * khi mọi thứ CẦN quá khứ nay đều CỘNG DỒN qua các lượt và không phụ thuộc cửa sổ quét nữa:
 *   • danh mục vị trí  → .danhmuc-vitri.json (bootstrap từ tab PHU-TRACH)
 *   • ai làm ô nào, lúc nào → VESINH-LICHSU (60 ngày, đã cộng dồn từ 01/08)
 *   • chấm công theo ngày   → VESINH-CHAMCONG-NGAY (60 ngày, đã cộng dồn từ 01/08)
 * Lượt cụm 8h40 vẫn quét đủ 45 ngày mỗi ngày một lần → mọi lệch tích luỹ đều được vá lại. */
const WINDOW_DAYS = Number(process.env.PHUTRACH_DAYS || 45);
/* VESINH-YEUCAU giữ N ngày (xem lại lịch sử trên sơ đồ). KHÔNG được vượt cửa sổ quét: lượt poller
   quét 10 ngày mà xin 30 ngày yêu cầu thì tab bị cắt cụt rồi ghi đè mất phần cũ. */
const YC_DAYS = Math.min(Number(process.env.VS_YC_DAYS || 7), WINDOW_DAYS);
const YC_ANH_NGAY = Number(process.env.VS_ANH_NGAY || 3);   // chỉ đính URL ảnh cho N ngày gần nhất (giảm payload)
/* DANH MỤC VỊ TRÍ (03/08/2026) — tập hợp MỌI vị trí F0-A1/F0-A8 từng thấy trên planogram, cộng dồn
 * qua các lượt. Đây là thứ duy nhất mà cửa sổ quét hẹp làm hỏng: tab PHU-TRACH-QUAY-KE vốn = "mọi
 * vị trí thấy trong 45 ngày", quét 10 ngày thì vị trí lâu không có yêu cầu biến mất khỏi tab →
 * dashboard mất luôn phần tách "đã dừng phát yêu cầu" ↔ "chưa khai báo lịch".
 * Ghi ngày THẤY GẦN NHẤT để còn quên được vị trí đã tháo khỏi mặt bằng (quá DM_NGAY). */
const DM_NGAY = Number(process.env.VS_DM_NGAY || 120);
const FILE_DM = path.join(DIR, ".danhmuc-vitri.json");      // không có PII (chỉ mã vị trí)
/* Đội vệ sinh (bảng CHAMCONG-VESINH) = ai CÓ báo cáo trong N ngày. Trước đây suy từ chính lượt
   quét nên phụ thuộc WINDOW_DAYS; nay lấy từ VESINH-LICHSU đã cộng dồn → giữ nguyên 45 ngày kể
   cả khi poller chỉ quét 10. */
const TEAM_NGAY = Number(process.env.VS_TEAM_NGAY || 45);
/* Cửa sổ TRƯỢT của VESINH-LICHSU: giữ 60 ngày gần nhất, sang ngày thứ 61 thì dòng đó bị xoá.
 * Dài hơn cửa sổ quét planogram (45 ngày) được vì lịch sử CỘNG DỒN qua các lượt sync — mỗi lượt
 * chỉ bổ sung lượt mới, không cần WMS trả lại quá khứ. Muốn có ngay 60 ngày đầy: chạy MỘT lần
 *   PHUTRACH_DAYS=60 node sync-vesinh-all.js
 * (quét rộng hơn ~1/3, chỉ nên làm 1 lần rồi để nhịp thường 45 ngày nuôi tiếp). */
const LS_NGAY = Number(process.env.VS_LS_NGAY || 60);
const FILE_LS = path.join(DIR, ".lichsu-vesinh.json");      // bộ nhớ lịch sử (CÓ PII: email/tên NV) — đã gitignore
/* CHẤM CÔNG THEO NGÀY (VESINH-CHAMCONG-NGAY) — cửa sổ trượt 60 ngày như lịch sử báo cáo.
 * VÌ SAO: pop-up ô sơ đồ cho chọn NGÀY, mà tab CHAMCONG-VESINH chỉ có chấm công HÔM NAY → xem lại
 * ngày 29/07 không trả lời được câu quan trọng nhất "hôm đó người phụ trách CÓ ĐI LÀM mà không báo
 * cáo, hay nghỉ?". Cũng cộng dồn: mỗi lượt chỉ lấy lại CC_LAY ngày gần nhất (chấm công bị sửa/duyệt
 * muộn — quan sát thật: dòng ngày 31/07 còn được updated_at 22:00 cùng ngày, giờ ra vào muộn), phần
 * cũ hơn đã nằm trong cache/tab. */
const CC_NGAY = Number(process.env.VS_CC_NGAY || 60);       // giữ lại bao nhiêu ngày
const CC_LAY = Number(process.env.VS_CC_LAY || 7);          // mỗi lượt gọi HR lấy lại N ngày gần nhất
const FILE_CCN = path.join(DIR, ".chamcong-ngay.json");     // CÓ PII — đã gitignore
/* MỌI url ảnh planogram dùng chung 76 ký tự đầu — đúng một nửa độ dài trung bình (đo 30/07:
 * 1000 ảnh × 154 ký tự). Ghi phần ĐUÔI thôi, dashboard ghép lại tiền tố (urlAnh trong
 * hasaki-planogram.js) → tab VESINH-YEUCAU nhẹ đi ~74KB mỗi lượt người dùng mở trang. */
const ANH_PREFIX = "https://wms-gw-external.hasaki.vn/api/v1/filesmanagement/planogram/standard/";
const gonAnh = (u) => { const s = String(u || ""); return s.startsWith(ANH_PREFIX) ? s.slice(ANH_PREFIX.length) : s; };
const SIZE = 500, MAX_PAGE = 300;
const DRY = process.argv.includes("--dry");
const HEADER_PT = ["Location", "Executed By", "Code", "Name", "Executed At"];
const HEADER_CC = ["Code", "Name", "Email", "Major", "Giờ vào", "Giờ ra", "Đã vệ sinh hôm nay", "Vị trí gần nhất", "Trạng thái"];
/* VESINH-YEUCAU — tab NẶNG NHẤT lúc mở dashboard. Đo thật 03/08/2026 (1.246 dòng, 246KB) rồi cắt
 * 5 cột SUY ĐƯỢC, không cột nào mất thông tin (đối chiếu trên chính dữ liệu đang chạy):
 *   Khu vực   28KB — dashboard không hề đọc, nó tự suy từ tiền tố F0-A1/F0-A8 của Location.
 *   Trạng thái 19KB — ánh xạ 1:1 với Status ID (1 New · 3 Waiting For Approve · 4 Approved
 *                     · 7 Not Performed — 4 giá trị, không có ngoại lệ nào trong 1.246 dòng).
 *   PT Name   32KB — 0/47 email phụ trách tra không ra tên từ PHU-TRACH + VESINH-PHANCONG
 *                     (2 tab dashboard đã nạp sẵn ở bậc 1).
 *   PT lần cuối 10KB — khớp 1246/1246 với cột Executed At của PHU-TRACH-QUAY-KE.
 *   Ảnh      44KB — tách sang tab VESINH-ANH nạp BẬC 3 (chỉ cần khi mở pop-up / danh sách).
 * Còn 113KB (−54%). Cột giữ lại đều là dữ liệu GỐC không suy được từ tab khác. */
const HEADER_YC = ["Request ID", "Ngày", "Location", "Status ID", "Executed By", "Executed At", "Phụ trách", "PT Code", "PT đi làm", "PT giờ vào"];
/* Ảnh báo cáo tách riêng: dòng nào KHÔNG có ảnh thì không có mặt ở đây (1.246 yêu cầu nhưng chỉ
   vài trăm lượt có ảnh) → tab này còn nhẹ hơn phần 44KB nó gánh đi. */
const HEADER_ANH = ["Request ID", "Ngày", "Ảnh"];
const HEADER_NK = ["Ngày", "Email", "Code", "Name", "Khu vực", "Số vị trí", "Vị trí"];
const HEADER_LS = ["Ngày", "Giờ", "Location", "Executed By", "Code", "Name", "Request ID"];
/* Chấm công GÓI THEO NGƯỜI, không phải 1 dòng/ngày: 60 ngày × ~82 NV = ~4.900 dòng (~270KB qua
 * readTab) chỉ để pop-up dùng đúng 1 ngày — gói lại còn ~90 dòng (~90KB) mà vẫn đọc được bằng mắt
 * trên Sheet. Ô "Chấm công": "2026-08-01 05:54-17:32 | 2026-07-31 05:47-16:58 | …" (mới → cũ,
 * thiếu giờ thì ??:??). */
const HEADER_CCN = ["Code", "Name", "Email", "Số ngày", "Chấm công theo ngày (ngày vào-ra)"];

const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
if (!APPSCRIPT_KEY && !DRY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

function hhmm(ts){ if (!ts) return ""; return new Date(ts * 1000).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }); }
function todayVN(){ return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }); }   // YYYY-MM-DD

/** Khoá ô GIỐNG dashboard (khoaO): A1 gom về mức KỆ (1 kệ nhiều mã mâm-bin), A8 giữ mã đầy đủ. */
function khoaO(loc){ const m = String(loc).match(/^F0-A1-(\d{3})-(\d{2})-/); return m ? `F0-A1-${m[1]}-${m[2]}` : String(loc).toUpperCase(); }
/** Bảng phân công VESINH-PHANCONG (sync-phancong.mjs ghi) = nguồn CHÍNH THỨC "ai phụ trách ô này".
 *  Thay cho suy đoán "executor gần nhất" chỉ phủ ~1/3 ô: đối chiếu 7 ngày báo cáo thật cho thấy
 *  205/205 lượt đều do đúng người được giao làm. Chưa có bảng (GAS cũ / chưa chạy) → trả {} và
 *  luồng cũ giữ nguyên. Lưu ý thứ tự: bộ này chạy TRƯỚC sync-phancong nên đọc bảng của lượt trước
 *  — phân công đổi rất thưa nên lệch tối đa 1 nhịp poller (15'), chấp nhận được. */
async function docPhanCong(){
  const t = await docTabGas("VESINH-PHANCONG");
  if (!t || !t.header.length) return {};
  const hl = t.header.map((h) => String(h).trim().toLowerCase());
  const iL = hl.indexOf("location"), iE = hl.indexOf("responsible by"), iC = hl.indexOf("code"), iN = hl.indexOf("name");
  if (iL < 0 || iE < 0) return {};
  const by = {};
  for (const row of t.rows) {
    const L = String(row[iL] || "").trim(), em = String(row[iE] || "").trim().toLowerCase();
    if (L && em) by[khoaO(L)] = { em, code: String(row[iC] || "").trim(), ten: String(row[iN] || "").trim() };
  }
  return by;
}
/* ===== DANH MỤC VỊ TRÍ — CỘNG DỒN, ĐỘC LẬP VỚI CỬA SỔ QUÉT (03/08/2026) =====================
 * { "F0-A1-513-10-04-01": "2026-08-03", ... }  — giá trị = ngày THẤY GẦN NHẤT trên planogram.
 * Máy mới / mất cache → dựng lại từ chính tab PHU-TRACH-QUAY-KE (nó vốn là danh sách vị trí).
 * Vị trí quá DM_NGAY ngày không thấy lượt quét nào nhắc tới = đã tháo khỏi mặt bằng → quên đi.
 * (Lượt cụm 8h40 quét đủ 45 ngày mỗi ngày nên mọi vị trí còn sống đều được chạm lại thường xuyên
 *  — ngưỡng 120 ngày là thừa an toàn, không có chuyện quên nhầm vị trí đang dùng.) */
function docDanhMucLocal(){ try { const j = JSON.parse(fs.readFileSync(FILE_DM, "utf8")); return (j && j.loc) || {}; } catch { return {}; } }
async function docDanhMucTab(homNay){
  const t = await docTabGas(TAB_PT); if (!t || !t.rows.length) return {};
  const hl = t.header.map((h) => String(h).replace(/\s+/g, " ").trim().toLowerCase());
  const iL = hl.indexOf("location"); if (iL < 0) return {};
  const dm = {};
  for (const r of t.rows){ const L = String(r[iL] || "").trim(); if (L && AREA_RE.test(L)) dm[L] = homNay; }
  return dm;
}
async function gopDanhMuc(locScan, homNay, mocQuen){
  let dm = docDanhMucLocal(), nguonCu = "cache máy";
  if (!Object.keys(dm).length){ dm = await docDanhMucTab(homNay); nguonCu = Object.keys(dm).length ? "tab " + TAB_PT + " (cache máy trống)" : "chưa có"; }
  let nMoi = 0;
  for (const L in locScan){ if (!dm[L]) nMoi++; dm[L] = homNay; }
  let nQuen = 0;
  for (const L in dm) if (dm[L] < mocQuen){ delete dm[L]; nQuen++; }
  return { dm, nMoi, nQuen, nguonCu };
}

/* ===== LỊCH SỬ BÁO CÁO 60 NGÀY (VESINH-LICHSU) — CỘNG DỒN + TỰ XOÁ NGÀY THỨ 61 ==============
 * Một lượt báo cáo = { n: ngày, g: giờ HH:MM, l: location đầy đủ, e: email, c: code, t: tên, id: request }.
 * KHOÁ TRÙNG = Request ID (mỗi yêu cầu chỉ báo cáo 1 lần); không có id thì lấy vị trí|thời điểm|người.
 * Tên/mã LƯU LUÔN vào lịch sử chứ không tra lại danh bạ mỗi lượt: NV nghỉ việc sẽ rơi khỏi danh bạ
 * wshr, tra lại thì lịch sử cũ mất tên — mà "ai đã làm ô này 2 tháng trước" chính là thứ cần đối chiếu. */
function khoaLuot(v){ return v.id ? "#" + v.id : v.l + "|" + v.n + " " + v.g + "|" + v.e; }
function docLichSuLocal(){
  try {
    const j = JSON.parse(fs.readFileSync(FILE_LS, "utf8"));
    return Array.isArray(j.ev) ? j.ev : [];
  } catch { return []; }
}
/** Máy mới / mất file cache → dựng lại lịch sử từ chính tab trên Sheet (khỏi mất 60 ngày đã tích). */
async function docLichSuTab(){
  const t = await docTabGas(TAB_LS); if (!t || !t.rows.length) return [];
  const hl = t.header.map(h => String(h).replace(/\s+/g, " ").trim().toLowerCase());
  const i = (ten) => hl.findIndex(h => h === ten);
  const iN = i("ngày"), iG = i("giờ"), iL = i("location"), iE = hl.findIndex(h => h.includes("executed by")),
        iC = i("code"), iT = i("name"), iR = hl.findIndex(h => h.includes("request"));
  if (iN < 0 || iL < 0) return [];
  return t.rows.map(r => ({
    n: String(r[iN] || "").slice(0, 10), g: String(r[iG] || "").slice(0, 5), l: String(r[iL] || "").trim(),
    e: String(r[iE] || "").trim().toLowerCase(), c: String(r[iC] || "").trim(), t: String(r[iT] || "").trim(),
    id: String(r[iR] || "").replace(/\.0$/, "").trim()
  })).filter(v => v.n && v.l && v.e);
}
/** Gộp lượt mới vào lịch sử cũ, cắt mọi dòng cũ hơn LS_NGAY ngày → { ev, nMoi, nXoa, nguonCu }. */
async function gopLichSu(evMoi, mocGiu){
  let cu = docLichSuLocal(), nguonCu = "cache máy";
  if (!cu.length){ cu = await docLichSuTab(); nguonCu = cu.length ? "tab trên Sheet (cache máy trống)" : "chưa có"; }
  const map = new Map();
  for (const v of cu) if (v.n >= mocGiu) map.set(khoaLuot(v), v);
  const nGiuCu = map.size, nXoa = cu.length - cu.filter(v => v.n >= mocGiu).length;
  let nMoi = 0;
  for (const v of evMoi){
    const k = khoaLuot(v);
    if (map.has(k)){   // đã có: chỉ vá ô trống (tên/mã lần đầu chưa tra được danh bạ)
      const o = map.get(k);
      if (!o.c && v.c) o.c = v.c;
      if (!o.t && v.t) o.t = v.t;
      continue;
    }
    map.set(k, v); nMoi++;
  }
  const ev = [...map.values()].sort((a, b) => (b.n + " " + b.g).localeCompare(a.n + " " + a.g) || a.l.localeCompare(b.l));
  return { ev, nMoi, nXoa, nGiuCu, nguonCu };
}
/* ===== CHẤM CÔNG THEO NGÀY 60 NGÀY (VESINH-CHAMCONG-NGAY) — cộng dồn + tự xoá ngày thứ 61 =====
 * Cấu trúc trong bộ nhớ: nv[code] = { ten, em, d: { "2026-08-01": "05:54-17:32" } }.
 * Mỗi lượt XOÁ SẠCH các ngày thuộc cửa sổ vừa gọi lại HR rồi nạp lại — để bản sửa/huỷ chấm công
 * ghi đè được (nếu chỉ merge thì dòng cũ đã sai sẽ sống mãi). */
const GIO_TRONG = "??:??";   // thiếu giờ (chưa chấm ra / quên chấm) — KHÔNG dùng "--:--" vì nối vào thành "05:50---:--" đọc ra như lỗi
function docCcLocal(){ try { const j = JSON.parse(fs.readFileSync(FILE_CCN, "utf8")); return (j && j.nv) || {}; } catch { return {}; } }
async function docCcTab(){
  const t = await docTabGas(TAB_CCN); if (!t || !t.rows.length) return {};
  const hl = t.header.map(h => String(h).replace(/\s+/g, " ").trim().toLowerCase());
  const iC = hl.findIndex(h => h === "code"), iT = hl.findIndex(h => h === "name"),
        iE = hl.findIndex(h => h.includes("email")), iD = hl.findIndex(h => h.includes("chấm công"));
  if (iC < 0 || iD < 0) return {};
  const nv = {};
  for (const r of t.rows){
    const code = String(r[iC] || "").replace(/\.0$/, "").trim(); if (!code) continue;
    const o = nv[code] || (nv[code] = { ten: String(r[iT] || "").trim(), em: String(r[iE] || "").trim(), d: {} });
    for (const m of String(r[iD] || "").matchAll(/(\d{4}-\d{2}-\d{2})\s+(\S+)-(\S+)/g)) o.d[m[1]] = m[2] + "-" + m[3];
  }
  return nv;
}
async function gopChamCong(attNgay, nvTS, byCode, mocGiu, tuNgay, chiCode){
  let nv = docCcLocal(), nguonCu = "cache máy";
  if (!Object.keys(nv).length){ nv = await docCcTab(); nguonCu = Object.keys(nv).length ? "tab trên Sheet (cache máy trống)" : "chưa có"; }
  let nXoaNgay = 0;
  for (const code in nv) for (const d in nv[code].d) if (d >= tuNgay){ delete nv[code].d[d]; nXoaNgay++; }   // cửa sổ vừa lấy lại
  let nMoi = 0, nBoQua = 0;
  for (const d in attNgay){
    for (const code in attNgay[d]){
      /* CHỈ GIỮ ĐỘI VỆ SINH (bảng phân công + người từng báo cáo). Cả bộ phận là ~117 NV/ngày →
         60 ngày ≈ 7.000 ô, tab phình ~200KB cho một nguồn mà pop-up chỉ tra đúng người phụ trách;
         lọc còn ~65 NV thì nhẹ ~1/3 VÀ bớt PII của người không liên quan. */
      if (chiCode && !chiCode.has(String(code))){ nBoQua++; continue; }
      const a = attNgay[d][code], dir = byCode[code] || {};
      const o = nv[code] || (nv[code] = { ten: "", em: "", d: {} });
      if (!o.ten) o.ten = nvTS[code] || dir.ten || "";
      if (!o.em) o.em = dir.em || "";
      o.d[d] = (a.ci ? hhmm(a.ci) : GIO_TRONG) + "-" + (a.co ? hhmm(a.co) : GIO_TRONG);
      nMoi++;
    }
  }
  let nQuaHan = 0;
  for (const code in nv){
    for (const d in nv[code].d) if (d < mocGiu){ delete nv[code].d[d]; nQuaHan++; }
    if (!Object.keys(nv[code].d).length) delete nv[code];   // NV không còn ngày nào trong 60 ngày
  }
  return { nv, nMoi, nQuaHan, nXoaNgay, nBoQua, nguonCu };
}
async function ghiTab(tab, header, rows){
  if (DRY){ fs.mkdirSync(path.join(DIR, ".exports"), { recursive: true }); fs.writeFileSync(path.join(DIR, ".exports", tab + "-out.json"), JSON.stringify({ header, rows }, null, 2)); log("  (DRY) " + tab + ": " + rows.length + " dòng → .exports/" + tab + "-out.json"); return; }
  if (!rows.length){ log("  ⚠ " + tab + ": 0 dòng — BỎ QUA (giữ dữ liệu cũ)."); return; }
  // Nhịp poller 15': dữ liệu thường KHÔNG đổi giữa 2 lượt — so hash với lần ghi trước, giống thì khỏi ghi.
  const hash = hashTab(header, rows);
  if (tabKhongDoi(DIR, tab, hash)) {
    log("  = " + tab + ": không đổi — bỏ qua ghi (" + rows.length + " dòng).");
    await chamMocTabs([tab], Date.now(), log);   // chip giờ dashboard vẫn chạy theo giờ quét planogram thật
    return;
  }
  // KHÔNG truyền sheetId → GAS tự định tuyến 2 tab whitelist (SERVE_PRIVATE_TABS) sang SHEET PRIVATE bí mật.
  const body = JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, tab, header, rows, apiAt: Date.now() });
  const j = await (await fetchThuLai(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body })).json();
  if (j.status !== "success") throw new Error("Ghi " + tab + " lỗi: " + (j.message || "?"));
  luuHashTab(DIR, tab, hash);
  log("  ✓ " + tab + ": ghi " + (j.written || rows.length) + " dòng.");
}

(async () => {
  // Lượt guard chạy VÁ bước khác mà vesinh hôm nay đã xong → thoát sớm (mốc .sync-ok-vesinh).
  if (!DRY && boQuaNeuDaTuoi(DIR, "vesinh", log)) process.exit(0);
  const token = await layTokenSongWms(DIR, log);
  if (!token) throw new DeferError("Chưa có token phiên sống — hoãn, sync-guard sẽ chạy lại.");
  const H = { authorization: token };
  const HX = { authorization: token, "Company-Ids": COMPANY_IDS };
  const today = todayVN();

  // 1) DANH BẠ wshr → email -> { code, name, major }. CACHE 12h (.cache-danhba.json — có PII,
  // đã gitignore): nhịp poller 15' mà tải lại 5.6k NV mỗi lượt là dội wshr vô ích; danh bạ đổi theo ngày.
  const CACHE_DB = path.join(DIR, ".cache-danhba.json");
  const byEmail = {};
  let dsNV = null;
  try { const c = JSON.parse(fs.readFileSync(CACHE_DB, "utf8")); if (Date.now() - c.at < 12 * 3600 * 1000 && Array.isArray(c.data) && c.data.length) dsNV = c.data; } catch { /* chưa có cache */ }
  if (dsNV) log("✓ Danh bạ wshr: dùng cache <12h (" + dsNV.length + " NV, khỏi gọi lại).");
  else {
    try {
      dsNV = (await (await fetch(WSHR_DIR, { headers: H })).json()).data || [];
      try { fs.writeFileSync(CACHE_DB, JSON.stringify({ at: Date.now(), data: dsNV })); } catch { /* cache best-effort */ }
      log("✓ Danh bạ wshr (tải mới): " + dsNV.length + " NV.");
    } catch (e) {
      try { dsNV = JSON.parse(fs.readFileSync(CACHE_DB, "utf8")).data || []; log("  ⚠ Danh bạ wshr lỗi (" + e.message + ") — dùng cache cũ " + dsNV.length + " NV."); }
      catch { dsNV = []; log("  ⚠ Danh bạ wshr lỗi (" + e.message + ") — vẫn ghi email, để trống Code/Name."); }
    }
  }
  const byCodeDir = {};   // mã NV -> { em, ten } (chấm công HR chỉ trả mã + tên, cần vá email)
  for (const s of dsNV) if (s.staff_email) {
    byEmail[String(s.staff_email).toLowerCase()] = { code: String(s.code || ""), name: s.staff_name || "", major: s.staff_major || "" };
    if (s.code) byCodeDir[String(s.code)] = { em: String(s.staff_email).toLowerCase(), ten: s.staff_name || "" };
  }

  // 2) QUÉT PLANOGRAM (1 LẦN) → gom đồng thời: (a) phụ trách theo vị trí; (b) đội vệ sinh + đã vệ sinh hôm nay
  const DAY = 24 * 3600 * 1000, now = Date.now();
  const to = now, from = now - WINDOW_DAYS * DAY;
  const isoNgay = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  const mocYc = isoNgay(now - (YC_DAYS - 1) * DAY), mocAnh = isoNgay(now - (YC_ANH_NGAY - 1) * DAY);
  const base = `${EXT}/planogram/schedule-requests?company_ids=${COMPANY_IDS}&warehouse_ids=${WAREHOUSE_ID}&from_date=${from}&to_date=${to}`;
  const loc = {};    // location -> { at, email }              (PHU-TRACH — bù thêm từ danh mục + lịch sử)
  const team = {};   // emailLower -> { email, lastAt, todayCount, todayLoc }   (CHAMCONG)
  const reqToday = [];  // yêu cầu cửa sổ YC_DAYS ngày           (VESINH-YEUCAU)
  const evLS = [];      // từng lượt báo cáo (vị trí + GIỜ)     (VESINH-LICHSU — cộng dồn 60 ngày)
  const khuOf = (L) => /^F0-A8/i.test(L) ? "Không gian làm việc (F0-A8)" : "Quầy kệ (F0-A1)";
  let scanned = 0, total = null, pages = 0;
  for (let page = 1; page <= MAX_PAGE; page++) {
    const r = await fetchThuLai(base + "&page=" + page + "&size=" + SIZE, { headers: HX });
    if (r.status === 401 || r.status === 403) throw new DeferError("Token hết hạn giữa chừng (HTTP " + r.status + ").");
    if (!r.ok) { log("  ⚠ planogram trang " + page + " HTTP " + r.status); break; }
    const j = await r.json().catch(() => null); if (!j || !j.records || !j.records.length) { if (total === null) total = j && j.count; break; }
    if (total === null) total = j.count ?? null;
    scanned += j.records.length; pages = page;
    for (const it of j.records) {
      const L = String(it.location_description || ""); if (!AREA_RE.test(L)) continue;
      const email = String(it.executed_by_name || "").trim();
      const at = it.executed_at || "";
      // (a) phụ trách theo vị trí: giữ MỌI vị trí; gắn executor gần nhất
      const cl = loc[L] || (loc[L] = { at: "", email: "" });
      if (email && at > cl.at) { cl.at = at; cl.email = email; }
      // (b) đội vệ sinh: chỉ dòng có executor
      if (email) {
        const k = email.toLowerCase();
        const t = team[k] || (team[k] = { email: email, lastAt: "", todayCount: 0, todayLoc: "" });
        if (at > t.lastAt) t.lastAt = at;
        if (at.slice(0, 10) === today) { t.todayCount++; if (L > t.todayLoc) t.todayLoc = L; }
        /* (d) LỊCH SỬ 60 NGÀY: giữ nguyên GIỜ báo cáo — pop-up vị trí cần đúng "lúc mấy giờ"
           để đối chiếu với chấm công, và đây là dữ liệu duy nhất sống lâu hơn cửa sổ quét. */
        if (at.length >= 16) evLS.push({ n: at.slice(0, 10), g: at.slice(11, 16), l: L, e: k, c: "", t: "", id: String(it.request_id || "") });
      }
      // (c) yêu cầu trong CỬA SỔ YC_DAYS ngày (mọi trạng thái) + ảnh báo cáo (chỉ YC_ANH_NGAY ngày gần)
      const ngayYC = String(it.request_time || "").slice(0, 10);
      if (ngayYC >= mocYc) {
        reqToday.push({
          id: it.request_id, ngay: ngayYC, loc: L,
          stId: it.status_id, stName: it.status_name || "",   // stName chỉ để LOG đối chiếu ánh xạ, không ghi Sheet nữa
          email: email, at: at,
          anh: ngayYC >= mocAnh ? (it.request_image || []).map((x) => gonAnh(x && x.image)).filter(Boolean).join(" | ") : ""
        });
      }
    }
    if (j.records.length < SIZE) break;
    await nghi(250);
  }
  log("✓ Quét planogram (" + WINDOW_DAYS + " ngày, " + pages + " trang): " + scanned + " request (count=" + total + "). Vị trí: " + Object.keys(loc).length + " · đội vệ sinh: " + Object.keys(team).length + ".");

  /* 2b) GỘP LỊCH SỬ + DANH MỤC VỊ TRÍ **TRƯỚC** khi dựng bảng (03/08/2026 — đảo thứ tự so với bản
   *     cũ, khi đó lịch sử gộp mãi ở bước 4e nên 3 bảng trên nó vẫn phải sống bằng lượt quét).
   *     Đây là chỗ cửa sổ quét hẹp được BÙ LẠI: mọi thứ cần quá khứ đều lấy từ 2 kho cộng dồn này.
   *     Với lượt quét đủ 45 ngày thì phần bù gần như bằng 0 → hành vi không đổi. */
  const mocGiu = isoNgay(now - (LS_NGAY - 1) * DAY);
  for (const v of evLS){ const m = byEmail[v.e] || {}; v.c = m.code || ""; v.t = m.name || ""; }
  const ls = await gopLichSu(evLS, mocGiu);
  const lsMoiNhat = {};   // location -> lượt báo cáo GẦN NHẤT (ls.ev đã sort mới → cũ)
  for (const v of ls.ev) if (!lsMoiNhat[v.l]) lsMoiNhat[v.l] = v;

  const dmoc = await gopDanhMuc(loc, today, isoNgay(now - (DM_NGAY - 1) * DAY));
  for (const L in dmoc.dm) if (!loc[L]) loc[L] = { at: "", email: "" };
  /* Vị trí lượt quét này không thấy ai báo cáo → tra lượt gần nhất trong lịch sử 60 ngày.
     Lượt quét LUÔN mới hơn lịch sử nên chỉ bù chỗ TRỐNG, không bao giờ ghi đè bản mới. */
  let nBu = 0;
  for (const L in loc) if (!loc[L].email){ const v = lsMoiNhat[L]; if (v){ loc[L].email = v.e; loc[L].at = v.n + " " + v.g; nBu++; } }
  log("✓ Danh mục vị trí: " + Object.keys(dmoc.dm).length + " vị trí (+" + dmoc.nMoi + " mới, -" + dmoc.nQuen +
    " quá " + DM_NGAY + " ngày không thấy) · cũ đọc từ: " + dmoc.nguonCu + " · bù người phụ trách từ lịch sử cho " + nBu + " vị trí.");
  /* CHỐT AN TOÀN cho cửa sổ quét hẹp: máy mới (cache trống) mà ĐỒNG THỜI không đọc được tab
     PHU-TRACH để bootstrap → danh mục chỉ còn đúng những vị trí lượt quét hẹp nhìn thấy. Ghi đè
     tab bằng danh sách cụt đó sẽ làm dashboard báo nhầm hàng chục vị trí là "đã dừng phát yêu
     cầu". Thà GIỮ dữ liệu cũ và đợi lượt cụm 45 ngày (chạy mỗi ngày) dựng lại cho đủ. */
  const dmCut = dmoc.nguonCu === "chưa có" && WINDOW_DAYS < 45;
  if (dmCut) log("  ⚠ Chưa có danh mục vị trí (cache trống + không đọc được tab " + TAB_PT + ") mà lượt này chỉ quét " +
    WINDOW_DAYS + " ngày — BỎ QUA ghi " + TAB_PT + " để không cắt cụt danh sách vị trí. Lượt cụm 45 ngày sẽ dựng lại đủ.");

  /* ĐỘI VỆ SINH: bù người có báo cáo trong TEAM_NGAY ngày mà lượt quét (hẹp) không thấy.
     todayCount/todayLoc vẫn chỉ lấy từ lượt quét — cửa sổ nào cũng chứa hôm nay. */
  const mocTeam = isoNgay(now - (TEAM_NGAY - 1) * DAY);
  let nBuTeam = 0;
  for (const v of ls.ev){
    if (v.n < mocTeam || !v.e) continue;
    if (!team[v.e]){ team[v.e] = { email: v.e, lastAt: v.n + " " + v.g, todayCount: 0, todayLoc: "" }; nBuTeam++; }
  }
  /* NHẬT KÝ NV × NGÀY × KHU: dựng từ lịch sử cộng dồn thay vì lượt quét → phủ đúng LS_NGAY ngày,
     không co giãn theo cửa sổ quét (và rộng hơn bản cũ 45 ngày). */
  const nhatky = {};
  for (const v of ls.ev){
    const key = v.n + "|" + v.e + "|" + khuOf(v.l);
    const nk = nhatky[key] || (nhatky[key] = { locs: [] });
    if (!nk.locs.includes(v.l)) nk.locs.push(v.l);
  }
  if (nBuTeam) log("  + đội vệ sinh: bù " + nBuTeam + " NV có báo cáo trong " + TEAM_NGAY + " ngày mà lượt quét không thấy.");

  /* 3) TIMESHEET — lấy CẢ KHOẢNG CC_LAY ngày trong 1 lượt phân trang (dòng timesheet có trường
        `date`, đã kiểm chứng 01/08/2026) rồi gom theo NGÀY. Vẫn chỉ 1-2 request như trước, nhưng
        có dữ liệu cho pop-up xem NGÀY QUÁ KHỨ; `att` (hôm nay) giữ nguyên cho các bảng cũ.
        Lấy lại nhiều ngày chứ không chỉ hôm nay vì chấm công CÒN SỬA sau đó (giờ ra về, duyệt muộn). */
  const attNgay = {};   // "yyyy-mm-dd" -> { code: { ci, co } }
  const nvTS = {};      // code -> tên (từ HR — nguồn đúng nhất, kể cả NV đã rời danh bạ wms)
  const mocLay = isoNgay(now - (CC_LAY - 1) * DAY);
  let tsRows = 0;
  for (let off = 0; off < 40000; off += 2000) {
    const u = `${TIMESHEET}?location_id=${HR_LOCATION}&department_id=${HR_DEPT}&from_date=${mocLay}&to_date=${today}&limit=2000&offset=${off}`;
    const r = await fetchThuLai(u, { headers: H });
    if (!r.ok) { log("  ⚠ timesheet HTTP " + r.status); break; }
    const j = await r.json().catch(() => null); const rr = (j && j.data && j.data.rows) || [];
    if (!rr.length) break; tsRows += rr.length;
    for (const row of rr) {
      const code = String((row.staff && row.staff.code) || row.staff_code || ""); if (!code) continue;
      /* Ngày của dòng: ưu tiên trường `date` của HR; thiếu thì suy từ check_in theo giờ VN
         (đừng dùng today — dòng của ngày khác sẽ bị dồn sai vào hôm nay). */
      const d = String(row.date || "").slice(0, 10) ||
        (row.check_in ? isoNgay(row.check_in * 1000) : "");
      if (!d) continue;
      if (row.staff && row.staff.staff_name) nvTS[code] = String(row.staff.staff_name);
      const ngay = attNgay[d] || (attNgay[d] = {});
      const a = ngay[code] || (ngay[code] = { ci: null, co: null });
      if (row.check_in && (!a.ci || row.check_in < a.ci)) a.ci = row.check_in;
      if (row.check_out && (!a.co || row.check_out > a.co)) a.co = row.check_out;
    }
    if (rr.length < 2000) break;
  }
  const att = attNgay[today] || {};   // các bảng cũ (CHAMCONG-VESINH, cột "PT đi làm") chỉ dùng hôm nay
  log("✓ Timesheet " + mocLay + " → " + today + " (loc " + HR_LOCATION + "/dept " + HR_DEPT + "): " +
    tsRows + " dòng · " + Object.keys(attNgay).length + " ngày · hôm nay " + Object.keys(att).length + " NV.");

  // 4a) Bảng PHU-TRACH-QUAY-KE
  const rowsPT = Object.keys(loc).sort().map((L) => {
    const e = loc[L].email, m = e ? (byEmail[e.toLowerCase()] || {}) : {};
    return [L, e, m.code || "", m.name || "", loc[L].at || ""];
  });
  const coNguoi = rowsPT.filter(r => r[1]).length;
  log("→ PHU-TRACH: " + rowsPT.length + " vị trí (" + coNguoi + " có người, " + (rowsPT.length - coNguoi) + " chưa báo cáo).");

  // Bảng phân công (nguồn chính thức chủ vị trí) — dùng cho cả 4b và 4c
  const pcBy = await docPhanCong();
  const nPc = Object.keys(pcBy).length;
  log(nPc ? "✓ Bảng phân công VESINH-PHANCONG: " + nPc + " vị trí có chủ (dùng thay suy đoán executor gần nhất)."
          : "  ⚠ Chưa đọc được VESINH-PHANCONG — tạm suy phụ trách theo executor gần nhất như cũ.");

  // 4b) Bảng CHAMCONG-VESINH (gộp đội theo mã NV)
  const byCode = {};
  for (const k in team) {
    const t = team[k], m = byEmail[k] || {};
    const idk = m.code || k;
    const e = byCode[idk] || (byCode[idk] = { code: m.code || "", name: m.name || "", email: t.email, major: m.major || "", todayCount: 0, todayLoc: "", lastAt: "" });
    e.todayCount += t.todayCount;
    if (t.todayLoc > e.todayLoc) e.todayLoc = t.todayLoc;
    if (t.lastAt > e.lastAt) e.lastAt = t.lastAt;
  }
  /* BỔ SUNG NGƯỜI ĐƯỢC GIAO MÀ CHƯA TỪNG VỆ SINH.
   * `team` chỉ gồm người CÓ báo cáo trong 45 ngày, nên đúng nhóm cần quản lý nhất — người được
   * giao vị trí mà im lặng suốt — lại KHÔNG có dòng chấm công nào. Dashboard vì thế xếp họ vào
   * "không có ca làm việc" dù thực tế đang đi làm, và không ai nhắc. Gộp thêm mọi email trong
   * bảng phân công (todayCount = 0) để nhóm này hiện đúng là "Đi làm - chưa vệ sinh". */
  /* Gộp theo EMAIL, không theo mã: `team` khoá bằng `m.code || email`, nên NV mà danh bạ wshr
     không tra được mã sẽ nằm dưới khoá email — thêm bằng khoá mã sẽ nhân đôi đúng người đó
     (đã gặp: trinhthk@, nhuhtq3@). Nhân dịp này vá luôn Code/Name rỗng bằng dữ liệu bảng phân công. */
  const khoaTheoEmail = {};
  for (const idk in byCode) khoaTheoEmail[String(byCode[idk].email || "").toLowerCase()] = idk;
  let nThemPC = 0, nVa = 0;
  for (const kk in pcBy) {
    const c = pcBy[kk], em = c.em, m = byEmail[em] || {};
    const daCo = khoaTheoEmail[em];
    if (daCo){
      const e = byCode[daCo];
      if (!e.code && (c.code || m.code)){ e.code = c.code || m.code; nVa++; }
      if (!e.name && (c.ten || m.name)) e.name = c.ten || m.name;
      continue;
    }
    const idk = c.code || m.code || em;
    byCode[idk] = { code: c.code || m.code || "", name: c.ten || m.name || "", email: em,
      major: m.major || "", todayCount: 0, todayLoc: "", lastAt: "" };
    khoaTheoEmail[em] = idk;
    nThemPC++;
  }
  if (nThemPC || nVa) log("  + CHAMCONG: thêm " + nThemPC + " NV được giao vị trí nhưng chưa từng báo cáo" +
    (nVa ? " · vá Code/Name cho " + nVa + " NV danh bạ không tra được" : "") + ".");
  const rowsCC = Object.values(byCode).map((e) => {
    const a = (e.code && att[e.code]) || {};
    const ci = hhmm(a.ci), co = hhmm(a.co);
    const diLam = !!(a.ci || a.co), daVS = e.todayCount > 0;
    const tt = !diLam ? "Nghỉ / không chấm công" : (daVS ? "Đi làm - đã vệ sinh" : "Đi làm - chưa vệ sinh");
    return [e.code, e.name, e.email, e.major, ci, co, e.todayCount, e.todayLoc, tt];
  });
  const uu = (tt) => tt === "Đi làm - chưa vệ sinh" ? 0 : tt === "Đi làm - đã vệ sinh" ? 1 : 2;
  rowsCC.sort((a, b) => uu(a[8]) - uu(b[8]) || String(a[1]).localeCompare(String(b[1]), "vi"));
  const nDiLam = rowsCC.filter(r => r[8] !== "Nghỉ / không chấm công").length;
  const nChua = rowsCC.filter(r => r[8] === "Đi làm - chưa vệ sinh").length;
  log("→ CHAMCONG: đội " + rowsCC.length + " NV — đi làm " + nDiLam + " (đã vs " + (nDiLam - nChua) + ", CHƯA vs " + nChua + "), nghỉ " + (rowsCC.length - nDiLam) + ".");

  // 4c) Bảng VESINH-YEUCAU — từng yêu cầu (YC_DAYS ngày): trạng thái + executor + phụ trách dự kiến × chấm công
  const ycSap = reqToday.sort((a, b) => String(b.ngay).localeCompare(String(a.ngay)) || String(a.loc).localeCompare(String(b.loc)));
  const rowsYC = ycSap
    .map((r) => {
      /* CHỦ VỊ TRÍ: bảng phân công trước, không có mới suy theo executor gần nhất như cũ.
         Nhờ vậy cột "PT đi làm" là chấm công của ĐÚNG người được giao → nhóm "Chưa vệ sinh,
         phụ trách CÓ chấm công (cần nhắc)" trên dashboard mới đếm đúng người. */
      const chu = pcBy[khoaO(r.loc)];
      const ptEmail = chu ? chu.em : ((loc[r.loc] || {}).email || "");
      const dbo = ptEmail ? (byEmail[ptEmail.toLowerCase()] || {}) : {};
      const pt = chu ? { code: chu.code || dbo.code || "", name: chu.ten || dbo.name || "" } : dbo;
      const a = (pt.code && att[pt.code]) || {};
      const ptDiLam = (a.ci || a.co) ? 1 : 0;   // chấm công CHỈ của hôm nay — dashboard chỉ dùng cho ngày hôm nay
      /* BỎ 5 cột suy được (03/08/2026 — xem chú thích HEADER_YC): Khu vực / Trạng thái / PT Name /
         Ảnh / PT lần cuối. "PT lần cuối" chính là cột Executed At của PHU-TRACH-QUAY-KE cùng
         Location (đã đối chiếu 1246/1246) nên dashboard tra thẳng ở đó. */
      return [r.id, r.ngay, r.loc, r.stId, r.email, r.at, ptEmail, pt.code || "", ptDiLam, hhmm(a.ci)];
    });
  const nDa = rowsYC.filter((r) => r[3] === 3 || r[3] === 4).length;
  /* Ánh xạ Status ID → tên: canh chừng WMS thêm mã lạ. Dashboard có bảng tra tương ứng; mã nào
     ngoài bảng nó hiện "#<id>" chứ không chết, nhưng phải BIẾT để cập nhật cả hai đầu. */
  const stLa = {};
  for (const r of reqToday) if ([1, 3, 4, 7].indexOf(Number(r.stId)) < 0) stLa[r.stId + " = " + (r.stName || "?")] = (stLa[r.stId + " = " + (r.stName || "?")] || 0) + 1;
  log("→ YEUCAU: " + rowsYC.length + " yêu cầu (" + YC_DAYS + " ngày, " + nDa + " đã vệ sinh)." +
    (Object.keys(stLa).length ? "  ⚠ STATUS LẠ ngoài bảng tra: " + Object.keys(stLa).map(k => k + " ×" + stLa[k]).join(", ") + " — thêm vào ST_TEN của hasaki-planogram.js." : ""));

  // 4c-bis) Bảng VESINH-ANH — chỉ yêu cầu CÓ ảnh, tách khỏi YEUCAU để dashboard nạp ở bậc 3
  const rowsANH = ycSap.filter((r) => r.anh).map((r) => [r.id, r.ngay, r.anh]);
  log("→ ANH: " + rowsANH.length + "/" + rowsYC.length + " yêu cầu có ảnh (" + YC_ANH_NGAY + " ngày gần nhất).");

  // 4d) Bảng VESINH-NHATKY — NV × ngày × khu vực (dựng từ lịch sử cộng dồn LS_NGAY ngày)
  const rowsNK = Object.keys(nhatky).map((key) => {
    const [ngay, em, khu] = key.split("|");
    const m = byEmail[em] || {};
    const locs = nhatky[key].locs.sort();
    return [ngay, em, m.code || "", m.name || "", khu, locs.length, locs.join(", ")];
  }).sort((a, b) => String(b[0]).localeCompare(String(a[0])) || String(a[3]).localeCompare(String(b[3]), "vi"));
  log("→ NHATKY: " + rowsNK.length + " dòng (NV × ngày × khu, " + LS_NGAY + " ngày — nguồn: lịch sử cộng dồn).");

  // 4e) Bảng VESINH-LICHSU — lịch sử từng lượt báo cáo theo vị trí + GIỜ (đã gộp ở bước 2b)
  const rowsLS = ls.ev.map(v => [v.n, v.g, v.l, v.e, v.c, v.t, v.id]);
  /* Lưu cache TRƯỚC khi ghi Sheet: kể cả lượt này ghi Sheet lỗi / GAS chưa whitelist thì lịch sử
     vẫn tích luỹ trên máy, lượt sau đẩy lên đủ — không mất ngày nào. Danh mục vị trí cũng vậy. */
  if (!DRY){
    try { fs.writeFileSync(FILE_LS, JSON.stringify({ at: Date.now(), moc: mocGiu, ngay: LS_NGAY, ev: ls.ev })); }
    catch (e) { log("  ⚠ Không lưu được " + path.basename(FILE_LS) + " (" + e.message + ") — lịch sử lượt sau sẽ dựng lại từ tab."); }
    try { fs.writeFileSync(FILE_DM, JSON.stringify({ at: Date.now(), ngay: DM_NGAY, loc: dmoc.dm })); }
    catch (e) { log("  ⚠ Không lưu được " + path.basename(FILE_DM) + " (" + e.message + ") — lượt sau dựng lại từ tab " + TAB_PT + "."); }
  }
  // 4f) Bảng VESINH-CHAMCONG-NGAY — chấm công theo NGÀY của cả bộ phận, cửa sổ trượt CC_NGAY ngày
  const mocGiuCC = isoNgay(now - (CC_NGAY - 1) * DAY);
  /* Danh sách mã NV ĐỘI VỆ SINH = bảng phân công (chủ vị trí) + mọi người từng báo cáo trong cửa sổ
     quét + đội trong bảng chấm công hôm nay. Đủ để pop-up tra được mọi người phụ trách, mà không
     lưu chấm công của cả bộ phận. */
  const codeVS = new Set();
  const themCode = (c) => { if (c) codeVS.add(String(c)); };
  for (const kk in pcBy){ const c = pcBy[kk]; themCode(c.code); themCode((byEmail[c.em] || {}).code); }
  for (const k in team) themCode((byEmail[k] || {}).code);
  for (const idk in byCode) themCode(byCode[idk].code);
  const cc = await gopChamCong(attNgay, nvTS, byCodeDir, mocGiuCC, mocLay, codeVS);
  const rowsCCN = Object.keys(cc.nv)
    .sort((a, b) => String(cc.nv[a].ten || "").localeCompare(String(cc.nv[b].ten || ""), "vi") || a.localeCompare(b))
    .map(code => {
      const o = cc.nv[code], ds = Object.keys(o.d).sort().reverse();
      return [code, o.ten || "", o.em || "", ds.length, ds.map(d => d + " " + o.d[d]).join(" | ")];
    });
  if (!DRY){
    try { fs.writeFileSync(FILE_CCN, JSON.stringify({ at: Date.now(), moc: mocGiuCC, ngay: CC_NGAY, nv: cc.nv })); }
    catch (e) { log("  ⚠ Không lưu được " + path.basename(FILE_CCN) + " (" + e.message + ") — lượt sau dựng lại từ tab."); }
  }
  const ngayCC = [...new Set(rowsCCN.flatMap(r => [...String(r[4]).matchAll(/(\d{4}-\d{2}-\d{2})/g)].map(m => m[1])))].sort();
  log("→ CHAMCONG-NGAY: " + rowsCCN.length + " NV · giữ từ " + mocGiuCC + " (" + CC_NGAY + " ngày) · lấy lại " +
    mocLay + "→" + today + " (" + cc.nMoi + " ô ngày, thay " + cc.nXoaNgay + " ô cũ), -" + cc.nQuaHan + " ô quá hạn · phủ " +
    ngayCC.length + " ngày" + (ngayCC.length ? " (" + ngayCC[0] + " → " + ngayCC[ngayCC.length - 1] + ")" : "") +
    " · bỏ qua " + cc.nBoQua + " ô của NV ngoài đội vệ sinh · cũ đọc từ: " + cc.nguonCu + ".");

  const ngayLS = [...new Set(ls.ev.map(v => v.n))].sort();
  log("→ LICHSU: " + rowsLS.length + " lượt báo cáo · giữ từ " + mocGiu + " (" + LS_NGAY + " ngày) · +" + ls.nMoi +
    " lượt mới, -" + ls.nXoa + " lượt quá hạn · phủ " + ngayLS.length + " ngày" +
    (ngayLS.length ? " (" + ngayLS[0] + " → " + ngayLS[ngayLS.length - 1] + ")" : "") + " · lịch sử cũ đọc từ: " + ls.nguonCu + ".");

  // 5) Ghi 7 tab (các tab có PII đều có chốt an toàn — chỉ ghi khi GAS đã deploy whitelist mới)
  if (!dmCut) await ghiTab(TAB_PT, HEADER_PT, rowsPT);
  await ghiTab(TAB_CC, HEADER_CC, rowsCC);
  /* VESINH-ANH tách từ VESINH-YEUCAU (03/08/2026). Nội dung KHÔNG có PII (mã yêu cầu + đuôi URL
     ảnh công khai) nhưng vẫn đi cùng whitelist để nằm chung sheet private với các tab vệ sinh —
     đỡ phải nhớ "tab này ở sheet nào". Chưa deploy GAS thì bỏ qua: dashboard tự ẩn phần ảnh. */
  if (DRY || await gasPhucVuTab(TAB_ANH)) await ghiTab(TAB_ANH, HEADER_ANH, rowsANH);
  else log("  ⚠ GAS chưa phục vụ " + TAB_ANH + " — BỎ QUA tab ảnh (dashboard tạm không có ảnh báo cáo). Thêm '" + TAB_ANH + "' vào SERVE_PRIVATE_TABS rồi deploy google-script.gs.");
  if (DRY || await gasPhucVuTab(TAB_YC)) {
    await ghiTab(TAB_YC, HEADER_YC, rowsYC);
    await ghiTab(TAB_NK, HEADER_NK, rowsNK);
  } else {
    log("  ⚠ GAS chưa deploy whitelist " + TAB_YC + "/" + TAB_NK + " — BỎ QUA 2 tab mới (tránh ghi email NV vào sheet public). Dán google-script.gs mới vào Apps Script rồi deploy.");
  }
  /* LICHSU probe RIÊNG (không đi kèm YC): tab này mới thêm 01/08 nên whitelist có thể chưa deploy
     trong khi YC/NK đã có từ trước — dùng chung cờ thì lịch sử bị đổ sang SHEET PUBLIC. */
  if (DRY || await gasPhucVuTab(TAB_LS)) await ghiTab(TAB_LS, HEADER_LS, rowsLS);
  else log("  ⚠ GAS chưa phục vụ " + TAB_LS + " — lịch sử vẫn tích luỹ ở " + path.basename(FILE_LS) +
    ", BỎ QUA ghi Sheet (tránh đổ email NV vào sheet public). Thêm '" + TAB_LS + "' vào SERVE_PRIVATE_TABS rồi deploy google-script.gs.");
  if (DRY || await gasPhucVuTab(TAB_CCN)) await ghiTab(TAB_CCN, HEADER_CCN, rowsCCN);
  else log("  ⚠ GAS chưa phục vụ " + TAB_CCN + " — chấm công theo ngày vẫn tích luỹ ở " + path.basename(FILE_CCN) +
    ", BỎ QUA ghi Sheet. Thêm '" + TAB_CCN + "' vào SERVE_PRIVATE_TABS rồi deploy google-script.gs.");
  if (!DRY) ghiMocBuoc(DIR, "vesinh");   // mốc thành công cho sync-guard
  log("✓ HOÀN TẤT (1 lượt quét " + WINDOW_DAYS + " ngày, cả 7 tab).");
  process.exit(0);
})().catch((e) => { thoatTheoLoi(e, log, 2); });
