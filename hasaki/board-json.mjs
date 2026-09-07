/**
 * board-json.mjs — đọc task workflow 5S bằng API JSON, thay đường export xlsx bị tường lửa chặn.
 *
 *  SỰ CỐ 04/09/2026: job export vẫn "Export thành công!" nhưng file .xlsx dưới
 *  production/hr/excel_io/… trả 403 "Tường lửa của Hasaki" (Cloudflare) trên CẢ wshr lẫn hr-media,
 *  kể cả trình duyệt thật → 5S-TASKS đứng ở dữ liệu 29/08. Frontend work.hasaki.vn tự lấy dữ liệu board bằng:
 *      GET /api/hr/workflows/detail-workflow-task/<wfid>?from_date&to_date&search_type=board
 *  trả JSON {data:{rows:[task…], total}} — mỗi task kèm data.configs (trường cấp task) và subtasks[]
 *  (mỗi bước = 1 task con: status, date_end, staff[].info, data.configs của bước).
 *
 *  Module này DỰNG LẠI đúng bố cục bảng export cũ (87 cột "Bước ▸ Trường", 2 dòng tiêu đề) để phần
 *  còn lại của auto-export-sync.js (kho đóng băng, convMedia, tên NV, chunk tháng, dashboard) giữ nguyên.
 *  Ánh xạ khoá → nhãn cột được đối chứng bằng qc-board-json.mjs trên các task chung với file export 31/08.
 *
 *  Tải upstream: 1 GET/cửa sổ (đường cũ: POST export + ~5–100 GET poll + 1 GET tải file).
 */

/* 87 cột của bảng export cũ — nguồn: header kho .exports/tasks-cache.json (đối chiếu file xlsx 31/08/2026). */
export const HEADER_CHUAN = [
  "Task Code",
  "Link Task",
  "Task Name",
  "Status",
  "Created By",
  "Created At",
  "Hình ảnh vi phạm",
  "Video vi phạm",
  "Ngày vi phạm:",
  "Lỗi vi phạm",
  "Vị trí ghi nhận",
  "Link planogram (nếu có)",
  "B1. Xác minh lỗi vi phạm ▸ Deadline",
  "B1. Xác minh lỗi vi phạm ▸ Status",
  "B1. Xác minh lỗi vi phạm ▸ Kết quả công việc",
  "B1. Xác minh lỗi vi phạm ▸ Người thực hiện",
  "B1. Xác minh lỗi vi phạm ▸ Quản lý trực tiếp của nhân viên vi phạm:",
  "B1. Xác minh lỗi vi phạm ▸ Hình ảnh bằng chứng :",
  "B1. Xác minh lỗi vi phạm ▸ Nhân viên vi phạm",
  "B1. Xác minh lỗi vi phạm ▸ Video (Nếu có)",
  "B1.1 Nhân viên xác nhận lỗi vi phạm ▸ Deadline",
  "B1.1 Nhân viên xác nhận lỗi vi phạm ▸ Status",
  "B1.1 Nhân viên xác nhận lỗi vi phạm ▸ Kết quả công việc",
  "B1.1 Nhân viên xác nhận lỗi vi phạm ▸ Người thực hiện",
  "B1.1 Nhân viên xác nhận lỗi vi phạm ▸ Giải trình:",
  "B1.1 Nhân viên xác nhận lỗi vi phạm ▸ Bằng chứng chứng khắc phục:",
  "B1.1 Nhân viên xác nhận lỗi vi phạm ▸ Xác nhận lỗi:",
  "B2. QLTT xác nhận và giải trình ▸ Deadline",
  "B2. QLTT xác nhận và giải trình ▸ Status",
  "B2. QLTT xác nhận và giải trình ▸ Kết quả công việc",
  "B2. QLTT xác nhận và giải trình ▸ Người thực hiện",
  "B2. QLTT xác nhận và giải trình ▸ Xác nhận lỗi:",
  "B2. QLTT xác nhận và giải trình ▸ Bằng chứng chứng khắc phục:",
  "B2. QLTT xác nhận và giải trình ▸ Giải trình:",
  "B2.1 Hình ảnh khắc phục vi phạm ▸ Deadline",
  "B2.1 Hình ảnh khắc phục vi phạm ▸ Status",
  "B2.1 Hình ảnh khắc phục vi phạm ▸ Kết quả công việc",
  "B2.1 Hình ảnh khắc phục vi phạm ▸ Người thực hiện",
  "B2.1 Hình ảnh khắc phục vi phạm ▸ Hình ảnh khắc phục:",
  "B3.1 Ghi nhận vi phạm vệ sinh kho tổng ▸ Deadline",
  "B3.1 Ghi nhận vi phạm vệ sinh kho tổng ▸ Status",
  "B3.1 Ghi nhận vi phạm vệ sinh kho tổng ▸ Kết quả công việc",
  "B3.1 Ghi nhận vi phạm vệ sinh kho tổng ▸ Người thực hiện",
  "B3.1 Ghi nhận vi phạm vệ sinh kho tổng ▸ Danh mục vi phạm:",
  "B3.1 Ghi nhận vi phạm vệ sinh kho tổng ▸ Reason",
  "B3.1 Ghi nhận vi phạm vệ sinh kho tổng ▸ Nhân viên vi phạm:",
  "B3.1 Ghi nhận vi phạm vệ sinh kho tổng ▸ Skill liên quan:",
  "B3.1 Ghi nhận vi phạm vệ sinh kho tổng ▸ Location",
  "B3.2 Ghi nhận vi phạm quy định kho tổng ▸ Deadline",
  "B3.2 Ghi nhận vi phạm quy định kho tổng ▸ Status",
  "B3.2 Ghi nhận vi phạm quy định kho tổng ▸ Kết quả công việc",
  "B3.2 Ghi nhận vi phạm quy định kho tổng ▸ Người thực hiện",
  "B3.2 Ghi nhận vi phạm quy định kho tổng ▸ Danh mục vi phạm:",
  "B3.2 Ghi nhận vi phạm quy định kho tổng ▸ Reason",
  "B3.2 Ghi nhận vi phạm quy định kho tổng ▸ Nhân viên vi phạm",
  "B3.2 Ghi nhận vi phạm quy định kho tổng ▸ Skill liên quan",
  "B3.2 Ghi nhận vi phạm quy định kho tổng ▸ Location",
  "B3.3 Ghi nhận vi phạm lỗi đóng gói ▸ Deadline",
  "B3.3 Ghi nhận vi phạm lỗi đóng gói ▸ Status",
  "B3.3 Ghi nhận vi phạm lỗi đóng gói ▸ Kết quả công việc",
  "B3.3 Ghi nhận vi phạm lỗi đóng gói ▸ Người thực hiện",
  "B3.3 Ghi nhận vi phạm lỗi đóng gói ▸ Location",
  "B3.3 Ghi nhận vi phạm lỗi đóng gói ▸ Skill liên quan:",
  "B3.3 Ghi nhận vi phạm lỗi đóng gói ▸ Nhân viên vi phạm:",
  "B3.3 Ghi nhận vi phạm lỗi đóng gói ▸ Reason",
  "B3.3 Ghi nhận vi phạm lỗi đóng gói ▸ Danh mục vi phạm:",
  "B4. Audit kiểm tra và xác nhận ▸ Deadline",
  "B4. Audit kiểm tra và xác nhận ▸ Status",
  "B4. Audit kiểm tra và xác nhận ▸ Kết quả công việc",
  "B4. Audit kiểm tra và xác nhận ▸ Người thực hiện",
  "B4. Audit kiểm tra và xác nhận ▸ Xác nhận lỗi:",
  "B4. Audit kiểm tra và xác nhận ▸ Ghi chú:",
  "B4.1 Audit kiểm tra khắc phục ▸ Deadline",
  "B4.1 Audit kiểm tra khắc phục ▸ Status",
  "B4.1 Audit kiểm tra khắc phục ▸ Kết quả công việc",
  "B4.1 Audit kiểm tra khắc phục ▸ Người thực hiện",
  "B4.1 Audit kiểm tra khắc phục ▸ Xác nhận khắc phục",
  "B5.Vận hành xem xét và xác nhận ▸ Deadline",
  "B5.Vận hành xem xét và xác nhận ▸ Status",
  "B5.Vận hành xem xét và xác nhận ▸ Kết quả công việc",
  "B5.Vận hành xem xét và xác nhận ▸ Người thực hiện",
  "B5.Vận hành xem xét và xác nhận ▸ Xác nhận lỗi:",
  "B5.Vận hành xem xét và xác nhận ▸ Ghi chú:",
  "Điều hướng ▸ Deadline",
  "Điều hướng ▸ Status",
  "Điều hướng ▸ Kết quả công việc",
  "Điều hướng ▸ Người thực hiện"
];

/* Mã trạng thái của task/bước trong JSON → chữ như export cũ (đối chứng 132 task: 0→None, 2→Finished,
   4→Canceled, 6→Failed; 1 chưa gặp — đặt Processing theo từ vựng WF; mã lạ giữ số để không bị coi là đóng). */
const STT_LABEL = { 0: "None", 1: "Processing", 2: "Finished", 4: "Canceled", 6: "Failed" };
export const nhanTrangThai = (code) => (code == null || code === "") ? "" : (STT_LABEL[code] ?? ("Status " + code));

/* Trường "Location" của bước B3.x: JSON lưu id vị trí, export cũ in tên. Chỉ gặp 1 id trong toàn kho. */
const LOC_TEN = { "398": "170 Quốc lộ 1A - Hồ Chí Minh" };

/* Khoá trong subtask.data.configs theo từng bước → nhãn cột export. Mảng = thử lần lượt (khoá chưa chắc). */
const KEY_BUOC = {
  "B1. Xác minh lỗi vi phạm": { "Quản lý trực tiếp của nhân viên vi phạm:": "QLBP02", "Hình ảnh bằng chứng :": "PIC02", "Nhân viên vi phạm": "staff", "Video (Nếu có)": "video02" },
  "B1.1 Nhân viên xác nhận lỗi vi phạm": { "Giải trình:": "giaitrinh11", "Bằng chứng chứng khắc phục:": "bangchung11", "Xác nhận lỗi:": "xacnhan11" },
  "B2. QLTT xác nhận và giải trình": { "Xác nhận lỗi:": "CNF03", "Bằng chứng chứng khắc phục:": "BC03", "Giải trình:": "DT03" },
  "B2.1 Hình ảnh khắc phục vi phạm": { "Hình ảnh khắc phục:": "IMA04" },
  "B3.1 Ghi nhận vi phạm vệ sinh kho tổng": { "Danh mục vi phạm:": "VP04", "Reason": "rea04", "Nhân viên vi phạm:": "NVVP04", "Skill liên quan:": "SK04", "Location": "loc04" },
  "B3.2 Ghi nhận vi phạm quy định kho tổng": { "Danh mục vi phạm:": "VP32", "Reason": "rea32", "Nhân viên vi phạm": "staff32", "Skill liên quan": "skill32", "Location": "loc32" },
  "B3.3 Ghi nhận vi phạm lỗi đóng gói": { "Location": "loc33", "Skill liên quan:": "skill33", "Nhân viên vi phạm:": "staff33", "Reason": "rea33", "Danh mục vi phạm:": "cat33" },
  "B4. Audit kiểm tra và xác nhận": { "Xác nhận lỗi:": "CNF05", "Ghi chú:": "GT05" },
  "B4.1 Audit kiểm tra khắc phục": { "Xác nhận khắc phục": "xacnhan41" },
  "B5.Vận hành xem xét và xác nhận": { "Xác nhận lỗi:": "XNL06", "Ghi chú:": ["GT06", "GC06", "note06"] },
  "Điều hướng": {},
};

const LINK = (id) => "https://work.hasaki.vn/tasks?task_id=" + id;
/* Mảng (ảnh/clip nhiều file) → nối ", " y như export cũ; convMedia phía sau tách lại theo /[\s,]+/. */
const noi = (v) => Array.isArray(v) ? v.filter((x) => x != null && x !== "").map(String).join(", ") : (v == null ? "" : String(v));

/* "Created By" của export cũ = "Họ tên - mã NV"; JSON chỉ có created_by = user_id (KHÔNG phải staff_id).
   Tra: danh bạ (user_id) → info của staff gặp trong chính lô JSON → để trống (không in số id lạ lên dashboard). */
function bangUidTuRows(rows) {
  const m = {};
  const nap = (st) => { for (const x of st || []) { const i = x && x.info; if (i && i.id != null && i.staff_name) m[String(i.id)] = i.staff_name + (i.code ? " - " + i.code : ""); } };
  for (const t of rows || []) { nap(t.staff); for (const s of t.subtasks || []) nap(s.staff); }
  return m;
}

/** rows (data.rows của API) → aoa: 2 dòng tiêu đề + 1 dòng/task, đúng cột của headerHienCo (kho) ∪ HEADER_CHUAN.
 *  nv = { dir: mã/staff_id → tên, uid: user_id → "tên - mã" } (từ layDanhBaNV). */
export function aoaTuRows(rows, headerHienCo, nv = {}) {
  const header = [...(Array.isArray(headerHienCo) && headerHienCo.length ? headerHienCo : HEADER_CHUAN)];
  for (const h of HEADER_CHUAN) if (!header.includes(h)) header.push(h);   // kho cũ thiếu cột chuẩn nào → nối CUỐI (giữ vị trí cột cũ)
  const idx = new Map(header.map((h, i) => [h, i]));
  const uidLo = bangUidTuRows(rows);
  const dir = nv.dir || {}, uid = nv.uid || {};
  const out = [Array(header.length).fill(""), header.slice()];
  for (const t of rows || []) {
    if (!t || !t.code) continue;
    const r = Array(header.length).fill("");
    const set = (h, v) => { const i = idx.get(h); if (i != null) r[i] = v == null ? "" : String(v); };
    const cfg = (t.data && t.data.configs) || {};
    set("Task Code", t.code); set("Link Task", LINK(t.id)); set("Task Name", t.name); set("Status", nhanTrangThai(t.status));
    set("Created By", uid[String(t.created_by)] || uidLo[String(t.created_by)] || "");
    set("Created At", t.created_at);
    set("Hình ảnh vi phạm", noi(cfg.IMA00)); set("Video vi phạm", noi(cfg.VID01)); set("Ngày vi phạm:", cfg.DATE00);
    set("Lỗi vi phạm", cfg.TYPE00); set("Vị trí ghi nhận", cfg.BIN00); set("Link planogram (nếu có)", cfg.link00);
    // Bước lặp lại (mở lại) → task con MỚI nhất thắng
    const subs = [...(t.subtasks || [])].sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
    for (const s of subs) {
      const buoc = String(s.name || (s.workflow_step && s.workflow_step.name) || "").trim(); if (!buoc) continue;
      set(buoc + " ▸ Deadline", s.date_end); set(buoc + " ▸ Status", nhanTrangThai(s.status)); set(buoc + " ▸ Kết quả công việc", LINK(s.id));
      set(buoc + " ▸ Người thực hiện", (s.staff || []).map((x) => (x.info && x.info.staff_name) || dir[String(x.staff_id)] || "").filter(Boolean).join(", "));
      const map = KEY_BUOC[buoc] || {}; const sc = (s.data && s.data.configs) || {};
      for (const nhan in map) {
        const k = [].concat(map[nhan]).find((k) => sc[k] != null && sc[k] !== "" && !(Array.isArray(sc[k]) && !sc[k].length));
        if (k == null) continue;
        let v = noi(sc[k]); if (nhan === "Location") v = LOC_TEN[v] || v;
        set(buoc + " ▸ " + nhan, v);
      }
    }
    out.push(r);
  }
  return out;
}

/** Gọi API danh sách board cho 1 cửa sổ ngày rồi dựng aoa. fetchFn = fetchRetry của caller (backoff 5xx/429). */
export async function docCuaSoJSON(token, wfid, from, to, headerHienCo, nv, fetchFn = fetch) {
  const url = "https://wshr.hasaki.vn/api/hr/workflows/detail-workflow-task/" + wfid + "?from_date=" + from + "&to_date=" + to + "&search_type=board";
  const r = await fetchFn(url, { headers: { authorization: token }, signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error("API danh sách task trả " + r.status + " (" + from + ".." + to + ")");
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { throw new Error("API danh sách task không trả JSON: " + txt.slice(0, 80).replace(/\s+/g, " ")); }
  const rows = j && j.data && j.data.rows;
  if (!Array.isArray(rows)) throw new Error("API danh sách task thiếu data.rows (" + (j && j.message) + ")");
  return { aoa: aoaTuRows(rows, headerHienCo, nv), soTask: rows.length, total: j.data.total };
}
