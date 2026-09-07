/**
 * ============================================================================
 *  dieu-huong-tra-b1.mjs — Tự động ĐIỀU HƯỚNG bước "Điều hướng" TRẢ VỀ "B1. Xác
 *  minh lỗi vi phạm" cho workflow 591 ([Manual] Giải trình & ghi nhận vi phạm Kho Tổng)
 * ============================================================================
 *  BỐI CẢNH: khi người xác minh (B1) BÁC một biên bản 5S với lý do "không có sku để
 *  check", engine sinh bước "Điều hướng" giao về cho tamlc@hasaki.vn (Audit). Nghiệp vụ
 *  của Audit trong ca này là ĐẨY TRẢ VỀ B1 để xác minh lại. Tool này làm đúng thao tác đó.
 *
 *  QUY TẮC LỌC (chốt 05/09/2026): CHỈ điều hướng khi lý do bác ở B1 khớp cụm "không có
 *  sku" (kể cả "ko có sku", "khong co sku", "không có sku, không thể check"). Lý do khác
 *  (nhân viên off, quá thời gian lưu trữ…) KHÔNG tự điều hướng — để người quyết. Bỏ lọc
 *  bằng --ep-lydo (chỉ dùng khi chắc chắn).
 *
 *  ĐƯỜNG ĐI (bắt được 05/09 từ thao tác web thật qua extension bridge — xem bat-request-bridge.mjs):
 *    1) POST /api/hr/projects/re-create-step/{id_bước_Điều_hướng}   body JSON {"workflow_step_id":"7379"}
 *         → engine HỦY bước Điều hướng (status→4 Canceled) + TẠO LẠI bước B1 (7379, status 0).
 *    2) POST /api/hr/projects/mass-update-field-task-input  (FormData)
 *         { id: id_Điều_hướng, field:"data", "value[note_failed]": JSON([{note_failed, staff_name,
 *           staff_code, created_at}]) } → ghi Lý do điều hướng vào lịch sử ("… canceled and
 *           redirected the task … Reason: …"). Bước 2 chỉ để lịch sử đẹp, KHÔNG bắt buộc.
 *
 *  TOKEN: LUÔN dùng phiên sống của operator qua BRIDGE (layTokenSongWork) — không đăng nhập mới.
 *
 *  Chạy:
 *    node dieu-huong-tra-b1.mjs                 # QUÉT workflow 591, DIỄN TẬP (không ghi) — mặc định an toàn
 *    node dieu-huong-tra-b1.mjs --lam           # QUÉT rồi ĐIỀU HƯỚNG thật các ĐH khớp lý do
 *    node dieu-huong-tra-b1.mjs --task=13522370 --lam        # chỉ 1 bước Điều hướng (id ĐH), có kiểm lý do
 *    node dieu-huong-tra-b1.mjs --task=... --lam --ep-lydo   # bỏ lọc lý do cho đúng ĐH đó
 *    node dieu-huong-tra-b1.mjs --tu=2026-08-01 # đổi mốc quét (mặc định 60 ngày gần đây)
 * ============================================================================
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { layTokenSongWork } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const V = "https://wshr.hasaki.vn/api";
const WORKFLOW_ID = process.env.WORKFLOW_ID || "591";
const STEP_B1 = "7379";                                   // workflow_step_id của "B1. Xác minh lỗi vi phạm"
const TEN_DIEU_HUONG = /điều hướng/i;
const TEN_B1 = /xác minh/i;
const CHO_XU_LY = new Set([0, 1]);                         // ĐH chưa xử lý (0) / đang xử lý (1)
const STAFF = { id: 17312, name: "Lê Chí Tâm", code: "233135" };

const LAM = process.argv.includes("--lam");               // mặc định KHÔNG ghi (diễn tập)
const EP_LYDO = process.argv.includes("--ep-lydo");
const argTask = process.argv.find((x) => x.startsWith("--task="));
const TASK = argTask ? argTask.split("=")[1] : "";
const argTu = process.argv.find((x) => x.startsWith("--tu="));
const TU = argTu ? argTu.split("=")[1] : new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);

const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

/* Chuẩn hoá bỏ dấu để khớp lý do bền với biến thể gõ tay. */
const boDau = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
const KHOP_LYDO = (ly) => /kho?ng\s*co\s*sku|ko\s*co\s*sku/.test(boDau(ly));

/* Lấy note_failed (mảng) đã parse của 1 task; trả chuỗi lý do gộp. */
function lyDoCua(task) {
  try {
    const raw = (task.data && task.data.note_failed) || "";
    const arr = JSON.parse(raw || "[]");
    return arr.map((x) => x.note_failed).filter(Boolean).join(" | ");
  } catch { return String((task.data && task.data.note_failed) || ""); }
}

async function getJ(token, url, opt = {}) {
  const r = await fetch(url, { headers: { authorization: token, ...(opt.headers || {}) }, ...opt, signal: AbortSignal.timeout(30000) });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch { /* HTML/err */ }
  return { http: r.status, j, raw: t };
}

/* Đọc cây 1 task cha (task-input trả subtasks). */
async function docCha(token, chaId) {
  const { j } = await getJ(token, `${V}/hr/projects/task-input/${chaId}`);
  return j && j.data;
}

/* Thực hiện điều hướng 1 bước ĐH về B1. Trả {ok, b1Moi, msg}. */
async function dieuHuong(token, dh, lyDo) {
  // 1) re-create-step (JSON)
  const b = await getJ(token, `${V}/hr/projects/re-create-step/${dh.id}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" },
    body: JSON.stringify({ workflow_step_id: STEP_B1 }),
  });
  const ok1 = b.http === 200 && b.j && (b.j.status === 1 || (b.j.data && b.j.data.result));
  if (!ok1) return { ok: false, msg: "re-create-step lỗi HTTP " + b.http + ": " + JSON.stringify(b.j || b.raw).slice(0, 150) };
  // 2) ghi Lý do điều hướng vào ĐH (FormData) — best-effort, không chặn nếu lỗi
  let ghiNote = "bỏ qua";
  try {
    const nf = JSON.stringify([{ note_failed: lyDo || "không có sku để check", staff_name: STAFF.name, staff_code: STAFF.code, created_at: new Date().toISOString().slice(0, 19).replace("T", " ") }]);
    const fd = new FormData();
    fd.set("id", String(dh.id)); fd.set("field", "data"); fd.set("value[note_failed]", nf);
    const r = await fetch(`${V}/hr/projects/mass-update-field-task-input`, {
      method: "POST", body: fd,
      headers: { authorization: token, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" }, signal: AbortSignal.timeout(20000),
    });
    ghiNote = r.status === 200 ? "OK" : "HTTP " + r.status;
  } catch (e) { ghiNote = "lỗi " + e.message; }
  return { ok: true, msg: "đã điều hướng (ghi lý do: " + ghiNote + ")" };
}

/* Gom danh sách bước ĐH cần xét: từ --task, hoặc quét workflow. Trả [{dh, cha, lyDo}]. */
async function gomViec(token) {
  const viec = [];
  if (TASK) {
    // --task = id bước Điều hướng; lấy cha rồi định vị
    const { j } = await getJ(token, `${V}/hr/projects/task-input/${TASK}`);
    const dh = j && j.data;
    if (!dh) throw new Error("Không đọc được task " + TASK);
    if (!TEN_DIEU_HUONG.test(dh.name || "")) throw new Error("Task " + TASK + " không phải bước 'Điều hướng' (tên: " + dh.name + ")");
    const cha = await docCha(token, dh.parent_id);
    viec.push({ dh, cha });
  } else {
    const url = `${V}/hr/workflows/detail-workflow-task/${WORKFLOW_ID}?from_date=${TU}&to_date=${new Date().toISOString().slice(0, 10)}&search_type=boa`;
    const { j } = await getJ(token, url);
    if (!j) throw new Error("Không kéo được detail-workflow-task");
    // gom mọi task có subtasks (task cha)
    const chas = new Map();
    (function walk(o) {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o && typeof o === "object") {
        if (Array.isArray(o.subtasks) && o.subtasks.length && /^HSK-/.test(o.code || "")) chas.set(o.id, o);
        for (const k in o) walk(o[k]);
      }
    })(j);
    for (const cha of chas.values()) {
      for (const s of cha.subtasks) {
        if (TEN_DIEU_HUONG.test(s.name || "") && CHO_XU_LY.has(s.status) && (s.staff_ids || []).includes(STAFF.id)) {
          viec.push({ dh: s, cha });
        }
      }
    }
  }
  return viec;
}

/* Đã điều hướng rồi? — trong cây cha có B1 (7379) tạo SAU bước ĐH và chưa đóng (status < 6/≠4). */
function daDieuHuong(cha, dh) {
  const subs = cha.subtasks || [];
  return subs.some((s) => TEN_B1.test(s.name || "") && String(s.workflow_step_id) === STEP_B1 &&
    new Date(s.created_at) > new Date(dh.created_at) && s.status !== 6 && s.status !== 4);
}

(async () => {
  log((LAM ? "" : "[DIỄN TẬP] ") + "Điều hướng trả về B1 — workflow " + WORKFLOW_ID + (TASK ? " · task " + TASK : " · quét từ " + TU) + (EP_LYDO ? " · BỎ lọc lý do" : ""));
  const token = await layTokenSongWork(DIR, log);
  if (!token) { log("✗ Không có token bridge/kho sống. Mở work.hasaki.vn (extension bridge) rồi chạy lại."); process.exit(2); }

  let viec;
  try { viec = await gomViec(token); }
  catch (e) { log("✗ " + e.message); process.exit(2); }
  log("→ Tìm thấy " + viec.length + " bước 'Điều hướng' chờ xử lý (giao " + STAFF.name + ").");

  let lam = 0, boLyDo = 0, boDaXL = 0, loi = 0;
  for (const { dh, cha } of viec) {
    const b1s = (cha.subtasks || []).filter((s) => TEN_B1.test(s.name || "") && s.status === 6)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    const lyDo = b1s.length ? lyDoCua(b1s[0]) : "";
    const nhan = `#${dh.id} (cha ${cha.code} ${String(cha.name).slice(0, 40)}) · lý do B1: «${lyDo || "—"}»`;

    if (daDieuHuong(cha, dh)) { boDaXL++; log("  ○ " + nhan + " — ĐÃ có B1 mới, bỏ qua."); continue; }
    if (!EP_LYDO && !KHOP_LYDO(lyDo)) { boLyDo++; log("  ⤳ " + nhan + " — lý do KHÔNG khớp 'không có sku', BỎ QUA (người quyết)."); continue; }

    if (!LAM) { lam++; log("  ◇ [thử] SẼ điều hướng " + nhan); continue; }
    try {
      const r = await dieuHuong(token, dh, lyDo);
      if (r.ok) { lam++; log("  ✓ " + nhan + " — " + r.msg); }
      else { loi++; log("  ✗ " + nhan + " — " + r.msg); }
      await nghi(400);
    } catch (e) { loi++; log("  ✗ " + nhan + " — " + e.message); }
  }
  log("HOÀN TẤT — " + (LAM ? "Đã điều hướng: " : "Sẽ điều hướng: ") + lam +
    " | Bỏ (lý do khác): " + boLyDo + " | Bỏ (đã xử lý): " + boDaXL + " | Lỗi: " + loi);
  if (!LAM && lam) log("→ Chạy lại kèm --lam để thực hiện thật.");
  process.exit(loi && !lam ? 1 : 0);
})();
