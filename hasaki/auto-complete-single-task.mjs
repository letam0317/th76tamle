/**
 * auto-complete-single-task.mjs — ĐÓNG TAY bước B1 của MỘT task 5S rồi để engine mở B1.1.
 * ============================================================================================
 *  Dùng khi phiếu đã tạo từ trước (lúc đó chưa có ô "Nhân viên vi phạm") mà nay đã biết ai vi phạm.
 *  Luồng thường ngày KHÔNG cần file này — push-5s-to-workflow.js tự làm khi đẩy phiếu mới.
 *
 *  KHUÔN API là bản đã ĐO THẬT 22/09/2026 — giữ GIỐNG push-5s-to-workflow.js, đừng để lệch:
 *    POST mass-update-field-task-input (FormData) {id, field:"data", "value[configs][<KEY>]": …}
 *      → ghi data.configs.<KEY> + tự sinh data.logs.<KEY> y như thao tác tay trên web.
 *    rồi {id, field:"status", value:"2"} để đóng bước.
 *  Bẫy: khuôn JSON extra_data (bản 21/09) trả 200 mà KHÔNG ghi gì — đã làm task HSK-16E66T6P
 *  đứng im ở B1 suốt một ngày mà không ai biết. Vì vậy script LUÔN đọc lại để chốt.
 *
 *  Chạy:
 *    node auto-complete-single-task.mjs --task=13829903 --nv=trinhhtm3@hasaki.vn        # diễn tập
 *    node auto-complete-single-task.mjs --task=13829903 --nv=trinhhtm3@hasaki.vn --lam  # làm thật
 *    (--nv nhận email / mã NV / tên; nhiều người ngăn bằng dấu phẩy)
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWork } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const V = "https://wshr.hasaki.vn/api";
const CACHE_DB = path.join(DIR, ".cache-nv170.json");
const STAFF_API = V + "/news/staff/search-for-dropdown?limit=10000&sort=staff_id";
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

const doc = (ten) => { const a = process.argv.find((x) => x.startsWith("--" + ten + "=")); return a ? a.split("=").slice(1).join("=") : ""; };
const TASK = doc("task");
const QUERY_NV = doc("nv");
const LAM = process.argv.includes("--lam");          // mặc định DIỄN TẬP — không ghi gì

async function layDanhBa(token) {
  try {
    const c = JSON.parse(fs.readFileSync(CACHE_DB, "utf8"));
    if (Date.now() - c.at < 12 * 3600 * 1000 && Array.isArray(c.data) && c.data.length) return c.data;
  } catch { /* chưa có cache */ }
  try {
    const res = await fetch(STAFF_API, { headers: { authorization: token } });
    const j = await res.json();
    const data = j.data || j.rows || [];
    if (data.length) try { fs.writeFileSync(CACHE_DB, JSON.stringify({ at: Date.now(), data })); } catch { /* best-effort */ }
    return data;
  } catch {
    try { return JSON.parse(fs.readFileSync(CACHE_DB, "utf8")).data || []; } catch { return []; }
  }
}

function timNhanVien(q, db) {
  if (!q || !db.length) return null;
  const s = String(q).trim().toLowerCase(), user = s.includes("@") ? s.split("@")[0] : s;
  return db.find((x) => {
    const em = String(x.staff_email || "").toLowerCase();
    return em === s || (em.includes("@") ? em.split("@")[0] : em) === user ||
      String(x.code || "").toLowerCase() === s || String(x.staff_id || "") === s ||
      String(x.staff_name || "").toLowerCase() === s;
  }) || null;
}

function timQuanLy(nv, db) {
  let ten = nv.staff_dept || "Quản lý kho";
  if (!nv.working_loc_id || !db.length) return ten;
  const cung = db.filter((s) => s.working_loc_id === nv.working_loc_id);
  let ql = cung.find((s) => s.position_id === 7 || /sub leader/i.test(s.staff_title));
  if (!ql) ql = cung.find((s) => s.position_id === 5 || /leader/i.test(s.staff_title));
  if (!ql) ql = cung.find((s) => s.position_id === 8 || s.position_id === 17 || /supervisor|manager/i.test(s.staff_title));
  return (ql && ql.staff_name) ? ql.staff_name : ten;
}

async function ghi(token, id, field, cap) {
  const fd = new FormData();
  fd.set("id", String(id)); fd.set("field", field);
  for (const [k, v] of Object.entries(cap)) fd.set(k, v);
  const r = await fetch(V + "/hr/projects/mass-update-field-task-input", { method: "POST", body: fd,
    headers: { authorization: token, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" }, signal: AbortSignal.timeout(30000) });
  return { http: r.status, t: await r.text() };
}
const docTask = async (token, id) => (await (await fetch(V + "/hr/projects/task-input/" + id,
  { headers: { authorization: token, accept: "application/json" } })).json()).data;

(async () => {
  if (!TASK || !QUERY_NV) { console.log("Thiếu tham số. Ví dụ:\n  node auto-complete-single-task.mjs --task=13829903 --nv=trinhhtm3@hasaki.vn --lam"); process.exit(1); }
  const token = await layTokenSongWork(DIR, log);
  if (!token) { log("✗ Không lấy được token work.hasaki.vn."); process.exit(2); }

  const db = await layDanhBa(token);
  const ds = QUERY_NV.split(",").map((s) => s.trim()).filter(Boolean).map((q) => timNhanVien(q, db)).filter(Boolean);
  if (!ds.length) { log("✗ Không tìm thấy NV nào khớp «" + QUERY_NV + "» trong danh bạ " + db.length + " người."); process.exit(3); }
  const nv = ds[0], codes = ds.map((x) => String(x.code || x.staff_id)).join(",");
  const qltt = timQuanLy(nv, db);

  const d = await docTask(token, TASK);
  if (!d || !Array.isArray(d.subtasks)) { log("✗ Không đọc được task " + TASK); process.exit(4); }
  const b1 = d.subtasks.find((s) => String(s.workflow_step_id) === "7379" || /B1\./i.test(s.name || ""));
  if (!b1) { log("✗ Task " + d.code + " không có bước B1."); process.exit(5); }

  log("Task " + d.code + " (" + TASK + ") · B1 id " + b1.id + " · status hiện tại " + b1.status);
  log("  NV vi phạm : " + ds.map((x) => x.staff_name + " (" + x.code + ")").join(", "));
  log("  QLTT (đoán): " + qltt);
  if (b1.status === 2) { log("ℹ B1 đã đóng sẵn — không làm gì."); return; }
  if (!LAM) { log("— DIỄN TẬP, chưa ghi gì. Thêm --lam để làm thật."); return; }

  const r1 = await ghi(token, b1.id, "data", { "value[configs][staff]": codes, "value[configs][QLBP02]": qltt });
  if (r1.http !== 200) { log("✗ Ghi NV vi phạm/QLTT trượt (HTTP " + r1.http + ") — dừng, KHÔNG đóng B1."); process.exit(6); }
  await ghi(token, b1.id, "assign_staff", { value: String(nv.staff_id) }).catch(() => {});
  const r2 = await ghi(token, b1.id, "status", { value: "2" });

  const sau = await docTask(token, TASK);
  const b1Sau = sau.subtasks.find((s) => String(s.id) === String(b1.id));
  const b11 = sau.subtasks.find((s) => String(s.workflow_step_id) === "7826" || /B1\.1/i.test(s.name || ""));
  if (b1Sau && b1Sau.status === 2) log("🚀 ĐÓNG B1 XONG → " + (b11 ? "B1.1 đã mở (" + b11.name + ")" : "chờ engine mở B1.1"));
  else log("✗ B1 VẪN CHƯA ĐÓNG (status " + (b1Sau && b1Sau.status) + ", HTTP " + r2.http + "): " + r2.t.slice(0, 200));
})();
