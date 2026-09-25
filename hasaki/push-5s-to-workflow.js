/**
 * ============================================================================
 *  BỘ ĐẨY: Google Sheet (WMS-5S-AUDIT) ──► Task trong workflow 591 (work.hasaki.vn)
 * ============================================================================
 *  Mỗi lần chạy:
 *   1) Lấy token mới từ phiên Edge đã đăng nhập (không cần OTP nếu phiên còn hạn).
 *   2) Đọc các báo cáo 5S CHƯA đẩy từ Apps Script (?action=pending).
 *   3) Với mỗi báo cáo CÓ vi phạm: khớp hạng mục với "Lỗi vi phạm" (TYPE00),
 *      tạo task kèm ảnh, rồi ghi mã task ngược lại Sheet (?action=mark).
 *
 *  Chạy:  node push-5s-to-workflow.js
 *  Nếu báo "phiên hết hạn": chạy  node login-hasaki.js  để đăng nhập lại 1 lần.
 * ============================================================================
 */
import puppeteer from "puppeteer";
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { layTokenTuPhucHoi } from "./auto-login.js";
import { docSoQLTT, chonQLTTCanBang, ghiLuot } from "./qltt.js";
import { EDGE_PATH, duongDanProfile } from "./token-store.js";
import { gasPost } from "./session-rules.js";
import { traCuuSanPham, dongMoTaSP } from "./tra-sku-hasaki.mjs";
import { napNguonTruyVet, truyVet, laHangMucVeSinhHangNgay } from "./truy-vet-vesinh.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));

/* ----------------------------- CẤU HÌNH ----------------------------- */
// Bí mật & cấu hình lấy từ .env (KHÔNG hardcode key — .env đã được gitignore).
const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;     // phải trùng SECRET trong google-script.gs
const WORKFLOW_ID = process.env.WORKFLOW_ID || "591";
const STAFF_ID = process.env.STAFF_ID || "17312";    // người được giao mặc định (Lê Chí Tâm)
if (!APPSCRIPT_KEY) {
  console.error("✗ Thiếu APPSCRIPT_KEY trong .env. Hãy copy .env.example -> .env rồi điền APPSCRIPT_KEY (trùng SECRET trong google-script.gs).");
  process.exit(3);
}
// Profile Edge ổn định (gitignore qua .wms-session/) — KHÔNG để trong Temp để lịch chạy ngầm khỏi mất phiên.
const PROFILE_DIR = duongDanProfile(DIR);
const API_CREATE = "https://wshr.hasaki.vn/api/hr/projects/create-task-workflow";
const API_WORKFLOW = "https://wshr.hasaki.vn/api/hr/workflows/" + WORKFLOW_ID;
const MATCH_THRESHOLD = 0.55;                        // ngưỡng khớp hạng mục

const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

/* --------------------- 1) Lấy token từ phiên Edge --------------------- */
async function getToken() {
  const browser = await puppeteer.launch({
    headless: true, executablePath: EDGE_PATH, userDataDir: PROFILE_DIR,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  try {
    const page = (await browser.pages())[0] || (await browser.newPage());
    let token = null;
    page.on("request", (req) => {
      const a = req.headers()["authorization"];
      if (a && /wshr\.hasaki\.vn/.test(req.url()) && !token) token = a;
    });
    await page.goto("https://work.hasaki.vn/tasks-workflow?wfid=" + WORKFLOW_ID, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
    for (let i = 0; i < 12 && !token; i++) await new Promise((r) => setTimeout(r, 1000));
    if (/auth\/login/.test(page.url()) || !token) {
      throw new Error("Phiên đăng nhập work.hasaki.vn đã hết hạn. Hãy chạy: node login-hasaki.js để đăng nhập lại 1 lần.");
    }
    return token;
  } finally { await browser.close().catch(() => {}); }
}

/* --------------- 2) Lấy danh sách lựa chọn TYPE00 (để khớp) --------------- */
async function getType00Options(token) {
  const res = await fetch(API_WORKFLOW, { headers: { authorization: token } });
  const j = await res.json();
  let opts = [];
  (function walk(o) {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === "object") { if (o.key === "TYPE00" && Array.isArray(o.value)) opts = o.value; for (const k in o) walk(o[k]); }
  })(j);
  return opts;
}

const norm = (s) => String(s || "").toLowerCase().replace(/[,.:;()/\-…"']/g, " ").replace(/\s+/g, " ").trim();
function dice(a, b) { // độ tương đồng theo tập từ
  const A = new Set(norm(a).split(" ").filter(Boolean));
  const B = new Set(norm(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const w of A) if (B.has(w)) inter++;
  return (2 * inter) / (A.size + B.size);
}
function matchType00(hangMuc, options) {
  const target = norm(hangMuc);
  for (const o of options) if (norm(o) === target) return o;       // khớp tuyệt đối (đã chuẩn hoá)
  let best = null, score = 0;
  for (const o of options) { const s = dice(hangMuc, o); if (s > score) { score = s; best = o; } }
  return score >= MATCH_THRESHOLD ? best : null;
}

/* ------------------------- 3) Gọi Apps Script (SECRET trong POST body, không qua query) ------------------------- */
/* gasPost: 404 chập chờn của Google từng làm .json() nổ ở getPending → chết cả lượt đẩy biên bản.
   Riêng "mark" là ghi mã task vào sheet nên nonce của gasPost cũng chặn ghi trùng khi thử lại. */
const apiPost = (act, extra) => gasPost({ action: act, key: APPSCRIPT_KEY, ...(extra || {}) }, log, act);
async function getPending() {
  const j = await apiPost("pending");
  // 03/09/2026: "rows thiếu hẳn" ≠ "rỗng" — hôm nay chặng 2 Google rơi về trang doGet mặc định
  // ({status:'success', message:'Web App đang hoạt động…'}) và bộ đẩy tưởng "0 báo cáo" suốt buổi.
  if (j.status !== "success" || !Array.isArray(j.rows)) throw new Error("Apps Script pending lỗi/dị dạng: " + JSON.stringify(j).slice(0, 150));
  return j.rows;
}
/** Lấy ảnh/video của MỘT dòng theo anhIds — mỗi call GAS 1 file (vá nghẽn 03/09: pending hết cõng base64).
 *  File lỗi/quá nặng chỉ mất file đó, dòng khác không bị vạ lây.
 *  SOI METADATA TRƯỚC (1 call nhẹ, chiMeta=1) vì 2 lẽ đo được 03/09:
 *   · dòng CHỈ CÓ VIDEO (6 dòng tồn thật) sẽ bị bỏ ở bước IMA00 — tải video mỗi tick 15' là công cốc;
 *   · file >12MB (video mp4 19,6MB hàng 114) base64 KHÔNG BAO GIỜ chui lọt chặng 2 googleusercontent
 *     — gọi chỉ để nhận trang mặc định, bỏ đích danh từ metadata rẻ hơn nhiều. */
const TRAN_FILE_MB = 12;
async function layAnhTheoDong(row) {
  const ids = (row.anhIds || []).slice(0, 8);
  if (!ids.length) return [];
  let taiIds = ids;
  try {
    const j = await apiPost("anh", { ids, chiMeta: 1 });
    if (j && Array.isArray(j.files)) {
      const meta = j.files;
      if (!meta.some((f) => /^image\//i.test(f.mime || ""))) {
        log("    ⚠ Hàng " + row.row + ": không có ẢNH nào (" + meta.map((f) => f.loi ? "file lỗi" : (f.mime + " " + ((f.bytes || 0) / 1048576).toFixed(1) + "MB")).join(", ") + ") — không tải gì.");
        return [];
      }
      taiIds = [];
      for (const f of meta) {
        if (f.loi) { log("    ⚠ Hàng " + row.row + ": file " + String(f.id).slice(0, 12) + "… lỗi Drive (" + String(f.loi).slice(0, 60) + ")"); continue; }
        if ((f.bytes || 0) > TRAN_FILE_MB * 1048576) { log("    ⚠ Hàng " + row.row + ": bỏ file quá nặng " + f.filename + " (" + ((f.bytes || 0) / 1048576).toFixed(1) + "MB > " + TRAN_FILE_MB + "MB)"); continue; }
        taiIds.push(f.id);
      }
    }
  } catch { /* metadata trượt (mạng/chặng 2) → cứ tải như thường, đường cũ vẫn chạy */ }
  const out = [];
  for (const id of taiIds) {
    try {
      const j = await apiPost("anh", { ids: [id] });
      const f = j && Array.isArray(j.files) ? j.files[0] : null;
      if (f && f.base64) out.push({ filename: f.filename, mime: f.mime, base64: f.base64 });
      else log("    ⚠ Hàng " + row.row + ": file " + id.slice(0, 12) + "… không lấy được" + (f && f.loi ? " (" + String(f.loi).slice(0, 60) + ")" : ""));
    } catch (e) { log("    ⚠ Hàng " + row.row + ": lỗi lấy file " + id.slice(0, 12) + "…: " + e.message); }
  }
  return out;
}
async function markDone(row, code) {
  await apiPost("mark", { row, code }).catch(() => {});
}
/** Gửi cảnh báo qua Apps Script (gửi email) — dùng khi phiên hết hạn / sự cố. Best-effort. */
async function sendAlert(msg) {
  try {
    const j = (await apiPost("alert", { msg })) || {};   // apiPost trả JSON sẵn (gasPost), không còn Response
    if (j.sent) log("  ✉ Đã gửi email cảnh báo.");
    else if (j.skipped) log("  ✉ (Đã cảnh báo gần đây, bỏ qua gửi lại.)");
  } catch { /* không chặn luồng chính nếu gửi mail lỗi */ }
}

/* ---------------------------- 4) Tạo task ---------------------------- */
function endOfDay(ngay) { const d = (ngay || "").slice(0, 10); return (d || ngay) + " 23:59:00"; }
const EXT_THEO_MIME = {
  "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp",
  "image/gif": "gif", "image/heic": "jpg",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
  "video/x-matroska": "mkv", "video/3gpp": "3gp",
};
async function createTask(token, row, type00) {
  const fd = new FormData();
  const ten = ("[5S] " + (row.viTri || "?") + " - " + row.hangMuc).slice(0, 90);
  // Ngày vi phạm: ưu tiên thời gian từ ảnh/video (client gửi qua thoiGianViPham), thiếu thì dùng lúc gửi form.
  const ngayViPham = row.thoiGianViPham || row.ngay || "";
  fd.set("name", ten);
  fd.set("amount_of_work", "0");
  fd.set("type", "2");
  fd.set("staff_id", STAFF_ID);
  fd.set("date_start", (ngayViPham || "").slice(0, 10));
  fd.set("date_end", endOfDay(ngayViPham));
  fd.set("planned_hours", "0");
  fd.set("piority", "0");
  fd.set("workflow_id", WORKFLOW_ID);
  fd.set("data[configs][DATE00]", ngayViPham);
  fd.set("data[configs][TYPE00]", type00);
  fd.set("data[configs][BIN00]", row.viTri || "");           // Vị trí ghi nhận (giữ nguyên)
  // 03/09/2026: WF 591 không có ô cấu hình riêng cho SKU → ghép mã SP (nếu form có quét) vào Mô tả.
  // Tra hasaki.vn ra SKU + tên + ảnh; tra trượt/lỗi mạng vẫn ghi mã thô — không chặn việc tạo task.
  let note = row.hienTrang || "";
  const maSP = String(row.maSanPham || "").trim();
  if (maSP) {
    let sp = null; try { sp = await traCuuSanPham(maSP); } catch { /* best-effort */ }
    note = (note ? note + "\n" : "") + dongMoTaSP(maSP, sp);
  }
  fd.set("note", note);                                       // Hiện trạng (+ mã SP) -> Mô tả task
  let soAnh = 0, soVideo = 0;
  for (const m of (row.images || [])) {
    const mime = m.mime || "image/jpeg";
    const laVideo = /^video\//i.test(mime);
    const buf = Buffer.from(m.base64, "base64");
    const ext = EXT_THEO_MIME[mime] || (laVideo ? "mp4" : "jpg");
    let fname = m.filename || (laVideo ? "video" : "anh");
    if (!/\.[a-z0-9]{2,4}$/i.test(fname)) fname += "." + ext;
    const field = laVideo ? "data[configs][VID01][]" : "data[configs][IMA00][]";
    fd.append(field, new Blob([buf], { type: mime }), fname);
    if (laVideo) soVideo++; else soAnh++;
  }
  row._soAnh = soAnh; row._soVideo = soVideo;                 // để log
  const res = await fetch(API_CREATE, {
    method: "POST",
    headers: { authorization: token, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" },
    body: fd,
  });
  let j = {}; try { j = JSON.parse(await res.text()); } catch {}
  return { ok: res.status === 200 && (j.status === 1 || j.code === 200), code: (j.data && j.data.code) || "", id: (j.data && j.data.id) || "", raw: j, http: res.status };
}

/* ------------------ 4b) Tra cứu NV & Tự động hoàn thành B1 ------------------ */
const CACHE_DB = path.join(DIR, ".cache-danhba.json");
const STAFF_API = "https://wshr.hasaki.vn/api/news/staff/search-for-dropdown?limit=10000&sort=staff_id";

async function layDanhBa(token) {
  try {
    const c = JSON.parse(fs.readFileSync(CACHE_DB, "utf8"));
    if (Date.now() - c.at < 12 * 3600 * 1000 && Array.isArray(c.data) && c.data.length) return c.data;
  } catch {}
  try {
    const res = await fetch(STAFF_API, { headers: { authorization: token } });
    const j = await res.json();
    const data = j.data || j.rows || [];
    if (data.length) try { fs.writeFileSync(CACHE_DB, JSON.stringify({ at: Date.now(), data })); } catch {}
    return data;
  } catch (e) {
    try { return JSON.parse(fs.readFileSync(CACHE_DB, "utf8")).data || []; } catch {}
    return [];
  }
}

function timNhanVien(query, danhBa) {
  if (!query || !danhBa || !danhBa.length) return null;
  const q = String(query).trim().toLowerCase();
  const qUser = q.includes("@") ? q.split("@")[0] : q;
  return danhBa.find((s) => {
    const email = String(s.staff_email || "").toLowerCase();
    const emailUser = email.includes("@") ? email.split("@")[0] : email;
    const code = String(s.code || "").toLowerCase();
    const name = String(s.staff_name || "").toLowerCase();
    const staffId = String(s.staff_id || "");
    return email === q || emailUser === qUser || code === q || staffId === q || name === q;
  }) || null;
}

/* ---- Hoàn thành bước B1 rồi để engine tự mở B1.1 (khuôn API đo thật 22/09/2026) ----------------
 * BẮT ĐƯỢC TỪ WEB THẬT: ô cấu hình của MỘT BƯỚC ghi bằng FormData
 *     POST mass-update-field-task-input  { id: <id bước>, field: "data", "value[configs][<KEY>]": <giá trị> }
 * → server ghi vào `data.configs.<KEY>` VÀ tự sinh `data.logs.<KEY>` (ai sửa, lúc nào) y như thao tác tay.
 * BẢN TRƯỚC (21/09) gửi JSON field "status" kèm khối "extra data / configs" — server trả 200 nhưng
 * KHÔNG ghi gì: task HSK-16E66T6P chạy hôm 21/09 tới nay vẫn nằm ở B1 với data rỗng. Đừng quay lại khuôn đó.
 * 3 bẫy đã đo:
 *   · `field:"configs"` → SQL lỗi "Unknown column 'configs'" (chỉ có field "data").
 *   · `value[<KEY>]` (không lồng `configs`) ghi vào data.<KEY> — web KHÔNG đọc chỗ đó, coi như mất.
 *   · Nạp ảnh là CỘNG DỒN, không đè: phải xoá PIC02 trước rồi mới nạp, nếu không chạy lại là nhân đôi ảnh.
 * Ô cần điền (đối chiếu phiếu người thật làm — HSK-XT2O04L0 ngày 19/09):
 *   staff = mã NV vi phạm (nhiều người ngăn bằng dấu phẩy) · QLBP02 = tên quản lý trực tiếp · PIC02 = ảnh bằng chứng.
 */
const V_API = "https://wshr.hasaki.vn/api";
const CDN_HR = "https://hr-media.hasaki.vn/production/hr/";

async function ghiOBuoc(token, buocId, cap, files) {
  const fd = new FormData();
  fd.set("id", String(buocId));
  fd.set("field", "data");
  for (const [k, v] of Object.entries(cap || {})) fd.set(k, v);
  for (const f of (files || [])) fd.append(f.field, new Blob([f.buf], { type: f.mime }), f.ten);
  const r = await fetch(V_API + "/hr/projects/mass-update-field-task-input", {
    method: "POST", body: fd,
    headers: { authorization: token, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" },
    signal: AbortSignal.timeout(60000),
  });
  let j = null; try { j = JSON.parse(await r.text()); } catch { /* HTML lỗi */ }
  return { ok: r.status === 200 && j && j.status === 1, http: r.status, j };
}

async function docTask(token, taskId) {
  const r = await fetch(V_API + "/hr/projects/task-input/" + taskId, {
    headers: { authorization: token, accept: "application/json" }, signal: AbortSignal.timeout(30000),
  });
  const j = await r.json();
  return j && j.data;
}
/* Quản lý trực tiếp (ô QLBP02): ƯU TIÊN sổ tra dựng từ phiếu NGƯỜI đã điền, chỉ đoán khi sổ chưa
   có mã đó — xem đầu qltt.js để biết vì sao không tin được cách đoán và vì sao HR/chat không dùng được. */
const SO_QLTT = docSoQLTT(DIR);

async function tuDongHoanThanhB1(token, taskId, queryNV, danhBa, log, row) {
  if (!taskId || !queryNV) return;

  const nvQueries = String(queryNV).split(",").map((s) => s.trim()).filter(Boolean);
  const danhSachNv = nvQueries.map((q) => timNhanVien(q, danhBa)).filter(Boolean);
  if (!danhSachNv.length) {
    log("    ⚠ Không tìm thấy NV vi phạm khớp với «" + queryNV + "» trong danh bạ — giữ nguyên ở B1.");
    return;
  }
  const nv = danhSachNv[0];
  const allCodes = danhSachNv.map((x) => String(x.code || x.staff_id)).join(",");
  log("    ✓ Khớp " + danhSachNv.length + " NV vi phạm: " + danhSachNv.map((x) => x.staff_name + " (mã: " + x.code + ")").join(", "));

  try {
    const taskData = await docTask(token, taskId);
    if (!taskData || !Array.isArray(taskData.subtasks)) { log("    ⚠ Không đọc được cây bước của task " + taskId); return; }
    const b1 = taskData.subtasks.find((s) => String(s.workflow_step_id) === "7379" || /B1\./i.test(s.name || ""));
    if (!b1) { log("    ⚠ Không tìm thấy bước B1 trong task " + taskId); return; }
    if (b1.status === 2) { log("    ℹ B1 đã hoàn thành sẵn — bỏ qua."); return; }

    const q = chonQLTTCanBang(nv, danhBa, SO_QLTT, DIR, false);   // peek: chưa cộng lượt
    const qltt = q.ten;
    log("    · QLTT: " + qltt + " (" + q.nguon + " — " + q.ghiChu + ")");

    /* 1) Ảnh bằng chứng PIC02 = chính ảnh vi phạm đã nạp ở task cha (không tải lại từ Drive).
          Xoá trước rồi nạp để chạy lại không nhân đôi. Ảnh lỗi thì BỎ QUA — không chặn việc đóng B1. */
    const anh = (row.images || []).find((m) => !/^video\//i.test(m.mime || "image/jpeg"));
    let nhanAnh = "không có ảnh";
    if (anh && anh.base64) {
      try {
        await ghiOBuoc(token, b1.id, { "value[configs][PIC02]": "" });
        const buf = Buffer.from(anh.base64, "base64");
        let ten = anh.filename || "bang-chung.jpg";
        if (!/\.[a-z0-9]{2,4}$/i.test(ten)) ten += ".jpg";
        const rA = await ghiOBuoc(token, b1.id, {}, [{ field: "value[configs][PIC02][]", buf, mime: anh.mime || "image/jpeg", ten }]);
        nhanAnh = rA.ok ? "đã nạp ảnh" : "nạp ảnh trượt (HTTP " + rA.http + ")";
      } catch (e) { nhanAnh = "nạp ảnh lỗi: " + e.message; }
    }

    /* 2) NV vi phạm + Quản lý trực tiếp. */
    const rCfg = await ghiOBuoc(token, b1.id, { "value[configs][staff]": allCodes, "value[configs][QLBP02]": qltt });
    if (!rCfg.ok) { log("    ⚠ Ghi ô NV vi phạm/QLTT trượt (HTTP " + rCfg.http + ") — KHÔNG đóng B1 để không mất thông tin."); return; }

    /* 3) ĐÓNG bước (status 2) → engine mở B1.1.
       KHÔNG gán lại assign_staff của B1: B1 "Xác minh lỗi vi phạm" là việc của NGƯỜI XÁC MINH
       (đo 3 phiếu người thật làm: B1 luôn đứng tên Lâm Thanh Tú). Bản thử 22/09 gán B1 sang NV vi
       phạm thì engine mở B1.1 và giao cho QUẢN LÝ của người đó — sai người phải xác nhận lỗi. */
    const fdSt = new FormData();
    fdSt.set("id", String(b1.id)); fdSt.set("field", "status"); fdSt.set("value", "2");
    const rSt = await fetch(V_API + "/hr/projects/mass-update-field-task-input", { method: "POST", body: fdSt,
      headers: { authorization: token, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" }, signal: AbortSignal.timeout(30000) });
    const tSt = await rSt.text();

    /* 4) ĐỌC LẠI ĐỂ CHỐT — bài học 21/09: server trả 200 mà không đổi gì. Không thấy B1=2 thì báo TRƯỢT. */
    const sau = await docTask(token, taskId);
    const b1Sau = (sau && sau.subtasks || []).find((s) => String(s.id) === String(b1.id));
    const b11 = (sau && sau.subtasks || []).find((s) => String(s.workflow_step_id) === "7826" || /B1\.1/i.test(s.name || ""));

    /* 5) CHỐT NGƯỜI Ở B1.1. Bước này là "Nhân viên xác nhận lỗi vi phạm" nên PHẢI đứng tên chính
       NV vi phạm. Không tin engine tự giao đúng: lần thử 22/09 nó giao sang quản lý. Đọc xem ai
       đang cầm, thiếu người nào thì giao lại cho đủ, rồi đọc lần nữa để báo tên thật. */
    let aiB11 = "";
    if (b11) {
      const dangCam = (b11.staff || []).map((x) => String(x.info && x.info.code || "")).filter(Boolean);
      const canCo = danhSachNv.map((x) => String(x.code || x.staff_id));
      if (canCo.some((c) => !dangCam.includes(c))) {
        const fdG = new FormData();
        fdG.set("id", String(b11.id)); fdG.set("field", "assign_staff");
        fdG.set("value", danhSachNv.map((x) => String(x.staff_id)).join(","));
        await fetch(V_API + "/hr/projects/mass-update-field-task-input", { method: "POST", body: fdG,
          headers: { authorization: token, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" } }).catch(() => {});
      }
      /* ≥2 NV vi phạm → B1.1 bật "MỖI THÀNH VIÊN": field `sub_type`=1 — số đo từ ví dụ thật
         của user (task 13818654 sau khi bật đúng chế độ: type=2, sub_type=1; mọi task khác
         sub_type=0). ĐỪNG dùng type=3 — suy đoán i18n ban đầu sai. canh-b11.mjs quét bù. */
      if (danhSachNv.length >= 2) {
        const fdT = new FormData();
        fdT.set("id", String(b11.id)); fdT.set("field", "sub_type"); fdT.set("value", "1");
        await fetch(V_API + "/hr/projects/mass-update-field-task-input", { method: "POST", body: fdT,
          headers: { authorization: token, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" } }).catch(() => {});
      }
      const lai = await docTask(token, taskId);
      const b11b = (lai && lai.subtasks || []).find((s) => String(s.id) === String(b11.id));
      aiB11 = ((b11b && b11b.staff) || []).map((x) => x.info && x.info.staff_name).filter(Boolean).join(", ");
    }

    if (b1Sau && b1Sau.status === 2) {
      if (q.pool && q.pool.length > 1) ghiLuot(DIR, qltt);   // chỉ cộng lượt khi B1 đã đóng THẬT (chia đều 0,2%)
      log("    🚀 ĐÓNG B1 XONG → " + (b11 ? "B1.1 đang ở tay: " + (aiB11 || "(chưa ai)") : "chờ engine mở B1.1") +
          " · QLTT: " + qltt + " (" + q.nguon + ") · " + nhanAnh);
    } else {
      log("    ⚠ B1 VẪN CHƯA ĐÓNG (status " + (b1Sau && b1Sau.status) + ", HTTP " + rSt.status + "): " + tSt.slice(0, 150));
    }
  } catch (err) {
    log("    ⚠ Lỗi tự động hoàn thành B1: " + err.message);
  }
}


/* ------------------------------- MAIN ------------------------------- */
(async () => {
  log("Bắt đầu đẩy báo cáo 5S sang workflow " + WORKFLOW_ID);

  // TỐI ƯU: hỏi báo cáo chưa đẩy TRƯỚC (GET rẻ, không cần Edge). Rỗng → thoát ngay,
  // KHÔNG mở Edge lấy token → đỡ mở Edge vô ích mỗi 15' + tránh xung đột profile khi rảnh.
  const rows = await getPending();
  log("→ Có " + rows.length + " báo cáo (có vi phạm) chưa đẩy.");
  if (!rows.length) { log("Không có gì để đẩy (không mở Edge). Xong."); process.exit(0); }

  let token;
  try { token = await layTokenTuPhucHoi(getToken, DIR, log, "work"); log("✓ Đã lấy token."); }
  catch (e) {
    // Đường 2 (OTP thủ công): e.defer = không có phiên sống để mượn VÀ bot không tự đăng nhập được.
    // Đây KHÔNG phải lỗi — chờ người đăng nhập tay (nút trong email); lượt push-5s sau (mỗi 15') sẽ
    // thấy phiên và đẩy. Thoát êm, KHÔNG gửi mail báo động mỗi 15' (nếu không sẽ spam đúng lúc chờ người).
    if (e && e.defer) { log("⏸ " + e.message + " — bỏ lượt này, chờ phiên người thật. Không báo động."); process.exit(0); }
    log("✗ " + e.message); await sendAlert(e.message); process.exit(2);
  }

  const options = await getType00Options(token);
  log("✓ Workflow có " + options.length + " lựa chọn 'Lỗi vi phạm'.");

  const danhBa = await layDanhBa(token);

  const nghi = (ms) => new Promise((res) => setTimeout(res, ms));
  let ok = 0, skip = 0, fail = 0, daTao = 0;
  for (const row of rows) {
    const type00 = matchType00(row.hangMuc, options);
    if (!type00) { skip++; log("  ⚠ Bỏ qua hàng " + row.row + ": không khớp hạng mục «" + row.hangMuc.slice(0, 40) + "...»"); continue; }
    // GAS mới trả anhIds (metadata nhẹ) → tải ảnh từng file tại đây; GAS cũ trả sẵn images thì dùng luôn.
    if (!Array.isArray(row.images)) row.images = await layAnhTheoDong(row);
    const coAnh = (row.images || []).some((m) => !/^video\//i.test(m.mime || "image/jpeg"));
    if (!coAnh) { skip++; log("  ⚠ Bỏ qua hàng " + row.row + ": thiếu ẢNH (IMA00 bắt buộc; chỉ có video không tạo được task)."); continue; }
    // THROTTLE: giãn 300ms giữa các lần createTask để không dội POST create-task khi tồn đọng lớn
    if (daTao > 0) await nghi(300);
    daTao++;
    try {
      const r = await createTask(token, row, type00);
      if (r.ok) {
        ok++;
        log("  ✓ Hàng " + row.row + " → task " + r.code + " (ảnh:" + (row._soAnh||0) + " video:" + (row._soVideo||0) + ")");
        await markDone(row.row, r.code);

        /* NV VI PHẠM — 2 nguồn, theo thứ tự tin cậy:
           1) Ô "Nhân viên vi phạm" người dùng chọn ở form (cột 9 sheet WMS-5S-AUDIT; pop-up Planogram
              điền sẵn ở ca "có đi làm mà KHÔNG báo cáo ô này").
           2) Phiếu cũ chưa có ô đó → đọc lại dòng "Phụ trách:" của biên bản pop-up, mẫu chốt 17/09:
              «Phụ trách: <Tên> (<mã>) -Có đi làm nhưng KHÔNG báo cáo vệ sinh ô này».
           CHỈ nhận đúng câu tình trạng đó. Các ca còn lại (phụ trách nghỉ · người khác đã báo cáo · chưa
           có dữ liệu chấm công · ô không có yêu cầu vệ sinh) KHÔNG có người chịu lỗi rõ ràng ⇒ để nguyên
           ở B1 cho người xác minh quyết.
           Luật cũ dò "Báo cáo gần nhất" + "đúng người trong bảng phân công" đã CHẾT từ 17/09: mẫu biên
           bản mới không còn hai dòng đó, nên mọi phiếu từ pop-up đều nằm lại B1. */
        let qNV = row.nhanVienViPham || row.nvViPham || "";
        if (!String(qNV).trim()) {
          const dongPT = String(row.hienTrang || "").split("\n").map((l) => l.trim())
            .find((l) => /^Phụ trách:/i.test(l) && /KHÔNG báo cáo vệ sinh ô này/i.test(l));
          const maPT = dongPT && dongPT.match(/\((\d{4,})\)/);
          if (maPT) { qNV = maPT[1]; log("    (Tự suy) NV vi phạm lấy từ dòng Phụ trách: " + dongPT.slice(0, 80)); }
        }

        /* ===== KHỐI TRUY VẾT VỆ SINH (user duyệt 25/09/2026 — xem truy-vet-vesinh.mjs) =========
           Lỗi "vệ sinh hằng ngày cuối ca" (mọi vị trí): ghép vào Mô tả — phụ trách theo bảng phân
           công + đi làm/báo cáo của NGÀY XÉT (ghi nhận −1; ghi nhận sau giờ RA thì chính ngày đó)
           + 2 báo cáo gần nhất (hyperlink "Yêu cầu <id>") + đánh giá AI. Ghi note bằng HTML —
           đã đo thật 25/09: mass-update-field field=note giữ nguyên thẻ <a>, web render được.
           "Đi làm mà KHÔNG báo cáo" → suy luôn NV vi phạm (cùng luật buộc tội với dòng Phụ trách). */
        if (laHangMucVeSinhHangNgay(type00)) {
          try {
            if (!global._nguonTV) global._nguonTV = await napNguonTruyVet(log);
            const kq = truyVet(global._nguonTV, row.viTri, row.thoiGianViPham || row.ngay || "");
            if (kq && r.id) {
              const dTask = await docTask(token, r.id);
              const noteMoi = String((dTask && dTask.note) || "") + kq.html;
              const fdN = new FormData();
              fdN.set("id", String(r.id)); fdN.set("field", "note"); fdN.set("value", noteMoi);
              const rN = await fetch(V_API + "/hr/projects/mass-update-field-task-input", { method: "POST", body: fdN,
                headers: { authorization: token, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" }, signal: AbortSignal.timeout(30000) });
              log("    Truy vết vệ sinh: " + (rN.status === 200 ? "đã ghép vào Mô tả (ngày xét " + kq.ngayXet + ")" : "ghi Mô tả trượt HTTP " + rN.status));
              if (!String(qNV).trim() && kq.suyNV) { qNV = kq.suyNV; log("    (Tự suy truy vết) NV vi phạm = phụ trách " + kq.suyNV + " — đi làm mà KHÔNG báo cáo ngày " + kq.ngayXet); }
            }
          } catch (e) { log("    ⚠ Truy vết vệ sinh lỗi: " + e.message + " — task vẫn tạo bình thường."); }
        }

        if (qNV && String(qNV).trim()) {
          await tuDongHoanThanhB1(token, r.id || r.code, String(qNV).trim(), danhBa, log, row);
        }
      }
      else { fail++; log("  ✗ Hàng " + row.row + " thất bại (HTTP " + r.http + "): " + JSON.stringify(r.raw).slice(0, 200)); }
    } catch (e) { fail++; log("  ✗ Hàng " + row.row + " lỗi: " + e.message); }
  }
  log("HOÀN TẤT — Tạo: " + ok + " | Bỏ qua: " + skip + " | Lỗi: " + fail);
  process.exit(0);
})();
