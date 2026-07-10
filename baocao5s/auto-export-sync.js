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
const laTerminal = (v) => /^(finished|canceled|cancelled|failed)$/i.test(String(v).trim()); // đã xong/huỷ/thất bại → không refresh nữa
const STAFF_API = "https://wshr.hasaki.vn/api/news/staff/search-for-dropdown?limit=10000&sort=staff_id"; // danh bạ NV (id/code → họ tên)
const nhanCuoi = (h) => String(h || "").split("▸").pop().trim();
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

// Danh bạ NV: dựng map (code + staff_id) → họ tên đầy đủ để đổi "Nhân viên vi phạm" từ mã số sang tên.
async function layDanhBaNV(token) {
  try {
    const j = await (await fetch(STAFF_API, { headers: { authorization: token } })).json();
    const list = j.data || j.rows || [];
    const dir = {};
    for (const s of list) {
      const nm = s.staff_name || s.full_name || s.name; if (!nm) continue;
      if (s.code != null) dir[String(s.code)] = nm;                                   // mã NV (đa số khớp field này)
      if (s.staff_id != null && dir[String(s.staff_id)] == null) dir[String(s.staff_id)] = nm;
    }
    log("✓ Danh bạ NV: " + Object.keys(dir).length + " mã.");
    return dir;
  } catch (e) { log("  (cảnh báo: không tải được danh bạ NV: " + e.message + ")"); return {}; }
}
// Đổi chuỗi mã "23751,38125" -> "Phùng Lê Cao Minh, Mai Lê Hoàng Phi" (mã không tra được -> bỏ, KHÔNG ghi số).
const tenNVvp = (val, dir) => String(val || "").split(",").map(s => s.trim()).filter(Boolean).map(x => dir[x] || "").filter(Boolean).join(", ");

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
    if (si >= 0 && laTerminal(row[si])) continue;   // terminal → đóng băng, bỏ qua
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

const dsExport = async (token) => ((await (await fetch(API, { headers: { authorization: token } })).json()).data?.rows || []);

// Queue 1 cửa sổ + chờ tới khi job (khớp from/to) có file_path
async function xuatMotCuaSo(token, from, to) {
  const fd = new FormData();
  fd.append("param[from_date]", from); fd.append("param[to_date]", to);
  fd.append("param[search_type]", "board"); fd.append("param[wfid]", WORKFLOW_ID); fd.append("type", "6");
  await fetch(API + "/export", { method: "POST", headers: { authorization: token }, body: fd });
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
  const token = await layTokenTuPhucHoi(getToken, DIR, log, "work").catch(e => { log("✗ " + e.message); process.exit(2); });
  log("✓ Đã lấy token.");
  const nvDir = await layDanhBaNV(token);   // danh bạ NV để đổi mã → họ tên

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
  } catch (e) { log("  (chưa có cột Biên bản trên 5S-TASKS - sẽ tạo mới)"); }
  const outHeader = [...header, "Tên NV vi phạm", "Biên bản"];
  const rows = [...byCode.entries()].map(([code, r]) => {
    const base = Array.from({ length: header.length }, (_, i) => (r[i] != null ? r[i] : ""));
    base.push(nvIdx >= 0 ? tenNVvp(base[nvIdx], resolver) : "");
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
    String(r[nvIdx] || "").split(",").map(s => s.trim()).filter(Boolean).forEach(cd => { if (resolver[cd]) persist[cd] = resolver[cd]; });
  // Lưu cache = dữ liệu THÔ + kho tên NV bền vững (nvNames).
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ header, complete, nvNames: persist, rows: Object.fromEntries(byCode), updatedAt: new Date().toISOString() }));
  } catch (e) { log("  (cảnh báo: không lưu được cache: " + e.message + ")"); }
  if (loi > 0) log("  ⚠ " + loi + " cửa sổ export lỗi → kho đánh dấu CHƯA hoàn chỉnh, lần chạy sau sẽ tự dựng lại full.");
  log("  Kho tên NV bền vững: " + Object.keys(persist).length + " mã.");
  const daTra = rows.filter(r => /\p{L}/u.test(String(r[header.length]))).length;   // cột "Tên NV vi phạm" (trước cột Biên bản)
  log("→ Ghi " + rows.length + " task (" + outHeader.length + " cột, refresh " + moi + ", " + daTra + " dòng có tên NV) vào 5S-TASKS...");
  const res = await fetch(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, header: outHeader, rows }) });
  let j = {}; try { j = JSON.parse(await res.text()); } catch {}
  log(j.status === "success" ? "✓ Đã ghi " + j.written + " dòng lúc " + j.at : "✗ Ghi tab thất bại: " + JSON.stringify(j).slice(0, 200));
  // giữ 3 file .xlsx gần nhất
  const all = fs.readdirSync(EXPORT_DIR).filter(f => /\.xlsx$/i.test(f)).map(f => ({ f, t: fs.statSync(path.join(EXPORT_DIR, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  all.slice(3).forEach(x => { try { fs.rmSync(path.join(EXPORT_DIR, x.f), { force: true }); } catch {} });
  await new Promise(r => setTimeout(r, 200));
  process.exit(0);
})().catch(e => { log("✗ " + e.message); process.exit(2); });
