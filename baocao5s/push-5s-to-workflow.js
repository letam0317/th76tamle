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
const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
// Profile Edge ổn định (gitignore qua .wms-session/) — KHÔNG để trong Temp để lịch chạy ngầm khỏi mất phiên.
const PROFILE_DIR = process.env.EDGE_PROFILE_DIR || "C:/Users/lechitam/New folder/baocao5s/.wms-session/edge-profile";
const API_CREATE = "https://wshr.hasaki.vn/api/hr/projects/create-task-workflow";
const API_WORKFLOW = "https://wshr.hasaki.vn/api/hr/workflows/" + WORKFLOW_ID;
const MATCH_THRESHOLD = 0.55;                        // ngưỡng khớp hạng mục

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

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

/* ------------------------- 3) Gọi Apps Script ------------------------- */
async function getPending() {
  const res = await fetch(APPSCRIPT_URL + "?action=pending&key=" + encodeURIComponent(APPSCRIPT_KEY));
  const j = await res.json();
  if (j.status !== "success") throw new Error("Apps Script pending lỗi: " + JSON.stringify(j));
  return j.rows || [];
}
async function markDone(row, code) {
  const u = APPSCRIPT_URL + "?action=mark&key=" + encodeURIComponent(APPSCRIPT_KEY) + "&row=" + row + "&code=" + encodeURIComponent(code);
  await fetch(u).catch(() => {});
}
/** Gửi cảnh báo qua Apps Script (gửi email) — dùng khi phiên hết hạn / sự cố. Best-effort. */
async function sendAlert(msg) {
  const u = APPSCRIPT_URL + "?action=alert&key=" + encodeURIComponent(APPSCRIPT_KEY) + "&msg=" + encodeURIComponent(msg);
  try {
    const r = await fetch(u);
    const j = await r.json().catch(() => ({}));
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
  fd.set("note", row.hienTrang || "");                        // Hiện trạng (ghi chú) -> Mô tả task
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
  return { ok: res.status === 200 && (j.status === 1 || j.code === 200), code: (j.data && j.data.code) || "", raw: j, http: res.status };
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
  catch (e) { log("✗ " + e.message); await sendAlert(e.message); process.exit(2); }

  const options = await getType00Options(token);
  log("✓ Workflow có " + options.length + " lựa chọn 'Lỗi vi phạm'.");

  let ok = 0, skip = 0, fail = 0;
  for (const row of rows) {
    const type00 = matchType00(row.hangMuc, options);
    if (!type00) { skip++; log("  ⚠ Bỏ qua hàng " + row.row + ": không khớp hạng mục «" + row.hangMuc.slice(0, 40) + "...»"); continue; }
    const coAnh = (row.images || []).some((m) => !/^video\//i.test(m.mime || "image/jpeg"));
    if (!coAnh) { skip++; log("  ⚠ Bỏ qua hàng " + row.row + ": thiếu ẢNH (IMA00 bắt buộc; chỉ có video không tạo được task)."); continue; }
    try {
      const r = await createTask(token, row, type00);
      if (r.ok) { ok++; log("  ✓ Hàng " + row.row + " → task " + r.code + " (ảnh:" + (row._soAnh||0) + " video:" + (row._soVideo||0) + ")"); await markDone(row.row, r.code); }
      else { fail++; log("  ✗ Hàng " + row.row + " thất bại (HTTP " + r.http + "): " + JSON.stringify(r.raw).slice(0, 200)); }
    } catch (e) { fail++; log("  ✗ Hàng " + row.row + " lỗi: " + e.message); }
  }
  log("HOÀN TẤT — Tạo: " + ok + " | Bỏ qua: " + skip + " | Lỗi: " + fail);
  process.exit(0);
})();
