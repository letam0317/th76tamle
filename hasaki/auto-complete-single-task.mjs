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
import { docSoQLTT, chonQLTTCanBang, ghiLuot } from "./qltt.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const V = "https://wshr.hasaki.vn/api";
const CDN = "https://hr-media.hasaki.vn/production/hr/";   // thiếu "production/hr/" là 404 câm
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

/* Quản lý trực tiếp: sổ tra (phiếu người đã điền) trước, đoán theo danh bạ sau — xem qltt.js. */

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
  const q = chonQLTTCanBang(nv, db, docSoQLTT(DIR), DIR, false);   // peek — cộng lượt sau khi đóng B1
  const qltt = q.ten;

  const d = await docTask(token, TASK);
  if (!d || !Array.isArray(d.subtasks)) { log("✗ Không đọc được task " + TASK); process.exit(4); }
  const b1 = d.subtasks.find((s) => String(s.workflow_step_id) === "7379" || /B1\./i.test(s.name || ""));
  if (!b1) { log("✗ Task " + d.code + " không có bước B1."); process.exit(5); }

  log("Task " + d.code + " (" + TASK + ") · B1 id " + b1.id + " · status hiện tại " + b1.status);
  log("  NV vi phạm : " + ds.map((x) => x.staff_name + " (" + x.code + ")").join(", "));
  log("  QLTT       : " + qltt + "  ← " + q.nguon + " (" + q.ghiChu + ")");
  if (b1.status === 2) { log("ℹ B1 đã đóng sẵn — không làm gì."); return; }
  if (!LAM) { log("— DIỄN TẬP, chưa ghi gì. Thêm --lam để làm thật."); return; }

  const r1 = await ghi(token, b1.id, "data", { "value[configs][staff]": codes, "value[configs][QLBP02]": qltt });
  if (r1.http !== 200) { log("✗ Ghi NV vi phạm/QLTT trượt (HTTP " + r1.http + ") — dừng, KHÔNG đóng B1."); process.exit(6); }

  /* PIC02 "Hình ảnh bằng chứng" là Ô BẮT BUỘC: thiếu thì đóng bước trả 422 "Vui lòng cập nhật dữ
     liệu cấu hình!" (đo thật 22/09). Lấy lại chính ảnh vi phạm ở task cha (IMA00) — đúng thứ người
     xác minh vẫn đính kèm. Nạp ảnh là CỘNG DỒN nên xoá trước rồi mới nạp. */
  const ima = (d.data && d.data.configs && d.data.configs.IMA00) || [];
  if (!ima.length) { log("✗ Task cha không có ảnh vi phạm (IMA00) để làm bằng chứng B1 — dừng."); process.exit(7); }
  const rAnh = await fetch(CDN + String(ima[0]).replace(/^\/+/, ""), { signal: AbortSignal.timeout(60000) });
  const buf = Buffer.from(await rAnh.arrayBuffer());
  if (rAnh.status !== 200 || buf.length < 2000) { log("✗ Tải ảnh bằng chứng trượt (HTTP " + rAnh.status + ", " + buf.length + " byte) — dừng."); process.exit(8); }
  await ghi(token, b1.id, "data", { "value[configs][PIC02]": "" });
  const fdA = new FormData();
  fdA.set("id", String(b1.id)); fdA.set("field", "data");
  fdA.append("value[configs][PIC02][]", new Blob([buf], { type: "image/jpeg" }), "bang-chung-b1.jpg");
  const rA = await fetch(V + "/hr/projects/mass-update-field-task-input", { method: "POST", body: fdA,
    headers: { authorization: token, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" }, signal: AbortSignal.timeout(60000) });
  log("  Ảnh bằng chứng: " + (rA.status === 200 ? "đã nạp (" + Math.round(buf.length / 1024) + " KB)" : "TRƯỢT HTTP " + rA.status));
  /* KHÔNG gán lại người thực hiện B1 — B1 là việc của NGƯỜI XÁC MINH (3 phiếu người thật đều đứng
     tên Lâm Thanh Tú). Gán sang NV vi phạm thì engine mở B1.1 và giao cho QUẢN LÝ của họ. */
  const r2 = await ghi(token, b1.id, "status", { value: "2" });

  const sau = await docTask(token, TASK);
  const b1Sau = sau.subtasks.find((s) => String(s.id) === String(b1.id));
  const b11 = sau.subtasks.find((s) => String(s.workflow_step_id) === "7826" || /B1\.1/i.test(s.name || ""));
  if (b1Sau && b1Sau.status === 2) {
    if (q.pool && q.pool.length > 1) ghiLuot(DIR, qltt);   // chia đều 0,2%: chỉ cộng khi đóng thật
    /* B1.1 PHẢI đứng tên NV vi phạm — engine có thể giao sang quản lý, nên giao lại cho chắc. */
    if (b11) {
      const dangCam = (b11.staff || []).map((x) => String(x.info && x.info.code || ""));
      if (ds.some((x) => !dangCam.includes(String(x.code)))) {
        await ghi(token, b11.id, "assign_staff", { value: ds.map((x) => String(x.staff_id)).join(",") });
        log("  (đã giao lại B1.1 cho đúng NV vi phạm)");
      }
      const lai = await docTask(token, TASK);
      const b = lai.subtasks.find((s) => String(s.id) === String(b11.id));
      log("🚀 ĐÓNG B1 XONG → B1.1 đang ở tay: " + ((b && b.staff || []).map((x) => x.info && x.info.staff_name).filter(Boolean).join(", ") || "(chưa ai)"));
    } else log("🚀 ĐÓNG B1 XONG → chờ engine mở B1.1");
  }
  else log("✗ B1 VẪN CHƯA ĐÓNG (status " + (b1Sau && b1Sau.status) + ", HTTP " + r2.http + "): " + r2.t.slice(0, 200));
})();
