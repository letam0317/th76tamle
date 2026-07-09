/**
 * ============================================================================
 *  BỘ ĐỒNG BỘ: Toàn bộ task workflow 591 (work.hasaki.vn) ──► tab "5S-TASKS"
 * ============================================================================
 *  Kéo MỌI task (cả từ form lẫn người khác) + trạng thái từng bước con, ghi đè
 *  tab 5S-TASKS trên Google Sheet — để dashboard (dashboard-5s.html) đọc.
 *
 *  KHÁC với push-5s-to-workflow.js: bộ này CHỈ ĐỌC workflow & GHI tab reporting,
 *  KHÔNG tạo task, KHÔNG đụng inbox WMS-5S-AUDIT → không gây trùng lặp.
 *
 *  Chạy:  node sync-tasks-to-sheet.js   (hoặc bấm DONG-BO-TASK.bat)
 * ============================================================================
 */
import puppeteer from "puppeteer";
import "dotenv/config";

const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const WORKFLOW_ID = process.env.WORKFLOW_ID || "591";
const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PROFILE_DIR = process.env.EDGE_PROFILE_DIR || "C:/Users/lechitam/New folder/baocao5s/.wms-session/edge-profile";
const FROM_DATE = process.env.SYNC_FROM || "2026-01-01";   // mốc bắt đầu kéo task

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
if (!APPSCRIPT_KEY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

// Nhãn trạng thái (chỉnh lại nếu đối chiếu UI thấy khác)
const NHAN_TRANG_THAI = { 0: "Chưa xử lý", 1: "Đang xử lý", 2: "Hoàn thành", 4: "Từ chối/Huỷ", 6: "Quá hạn" };
const nhan = (s) => NHAN_TRANG_THAI[s] || (s === undefined || s === null ? "" : "Khác(" + s + ")");

async function getToken() {
  const browser = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH, userDataDir: PROFILE_DIR, args: ["--disable-blink-features=AutomationControlled"] });
  try {
    const page = (await browser.pages())[0] || (await browser.newPage());
    let token = null;
    page.on("request", (req) => { const a = req.headers()["authorization"]; if (a && /wshr\.hasaki\.vn/.test(req.url()) && !token) token = a; });
    await page.goto("https://work.hasaki.vn/tasks-workflow?wfid=" + WORKFLOW_ID, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
    for (let i = 0; i < 12 && !token; i++) await new Promise((r) => setTimeout(r, 1000));
    if (/auth\/login/.test(page.url()) || !token) throw new Error("Phiên work.hasaki.vn đã hết hạn. Chạy: node login-hasaki.js");
    return token;
  } finally { await browser.close().catch(() => {}); }
}

const tenNguoi = (t) => (t && t.staff && (t.staff.full_name || t.staff.name)) || (t && t.created_by_user && t.created_by_user.full_name) || (t && t.staff_id) || "";

(async () => {
  log("Bắt đầu đồng bộ task workflow " + WORKFLOW_ID + " → tab 5S-TASKS");
  const token = await getToken().catch((e) => { log("✗ " + e.message); process.exit(2); });
  log("✓ Đã lấy token.");

  const today = new Date().toISOString().slice(0, 10);
  const url = "https://wshr.hasaki.vn/api/hr/workflows/detail-workflow-task/" + WORKFLOW_ID +
    "?from_date=" + FROM_DATE + "&to_date=" + today + "&search_type=boa";
  const j = await (await fetch(url, { headers: { authorization: token } })).json();

  // Gom mọi task (cả cha lẫn bước con) thành danh sách phẳng
  const tasks = [];
  (function walk(o) {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === "object") {
      if (typeof o.code === "string" && /^HSK-/.test(o.code)) tasks.push(o);
      for (const k in o) walk(o[k]);
    }
  })(j);
  // Khử trùng theo id/code
  const map = new Map();
  for (const t of tasks) map.set(t.id || t.code, t);
  const all = [...map.values()];
  log("→ Đọc được " + all.length + " bản ghi task (gồm bước con).");

  // id -> code & nguồn (để gắn cho bước con)
  const idToCode = new Map(), idToNguon = new Map();
  for (const t of all) {
    idToCode.set(t.id, t.code);
    if (!t.parent_id) idToNguon.set(t.id, /^\[5S\]/.test(t.name || "") ? "Form" : "Khác");
  }

  const header = ["Mã task", "Loại", "Mã cha", "Tên / Bước", "Mô tả", "Lỗi vi phạm", "Vị trí", "Ngày vi phạm", "Trạng thái", "% HT", "Bước hiện tại", "Người phụ trách", "Ngày tạo", "Ảnh", "Video", "Nguồn"];
  const rows = [];
  let soCha = 0, soBuoc = 0;
  for (const t of all) {
    const c = (t.data && t.data.configs) || {};
    const laCha = !t.parent_id;
    const buocHienTai = (t.current_step && t.current_step.name) || "";
    const nguon = laCha ? (idToNguon.get(t.id) || "Khác") : (idToNguon.get(t.parent_id) || "Khác");
    if (laCha) soCha++; else soBuoc++;
    rows.push([
      t.code || "",
      laCha ? "Cha" : "Bước",
      laCha ? "" : (idToCode.get(t.parent_id) || t.parent_id || ""),
      t.name || "",
      laCha ? String(t.note || "") : "",
      laCha ? String(c.TYPE00 || "") : "",
      laCha ? String(c.BIN00 || "") : "",
      laCha ? String(c.DATE00 || "") : "",
      nhan(t.status),
      (t.percent != null ? t.percent : ""),
      buocHienTai,
      tenNguoi(t),
      t.created_at || "",
      laCha ? ((c.IMA00 || []).length) : "",
      laCha ? ((c.VID01 || []).length) : "",
      nguon,
    ]);
  }
  log("  Cha (task vi phạm): " + soCha + " | Bước con: " + soBuoc);

  const res = await fetch(APPSCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, header, rows }),
  });
  let r = {}; try { r = JSON.parse(await res.text()); } catch {}
  if (r.status === "success") log("✓ Đã ghi " + r.written + " dòng vào tab 5S-TASKS lúc " + r.at);
  else log("✗ Ghi tab thất bại: " + JSON.stringify(r).slice(0, 200));
  await new Promise((rs) => setTimeout(rs, 200));   // né crash teardown undici/libuv trên Windows
  process.exit(0);
})();
