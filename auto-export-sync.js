/**
 * ============================================================================
 *  TỰ ĐỘNG 100%: tự "Xuất" workflow 591 qua API → tải file → ghi tab 5S-TASKS
 * ============================================================================
 *  KHÔNG cần bấm nút, KHÔNG cần file trong Downloads. Quy trình:
 *    1) Lấy token từ phiên Edge đã đăng nhập
 *    2) POST /api/hr/excel-io/export  (queue job xuất Excel, tối đa 3 THÁNG/lần)
 *    3) Poll GET /api/hr/excel-io tới khi status=1 & có file_path (hoặc báo lỗi)
 *    4) TẢI file công khai từ  wshr.hasaki.vn/production/hr/<file_path>
 *    5) Đọc như sync-board, gộp các cửa sổ, POST syncTasks → tab 5S-TASKS
 *
 *  Chạy:  node auto-export-sync.js   (hoặc để Task Scheduler gọi ẩn theo lịch)
 * ============================================================================
 */
import puppeteer from "puppeteer";
import XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.join(DIR, ".exports");
const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const WORKFLOW_ID = process.env.WORKFLOW_ID || "591";
const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PROFILE_DIR = process.env.EDGE_PROFILE_DIR || "C:/Users/lechitam/New folder/.wms-session/edge-profile";
const SYNC_FROM = process.env.SYNC_FROM || "2026-04-01";   // mốc bắt đầu (workflow 5S khởi động ~4/2026)
const MEDIA_BASE = "https://hr-media.hasaki.vn/production/hr/";       // ảnh/clip (công khai)
const FILE_BASE = "https://wshr.hasaki.vn/production/hr/";            // file Excel export (công khai)
const API = "https://wshr.hasaki.vn/api/hr/excel-io";

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
if (!APPSCRIPT_KEY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

const fmt = (d) => d.toISOString().slice(0, 10);
function convMedia(v) {
  if (typeof v !== "string" || !/task_wf(step)?config\//.test(v)) return v;
  return v.split(/[\s,]+/).filter(Boolean)
    .map(p => /task_wf(step)?config\//.test(p) ? MEDIA_BASE + p.replace(/^\/+/, "") : p).join("\n");
}

// Chia [SYNC_FROM..hôm nay] thành các cửa sổ ≤ ~60 ngày (an toàn dưới hạn 3 tháng)
function cuaSoNgay() {
  const win = [], today = new Date(); let cur = new Date(SYNC_FROM);
  while (cur <= today) {
    const end = new Date(cur); end.setDate(end.getDate() + 60);
    win.push([fmt(cur), fmt(end < today ? end : today)]);
    cur = new Date(end); cur.setDate(cur.getDate() + 1);
  }
  return win;
}

async function getToken() {
  const browser = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH, userDataDir: PROFILE_DIR, args: ["--disable-blink-features=AutomationControlled"] });
  try {
    const page = (await browser.pages())[0] || (await browser.newPage());
    let token = null;
    page.on("request", (req) => { const a = req.headers()["authorization"]; if (a && /wshr\.hasaki\.vn/.test(req.url()) && !token) token = a; });
    await page.goto("https://work.hasaki.vn/tasks-workflow?wfid=" + WORKFLOW_ID, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
    for (let i = 0; i < 15 && !token; i++) await new Promise((r) => setTimeout(r, 1000));
    if (/auth\/login/.test(page.url()) || !token) throw new Error("Phiên work.hasaki.vn đã hết hạn. Chạy: node login-hasaki.js");
    return token;
  } finally { await browser.close().catch(() => {}); }
}

const dsExport = async (token) => ((await (await fetch(API, { headers: { authorization: token } })).json()).data?.rows || []);

// Queue 1 cửa sổ + chờ tới khi job (khớp from/to) có file_path
async function xuatMotCuaSo(token, from, to) {
  const fd = new FormData();
  fd.append("param[from_date]", from); fd.append("param[to_date]", to);
  fd.append("param[search_type]", "board"); fd.append("param[wfid]", WORKFLOW_ID); fd.append("type", "6");
  await fetch(API + "/export", { method: "POST", headers: { authorization: token }, body: fd });
  log("  queue " + from + " → " + to + ", chờ xử lý...");
  for (let i = 0; i < 60; i++) {   // tối đa ~180s
    await new Promise(r => setTimeout(r, 3000));
    const job = (await dsExport(token)).find(r => r.param && r.param.from_date === from && r.param.to_date === to && r.type === 6);
    if (job && job.status === 1 && job.file_path) return job.file_path;
    if (job && job.status === 0 && job.log && job.log.message) throw new Error("Job lỗi: " + job.log.message);
  }
  throw new Error("Quá thời gian chờ job (" + from + ").");
}

async function taiVaDoc(filePath) {
  const buf = Buffer.from(await (await fetch(FILE_BASE + filePath.replace(/^\/+/, ""))).arrayBuffer());
  if (buf.slice(0, 2).toString("latin1") !== "PK") throw new Error("File tải về không phải xlsx.");
  fs.writeFileSync(path.join(EXPORT_DIR, path.basename(filePath)), buf);
  const wb = XLSX.read(buf);
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
}

const RUN_LOCK = path.join(DIR, ".export-running.lock");
(async () => {
  // Chống chạy chồng (7h sáng + nút Cập nhật ngay) → xung đột profile Edge.
  if (fs.existsSync(RUN_LOCK) && Date.now() - fs.statSync(RUN_LOCK).mtimeMs < 10 * 60 * 1000) {
    log("Đang có phiên auto-export khác chạy, bỏ qua."); process.exit(0);
  }
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
  fs.writeFileSync(RUN_LOCK, String(Date.now()));
  process.on("exit", () => { try { fs.rmSync(RUN_LOCK, { force: true }); } catch {} });
  const token = await getToken().catch(e => { log("✗ " + e.message); process.exit(2); });
  log("✓ Đã lấy token.");

  const windows = cuaSoNgay();
  log("Xuất " + windows.length + " cửa sổ ≤3 tháng: " + windows.map(w => w[0] + ".." + w[1]).join(" | "));
  let header = null; const byCode = new Map();

  for (const [from, to] of windows) {
    let aoa;
    try { aoa = await taiVaDoc(await xuatMotCuaSo(token, from, to)); }
    catch (e) { log("  ✗ " + e.message + " (bỏ qua cửa sổ)"); continue; }
    if (!aoa || aoa.length < 2) { log("  (cửa sổ rỗng)"); continue; }
    const nhom = aoa[0] || [], ten = aoa[1] || [];
    const soCot = Math.max(nhom.length, ten.length, ...aoa.slice(2).map(r => r.length));
    let nhomHT = ""; const h = [];
    for (let i = 0; i < soCot; i++) { if (String(nhom[i] || "").trim()) nhomHT = String(nhom[i]).trim(); h.push(nhomHT && i >= 6 ? (nhomHT + " ▸ " + String(ten[i] || "").trim()) : String(ten[i] || "").trim()); }
    if (!header || h.length > header.length) header = h;
    for (const r of aoa.slice(2)) {
      const code = String(r[0] || "").trim(); if (!code) continue;
      byCode.set(code, Array.from({ length: soCot }, (_, i) => convMedia(r[i] != null ? r[i] : "")));   // dedup theo Task Code
    }
    log("  ✓ gộp: " + byCode.size + " task.");
  }

  if (!header || !byCode.size) { log("✗ Không lấy được dữ liệu."); process.exit(2); }
  const rows = [...byCode.values()];
  log("→ Ghi " + rows.length + " task (" + header.length + " cột) vào 5S-TASKS...");
  const res = await fetch(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, header, rows }) });
  let j = {}; try { j = JSON.parse(await res.text()); } catch {}
  log(j.status === "success" ? "✓ Đã ghi " + j.written + " dòng lúc " + j.at : "✗ Ghi tab thất bại: " + JSON.stringify(j).slice(0, 200));
  // giữ 3 file .xlsx gần nhất
  const all = fs.readdirSync(EXPORT_DIR).filter(f => /\.xlsx$/i.test(f)).map(f => ({ f, t: fs.statSync(path.join(EXPORT_DIR, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  all.slice(3).forEach(x => { try { fs.rmSync(path.join(EXPORT_DIR, x.f), { force: true }); } catch {} });
  await new Promise(r => setTimeout(r, 200));
  process.exit(0);
})().catch(e => { log("✗ " + e.message); process.exit(2); });
