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
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenTuPhucHoi } from "./auto-login.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.join(DIR, ".exports");
const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const WORKFLOW_ID = process.env.WORKFLOW_ID || "591";
const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PROFILE_DIR = process.env.EDGE_PROFILE_DIR || "C:/Users/lechitam/New folder/baocao5s/.wms-session/edge-profile";
const SYNC_FROM = process.env.SYNC_FROM || "2026-04-01";   // mốc bắt đầu (workflow 5S khởi động ~4/2026) — chỉ dùng khi FULL
const ROLL_DAYS = Number(process.env.ROLL_DAYS || 45);     // cửa sổ an toàn LUÔN refresh (bắt task mới / task bị mở lại)
const FULL_RESYNC = process.env.FULL_RESYNC === "1";       // ép đồng bộ TOÀN BỘ từ SYNC_FROM (bỏ qua cache) — chạy tay khi cần
const CACHE_FILE = path.join(EXPORT_DIR, "tasks-cache.json"); // KHO BỀN VỮNG: task terminal đóng băng ở đây, không export lại
// MULTI-TENANT (dashboard đa công ty): thư mục file tĩnh trên Pages. Hasaki = "summary" (mặc định, giữ nguyên).
// Chạy pipeline cho công ty khác: SUMMARY_DIR=summary-factory WORKFLOW_ID=<wf id> node auto-export-sync.js
const SUMMARY_DIR = process.env.SUMMARY_DIR || "summary";
// NGUỒN DUY NHẤT trạng thái "đóng" (terminal) — giá trị GỐC tiếng Anh của WF: Finished/Canceled/Cancelled/Failed
const TERMINAL_STATUSES = ["finished", "canceled", "cancelled", "failed"];
const chuanTT = (v) => String(v == null ? "" : v).trim().toLowerCase();
const laTerminal = (v) => TERMINAL_STATUSES.includes(chuanTT(v));   // đã xong/huỷ/thất bại → không refresh nữa
const STAFF_API = "https://wshr.hasaki.vn/api/news/staff/search-for-dropdown?limit=10000&sort=staff_id"; // danh bạ NV (id/code → họ tên)
const nhanCuoi = (h) => String(h || "").split("▸").pop().trim();
const MEDIA_BASE = "https://hr-media.hasaki.vn/production/hr/";       // ảnh/clip (công khai)
const FILE_BASE = "https://wshr.hasaki.vn/production/hr/";            // file Excel export (công khai)
const API = "https://wshr.hasaki.vn/api/hr/excel-io";

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
if (!APPSCRIPT_KEY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

const fmt = (d) => d.toISOString().slice(0, 10);
// Exponential backoff: thử lại 3 lần (1s→2s→4s) khi 5xx/429 hoặc lỗi mạng/timeout.
async function fetchRetry(url, opt, n = 3) {
  let loiCuoi;
  for (let i = 0; i < n; i++) {
    try {
      const r = await fetch(url, opt);
      if ((r.status >= 500 || r.status === 429) && i < n - 1) { await new Promise(s => setTimeout(s, 1000 * 2 ** i)); continue; }
      return r;
    } catch (e) { loiCuoi = e; if (i < n - 1) await new Promise(s => setTimeout(s, 1000 * 2 ** i)); }
  }
  if (loiCuoi) throw loiCuoi;
  return fetch(url, opt);
}
function convMedia(v) {
  if (typeof v !== "string" || !/task_wf(step)?config\//.test(v)) return v;
  return v.split(/[\s,]+/).filter(Boolean)
    .map(p => /task_wf(step)?config\//.test(p) ? MEDIA_BASE + p.replace(/^\/+/, "") : p).join("\n");
}

// Chia [from..to] thành các cửa sổ ≤ ~60 ngày (an toàn dưới hạn 3 tháng/lần của API export)
function chiaCuaSo(fromStr, toStr) {
  const win = [], end0 = new Date(toStr); let cur = new Date(fromStr);
  while (cur <= end0) {
    const e = new Date(cur); e.setDate(e.getDate() + 60);
    win.push([fmt(cur), fmt(e < end0 ? e : end0)]);
    cur = new Date(e); cur.setDate(cur.getDate() + 1);
  }
  return win;
}

// Đọc ngày (hỗ trợ "Date(y,m,d,...)", yyyy-mm-dd, dd/mm/yyyy) → Date UTC hoặc null
function parseNgay(v) {
  let m = String(v).match(/^Date\((\d+),(\d+),(\d+)/); if (m) return new Date(Date.UTC(+m[1], +m[2], +m[3]));
  m = String(v).match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return null;
}
const loadCache = () => { try { return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); } catch { return null; } };

// Danh bạ NV: dựng map (code + staff_id) → họ tên, VÀ map quy đổi mã chuẩn.
// WMS có 2 loại số cho 1 người: code (mã NV, vd 242485 — tra được trên UI) và staff_id
// (id nội bộ bảng nhân sự HR, vd 23751 — UI không tra được). Workflow lúc lưu code, lúc lưu
// staff_id -> cùng người bị tách 2 dòng trên dashboard. maChuan quy hết về CODE.
async function layDanhBaNV(token) {
  try {
    const j = await (await fetchRetry(STAFF_API, { headers: { authorization: token } })).json();
    const list = j.data || j.rows || [];
    const dir = {}, ma = {};
    for (const s of list) {
      const nm = s.staff_name || s.full_name || s.name; if (!nm) continue;
      const code = s.code != null ? String(s.code) : "";
      if (code) { dir[code] = nm; ma[code] = code; }
      if (s.staff_id != null) {
        if (dir[String(s.staff_id)] == null) dir[String(s.staff_id)] = nm;
        if (code && ma[String(s.staff_id)] == null) ma[String(s.staff_id)] = code;   // staff_id -> code
      }
    }
    log("✓ Danh bạ NV: " + Object.keys(dir).length + " mã.");
    return { dir, ma };
  } catch (e) { log("  (cảnh báo: không tải được danh bạ NV: " + e.message + ")"); return { dir: {}, ma: {} }; }
}
// Đổi chuỗi mã "23751,38125" -> "Phùng Lê Cao Minh, Mai Lê Hoàng Phi" (mã không tra được -> bỏ, KHÔNG ghi số).
const tenNVvp = (val, dir) => String(val || "").split(",").map(s => s.trim()).filter(Boolean).map(x => dir[x] || "").filter(Boolean).join(", ");
// Quy chuỗi mã về MÃ CHUẨN "23751" -> "242485" (không có trong map thì giữ nguyên).
const maChuanNV = (val, ma) => String(val || "").split(",").map(s => s.trim()).filter(Boolean).map(x => ma[x] || x).join(", ");

/* ---------- DATA-SUMMARY: đẩy JSON tính sẵn lên GitHub Pages (vai trò "server cache") ----------
   gviz của Google sinh trang MỖI LƯỢT truy cập (no-cache, độ trễ dao động tới hàng chục giây trên
   mobile) — là thủ phạm dashboard tải chậm. Máy này (đang chạy cron đồng bộ) tính sẵn toàn bộ và
   đẩy 1 file JSON tĩnh lên Pages: CDN nén gzip, phục vụ ổn định dưới 1 giây. */
function layGhToken() {
  if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) return process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  try {
    const out = execSync("git credential fill", { input: "protocol=https\nhost=github.com\n\n", encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
    const m = out.match(/password=(.+)/); return m ? m[1].trim() : null;
  } catch { return null; }
}
async function dayLenPages(tenFile, noiDung) {
  const TOKEN = layGhToken(); if (!TOKEN) throw new Error("không lấy được GitHub token");
  const api = (p, opt = {}) => fetch("https://api.github.com" + p, { ...opt, headers: { authorization: "Bearer " + TOKEN, accept: "application/vnd.github+json", "user-agent": "auto-export-sync", ...(opt.headers || {}) } });
  const g = await api(`/repos/letam0317/kiemsoatkho/contents/${tenFile}?ref=main`);
  let sha = null;
  if (g.ok) sha = (await g.json()).sha; else if (g.status !== 404) throw new Error("GET " + g.status);
  const body = { message: "data-summary " + new Date().toISOString(), content: Buffer.from(noiDung).toString("base64"), branch: "main" };
  if (sha) body.sha = sha;
  const r = await api(`/repos/letam0317/kiemsoatkho/contents/${tenFile}`, { method: "PUT", body: JSON.stringify(body) });
  if (!r.ok) throw new Error("PUT " + r.status);
}

/* ---------- QUÉT "BÁO CÁO ĐẠT KHỐNG": ảnh khắc phục trắng/đen toàn phần ----------
   Task có "B4.1 ▸ Xác nhận khắc phục" = Đạt nhưng ảnh khắc phục ĐƠN SẮC (đen/trắng toàn
   phần) => nghi báo cáo khống. Mỗi URL chỉ tải & phân tích ĐÚNG 1 LẦN — kết quả cache
   vĩnh viễn trong .exports/anh-check-cache.json (ảnh trên hr-media là bất biến). */
async function checkSolidColorImage(url) {
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 5000);   // timeout 5s
  try {
    const r = await fetch(url, { signal: ac.signal });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const { Jimp } = await import("jimp");
    const img = await Jimp.read(buf);
    img.resize({ w: 32, h: 32 });
    const d = img.bitmap.data; let tong = 0, tong2 = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; tong += g; tong2 += g * g; n++; }
    const mean = tong / n, std = Math.sqrt(Math.max(0, tong2 / n - mean * mean));
    return { solid: std < 10 && (mean > 235 || mean < 20), mean: Math.round(mean), std: Math.round(std) };
  } catch { return null; }                                  // URL lỗi/timeout -> bỏ qua
  finally { clearTimeout(to); }
}
async function quetAnhKhong(byCode, header) {
  const ANH_CACHE = path.join(EXPORT_DIR, "anh-check-cache.json");
  const iKP2 = header.findIndex(h => h === "B4.1 Audit kiểm tra khắc phục ▸ Xác nhận khắc phục");
  const iA1 = header.findIndex(h => /^B2\.1 .*Hình ảnh khắc phục/.test(h));
  const iA2 = header.findIndex(h => /^B1\.1 .*khắc phục/.test(h));
  if (iKP2 < 0) return [];
  let cache = {}; try { cache = JSON.parse(fs.readFileSync(ANH_CACHE, "utf8")); } catch {}
  let daTai = 0; const KQ = [];
  for (const [code, r] of byCode.entries()) {
    if (String(r[iKP2] || "").trim() !== "Đạt") continue;
    const urls = [iA1, iA2].filter(i => i >= 0)
      .flatMap(i => String(r[i] || "").split(/[\n,\s]+/))
      .filter(u => /^https?:.*\.(jpe?g|png|webp)(\?|$)/i.test(u));
    const khong = [];
    for (const u of urls) {
      if (cache[u] === undefined) {
        if (daTai >= 40) continue;                          // trần 40 ảnh MỚI/lượt — không kéo dài phiên đồng bộ
        daTai++;
        const kq = await checkSolidColorImage(u);
        cache[u] = kq ? { solid: kq.solid, mean: kq.mean, std: kq.std } : { solid: false, loi: 1 };
      }
      if (cache[u] && cache[u].solid) khong.push(u);
    }
    if (khong.length) KQ.push({ code, urls: khong });
  }
  try { fs.writeFileSync(ANH_CACHE, JSON.stringify(cache)); } catch {}
  log("  ✓ Quét ảnh khống: tải mới " + daTai + " ảnh; nghi 'Đạt khống': " + KQ.length + " task.");
  return KQ;
}

/* ---------- BÌNH LUẬN TASK: GET /api/v2/task/comment?obj_id=<task_id> ----------
   Endpoint chính trang WMS dùng (bắt được qua phiên thật). Task ĐANG MỞ: làm mới mỗi lượt;
   task ĐÃ ĐÓNG: lấy 1 lần rồi cache vĩnh viễn (.exports/comments-cache.json). */
async function layBinhLuan(token, byCode, header) {
  const CMT_CACHE = path.join(EXPORT_DIR, "comments-cache.json");
  const iLink = header.findIndex(h => h === "Link Task");
  const iSt = header.findIndex(h => h === "Status");
  if (iLink < 0) return {};
  let cache = {}; try { cache = JSON.parse(fs.readFileSync(CMT_CACHE, "utf8")); } catch {}
  const CMT_TTL_MS = 3 * 24 * 3600 * 1000;   // task ĐÓNG: làm mới bình luận tối đa 3 ngày/lần (bắt bình luận muộn)
  const viec = [];
  for (const [code, r] of byCode.entries()) {
    const m = String(r[iLink] || "").match(/task_id=(\d+)/); if (!m) continue;
    const id = m[1];
    const dong = laTerminal(r[iSt]);                    // dùng chuẩn terminal chung (finished/canceled/cancelled/failed)
    const c = cache[id];
    // Task ĐÓNG đã có cache & còn "tươi" (<3 ngày) -> bỏ qua; quá hạn -> refresh 1 lần để bắt bình luận muộn.
    // Task ĐANG MỞ -> luôn refresh.
    if (dong && c && c.taiLuc && (Date.now() - c.taiLuc) < CMT_TTL_MS) continue;
    viec.push({ code, id });
  }
  let goi = 0;
  const chay = async ({ id }) => {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 6000);
    try {
      const r = await fetchRetry("https://wshr.hasaki.vn/api/v2/task/comment?obj_id=" + id, { headers: { authorization: token }, signal: ac.signal });
      if (!r.ok) return;
      const j = await r.json();
      const rows = (Array.isArray(j.data) ? j.data : []).map(c => ({
        ten: (c.user && (c.user.name || (c.user.staff && c.user.staff.staff_name))) || ("User " + c.user_id),
        ma: (c.user && c.user.staff && c.user.staff.code) || "",
        luc: c.created_at || "", nd: c.comment || "", files: c.file || [],
      }));
      cache[id] = { taiLuc: Date.now(), rows }; goi++;   // taiLuc: mốc để tính TTL refresh task đóng
    } catch {} finally { clearTimeout(t); }
  };
  // 4 luồng/đợt + nghỉ 400ms giữa các đợt — không dội đồng loạt lên wshr (chống tự DDOS nội bộ)
  for (let i = 0; i < viec.length; i += 4) {
    await Promise.all(viec.slice(i, i + 4).map(chay));
    if (i + 4 < viec.length) await new Promise(r => setTimeout(r, 400));
  }
  try { fs.writeFileSync(CMT_CACHE, JSON.stringify(cache)); } catch {}
  const out = {};
  for (const [code, r] of byCode.entries()) {
    const m = String(r[iLink] || "").match(/task_id=(\d+)/); if (!m) continue;
    const c = cache[m[1]];
    if (c && c.rows && c.rows.length) out[code] = c.rows;
  }
  log("  ✓ Bình luận: gọi API " + goi + " task; có bình luận: " + Object.keys(out).length + " task.");
  return out;
}

// Xác định khoảng ngày CẦN export hôm nay:
//  - Mặc định: 45 ngày gần nhất (bắt task mới + task bị mở lại trong 45 ngày).
//  - Mở rộng lùi về: ngày sớm nhất của các task CÒN SỐNG (Processing/None) → task chưa xong luôn được refresh dù cũ.
//  - Không cache / FULL_RESYNC / có task sống thiếu ngày → chạy full từ SYNC_FROM cho chắc.
function tinhKhoang(cache) {
  const today = new Date();
  const roll = new Date(today); roll.setDate(roll.getDate() - ROLL_DAYS);
  // Chưa có kho, ép full, hoặc kho DỞ (lần full trước có cửa sổ lỗi) → dựng lại full cho tới khi sạch.
  if (FULL_RESYNC || !cache || !cache.header || !cache.rows || cache.complete === false)
    return { from: SYNC_FROM, to: fmt(today), full: true };
  const H = cache.header;
  const si = H.findIndex(h => h === "Status");                                  // cột trạng thái chính (index 3)
  const ci = H.findIndex(h => String(h || "").toLowerCase().includes("created at")); // cột ngày để chia cửa sổ
  let earliest = roll, active = 0, thieuNgay = 0;
  for (const code in cache.rows) {
    const row = cache.rows[code];
    // Bỏ qua, không export lại các task đã ở trạng thái đóng (Terminal)
    if (si >= 0 && laTerminal(row[si])) continue;
    active++;
    const d = ci >= 0 ? parseNgay(row[ci]) : null;
    if (d) { if (d < earliest) earliest = d; } else thieuNgay++;
  }
  if (thieuNgay > 0) return { from: SYNC_FROM, to: fmt(today), full: true, note: ` (${thieuNgay} task sống thiếu ngày → full cho chắc)` };
  return { from: fmt(earliest), to: fmt(today), full: false, active };
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

const dsExport = async (token) => ((await (await fetchRetry(API, { headers: { authorization: token } })).json()).data?.rows || []);

// Queue 1 cửa sổ + chờ tới khi job (khớp from/to) có file_path
async function xuatMotCuaSo(token, from, to) {
  const fd = new FormData();
  fd.append("param[from_date]", from); fd.append("param[to_date]", to);
  fd.append("param[search_type]", "board"); fd.append("param[wfid]", WORKFLOW_ID); fd.append("type", "6");
  await fetchRetry(API + "/export", { method: "POST", headers: { authorization: token }, body: fd });
  log("  queue " + from + " → " + to + ", chờ xử lý...");
  for (let i = 0; i < 100; i++) {   // tối đa ~300s (job export WMS có lúc chậm)
    await new Promise(r => setTimeout(r, 3000));
    const job = (await dsExport(token)).find(r => r.param && r.param.from_date === from && r.param.to_date === to && r.type === 6);
    if (job && job.status === 1 && job.file_path) return job.file_path;
    if (job && job.status === 0 && job.log && job.log.message) throw new Error("Job lỗi: " + job.log.message);
  }
  throw new Error("Quá thời gian chờ job (" + from + ").");
}

async function taiVaDoc(filePath) {
  const buf = Buffer.from(await (await fetchRetry(FILE_BASE + filePath.replace(/^\/+/, ""))).arrayBuffer());
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
  const token = await layTokenTuPhucHoi(getToken, DIR, log, "work").catch(e => { log("✗ " + e.message); process.exit(2); });
  log("✓ Đã lấy token.");
  const { dir: nvDir, ma: nvMa } = await layDanhBaNV(token);   // danh bạ NV: mã → tên, và staff_id → mã chuẩn

  // Nạp KHO BỀN VỮNG (cache): task terminal cũ giữ nguyên, không export lại.
  // LUÔN seed từ cache (kể cả FULL) → cửa sổ nào export lỗi vẫn giữ dữ liệu cũ, KHÔNG mất task.
  const cache = loadCache();
  let header = null; const byCode = new Map();
  if (cache && cache.rows) {
    header = cache.header || null;
    for (const c in cache.rows) byCode.set(c, cache.rows[c]);
  }
  const rg = tinhKhoang(cache);
  const windows = chiaCuaSo(rg.from, rg.to);
  log((rg.full ? "FULL" : "Tăng dần") + " — cửa sổ " + rg.from + ".." + rg.to +
      (rg.note || "") + (rg.active != null ? " (" + rg.active + " task còn sống, " + byCode.size + " task trong kho)" : "") +
      " → " + windows.length + " lần export ≤3 tháng.");

  let moi = 0, loi = 0;
  for (const [from, to] of windows) {
    let aoa;
    try { aoa = await taiVaDoc(await xuatMotCuaSo(token, from, to)); }
    catch (e) {
      log("  ⚠ " + e.message + " — thử lại 1 lần...");
      try { aoa = await taiVaDoc(await xuatMotCuaSo(token, from, to)); }
      catch (e2) { loi++; log("  ✗ " + e2.message + " (giữ dữ liệu cũ của cửa sổ này)"); continue; }
    }
    if (!aoa || aoa.length < 2) { log("  (cửa sổ rỗng)"); continue; }
    const nhom = aoa[0] || [], ten = aoa[1] || [];
    const soCot = Math.max(nhom.length, ten.length, ...aoa.slice(2).map(r => r.length));
    let nhomHT = ""; const h = [];
    for (let i = 0; i < soCot; i++) { if (String(nhom[i] || "").trim()) nhomHT = String(nhom[i]).trim(); h.push(nhomHT && i >= 6 ? (nhomHT + " ▸ " + String(ten[i] || "").trim()) : String(ten[i] || "").trim()); }
    if (!header || h.length > header.length) header = h;
    let n = 0;
    for (const r of aoa.slice(2)) {
      const code = String(r[0] || "").trim(); if (!code) continue;
      byCode.set(code, Array.from({ length: soCot }, (_, i) => convMedia(r[i] != null ? r[i] : "")));   // upsert theo Task Code (đè dòng cũ)
      n++;
    }
    moi += n;
    log("  ✓ " + from + ".." + to + ": refresh " + n + " task (kho: " + byCode.size + ").");
  }

  if (!header || !byCode.size) { log("✗ Không lấy được dữ liệu."); process.exit(2); }
  // Cờ "kho hoàn chỉnh": FULL mà mọi cửa sổ OK → complete. FULL còn lỗi → complete=false (lần sau tự chạy full lại).
  // Incremental thì kế thừa trạng thái kho nền (lỗi cửa sổ gần đây không phá tính hoàn chỉnh của phần đã đóng băng).
  const complete = rg.full ? (loi === 0) : (cache ? cache.complete !== false : true);
  // KHO TÊN NV BỀN VỮNG: giữ mọi tên đã từng tra được (kể cả NV đã nghỉ, rời danh bạ) → xem lại dữ liệu cũ luôn có tên.
  // Ưu tiên tên MỚI từ danh bạ hiện tại; mã không còn trong danh bạ thì dùng tên đã lưu trước đó.
  const persist = (cache && cache.nvNames) || {};
  const resolver = Object.assign({}, persist, nvDir);   // danh bạ hiện tại đè tên cũ; tên cũ được giữ nếu mã đã rời danh bạ
  // KHO MÃ CHUẨN BỀN VỮNG: giữ mọi quy đổi staff_id→code đã biết (NV nghỉ vẫn quy đúng)
  const persistMa = (cache && cache.nvCodes) || {};
  const maResolver = Object.assign({}, persistMa, nvMa);
  const nvIdx = header.findIndex(h => nhanCuoi(h).toLowerCase() === "nhân viên vi phạm");
  // GIỮ cột "Biên bản" đã có trên 5S-TASKS (đọc theo Task Code) để không mất khi ghi đè.
  const SID = "1FWffWi75aATbokfqIcqjByEPzkJLQBngTXp5aPOIbLM";
  const bbByCode = {};
  try {
    const t = await (await fetch("https://docs.google.com/spreadsheets/d/" + SID + "/gviz/tq?sheet=5S-TASKS&headers=1&tqx=out:json")).text();
    const tab = JSON.parse(t.match(/\{[\s\S]*\}/)[0]).table;
    const cols = (tab.cols || []).map(c => c.label || "");
    const iC = cols.findIndex(h => /task code/i.test(h)), iB = cols.findIndex(h => /^biên bản$/i.test(h));
    if (iC >= 0 && iB >= 0) (tab.rows || []).forEach(rr => { const c = rr.c || []; const code = c[iC] && c[iC].v != null ? String(c[iC].v).trim() : ""; const bb = c[iB] && c[iB].v != null ? String(c[iB].v) : ""; if (code && bb) bbByCode[code] = bb; });
    log("  Giữ " + Object.keys(bbByCode).length + " biên bản đã có.");
  } catch { log("  (chưa có cột Biên bản trên 5S-TASKS - sẽ tạo mới)"); }
  const outHeader = [...header, "Tên NV vi phạm", "Mã NV chuẩn", "Biên bản"];
  const rows = [...byCode.entries()].map(([code, r]) => {
    const base = Array.from({ length: header.length }, (_, i) => (r[i] != null ? r[i] : ""));
    base.push(nvIdx >= 0 ? tenNVvp(base[nvIdx], resolver) : "");
    // Mã NV CHUẨN: quy staff_id nội bộ (vd 23751) về mã NV (vd 242485) — dashboard nhóm theo cột này
    // (tiền tố ' để Sheets/gviz giữ nguyên chuỗi, không nuốt dấu phẩy thành số)
    const mc = nvIdx >= 0 ? maChuanNV(base[nvIdx], maResolver) : "";
    base.push(mc ? "'" + mc : "");
    base.push(bbByCode[code] || "");
    // CHỐNG SHEETS NUỐT DẤU PHẨY + CHỐNG GVIZ MIXED-TYPE:
    //  - "260997,251308" bị Sheets hiểu là SỐ 260997251308 (phẩy = hàng nghìn) -> mất tách mã.
    //  - Nếu chỉ vài ô là text còn đa số là số -> gviz gán kiểu cột = số và trả ô text về RỖNG.
    //  => Ép CẢ CỘT thành text bằng tiền tố ' (chuẩn Sheets, không hiển thị) — mọi ô cùng kiểu chuỗi.
    if (nvIdx >= 0 && String(base[nvIdx] || "").trim() !== "") {
      const cds = String(base[nvIdx]).split(",").map(s => s.trim()).filter(Boolean);
      base[nvIdx] = "'" + cds.join(", ");
    }
    return base;
  });
  // Tích luỹ vào kho tên: mọi mã NV xuất hiện + tra được -> lưu lại vĩnh viễn.
  if (nvIdx >= 0) for (const r of byCode.values())
    String(r[nvIdx] || "").split(",").map(s => s.trim()).filter(Boolean).forEach(cd => {
      if (resolver[cd]) persist[cd] = resolver[cd];
      if (maResolver[cd]) persistMa[cd] = maResolver[cd];
    });
  // Lưu cache = dữ liệu THÔ + kho tên NV (nvNames) + kho mã chuẩn (nvCodes) bền vững.
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ header, complete, nvNames: persist, nvCodes: persistMa, rows: Object.fromEntries(byCode), updatedAt: new Date().toISOString() }));
  } catch (e) { log("  (cảnh báo: không lưu được cache: " + e.message + ")"); }
  if (loi > 0) log("  ⚠ " + loi + " cửa sổ export lỗi → kho đánh dấu CHƯA hoàn chỉnh, lần chạy sau sẽ tự dựng lại full.");
  log("  Kho tên NV bền vững: " + Object.keys(persist).length + " mã.");
  const daTra = rows.filter(r => /\p{L}/u.test(String(r[header.length]))).length;   // cột "Tên NV vi phạm" (trước cột Biên bản)
  // CHẶN GHI RỖNG: 0 dòng -> KHÔNG POST (tránh clear sheet rồi ghi lại chỉ mỗi header/timestamp)
  if (!rows.length) { log("✗ 0 task để ghi — BỎ QUA POST (không xoá trắng 5S-TASKS)."); process.exit(0); }
  log("→ Ghi " + rows.length + " task (" + outHeader.length + " cột, refresh " + moi + ", " + daTra + " dòng có tên NV) vào 5S-TASKS...");
  // apiAt = mốc LẤY DỮ LIỆU TỪ API WMS (vừa export xong) — dashboard hiện chip "Dữ liệu · HH:MM" theo mốc này
  const apiAtMs = Date.now();
  const res = await fetchRetry(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, header: outHeader, rows, apiAt: apiAtMs }) });
  let j = {}; try { j = JSON.parse(await res.text()); } catch {}
  log(j.status === "success" ? "✓ Đã ghi " + j.written + " dòng lúc " + j.at : "✗ Ghi tab thất bại: " + JSON.stringify(j).slice(0, 200));

  // ==== DATA-SUMMARY theo THÁNG (kiến trúc 3 năm không nghẽn) ====
  //      Chia rows theo tháng "Ngày vi phạm" -> summary/YYYY-MM.json + summary/index.json.
  //      Dashboard nạp index + tháng hiện tại (TTFB nhanh), tháng cũ tải theo yêu cầu.
  //      Chỉ ĐẨY chunk có thay đổi (so nội dung với bản cục bộ) -> steady-state ~1-3 file/lượt.
  try {
    let anhKhong = [];
    try { anhKhong = await quetAnhKhong(byCode, header); }
    catch (e) { log("  (cảnh báo quét ảnh: " + e.message + ")"); }
    let binhLuan = {};
    try { binhLuan = await layBinhLuan(token, byCode, header); }
    catch (e) { log("  (cảnh báo bình luận: " + e.message + ")"); }
    const sRows = rows.map(r => r.map(v => (typeof v === "string" && v.charAt(0) === "'") ? v.slice(1) : v));

    const iNVP = outHeader.findIndex(h => /Ngày vi phạm/i.test(h));
    const iCreated = outHeader.findIndex(h => /Created At/i.test(h));
    const iCodeC = outHeader.findIndex(h => /^task code$/i.test(h));
    const thangCua = (r) => { const d = parseNgay(r[iNVP]) || parseNgay(r[iCreated]); return d ? d.toISOString().slice(0, 7) : "khac"; };
    const nhomThang = {};
    sRows.forEach(r => { const k = thangCua(r); (nhomThang[k] = nhomThang[k] || []).push(r); });

    const LOCAL_DIR = path.join(EXPORT_DIR, "summary");
    try { fs.mkdirSync(LOCAL_DIR, { recursive: true }); } catch {}
    const codesTrongThang = (rs) => new Set(rs.map(r => String(r[iCodeC] || "")));
    let dayLen = 0;
    const thangSap = Object.keys(nhomThang).sort();
    for (const th of thangSap) {
      const rs = nhomThang[th];
      const codeSet = codesTrongThang(rs);
      const akT = anhKhong.filter(x => codeSet.has(String(x.code)));
      const blT = {}; Object.keys(binhLuan).forEach(c => { if (codeSet.has(String(c))) blT[c] = binhLuan[c]; });
      const noiDung = JSON.stringify({ apiAt: apiAtMs, thang: th, header: outHeader, rows: rs, anhKhong: akT, binhLuan: blT });
      const fLocal = path.join(LOCAL_DIR, th + ".json");
      let cu = ""; try { cu = fs.readFileSync(fLocal, "utf8"); } catch {}
      // bỏ apiAt khi so sánh (apiAt đổi mỗi lượt) -> chỉ đẩy khi DỮ LIỆU tháng đổi
      const boApiAt = (s) => s.replace(/"apiAt":\d+,/, "");
      fs.writeFileSync(fLocal, noiDung);
      if (boApiAt(cu) !== boApiAt(noiDung)) { await dayLenPages(SUMMARY_DIR + "/" + th + ".json", noiDung); dayLen++; }
    }
    // index.json: danh sách tháng + tổng số + apiAt (luôn đẩy, rất nhẹ)
    const index = JSON.stringify({
      apiAt: apiAtMs, taiLuc: new Date().toISOString(), header: outHeader,
      thang: thangSap.slice().reverse(),                    // mới nhất trước
      soTask: Object.fromEntries(thangSap.map(t => [t, nhomThang[t].length])),
    });
    fs.writeFileSync(path.join(LOCAL_DIR, "index.json"), index);
    await dayLenPages(SUMMARY_DIR + "/index.json", index);
    log("  ✓ Chunk theo tháng → Pages: " + thangSap.length + " tháng, đẩy " + (dayLen + 1) + " file thay đổi (index + " + dayLen + " chunk).");
  } catch (e) { log("  (cảnh báo: không đẩy được chunk theo tháng: " + e.message + " — dashboard tự dùng gviz như cũ)"); }
  // giữ 3 file .xlsx gần nhất
  const all = fs.readdirSync(EXPORT_DIR).filter(f => /\.xlsx$/i.test(f)).map(f => ({ f, t: fs.statSync(path.join(EXPORT_DIR, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  all.slice(3).forEach(x => { try { fs.rmSync(path.join(EXPORT_DIR, x.f), { force: true }); } catch {} });
  await new Promise(r => setTimeout(r, 200));
  process.exit(0);
})().catch(e => { log("✗ " + e.message); process.exit(2); });
