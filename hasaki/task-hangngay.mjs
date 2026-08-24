/**
 * ============================================================================
 *  task-hangngay.mjs — 9 TASK HẰNG NGÀY trên work.hasaki.vn: soi + nộp báo cáo
 * ============================================================================
 *  Mỗi sáng hệ thống bắn cho tamlc@hasaki.vn một BỘ TASK CỐ ĐỊNH (T2–T7):
 *    07:30  Sắp xếp hàng hóa trong kho          (prid 8443, việc tay)
 *    07:30  Kiểm kê theo vị trí type full location (prid 8552)
 *    08:00  Các vấn đề bất thường F0-A0 · MTG    (do WMS tự bắn)
 *    08:00  Các vấn đề bất thường F0-A0 · GARMENT
 *    08:19  Kiểm kê Location / Kiểm kê SKU / Kiểm tra 5S kho tổng
 *           / Sắp xếp hàng hóa tại kho tổng      (prid 1735 "Audit")
 *    08:19  Dán tem QC Fail và Block UID Group   (việc tay)
 *
 *  ĐƯỜNG ĐI (đã bóc 18/08/2026 từ swagger nội bộ wshr.hasaki.vn/api/docs):
 *    1) GET  /api/news/notifications?limit=200        → object_type=4 = task được giao
 *    2) GET  /api/hr/projects/task-input/{id}         → chi tiết + trạng thái TỪNG người
 *    3) POST /api/hr/projects/mass-update-field-task-input
 *         { id, field:"status", value:5, extra_data:{ configs:{ virtual_text } } }
 *       → status 5 = "Chờ duyệt" (đúng thao tác nhân viên bấm Hoàn thành trên web;
 *         leader duyệt xong mới thành 2 = Finished).
 *
 *  NGUYÊN TẮC: chỉ nộp BÁO CÁO CÓ SỐ LIỆU THẬT.
 *    • Nhóm A (bot có dữ liệu): kiểm kê SKU/Location/full-location, 5S kho tổng,
 *      2 task F0-A0 → dựng báo cáo từ .pc-cache.json / .exports/tasks-cache.json /
 *      truy vấn lại WMS. Nộp tự động được.
 *    • NGOÀI PHẠM VI (chốt 19/08/2026): "Sắp xếp hàng hóa tại kho tổng" — chủ máy TỰ báo cáo,
 *      bot không nộp kể cả khi chọn "nộp tất cả" (cờ tuBaoCao trong SO_TAY).
 *    • Nhóm B (việc tay ngoài kho): sắp xếp hàng hóa trong kho, dán tem QC Fail → bot không có
 *      cách nào biết đã làm gì, nên nộp bằng MỘT CÂU TRUNG TÍNH (không khai đã làm hay
 *      chưa làm). Muốn ghi nội dung thật thì viết vào .task-baocao-tay.json, bot lấy đó.
 *
 *  THỜI GIAN THỰC TẾ (chốt 24/08/2026): ô "Thời gian thực tế" của web tính bằng PHÚT (planned_hours
 *  của 9 task là 20/30/60/120 — đúng số phút web hiện, quỹ 1 ngày = 480'). Bot không điền cứng 1'
 *  nữa mà đo từ MỐC THẬT của chính số liệu đã dùng để viết báo cáo (checklist_at/approved_at của
 *  phiếu kiểm kê, giờ ghi nhận vi phạm 5S), gộp theo phiên làm việc; task không có mốc nào (F0-A0,
 *  việc tay) giữ mặc định 1'. Muốn tự khai thì ghi .task-giothucte.json:
 *      { "ngay": "2026-08-24", "phut": { "<task_id hoặc tên task>": 45 } }
 *  Cuối phần nháp bot in bảng quỹ công: từng task mấy phút · đã ghi sẵn bao nhiêu · CÒN LẠI so với
 *  480'. Tổng vượt quỹ thì hạ đều theo tỉ lệ (mốc các task chồng nhau nên cộng thô là đếm trùng).
 *
 *  KHÔNG BAO GIỜ tự đăng nhập: chỉ chạy khi phiên work của người đang sống
 *  (layTokenSongWork) — đúng ý "sau khi người dùng đăng nhập vào nền tảng work".
 *
 *  CHỐT 19/08/2026 — NGƯỜI GIỮ QUYỀN BẤM, BOT KHÔNG TỰ NỘP NỮA.
 *  Lịch "5S Task hang ngay" 16:00 đã TẮT (Disable-ScheduledTask). Từ nay hai đường:
 *    • cần bot nộp  → bấm nút `NUT-NOP-TASK.bat` (shortcut ngoài Desktop) = chế độ `--nut`
 *    • không cần    → người tự bấm Hoàn thành trên work.hasaki.vn, bot không chen vào
 *  Vì vậy `--nut` KHÔNG BAO GIỜ nộp khi không có bàn phím (chạy nền): thấy stdin không phải
 *  TTY là dừng, để "bấm nút" luôn có nghĩa là có người thật bấm.
 *
 *  Chạy:
 *    node task-hangngay.mjs                 # chỉ xem: bảng trạng thái + báo cáo nháp
 *    node task-hangngay.mjs --nut           # NÚT BẤM TAY: làm tươi số liệu → xem nháp → HỎI rồi mới nộp
 *    node task-hangngay.mjs --nop           # nộp thật, không hỏi (chỉ nộp từ 15h trở đi)
 *    node task-hangngay.mjs --nop --ep      # nộp thật NGAY, bỏ chốt giờ
 *    node task-hangngay.mjs --nop --task=<id>   # chỉ 1 task (bỏ chốt giờ)
 *    (--nut = --nop --ep --hoi --lamtuoi; dùng lẻ từng cờ cũng được)
 * ============================================================================
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { spawn, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenSongWork, layTokenSongWms, fetchThuLai, ghiMocBuoc, docMocBuoc, moTaLoiMang as moTaLoi } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const TOI = Number(process.env.STAFF_ID_WORK || 17312);           // staff_id của Lê Chí Tâm trên wshr
const V = "https://wshr.hasaki.vn/api";
const NOTIF = V + "/news/notifications?limit=200";
const CHI_TIET = (id) => `${V}/hr/projects/task-input/${id}`;
const GHI = V + "/hr/projects/mass-update-field-task-input";
const WMS_BIN = "https://wms-gw.inshasaki.com/api/v1/wms/report-management/stock-locations/bins/count/v3";
/* Tồn TỪNG UID + NGUỒN của nó (phiếu nhập / phiếu điều chỉnh / PO / NCC / kho gốc). Cùng endpoint
   `tra-uid-ton.mjs` đang dùng; header `Company-Ids` là BẮT BUỘC (thiếu → 400 "Company not
   authenticated"). Trần đo được: size ≤ 1000, URL ≤ ~8 KB. */
const WMS_TON = "https://wms-gw.inshasaki.com/api/v1/wms/report-management/report-inventories";
const BIN_A0 = "F0-A0-00-00-00-00";                              // bin "chờ xếp chỗ" của cả 2 kho
/* Người giao task "Sắp xếp hàng hóa tại kho tổng" — Huỳnh Trần Như Ý (Leader/Audit), đối chứng
   20/08/2026 trên `created_by_user` của #13373859. Dùng làm khoá phụ để cờ tuBaoCao chỉ ăn đúng
   task của người đó, không ăn lây một task trùng tên do người khác giao. */
const NGUOI_GIAO_TU_BAO_CAO = 17840;
const DASH_5S = "https://letam0317.github.io/kiemsoatkho/?company=hasaki&tab=task";
const CHO_DUYET = 5;                                             // 5 = Chờ duyệt (nhân viên đã nộp)
const GIO_THUC_TE = Number(process.env.TASK_GIO_THUC_TE || 1);   // mặc định khi KHÔNG có mốc nào (1 phút)
/* ── THỜI GIAN THỰC TẾ — ô "Thời gian thực tế" của web (chốt 24/08/2026) ──────────────────────
 * ĐƠN VỊ là PHÚT, không phải giờ: planned_hours của 9 task hôm nay là 20/30/60/120 — đúng bằng số
 * phút web hiện, và quỹ công một ngày là 480 phút. Trước đây bot điền cứng 1 phút cho MỌI task;
 * nay tính từ MỐC THẬT của chính số liệu dùng để viết báo cáo:
 *   · kiểm kê SKU / Location / full-location → checklist_at + approved_at của phiếu HÔM NAY
 *   · 5S kho tổng                            → giờ ghi nhận từng lượt vi phạm hôm nay
 * Gộp mốc thành PHIÊN: hai mốc cách nhau > KHE_PHIEN là hai lần ngồi làm khác nhau; mỗi phiên cộng
 * BU_PHIEN cho phần việc xảy ra TRƯỚC mốc đầu tiên (mở phiếu, đi tới vị trí, đếm rồi mới bấm).
 * Không có mốc nào (F0-A0, việc tay) ⇒ giữ mặc định 1 phút — đúng yêu cầu "không có dữ liệu thì 1".
 * Tổng cả ngày được KẸP trong PHUT_NGAY: mốc của nhiều task chồng lên nhau nên cộng thô là đếm
 * trùng, thà thấp còn hơn khai vượt 8h. */
const PHUT_NGAY = Number(process.env.TASK_PHUT_NGAY || 480);     // quỹ công 1 ngày, để trừ ra phần còn lại
const KHE_PHIEN = Number(process.env.TASK_KHE_PHIEN || 30);      // phút: cách nhau hơn ngần này ⇒ phiên mới
const BU_PHIEN = Number(process.env.TASK_BU_PHIEN || 5);         // phút cộng thêm cho mỗi phiên
const FILE_GIO = path.join(DIR, ".task-giothucte.json");         // người tự khai số phút (ưu tiên cao nhất)
const TEN_TT = { 0: "chưa làm", 1: "đang làm", 2: "đã duyệt", 3: "trễ", 4: "huỷ", 5: "chờ duyệt", 6: "thất bại" };
const FILE_TAY = path.join(DIR, ".task-baocao-tay.json");         // báo cáo người tự viết (ưu tiên hơn bản tự dựng)
// Máy chủ CHẶN nộp khi "kết quả công việc" quá ngắn (≤50 ký tự) và không đính kèm file:
// 422 "Vui lòng mô tả chi tiết những công việc đã thực hiện...". Đo được: 50 ✗ · 55 ✓.
const TOI_THIEU = 55;
// Nhóm B (việc tay) — chủ máy chốt 18/08/2026: KHÔNG ghi nội dung gì. Nhưng web bắt buộc phải có
// chữ nên dùng một câu trung tính, KHÔNG khai là đã làm hay chưa làm.
const BC_NHOM_B = process.env.TASK_BAOCAO_MACDINH || "Không có nội dung báo cáo bổ sung cho công việc này trong ngày.";

const CO = { nop: false, ep: false, task: 0, hoi: false, lamtuoi: false, nhom: "", thuF0A0: false };
for (const a of process.argv.slice(2)) {
  if (a === "--nop") CO.nop = true;
  else if (a === "--ep") CO.ep = true;
  else if (a === "--hoi") CO.hoi = true;          // in nháp xong thì HỎI, chờ người chọn mới nộp
  else if (a === "--lamtuoi") CO.lamtuoi = true;  // số liệu trong máy cũ thì kéo lại trước khi soạn
  else if (a === "--nut") { CO.nop = true; CO.ep = true; CO.hoi = true; CO.lamtuoi = true; }
  // --nhom=A: chỉ nộp nhóm A (số liệu thật) — đường không-hỏi tương đương phím [a] của nút.
  // Bot tin nhắn dùng cờ này cho nút "Chỉ nhóm A" trong chat.
  else if (a.startsWith("--nhom=")) CO.nhom = a.slice(7).toUpperCase();
  else if (a.startsWith("--task=")) CO.task = Number(a.slice(7));
  // Xem trước báo cáo F0-A0 mà không cần task nào còn hạn (mỗi ngày chỉ nộp được 1 lần, nộp rồi là
  // hết cách xem lại bản dựng). Không gọi wshr, không nộp gì — chỉ hỏi WMS rồi in ra.
  else if (a === "--thu-f0a0") CO.thuF0A0 = true;
}
// Số liệu cũ hơn ngưỡng này thì --lamtuoi kéo lại (phút). Poller trong ngày giữ nhịp 30'/45' nên
// bấm nút giữa giờ làm thường KHÔNG tốn lượt gọi nào; chỉ tốn khi bấm lúc dữ liệu đã đứng lâu.
const TUOI_TOI_DA = Number(process.env.TASK_TUOI_TOI_DA || 120) * 60000;
// Giờ sớm nhất được phép nộp. Task bắn 07:30–08:19 nhưng hạn 22:00 và "kiểm kê trên app trước
// 16:00" — nộp lúc sáng thì mọi số liệu còn bằng 0, báo cáo rỗng. Chốt 18/08/2026: báo cáo 16h.
const GIO_SOM_NHAT = Number(process.env.TASK_GIO_SOM_NHAT || 15);

const gio = () => new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" });
const log = (...a) => console.log(gio(), ...a);

/* ĐỨT LIÊN LẠC — bẫy cắn 19/08/2026 10:23: wshr.hasaki.vn (104.20.29.160, sau Cloudflare) không
 * bắt tay kịp; `fetchThuLai` thử đủ 4 lượt (~66s) rồi NÉM, và vì mọi lời gọi đều nằm ở top-level
 * await nên Node đổ nguyên stack trace `TypeError: fetch failed` vào cửa sổ nút. Người bấm nút
 * không đọc stack — dịch sang một câu người hiểu (moTaLoi = moTaLoiMang trong session-rules,
 * dùng chung với bot tin nhắn), rồi thoát sạch. */
process.on("uncaughtException", (e) => {
  console.log("");
  log("✗ ĐỨT LIÊN LẠC: " + moTaLoi(e));
  log("  Chưa nộp thêm gì. Mở thử work.hasaki.vn xem mạng đã thông chưa rồi BẤM NÚT LẠI —");
  log("  task nào đã nộp sẽ tự bỏ qua, bấm lại không nộp trùng.");
  process.exit(4);
});
const ngayVN = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const ngayGon = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4);
const gioVN = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hour12: false }).format(new Date()));
const docJson = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
const linkTrongNote = (t) => (String(t.note || "").match(/https?:\/\/[^\s)"']+/) || [""])[0];

/* ═════════════════ 0b) BỘ ĐO THỜI GIAN THỰC TẾ ═════════════════ */
/** "2026-08-24 09:07:47" (giờ VN — WMS và work đều trả kiểu này) → ms. Khác ngày `ngay` ⇒ 0 (bỏ). */
const msVN = (s, ngay) => {
  const t = String(s || "");
  if (t.length < 16) return 0;
  if (ngay && t.slice(0, 10) !== ngay) return 0;
  const ms = Date.parse(t.slice(0, 10) + "T" + t.slice(11, 19) + "+07:00");
  return Number.isFinite(ms) ? ms : 0;
};
const hhmm = (ms) => new Date(ms).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hour12: false });
/** Gộp mốc rời rạc thành phiên làm việc → { phut, vi }. Không có mốc nào ⇒ null (nơi gọi tự lùi về
 *  mặc định 1 phút). Sàn 1 phút vì web không nhận 0. */
function phutTuMoc(mocs) {
  const t = [...new Set((mocs || []).filter(Boolean))].sort((a, b) => a - b);
  if (!t.length) return null;
  let tong = 0, dau = t[0], truoc = t[0], phien = 1;
  for (const x of t.slice(1)) {
    if (x - truoc > KHE_PHIEN * 60000) { tong += (truoc - dau) / 60000 + BU_PHIEN; dau = x; truoc = x; phien++; continue; }
    truoc = x;
  }
  tong += (truoc - dau) / 60000 + BU_PHIEN;
  return { phut: Math.max(1, Math.round(tong)), vi: `${t.length} mốc · ${phien} phiên · ${hhmm(t[0])}→${hhmm(t[t.length - 1])}` };
}
/** Số phút người TỰ KHAI trong .task-giothucte.json:
 *    { "ngay": "YYYY-MM-DD", "phut": { "<id task hoặc tên task>": 45 } }
 *  Chỉ ăn khi đúng ngày hôm nay — khai hôm qua không được dùng lại cho hôm nay. */
function phutTay(id, ten) {
  const j = docJson(FILE_GIO);
  if (!j || j.ngay !== ngayVN()) return 0;
  const p = j.phut || {};
  const v = Number(p[String(id)] ?? p[ten] ?? 0);
  return v > 0 ? Math.round(v) : 0;
}
/** Số phút ĐÃ ghi sẵn trên task (sub_type=1 tính theo TỪNG NGƯỜI nên đọc dòng của mình trước). */
function phutDaGhi(t) {
  if (Number(t.sub_type) === 1) {
    const me = (t.staff || []).find((x) => Number(x.staff_id) === TOI);
    if (me && Number(me.reality_hours) > 0) return Number(me.reality_hours);
  }
  return Number(t.reality_hours) || 0;
}

/* ═════════════════ 1) BỘ DỰNG BÁO CÁO (chỉ số liệu thật) ═════════════════ */

/** Đổi user_id sang TÊN người bằng danh bạ đã có trong máy (.cache-danhba.json do auto-export-sync
 *  đổ ra, 11.4k mã, làm tươi mỗi sáng) — KHÔNG gọi thêm API nào.
 *  Vì sao tra được: WMS và wshr dùng CHUNG một dải user_id (đối chứng 20/08/2026 —
 *  created_by 18811 = Lê Chí Tâm, 3490 = Lê Thanh Hiền, khớp `created_by_user` của wshr).
 *  Không có danh bạ / không thấy mã ⇒ trả chuỗi rỗng để báo cáo tự bỏ khúc tên, không bịa. */
let _danhBa = null;
function tenNguoi(id) {
  if (!id) return "";
  if (!_danhBa) {
    _danhBa = new Map();
    for (const x of (docJson(path.join(DIR, ".cache-danhba.json"))?.data || []))
      _danhBa.set(Number(x.user_id), String(x.staff_name || ""));
  }
  return _danhBa.get(Number(id)) || "";
}
const soVN = (v) => Number(v || 0).toLocaleString("vi-VN");
/* Chỉ đặt tên tiếng Việt cho những kiểu phiếu ĐÃ THẤY THẬT (20/08/2026: F0-A0 của cả 2 kho chỉ có
   2 kiểu này). Kiểu lạ thì in NGUYÊN mã của WMS — thà thô mà đúng, hơn là dịch bừa một từ mình
   chưa từng thấy dữ liệu. */
const TEN_NGUON = { PURCHASE_ORDER: "nhập mua", ADJUSTMENT: "điều chỉnh tồn" };

/** Phiếu kiểm kê hôm nay trong kho cache .pc-cache.json (push-pc-to-sheet đổ ra). */
function phieuKiemKe(kho, loai) {
  const pc = docJson(path.join(DIR, ".pc-cache.json")) || {};
  const hn = ngayVN();
  const rows = (pc[kho] || []).filter((r) => {
    if (loai && !loai.test(String(r.plan_type || ""))) return false;
    return String(r.checklist_at || "").slice(0, 10) === hn || String(r.plan_date || "").slice(0, 10) === hn;
  });
  /* TUỔI dữ liệu = mốc LÀM TƯƠI gần nhất (`.sync-ok-kiemke`), KHÔNG phải `pc.fullAt`: fullAt là
     đồng hồ "nâng cấp full mỗi 20h" và lượt DELTA cố ý KHÔNG trẻ hoá nó (push-pc-to-sheet dòng
     368). Lấy fullAt làm thước thì chiều nào cũng ra "dữ liệu đã cũ" → 3 task kiểm kê không bao
     giờ nộp được, dù poller vừa kéo xong 20' trước. Bẫy phát hiện 19/08/2026. */
  const moc = Math.max(docMocBuoc(DIR, "kiemke"), Number(pc.fullAt) || 0);
  return { rows, tuoi: moc ? new Date(moc) : null };
}
function tomTatKiemKe(nhan, rows, tuoi, link) {
  const hn = ngayGon(ngayVN());
  const gioTuoi = tuoi ? tuoi.toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "?";
  // Kho cache cũ quá thì KHÔNG dám nộp — số liệu cũ nộp lên còn tệ hơn không nộp.
  if (!tuoi || Date.now() - tuoi.getTime() > 6 * 3600 * 1000)
    return { du: false, text: `${nhan}: dữ liệu WMS trong máy đã cũ (${gioTuoi}) — chạy push-pc-to-sheet trước khi nộp.` };
  if (!rows.length)
    return { du: true, text: `${nhan} ngày ${hn}: WMS không phát sinh phiếu kiểm kê nào trong ngày (đối chiếu lúc ${gioTuoi}).${link ? "\nLink: " + link : ""}` };
  const dem = rows.length;
  const daDem = rows.filter((r) => /COUNTED|APPROVED|WAITING/i.test(String(r.status_name || ""))).length;
  const lech = rows.filter((r) => String(r.is_diff || "").toUpperCase() === "YES").length;
  const kho = [...new Set(rows.map((r) => r.warehouse_name).filter(Boolean))];
  const nguoi = [...new Set(rows.map((r) => r.checklist_by_name).filter(Boolean))];
  /* Thời gian thực tế: chỉ lấy mốc ĐẾM và mốc DUYỆT rơi vào hôm nay — phiếu có thể được tạo từ
     hôm kia nên created_at không phải giờ làm việc của ngày này, cố ý không dùng. */
  const moc = phutTuMoc(rows.flatMap((r) => [msVN(r.checklist_at, ngayVN()), msVN(r.approved_at, ngayVN())]));
  const dong = [
    `${nhan} ngày ${hn}: ${dem} phiếu (${daDem} đã đếm, ${lech} phiếu lệch).`,
    `Kho: ${kho.join(", ") || "-"}.`,
    nguoi.length ? `Người kiểm: ${nguoi.slice(0, 6).join(", ")}${nguoi.length > 6 ? ` và ${nguoi.length - 6} người khác` : ""}.` : "",
    link ? `Chi tiết: ${link}` : "",
  ].filter(Boolean);
  return { du: true, text: dong.join("\n"), phut: moc?.phut, vi: moc?.vi };
}
const bcKiemKeSku = async (t) => { const { rows, tuoi } = phieuKiemKe("fSku", /SKU/i); return tomTatKiemKe("Kiểm kê SKU", rows, tuoi, linkTrongNote(t)); };
const bcKiemKeLoc = async (t) => { const { rows, tuoi } = phieuKiemKe("fLoc", /^LOCATION/i); return tomTatKiemKe("Kiểm kê Location", rows, tuoi, linkTrongNote(t)); };
const bcFullLoc = async (t) => { const { rows, tuoi } = phieuKiemKe("fLoc", /FULL_LOCATION/i); return tomTatKiemKe("Kiểm kê theo vị trí (type full location)", rows, tuoi, linkTrongNote(t)); };

/** 5S kho tổng: đếm lượt vi phạm ghi nhận hôm nay trong kho cache workflow 591. */
async function bc5S() {
  const tc = docJson(path.join(DIR, ".exports", "tasks-cache.json"));
  if (!tc || !tc.rows) return { du: false, text: "Chưa đọc được kho dữ liệu 5S (.exports/tasks-cache.json)." };
  const hn = ngayVN();
  const rows = Object.values(tc.rows).filter((r) => String(r[5] || "").slice(0, 10) === hn);
  const theoTT = {};
  for (const r of rows) theoTT[r[3] || "?"] = (theoTT[r[3] || "?"] || 0) + 1;
  const moc = tc.updatedAt ? new Date(tc.updatedAt) : null;
  const tuoi = moc ? moc.toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "?";
  if (!moc || Date.now() - moc.getTime() > 6 * 3600 * 1000)
    return { du: false, text: `Dữ liệu 5S trong máy đã cũ (${tuoi}) — chạy auto-export-sync trước khi nộp.` };
  const mocPhut = phutTuMoc(rows.map((r) => msVN(r[5], hn)));   // giờ ghi nhận từng lượt vi phạm
  const dong = [
    `Báo cáo 5S kho tổng ngày ${ngayGon(hn)}:`,
    rows.length
      ? `ghi nhận ${rows.length} lượt vi phạm (${Object.entries(theoTT).map(([k, v]) => `${k}: ${v}`).join(", ")}).`
      : "không có lượt vi phạm nào được ghi nhận trong ngày.",
    `Số liệu đối chiếu lúc ${tuoi}. Chi tiết: [AUDIT](${DASH_5S})`,
  ];
  return { du: true, text: dong.join("\n"), phut: mocPhut?.phut, vi: mocPhut?.vi };
}

/* ── NGUỒN CỦA HÀNG ĐANG TREO Ở F0-A0 ────────────────────────────────────────────────────────────
 * Task chỉ nói "có N SKU treo ở F0-A0" thì người đọc vẫn phải tự mở WMS dò từng mã. Chốt 20/08/2026
 * (yêu cầu chủ máy): báo cáo phải nói luôn **mã đó đi ra F0-A0 từ đâu** — phiếu nào đưa vào, PO nào,
 * NCC nào, kho gốc nào, lúc nào, ai làm.
 *
 * Đường lấy: 1 lượt gọi `report-inventories` cho CẢ kho, lọc theo đúng danh sách SKU mà bins vừa
 * trả (`skus=<CSV>&location_description=F0-A0-00-00-00-00`) — thêm 1 lượt/kho, không phải 1 lượt/SKU.
 *
 * BẪY ĐÃ ĐO (20/08/2026, MTG 23 SKU / 164 dòng): phải lọc `status_id === 6` (In-BIN).
 *   · lấy cả dòng "Adjustment - shipped" (29/164) ⇒ số lượng phồng gấp trăm lần (2.000 → 3.002.000);
 *   · lọc In-BIN ⇒ tổng qty khớp ĐÚNG `quantity` của bins/count/v3 trên cả 23/23 SKU.
 * Bẫy thứ hai: `count` của endpoint này KHÔNG theo bộ lọc (trả 2,1 triệu) — chỉ tin `records`.
 * ─────────────────────────────────────────────────────────────────────────────────────────────── */
const TRAN_DONG_NGUON = 25;      // số dòng chi tiết tối đa (23 SKU là mức cao nhất từng thấy ở F0-A0)
/* Trần KÝ TỰ cho cả báo cáo. Máy chủ wshr có chặn dưới (≤50 ký tự → 422) nhưng chặn TRÊN thì chưa
   đo được — mà một báo cáo bị 422 vì dài là mất luôn lượt nộp của ngày. Nên tự cắt trước: bớt dần
   dòng chi tiết cho tới khi vừa ngân sách, phần bị bớt vẫn được đếm trong câu "…(+N SKU nữa)". */
const TRAN_KY_TU_BC = 3500;

/** Từng UID đang In-BIN tại F0-A0, gom theo SKU. Lỗi/hết token ⇒ Map rỗng (báo cáo tự lùi về bản
 *  ngắn), KHÔNG bao giờ làm task không nộp được vì một khúc bổ sung. */
async function nguonF0A0(wms, cfg, skus) {
  const ra = new Map();
  if (!skus.length) return ra;
  /* Trần URL ~8 KB của gateway (đo ở do-tran-uid.mjs): SKU 9 ký tự + phẩy = 10 byte ⇒ 500 mã ≈ 5 KB,
     còn dư. F0-A0 nhiều nhất mới thấy 23 SKU nên lát này chỉ là dây an toàn. */
  const u = `${WMS_TON}?page=1&size=1000&location_description=${BIN_A0}`
    + `&warehouse_ids=${cfg.warehouse}&skus=${skus.slice(0, 500).join(",")}`;
  const r = await fetchThuLai(u, { headers: { authorization: wms, "Company-Ids": cfg.company } }).catch(() => null);
  if (!r || !r.ok) return ra;
  const j = await r.json().catch(() => null);
  for (const x of (j?.records || [])) {
    if (Number(x.status_id) !== 6) continue;                     // chỉ hàng ĐANG nằm trong bin
    const k = String(x.sku || "");
    if (!k) continue;
    if (!ra.has(k)) ra.set(k, []);
    ra.get(k).push(x);
  }
  return ra;
}

/** Một dòng "SKU ← từ đâu". Nhiều UID cùng một phiếu thì gộp lại (15 cuộn cùng một phiếu điều chỉnh
 *  chỉ đáng một dòng, không phải 15 dòng y hệt nhau). */
function dongNguon(sku, rows) {
  const nhom = new Map();
  for (const x of rows) {
    const k = [x.inbound_shmt_type, x.inbound_shmt_number, x.purchase_order_number].join("|");
    if (!nhom.has(k)) nhom.set(k, { x, n: 0 });
    nhom.get(k).n++;
  }
  /* CỐ Ý KHÔNG in đơn vị: `uom` của endpoint này không đáng tin (sợi tính bằng gam, dây kéo tính
     bằng pcs — cả hai đều trả về "Cái"). Con số thì khớp đúng `quantity` của bins nên cứ in số. */
  const tong = rows.reduce((a, x) => a + Number(x.qty || 0), 0);
  const nguon = [...nhom.values()].map(({ x, n }) => [
    (TEN_NGUON[x.inbound_shmt_type] || x.inbound_shmt_type || "không rõ nguồn")
      + (x.inbound_shmt_number ? ` phiếu ${x.inbound_shmt_number}` : ""),
    x.purchase_order_number ? `PO ${x.purchase_order_number}` : "",
    x.vendor_name ? `NCC ${x.vendor_name}` : "",
    // Kho gốc khác kho đang đứng ⇒ hàng đi từ kho khác sang; đây là thông tin đắt nhất của dòng này.
    x.origin_warehouse_code && String(x.origin_warehouse_code) !== String(x.warehouse_code)
      ? `chuyển từ kho ${x.origin_warehouse_code}` : "",
    String(x.created_at || "").length >= 16
      ? `vào bin ${x.created_at.slice(8, 10)}/${x.created_at.slice(5, 7)} ${x.created_at.slice(11, 16)}` : "",
    tenNguoi(x.created_by),
    nhom.size > 1 ? `${n} UID` : "",
  ].filter(Boolean).join(" · "));
  return `- ${sku} (SL ${soVN(tong)} · ${rows.length} UID) ← ${nguon.join(" ; ")}`;
}

/** F0-A0 còn tồn: hỏi lại WMS đúng bộ lọc trong link của task (nhẹ — 2 lượt/kho: đếm bin + nguồn). */
async function bcF0A0(t, cfg) {
  const wms = await layTokenSongWms(DIR, () => {});
  if (!wms) return { du: false, text: "Không có phiên WMS còn sống để kiểm tra lại F0-A0 — không nộp." };
  const url = `${WMS_BIN}?company_ids=${cfg.company}&warehouse_ids=${cfg.warehouse}&ignore_zero_total=1`
    + `&prefix_location_description=${BIN_A0}&page=1&size=200`;
  const r = await fetchThuLai(url, { headers: { authorization: wms } }).catch(() => null);
  if (!r || !r.ok) return { du: false, text: `WMS từ chối truy vấn F0-A0 (${r ? r.status : "lỗi mạng"}) — không nộp.` };
  const j = await r.json().catch(() => null);
  const recs = j?.records || j?.data?.records || [];
  const con = j?.count ?? j?.total ?? recs.length;
  const dauNgay = (String(t.note || "").match(/(\d+)\s*sku/i) || [])[1];

  const ng = await nguonF0A0(wms, cfg, recs.map((x) => String(x.sku || "")).filter(Boolean));
  const coNguon = recs.filter((x) => (ng.get(String(x.sku)) || []).length);
  // Tóm tắt theo kiểu phiếu: đọc một dòng là biết "treo vì mới nhập" hay "treo vì điều chỉnh tồn".
  const dem = {};
  for (const l of ng.values()) for (const x of l) {
    const k = TEN_NGUON[x.inbound_shmt_type] || x.inbound_shmt_type || "không rõ nguồn";
    dem[k] = (dem[k] || 0) + 1;
  }
  const moiDong = coNguon.map((x) => dongNguon(String(x.sku), ng.get(String(x.sku))));
  const dung = (lay) => {
    const chiTiet = moiDong.slice(0, lay), conLai = moiDong.length - chiTiet.length;
    return [
      `Bin F0-A0 kho WH - MATERIAL - ${cfg.ten} — kiểm tra lại lúc ${gio()} ngày ${ngayGon(ngayVN())}:`,
      `còn ${con} SKU đang treo tại F0-A0${dauNgay ? ` (đầu ngày task ghi nhận ${dauNgay} SKU)` : ""}.`,
      Object.keys(dem).length
        ? `Nguồn đưa vào F0-A0: ${Object.entries(dem).map(([k, v]) => `${v} UID ${k}`).join(", ")}.`
        : "",
      chiTiet.length ? "Chi tiết từng mã (SL · số UID ← phiếu đưa nó vào bin):" : "",
      ...chiTiet,
      conLai > 0 ? `…(+${conLai} SKU nữa, xem link)` : "",
      /* Không tra được nguồn (WMS chối / mất phiên giữa đường) thì vẫn phải nêu được MÃ — lùi về bản
         liệt kê ngắn như trước, chứ không nộp một báo cáo chỉ có con số tổng. */
      !chiTiet.length && recs.length
        ? `Mã: ${recs.slice(0, 10).map((x) => x.sku || x.product_code || x.uid || "?").join(", ")}${recs.length > 10 ? ` …(+${recs.length - 10})` : ""}.`
        : "",
      linkTrongNote(t) ? `Link: ${linkTrongNote(t)}` : "",
    ].filter(Boolean).join("\n");
  };
  let lay = Math.min(moiDong.length, TRAN_DONG_NGUON), text = dung(lay);
  while (lay > 0 && text.length > TRAN_KY_TU_BC) text = dung(--lay);
  return { du: true, text };
}

/* ═════════════════ 2) SỔ TAY 9 TASK HẰNG NGÀY ═════════════════ */
/* nop: "sang"  = nội dung đã xác định ngay buổi sáng (trạng thái tồn F0-A0)
        "chieu" = phải chờ hết ca mới có số liệu (kiểm kê, 5S) → nộp cuối ngày */
const SO_TAY = [
  { khop: /^Kiểm kê SKU/i, nhom: "A", dung: bcKiemKeSku },
  { khop: /^Kiểm kê Location/i, nhom: "A", dung: bcKiemKeLoc },
  { khop: /Kiểm kê theo vị trí.*full location/i, nhom: "A", dung: bcFullLoc },
  { khop: /Kiểm tra 5S kho tổng/i, nhom: "A", dung: bc5S },
  { khop: /bất thường.*MATERIAL - MTG/i, nhom: "A", dung: (t) => bcF0A0(t, { company: "1002", warehouse: "1177", ten: "MTG" }) },
  { khop: /bất thường.*MATERIAL - GARMENT/i, nhom: "A", dung: (t) => bcF0A0(t, { company: "1005", warehouse: "1339", ten: "GARMENT" }) },
  { khop: /Sắp xếp hàng hóa trong kho/i, nhom: "B" },
  /* NGOÀI PHẠM VI BOT — ĐÚNG MỘT task, chủ máy chốt lại 20/08/2026: task tên CHÍNH XÁC "Sắp xếp
     hàng hóa tại kho tổng" do Huỳnh Trần Như Ý giao thì CHỦ MÁY TỰ báo cáo; mọi task còn lại trong
     sổ tay này bot đều báo cáo tự động.
     Vì sao khoá bằng CẢ TÊN NEO HAI ĐẦU (^...$) LẪN NGƯỜI GIAO: khớp lỏng kiểu /tại kho tổng/ sẽ ăn
     lây bất kỳ task nào chứa cụm đó (ví dụ "Sắp xếp hàng hóa tại kho tổng ca 2" của người khác) rồi
     im lặng không nộp. Lệch một trong hai điều kiện ⇒ rơi vào nhánh "task LẠ": bot KÊU TO và không
     nộp — hướng sai an toàn, không bao giờ nộp hộ task của người ta.
     Cửa duy nhất để bot soạn task này: gọi đích danh `--task=<id>` (phải tự gõ đúng id hôm đó). */
  { khop: /^\s*Sắp xếp hàng hóa tại kho tổng\s*$/i, nhom: "B", tuBaoCao: true, nguoiGiao: NGUOI_GIAO_TU_BAO_CAO },
  { khop: /Dán tem QC Fail/i, nhom: "B" },
];
/* Khớp theo TÊN, và với mục nào khai `nguoiGiao` thì phải đúng luôn người tạo task (`created_by`).
   Truyền `t` là tuỳ chọn — thiếu `t` thì mục có `nguoiGiao` không khớp, tức là ngả về an toàn. */
/* Cửa thử báo cáo F0-A0 — đặt NGAY SAU bộ dựng, TRƯỚC mọi lời gọi wshr, để chạy được cả khi phiên
   work đã chết (chỉ cần phiên WMS). */
if (CO.thuF0A0) {
  for (const cfg of [{ company: "1002", warehouse: "1177", ten: "MTG" },
                     { company: "1005", warehouse: "1339", ten: "GARMENT" }]) {
    const kq = await bcF0A0({ note: "" }, cfg);
    console.log("\n===== " + cfg.ten + " · du=" + kq.du + " · " + kq.text.length + " ký tự\n" + kq.text);
  }
  process.exit(0);
}

const traSoTay = (ten, t) => SO_TAY.find((s) =>
  s.khop.test(ten) && (!s.nguoiGiao || Number(t?.created_by) === s.nguoiGiao)) || null;

/** Nối thêm dòng mốc khi báo cáo ngắn hơn ngưỡng máy chủ — tránh 422 mà không bịa nội dung. */
function duDaiToiThieu(text) {
  const s = String(text || "").trim();
  if (s.length >= TOI_THIEU) return s;
  return (s ? s + "\n" : "") + `(Nội dung do bộ nộp báo cáo tự động ghi lúc ${gio()} ngày ${ngayGon(ngayVN())}.)`;
}

/** Báo cáo người tự viết (ưu tiên hơn bản tự dựng) — chỉ dùng nếu đúng ngày hôm nay. */
function baoCaoTay(id, ten) {
  const j = docJson(FILE_TAY);
  if (!j || j.ngay !== ngayVN()) return null;
  const b = j.baocao || {};
  return b[String(id)] || b[ten] || null;
}

/* ═════════════════ 3) ĐỌC / GHI wshr ═════════════════ */
async function dsTaskHomNay(work) {
  let r;
  try { r = await fetchThuLai(NOTIF, { headers: { authorization: work, accept: "application/json" } }); }
  catch (e) { log("✗ Không đọc được danh sách task hôm nay: " + moTaLoi(e)); return null; }
  const j = await r.json().catch(() => null);
  const rows = j?.data?.rows || [];
  const hn = ngayVN();
  const thay = new Map();
  for (const n of rows) {
    if (n.object_type !== 4) continue;                       // 4 = "vừa giao cho bạn 1 công việc"
    if (String(n.created_at || "").slice(0, 10) !== hn) continue;
    thay.set(n.object_id, String(n.title || "").replace(/^Task:\s*/i, ""));
  }
  return [...thay].map(([id, ten]) => ({ id, ten }));
}

async function chiTiet(work, id) {
  let r;
  try { r = await fetchThuLai(CHI_TIET(id), { headers: { authorization: work, accept: "application/json" } }); }
  catch (e) { log(`  (#${id} đọc chi tiết hỏng: ${moTaLoi(e)})`); return null; }
  const j = await r.json().catch(() => null);
  return j?.data || null;
}

/** Trạng thái CỦA TÔI: sub_type=1 → dòng riêng trong staff[]; sub_type=0 → trạng thái task. */
function trangThaiToi(t) {
  if (Number(t.sub_type) === 1) {
    const me = (t.staff || []).find((s) => Number(s.staff_id) === TOI);
    return me ? Number(me.status) : null;
  }
  return Number(t.status);
}

/* KHÔNG thử lại lượt POST này: đây là lượt GHI. Mạng đứt giữa chừng thì không biết máy chủ đã
   nhận chưa — thử lại có thể nộp đè lần hai. Báo lỗi để người bấm nút lại (lượt sau tự bỏ qua
   task đã nộp) an toàn hơn nhiều. */
async function datField(work, body) {
  let r;
  try {
    r = await fetch(GHI, {
      method: "POST",
      headers: { authorization: work, accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) { return { ok: false, moTa: "đứt liên lạc · " + moTaLoi(e) }; }
  const j = await r.json().catch(() => null);
  return { ok: r.ok && j && j.status === 1 && j.data !== false, moTa: `HTTP ${r.status} · ${JSON.stringify(j).slice(0, 200)}` };
}

/* Web BẮT phải có "giờ thực tế" trước khi đổi trạng thái (nếu thiếu: 422 "Vui lòng cập nhật giờ
   thực tế!"). Nên nộp 2 nhịp: đặt reality_hours rồi mới đẩy status — đúng thứ tự người bấm trên web. */
async function nopBaoCao(work, t, text, phut) {
  const id = t.id;
  const phutNop = Math.max(1, Math.round(Number(phut) || GIO_THUC_TE));   // web không nhận 0
  // LUÔN đặt lại giờ thực tế: với sub_type=1 nó tính theo TỪNG NGƯỜI — task cha đã có giờ (do
  // đồng nghiệp nộp trước) mà dòng của mình chưa, vẫn dính 422 "Vui lòng cập nhật giờ thực tế!".
  {
    const kq = await datField(work, { id, field: "reality_hours", value: phutNop });
    if (!kq.ok) return { ok: false, moTa: "đặt giờ thực tế lỗi · " + kq.moTa };
  }
  const kq = await datField(work, { id, field: "status", value: CHO_DUYET, extra_data: { configs: { virtual_text: text } } });
  return { ok: kq.ok, moTa: kq.ok ? "OK" : kq.moTa };
}

/* ═════════════════ 3b) NÚT BẤM TAY: làm tươi số liệu + hỏi người ═════════════════ */

const LOG_NUT = "nut.log";
const CHO_CUM_MS = Number(process.env.TASK_CHO_CUM_PHUT || 8) * 60000;

/** Cụm đồng bộ khác (8h40 / guard / poller) đang chạy? — nhận dạng y như `sync-poller.js`. */
function cumDangChay() {
  return new Promise((res) => {
    execFile("powershell", ["-NoProfile", "-Command",
      "Get-CimInstance Win32_Process -Filter \"Name='node.exe' or Name='cmd.exe'\" | Select-Object -ExpandProperty CommandLine"],
      { windowsHide: true, timeout: 30000 },
      (err, out) => {
        if (err || !out) return res(false);
        const dau = /sync-stocklocation\.js|push-pc-to-sheet\.mjs|sync-tonbatthuong\.js|sync-vesinh-all\.js|sync-vesinh-ai\.mjs|auto-export-sync\.js|SYNC-STOCK\.bat|AUTO-EXPORT\.bat/i;
        res(out.split(/\r?\n/).some((l) => dau.test(l)));
      });
  });
}

/** Chạy một script con, nối output vào `nut.log`.
 *
 *  VÌ SAO LOG RIÊNG (bẫy cắn 19/08/2026 lúc 10:06): bản đầu bắt chước poller — `cmd /c node … >>
 *  kiemke.log`. Đúng lúc đó cụm 09:36 đang kéo và đang GIỮ `kiemke.log` bằng chính `>>` của cmd,
 *  nên cmd thứ hai mở file không được → chết ngay `exit 1` trong **0 giây**, mà thông báo lỗi cũng
 *  bị đổ vào file đang khoá nên mất luôn: log sạch bóng, chỉ thấy "⚠ kiểm kê exit 1 (0s)". Nay
 *  spawn node trực tiếp (không qua cmd, không redirect) và tự ghi 1 lượt vào log riêng của nút. */
function chayNgoai(nhan, script, env) {
  const t0 = Date.now();
  const dau = `\r\n[nút ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false })}] ${nhan} (${script})\r\n`;
  return new Promise((res) => {
    let ra = "";
    const nhip = setInterval(() => process.stdout.write("."), 15000);   // cửa sổ nút khỏi trông như treo
    const c = spawn(process.execPath, [path.join(DIR, script)],
      { cwd: DIR, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, env: { ...process.env, ...(env || {}) } });
    c.stdout.on("data", (d) => { ra += d; });
    c.stderr.on("data", (d) => { ra += d; });
    const xong = (ma) => {
      clearInterval(nhip); process.stdout.write("\n");
      try { fs.appendFileSync(path.join(DIR, LOG_NUT), dau + ra); } catch { /* sổ best-effort */ }
      res({ ma, giay: Math.round((Date.now() - t0) / 1000) });
    };
    c.on("exit", (code) => xong(code == null ? -1 : code));
    c.on("error", (e) => { ra += "\r\nlỗi spawn: " + e.message + "\r\n"; xong(-1); });
  });
}

/* Báo cáo chỉ đáng nộp khi số liệu trong máy còn tươi. Poller trong ngày giữ kiểm kê ≥30' và 5S
 * ≥45', nên phần lớn lượt bấm nút KHÔNG tốn lượt gọi upstream nào — chỉ kéo khi mốc đã đứng lâu
 * (ví dụ bấm buổi sáng khi cụm 8h40 chưa kịp kéo kiểm kê). Ngưỡng: TASK_TUOI_TOI_DA phút. */
async function lamTuoiSoLieu() {
  const gia = (buoc) => Date.now() - docMocBuoc(DIR, buoc);
  const canKeo = () => {
    const v = [];
    if (gia("kiemke") > TUOI_TOI_DA) v.push({ ten: "kiểm kê", buoc: "kiemke", script: "push-pc-to-sheet.mjs", env: { PC_DELTA: "1" } });
    if (gia("5s") > TUOI_TOI_DA) v.push({ ten: "5S", buoc: "5s", script: "auto-export-sync.js", env: { KHONG_LOGIN: "1" } });
    return v;
  };
  if (!canKeo().length) { log("Số liệu trong máy còn tươi — khỏi kéo lại."); return; }

  /* Cụm khác đang kéo đúng những bước này: CHỜ nó xong rồi đo lại mốc — nó ghi mốc là mình khỏi
     kéo (đỡ 1 lượt gọi WMS), và tránh 2 tiến trình cùng ghi Sheet/log. */
  if (await cumDangChay()) {
    log(`Cụm đồng bộ khác đang chạy — chờ tối đa ${Math.round(CHO_CUM_MS / 60000)}' cho nó xong (khỏi kéo chồng)`);
    const het = Date.now() + CHO_CUM_MS;
    while (Date.now() < het) {
      await new Promise((r) => setTimeout(r, 15000));
      process.stdout.write(".");
      if (!(await cumDangChay())) break;
    }
    process.stdout.write("\n");
    if (!canKeo().length) { log("✓ Cụm vừa kéo xong — số liệu đã tươi, khỏi kéo lại."); return; }
    if (await cumDangChay()) {
      log("⚠ Cụm vẫn đang chạy — bỏ bước làm tươi. Task thiếu số liệu sẽ tự KHÔNG nộp; cụm xong thì bấm nút lại.");
      return;
    }
  }

  for (const v of canKeo()) {
    log(`→ ${v.ten}: mốc đã đứng ${Math.round(gia(v.buoc) / 60000)}' — kéo lại (chờ chút · log ${LOG_NUT})`);
    const { ma, giay } = await chayNgoai("làm tươi " + v.ten + " trước khi nộp báo cáo", v.script, v.env);
    log(ma === 0 ? `  ✓ ${v.ten} xong (${giay}s).`
      : ma === 75 ? `  … ${v.ten} hoãn (chưa có phiên sống, ${giay}s) — task nào thiếu số liệu sẽ tự không nộp.`
        : `  ⚠ ${v.ten} exit ${ma} (${giay}s) — xem ${LOG_NUT}.`);
  }
}

/** Hỏi người bấm: NỘP hay KHÔNG. Không có bàn phím ⇒ KHÔNG nộp.
 *  CHỐT 20/08/2026 — BỎ nhánh "[a] chỉ nhóm A" của bản 19/08. Nó là cái bẫy đã cắn đúng một ngày
 *  sau khi thêm: chiều 20/08 người bấm chọn [a], hai task nhóm B (#13371951 Sắp xếp hàng hóa trong
 *  kho, #13373905 Dán tem QC Fail) bị lặng lẽ bỏ lại — log chỉ ghi "nộp 6 · bỏ qua 4", không một
 *  chữ nào về hai task bị loại. Nay mọi task TRONG SỔ TAY đều nộp (trừ đúng một task cờ tuBaoCao),
 *  câu hỏi chỉ còn nộp / không nộp. Ai thật sự cần lọc riêng nhóm A thì dùng cờ --nhom=A (nút
 *  "Chỉ nhóm A" của bot tin nhắn) — đó là lựa chọn gõ tay, không phải một phím lỡ tay. */
/* MỘT readline DÙNG CHUNG cho mọi câu hỏi của nút — hàng đợi dòng, KHÔNG dùng rl.question.
   Hai bẫy bắt được 24/08/2026 khi chạy thử: (1) mỗi câu hỏi mở readline riêng rồi đóng —
   readline đọc trước cả khối stdin, close() vứt phần chưa dùng, câu sau treo; (2) rl.question
   chỉ bắt dòng ĐẾN SAU khi hỏi — dòng đến sớm bị nhả ra sự kiện line không ai nghe rồi mất,
   và stdin đóng thì promise question treo vĩnh viễn (thoát im lặng giữa chừng). Nghe line MỘT
   lần vào hàng đợi + nghe close ⇒ câu trả lời không bao giờ lạc, đứt stdin trả null tức thì. */
let _rl = null, _rlDong = false, _rlHang = [], _rlBao = null;
async function hoiNguoi(cau) {
  if (!_rl && !_rlDong) {
    _rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    _rl.on("line", (l) => { _rlHang.push(l); _rlBao?.(); });
    _rl.on("close", () => { _rlDong = true; _rlBao?.(); });
  }
  process.stdout.write(cau);
  while (!_rlHang.length) {
    if (_rlDong) { process.stdout.write("\n"); return null; }
    await new Promise((r) => { _rlBao = r; });
    _rlBao = null;
  }
  return _rlHang.shift().trim();
}
function dongHoi() { try { _rl?.close(); } catch { /* đã đóng */ } _rl = null; _rlDong = true; }

async function hoiLuaChon(hangDoi) {
  const soA = hangDoi.filter((x) => x.nhom === "A").length;
  console.log("");
  log(`${hangDoi.length} task sẵn sàng nộp — ${soA} nhóm A (số liệu thật) · ${hangDoi.length - soA} nhóm B (việc tay).`);
  /* Chốt 19/08/2026: bot chỉ nộp khi CÓ NGƯỜI BẤM. Chạy nền (Task Scheduler, vbs ẩn) thì stdin
     không phải TTY — hỏi sẽ treo mãi, nên dừng thẳng thay vì "im lặng nộp hộ". */
  if (!process.stdin.isTTY) { log("✗ Không có bàn phím (đang chạy nền) — chế độ nút không tự nộp. Dừng."); return "k"; }
  const tl = ((await hoiNguoi(`\n➜ Nộp lên work.hasaki.vn?  [Enter] nộp CẢ ${hangDoi.length} task · [g] sửa giờ trước · [k] không nộp gì : `)) ?? "k").toLowerCase();
  // Chỉ "k" là KHÔNG nộp, "g" là quay ra sửa giờ; gõ gì khác (kể cả "a" của bản cũ theo quán
  // tính) đều là nộp cả.
  return tl === "k" ? "k" : tl === "g" ? "g" : "tatca";
}

/* ═════════════════ 4) LUỒNG CHÍNH ═════════════════ */
const work = await layTokenSongWork(DIR, log);
if (!work) {
  log("✗ Không có phiên work còn sống — người dùng chưa đăng nhập work.hasaki.vn. Dừng (không tự đăng nhập).");
  process.exit(2);
}

let ds = await dsTaskHomNay(work);
if (!ds) { log("  Mạng chưa thông — chưa nộp gì cả. Bấm nút lại khi mở được work.hasaki.vn."); process.exit(4); }
if (CO.task) ds = ds.filter((x) => x.id === CO.task);
if (!ds.length) { log("Hôm nay chưa thấy task nào được giao (hoặc đã lọc hết)."); process.exit(0); }

const conSom = gioVN() < GIO_SOM_NHAT && !CO.ep && !CO.task;
log(`${ds.length} task hôm nay ${ngayGon(ngayVN())}`
  + (CO.hoi ? " · NÚT BẤM TAY (xem nháp rồi mới hỏi nộp)" : CO.nop ? " · CHẾ ĐỘ NỘP THẬT" : " · chỉ xem (thêm --nop để nộp)")
  + (conSom ? ` · CHƯA TỚI GIỜ BÁO CÁO (${GIO_SOM_NHAT}h) — chỉ xem, thêm --ep để ép nộp` : ""));
console.log("");

/* ── Nhịp 1: đọc trạng thái từng task (chưa dựng báo cáo — để biết có việc gì đáng làm tươi) ── */
const bang = [];
for (const { id, ten } of ds.sort((a, b) => a.id - b.id)) {
  const t = await chiTiet(work, id);
  if (!t) { log(`#${id} ${ten} — không đọc được chi tiết, bỏ qua.`); continue; }
  bang.push({ id, ten, t, st: trangThaiToi(t), sot: traSoTay(ten, t) });
}

/* ── Nhịp 2: số liệu cũ thì kéo lại — CHỈ khi thật có task nhóm A đang chờ (khỏi tốn lượt gọi
      upstream cho một lượt bấm mà mọi task đã nộp xong) ── */
if (CO.lamtuoi) {
  if (bang.some((x) => x.st === 0 && x.sot && x.sot.nhom === "A")) await lamTuoiSoLieu();
  else log("Không có task nhóm A nào đang chờ — khỏi kéo số liệu.");
  console.log("");
}

/* ── Nhịp 3: dựng + in bản nháp, xếp hàng đợi nộp ── */
let boQua = 0; const la = [], hangDoi = [], xemPhut = [];
for (const { id, ten, t, st, sot } of bang) {
  const nhan = `#${id} · ${ten}`;
  console.log(`── ${nhan}`);
  console.log(`   nhóm ${sot ? sot.nhom : "?"} · prid=${t.prid} · sub_type=${t.sub_type} · tôi: ${st == null ? "(không có trong danh sách)" : TEN_TT[st]} · cả task: ${TEN_TT[t.status]}`);

  if (st == null) { console.log("   → không phải task của tôi, bỏ qua.\n"); boQua++; continue; }
  if (st !== 0) { console.log("   → đã nộp/đã xử lý rồi, bỏ qua.\n"); boQua++; continue; }
  if (!sot) { console.log("   → task LẠ (chưa có trong sổ tay) — cần xem tay.\n"); la.push(nhan); boQua++; continue; }
  // Task để riêng cho chủ máy tự báo cáo (chốt 19/08/2026) — bot không soạn, không nộp.
  if (sot.tuBaoCao && !CO.task) { console.log("   → NGOÀI PHẠM VI BOT — bạn tự bấm Hoàn thành trên web.\n"); boQua++; continue; }
  if (sot.tuBaoCao) console.log("   ⚠ Task này vốn NGOÀI phạm vi bot — nhưng bạn gọi đích danh --task nên vẫn soạn.");

  let text = null, du = false, phut = 0, viPhut = "";
  if (sot.nhom === "A") {
    const kq = await sot.dung(t);
    text = kq.text; du = kq.du;
    if (kq.phut) { phut = kq.phut; viPhut = kq.vi || ""; }
  } else {
    text = baoCaoTay(id, ten) || BC_NHOM_B;   // người viết tay thì ưu tiên, không thì câu trung tính
    du = true;
  }
  if (du) text = duDaiToiThieu(text);
  /* Ưu tiên: người tự khai > mốc thật của số liệu > mặc định 1 phút (task không có mốc nào). */
  const tay = phutTay(id, ten);
  if (tay) { phut = tay; viPhut = "người tự khai trong .task-giothucte.json"; }
  if (!phut) { phut = GIO_THUC_TE; viPhut = "không có mốc thời gian nào -> mặc định " + GIO_THUC_TE + " phút"; }
  console.log("   ┌ báo cáo:");
  console.log(String(text).split("\n").map((s) => "   │ " + s).join("\n"));
  console.log("   └");
  console.log("   thời gian thực tế: " + phut + " phút" + (viPhut ? " (" + viPhut + ")" : ""));

  if (!CO.nop) { xemPhut.push({ id, ten, phut, viPhut }); console.log(""); continue; }
  if (!du) { console.log("   → thiếu dữ liệu thật → KHÔNG nộp.\n"); boQua++; continue; }
  if (conSom) { console.log(`   → chưa tới giờ báo cáo (${GIO_SOM_NHAT}h) — để dành.\n`); boQua++; continue; }
  console.log("   → xếp hàng chờ nộp.\n");
  hangDoi.push({ id, ten, t, text, nhom: sot.nhom, phut, viPhut });
}

/* ── Nhịp 3b: QUỸ CÔNG 480' — bot ĐỀ XUẤT số phút, người bấm sửa được ──
   Cộng thô số phút từng task là ĐẾM TRÙNG (mốc của các task chồng lên nhau trong cùng một ngày),
   nên khi tổng vượt quỹ CÒN LẠI của ngày thì hạ ĐỀU theo tỉ lệ — mỗi task vẫn giữ sàn 1 phút vì
   web không nhận 0. Quỹ còn lại = 480 trừ phần ĐÃ ghi sẵn ở các task khác hôm nay.
   SỐ NGƯỜI TỰ NHẬP KHÔNG BỊ HẠ: người đã gõ tay là người chịu trách nhiệm con số đó, bot chỉ co
   những task do chính nó đo để nhường chỗ. */
const dsPhut = CO.nop ? hangDoi : xemPhut;
for (const x of dsPhut) { x.phutDo = x.phut; if (x.viPhut.startsWith("người tự khai")) x.nguoiSua = true; }
const daGhi = bang.filter((x) => x.st != null && !dsPhut.some((y) => y.id === x.id))   // task của người khác không tính vào quỹ của mình
  .reduce((a, x) => a + phutDaGhi(x.t), 0);
const quyConLai = Math.max(0, PHUT_NGAY - daGhi);
const tongPhut = () => dsPhut.reduce((a, x) => a + x.phut, 0);

/** Dựng lại số phút sẽ nộp từ số ĐO GỐC + số người tự nhập, rồi hạ phần bot đo cho vừa quỹ.
 *  Gọi lại được nhiều lần (mỗi lượt người sửa giờ xong gọi một lượt). */
function tinhLaiQuy() {
  const tay = dsPhut.filter((x) => x.nguoiSua), tuDong = dsPhut.filter((x) => !x.nguoiSua);
  for (const x of tuDong) x.phut = x.phutDo;
  const quyTuDong = quyConLai - tay.reduce((a, x) => a + x.phut, 0);
  const tong = () => tuDong.reduce((a, x) => a + x.phut, 0);
  if (!tuDong.length || tong() <= quyTuDong) return;
  /* Hạ ĐỀU theo tỉ lệ, không gọt trụi mỗi task dài nhất — giữ đúng thứ tự "việc nào lâu hơn việc
     nào" mà người duyệt nhìn thấy. Làm tròn xuống nên thường còn dư vài phút, gọt nốt từ task dài
     nhất; task nào cũng có sàn 1 phút. */
  const ti = Math.max(0, quyTuDong) / tong();
  for (const x of tuDong) x.phut = Math.max(1, Math.floor(x.phut * ti));
  while (tong() > quyTuDong) {
    const lon = tuDong.filter((x) => x.phut > 1).sort((a, b) => b.phut - a.phut)[0];
    if (!lon) break;                                   // mọi task đã chạm sàn 1 phút — không hạ nữa
    lon.phut--;
  }
}
function inBangPhut() {
  if (!dsPhut.length && !daGhi) return;
  const tong = tongPhut(), con = PHUT_NGAY - daGhi - tong;
  console.log("── THỜI GIAN THỰC TẾ (phút · quỹ ngày " + PHUT_NGAY + "')");
  for (const x of dsPhut)
    console.log("   " + String(x.phut).padStart(4) + "'  #" + x.id + " " + x.ten
      + (x.nguoiSua ? "  ← BẠN NHẬP" + (x.phutDo !== x.phut ? " (bot đo " + x.phutDo + "')" : "")
        : x.phut !== x.phutDo ? " (bot đo " + x.phutDo + "', hạ theo quỹ)" : "")
      + (x.viPhut && !x.nguoiSua ? " — " + x.viPhut : ""));
  if (daGhi) console.log("   " + String(daGhi).padStart(4) + "'  (đã ghi sẵn ở task khác trong ngày)");
  console.log("   ─────");
  console.log("   " + String(daGhi + tong).padStart(4) + "' / " + PHUT_NGAY + "'  →  CÒN LẠI " + con + " phút"
    + (con < 0 ? "  ⚠ VƯỢT quỹ ngày" : ""));
  console.log("");
}
tinhLaiQuy();
inBangPhut();

/** Chỗ NHẬP GIỜ MÌNH MUỐN: đi từng task, Enter suông = giữ số bot đề xuất. */
async function suaGioTay() {
  let doi = 0;
  console.log("");
  log("Nhập số phút bạn muốn cho từng task — Enter suông = GIỮ số bot đề xuất · [x] = thôi, giữ hết");
  for (const x of dsPhut) {
    const tl = await hoiNguoi("   #" + x.id + " " + x.ten + "  [" + x.phut + "'] : ");
    if (tl == null || tl.toLowerCase() === "x") break;   // đứt stdin cũng dừng ở đây
    if (!tl) continue;
    const v = Math.round(Number(tl.replace(",", ".")));
    if (!Number.isFinite(v) || v < 1) { console.log("      (không phải số phút hợp lệ — giữ nguyên)"); continue; }
    x.phut = v; x.nguoiSua = true; doi++;   // giữ nguyên phutDo để bảng còn khoe số bot đo
  }
  return doi;
}
/** Nhớ số người vừa nhập vào .task-giothucte.json để bấm nút lại trong ngày không phải gõ lại. */
function ghiGioTay() {
  const cu = docJson(FILE_GIO);
  const phut = (cu && cu.ngay === ngayVN() && cu.phut) ? { ...cu.phut } : {};
  for (const x of dsPhut) if (x.nguoiSua) phut[String(x.id)] = x.phut;
  try { fs.writeFileSync(FILE_GIO, JSON.stringify({ ngay: ngayVN(), phut }, null, 2)); return true; }
  catch { return false; }
}

/* ── Nhịp 4: nộp (chế độ nút thì HỎI trước; không hỏi = nộp cả hàng đợi như cũ) ── */
let daNop = 0, phutDaNop = 0;
if (CO.nop && hangDoi.length) {
  let chon = "tatca";
  while (CO.hoi) {
    chon = await hoiLuaChon(hangDoi);
    if (chon !== "g") break;
    const doi = await suaGioTay();
    tinhLaiQuy();
    console.log("");
    inBangPhut();
    if (doi) log(ghiGioTay()
      ? `Đã nhớ ${doi} số phút bạn nhập vào .task-giothucte.json — bấm nút lại trong ngày khỏi gõ lại.`
      : "⚠ Không ghi được .task-giothucte.json — số phút vẫn dùng cho lượt nộp này.");
  }
  dongHoi();
  const canNop = (chon === "k" ? [] : hangDoi.filter((x) => chon === "tatca" || x.nhom === "A"))
    .filter((x) => !CO.nhom || x.nhom === CO.nhom);   // --nhom=A: lọc thêm (đường không-hỏi)
  if (chon === "k") log(`→ KHÔNG nộp gì. ${hangDoi.length} task để dành — tự bấm Hoàn thành trên work.hasaki.vn.`);
  else if (chon === "a") log(`→ Chỉ nộp ${canNop.length} task nhóm A; ${hangDoi.length - canNop.length} task việc tay để người tự báo cáo.`);
  console.log("");
  for (const x of canNop) {
    const kq = await nopBaoCao(work, x.t, x.text, x.phut);
    console.log(kq.ok ? `   ✓ ĐÃ NỘP #${x.id} · ${x.ten} (chờ duyệt · thời gian thực tế ${x.phut} phút).` : `   ✗ nộp lỗi #${x.id} · ${x.ten}: ${kq.moTa}`);
    if (kq.ok) { daNop++; phutDaNop += x.phut; } else boQua++;
  }
} else if (CO.nop) log("Không có task nào đang chờ nộp — khỏi bấm nút.");

console.log("");
log(`Xong: nộp ${daNop} · bỏ qua ${boQua}.`);
if (CO.nop) log(`Thời gian thực tế đã nộp ${phutDaNop} phút · đã ghi trước ${daGhi} phút`
  + ` → ${daGhi + phutDaNop}/${PHUT_NGAY} phút · CÒN LẠI ${PHUT_NGAY - daGhi - phutDaNop} phút.`);
/* Lượt bấm nút in ra màn hình rồi cửa sổ đóng là mất — chốt lại 1 dòng vào sổ để sau này tra
   được "hôm đó ai nộp, nộp mấy cái" mà không phải nhớ. */
if (CO.hoi) {
  try {
    fs.appendFileSync(path.join(DIR, "task-hangngay.log"),
      `[nút ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false })}] nộp ${daNop} (${phutDaNop}'/${PHUT_NGAY}', còn ${PHUT_NGAY - daGhi - phutDaNop}') · bỏ qua ${boQua}${hangDoi.length ? "" : " (không có gì chờ nộp)"}\r\n`);
  } catch { /* sổ best-effort */ }
}
/* Sổ tay khớp theo TÊN (task_id đổi mỗi ngày). Tên bị đổi/ thêm task mới ⇒ rơi vào đây và KHÔNG
   bao giờ bị nộp bừa — nhưng phải kêu to, không thì lặng lẽ bỏ sót hằng ngày. */
if (la.length) log(`⚠ ${la.length} task chưa có trong sổ tay (KHÔNG nộp) — thêm mẫu tên vào SO_TAY: ` + la.join(" | "));
if (CO.nop && daNop) ghiMocBuoc(DIR, "task-hangngay");
