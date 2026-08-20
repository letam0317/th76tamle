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
const DASH_5S = "https://letam0317.github.io/kiemsoatkho/?company=hasaki&tab=task";
const CHO_DUYET = 5;                                             // 5 = Chờ duyệt (nhân viên đã nộp)
const GIO_THUC_TE = Number(process.env.TASK_GIO_THUC_TE || 1);   // "giờ thực tế" — web bắt điền trước khi đổi trạng thái
const TEN_TT = { 0: "chưa làm", 1: "đang làm", 2: "đã duyệt", 3: "trễ", 4: "huỷ", 5: "chờ duyệt", 6: "thất bại" };
const FILE_TAY = path.join(DIR, ".task-baocao-tay.json");         // báo cáo người tự viết (ưu tiên hơn bản tự dựng)
// Máy chủ CHẶN nộp khi "kết quả công việc" quá ngắn (≤50 ký tự) và không đính kèm file:
// 422 "Vui lòng mô tả chi tiết những công việc đã thực hiện...". Đo được: 50 ✗ · 55 ✓.
const TOI_THIEU = 55;
// Nhóm B (việc tay) — chủ máy chốt 18/08/2026: KHÔNG ghi nội dung gì. Nhưng web bắt buộc phải có
// chữ nên dùng một câu trung tính, KHÔNG khai là đã làm hay chưa làm.
const BC_NHOM_B = process.env.TASK_BAOCAO_MACDINH || "Không có nội dung báo cáo bổ sung cho công việc này trong ngày.";

const CO = { nop: false, ep: false, task: 0, hoi: false, lamtuoi: false, nhom: "" };
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

/* ═════════════════ 1) BỘ DỰNG BÁO CÁO (chỉ số liệu thật) ═════════════════ */

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
  const dong = [
    `${nhan} ngày ${hn}: ${dem} phiếu (${daDem} đã đếm, ${lech} phiếu lệch).`,
    `Kho: ${kho.join(", ") || "-"}.`,
    nguoi.length ? `Người kiểm: ${nguoi.slice(0, 6).join(", ")}${nguoi.length > 6 ? ` và ${nguoi.length - 6} người khác` : ""}.` : "",
    link ? `Chi tiết: ${link}` : "",
  ].filter(Boolean);
  return { du: true, text: dong.join("\n") };
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
  const dong = [
    `Báo cáo 5S kho tổng ngày ${ngayGon(hn)}:`,
    rows.length
      ? `ghi nhận ${rows.length} lượt vi phạm (${Object.entries(theoTT).map(([k, v]) => `${k}: ${v}`).join(", ")}).`
      : "không có lượt vi phạm nào được ghi nhận trong ngày.",
    `Số liệu đối chiếu lúc ${tuoi}. Chi tiết: [AUDIT](${DASH_5S})`,
  ];
  return { du: true, text: dong.join("\n") };
}

/** F0-A0 còn tồn: hỏi lại WMS đúng bộ lọc trong link của task (nhẹ — 1 lượt/kho). */
async function bcF0A0(t, cfg) {
  const wms = await layTokenSongWms(DIR, () => {});
  if (!wms) return { du: false, text: "Không có phiên WMS còn sống để kiểm tra lại F0-A0 — không nộp." };
  const url = `${WMS_BIN}?company_ids=${cfg.company}&warehouse_ids=${cfg.warehouse}&ignore_zero_total=1`
    + "&prefix_location_description=F0-A0-00-00-00-00&page=1&size=200";
  const r = await fetchThuLai(url, { headers: { authorization: wms } }).catch(() => null);
  if (!r || !r.ok) return { du: false, text: `WMS từ chối truy vấn F0-A0 (${r ? r.status : "lỗi mạng"}) — không nộp.` };
  const j = await r.json().catch(() => null);
  const recs = j?.records || j?.data?.records || [];
  const con = j?.count ?? j?.total ?? recs.length;
  const dauNgay = (String(t.note || "").match(/(\d+)\s*sku/i) || [])[1];
  const dong = [
    `Bin F0-A0 kho WH - MATERIAL - ${cfg.ten} — kiểm tra lại lúc ${gio()} ngày ${ngayGon(ngayVN())}:`,
    `còn ${con} SKU đang treo tại F0-A0${dauNgay ? ` (đầu ngày task ghi nhận ${dauNgay} SKU)` : ""}.`,
    recs.length ? `Mã: ${recs.slice(0, 10).map((x) => x.sku || x.product_code || x.uid || "?").join(", ")}${recs.length > 10 ? ` …(+${recs.length - 10})` : ""}.` : "",
    linkTrongNote(t) ? `Link: ${linkTrongNote(t)}` : "",
  ].filter(Boolean);
  return { du: true, text: dong.join("\n") };
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
  /* NGOÀI PHẠM VI BOT — chủ máy chốt 19/08/2026: task này để riêng, CHỦ MÁY TỰ báo cáo hoàn thành.
     Bot không nộp kể cả khi người bấm chọn "nộp tất cả". Cửa duy nhất: gọi đích danh
     `--task=<id>` (phải tự tay gõ đúng id của ngày hôm đó — không thể lỡ tay). */
  { khop: /Sắp xếp hàng hóa tại kho tổng/i, nhom: "B", tuBaoCao: true },
  { khop: /Dán tem QC Fail/i, nhom: "B" },
];
const traSoTay = (ten) => SO_TAY.find((s) => s.khop.test(ten)) || null;

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
async function nopBaoCao(work, t, text) {
  const id = t.id;
  // LUÔN đặt lại giờ thực tế: với sub_type=1 nó tính theo TỪNG NGƯỜI — task cha đã có giờ (do
  // đồng nghiệp nộp trước) mà dòng của mình chưa, vẫn dính 422 "Vui lòng cập nhật giờ thực tế!".
  {
    const kq = await datField(work, { id, field: "reality_hours", value: GIO_THUC_TE });
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

/** Hỏi người bấm: nộp tất cả · chỉ nhóm A · không nộp. Không có bàn phím ⇒ KHÔNG nộp. */
async function hoiLuaChon(hangDoi) {
  const soA = hangDoi.filter((x) => x.nhom === "A").length;
  console.log("");
  log(`${hangDoi.length} task sẵn sàng nộp — ${soA} nhóm A (số liệu thật) · ${hangDoi.length - soA} nhóm B (việc tay).`);
  /* Chốt 19/08/2026: bot chỉ nộp khi CÓ NGƯỜI BẤM. Chạy nền (Task Scheduler, vbs ẩn) thì stdin
     không phải TTY — hỏi sẽ treo mãi, nên dừng thẳng thay vì "im lặng nộp hộ". */
  if (!process.stdin.isTTY) { log("✗ Không có bàn phím (đang chạy nền) — chế độ nút không tự nộp. Dừng."); return "k"; }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let tl = "";
  try {
    tl = (await rl.question(`\n➜ Nộp lên work.hasaki.vn?  [Enter] nộp CẢ ${hangDoi.length} · [a] chỉ ${soA} task nhóm A · [k] không nộp gì : `)).trim().toLowerCase();
  } finally { rl.close(); }
  if (tl === "" || tl === "c" || tl === "y") return "tatca";
  if (tl === "a") return "a";
  return "k";
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
  bang.push({ id, ten, t, st: trangThaiToi(t), sot: traSoTay(ten) });
}

/* ── Nhịp 2: số liệu cũ thì kéo lại — CHỈ khi thật có task nhóm A đang chờ (khỏi tốn lượt gọi
      upstream cho một lượt bấm mà mọi task đã nộp xong) ── */
if (CO.lamtuoi) {
  if (bang.some((x) => x.st === 0 && x.sot && x.sot.nhom === "A")) await lamTuoiSoLieu();
  else log("Không có task nhóm A nào đang chờ — khỏi kéo số liệu.");
  console.log("");
}

/* ── Nhịp 3: dựng + in bản nháp, xếp hàng đợi nộp ── */
let boQua = 0; const la = [], hangDoi = [];
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

  let text = null, du = false;
  if (sot.nhom === "A") {
    const kq = await sot.dung(t);
    text = kq.text; du = kq.du;
  } else {
    text = baoCaoTay(id, ten) || BC_NHOM_B;   // người viết tay thì ưu tiên, không thì câu trung tính
    du = true;
  }
  if (du) text = duDaiToiThieu(text);
  console.log("   ┌ báo cáo:");
  console.log(String(text).split("\n").map((s) => "   │ " + s).join("\n"));
  console.log("   └");

  if (!CO.nop) { console.log(""); continue; }
  if (!du) { console.log("   → thiếu dữ liệu thật → KHÔNG nộp.\n"); boQua++; continue; }
  if (conSom) { console.log(`   → chưa tới giờ báo cáo (${GIO_SOM_NHAT}h) — để dành.\n`); boQua++; continue; }
  console.log("   → xếp hàng chờ nộp.\n");
  hangDoi.push({ id, ten, t, text, nhom: sot.nhom });
}

/* ── Nhịp 4: nộp (chế độ nút thì HỎI trước; không hỏi = nộp cả hàng đợi như cũ) ── */
let daNop = 0;
if (CO.nop && hangDoi.length) {
  const chon = CO.hoi ? await hoiLuaChon(hangDoi) : "tatca";
  const canNop = (chon === "k" ? [] : hangDoi.filter((x) => chon === "tatca" || x.nhom === "A"))
    .filter((x) => !CO.nhom || x.nhom === CO.nhom);   // --nhom=A: lọc thêm (đường không-hỏi)
  if (chon === "k") log(`→ KHÔNG nộp gì. ${hangDoi.length} task để dành — tự bấm Hoàn thành trên work.hasaki.vn.`);
  else if (chon === "a") log(`→ Chỉ nộp ${canNop.length} task nhóm A; ${hangDoi.length - canNop.length} task việc tay để người tự báo cáo.`);
  console.log("");
  for (const x of canNop) {
    const kq = await nopBaoCao(work, x.t, x.text);
    console.log(kq.ok ? `   ✓ ĐÃ NỘP #${x.id} · ${x.ten} (chờ duyệt).` : `   ✗ nộp lỗi #${x.id} · ${x.ten}: ${kq.moTa}`);
    if (kq.ok) daNop++; else boQua++;
  }
} else if (CO.nop) log("Không có task nào đang chờ nộp — khỏi bấm nút.");

console.log("");
log(`Xong: nộp ${daNop} · bỏ qua ${boQua}.`);
/* Lượt bấm nút in ra màn hình rồi cửa sổ đóng là mất — chốt lại 1 dòng vào sổ để sau này tra
   được "hôm đó ai nộp, nộp mấy cái" mà không phải nhớ. */
if (CO.hoi) {
  try {
    fs.appendFileSync(path.join(DIR, "task-hangngay.log"),
      `[nút ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false })}] nộp ${daNop} · bỏ qua ${boQua}${hangDoi.length ? "" : " (không có gì chờ nộp)"}\r\n`);
  } catch { /* sổ best-effort */ }
}
/* Sổ tay khớp theo TÊN (task_id đổi mỗi ngày). Tên bị đổi/ thêm task mới ⇒ rơi vào đây và KHÔNG
   bao giờ bị nộp bừa — nhưng phải kêu to, không thì lặng lẽ bỏ sót hằng ngày. */
if (la.length) log(`⚠ ${la.length} task chưa có trong sổ tay (KHÔNG nộp) — thêm mẫu tên vào SO_TAY: ` + la.join(" | "));
if (CO.nop && daNop) ghiMocBuoc(DIR, "task-hangngay");
