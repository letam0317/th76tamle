/**
 * bo-sung-sku-comment.mjs — BỔ SUNG MÃ SẢN PHẨM vào BÌNH LUẬN các task 5S ĐÃ TẠO trên work.hasaki.vn.
 * ====================================================================================================
 * Vì sao: form ghi nhận 5S có ô "Mã sản phẩm" (quét barcode) từ 17/07/2026, dữ liệu nằm đủ ở cột 8
 * tab WMS-5S-AUDIT, nhưng apiPendingData_ (SO_COT=7) không trả cột này và bộ đẩy cũng không gửi —
 * nên mọi task đã tạo đều THIẾU mã SP. Bản vá 03/09/2026 ghép mã vào Mô tả cho task MỚI; tool này
 * quét ngược task CŨ (kể cả đã Finished/Failed/Canceled) và bổ sung 1 bình luận.
 *
 * Nguồn dữ liệu (không tốn lượt GAS, không tốn export wshr):
 *   - Tab WMS-5S-AUDIT đọc qua gviz public (cột A ngày, F mã task, H mã SP).
 *   - Map mã task (HSK-…) → task_id: .exports/tasks-cache.json của auto-export-sync (cột "Link Task").
 *   - Tra mã SP → SKU/tên/ảnh: tra-sku-hasaki.mjs (ô tìm kiếm hasaki.vn, có cache).
 *
 * Chống ghi trùng 2 lớp: (1) GET bình luận task, thấy marker "Mã SP quét:" là bỏ qua;
 * (2) sổ .exports/sku-cmt-done.json ghi code đã bổ sung — chạy lại không đè.
 *
 * Chạy:
 *   node bo-sung-sku-comment.mjs --thu           # DIỄN TẬP: chỉ liệt kê sẽ bổ sung gì, không POST
 *   node bo-sung-sku-comment.mjs                 # chạy thật
 *   node bo-sung-sku-comment.mjs --gioihan=5     # chỉ xử lý N task đầu (chạy thăm dò)
 * Phiên hết hạn: node login-hasaki.js rồi chạy lại.
 */
import puppeteer from "puppeteer";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { layTokenTuPhucHoi } from "./auto-login.js";
import { EDGE_PATH, duongDanProfile } from "./token-store.js";
import { traCuuSanPham, dongMoTaSP } from "./tra-sku-hasaki.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = duongDanProfile(DIR);
const WORKFLOW_ID = process.env.WORKFLOW_ID || "591";
const SHEET_ID = "1FWffWi75aATbokfqIcqjByEPzkJLQBngTXp5aPOIbLM";   // sheet public 5S (anyone reader)
const TAB = "WMS-5S-AUDIT";
const TASKS_CACHE = path.join(DIR, ".exports", "tasks-cache.json");
const DONE_FILE = path.join(DIR, ".exports", "sku-cmt-done.json");
const API_CMT = "https://wshr.hasaki.vn/api/v2/task/comment";
const MARKER = "Mã SP quét:";      // trùng với dongMoTaSP — đổi là vỡ dedupe

const THU = process.argv.includes("--thu");
const GIOI_HAN = (() => { const a = process.argv.find((x) => x.startsWith("--gioihan=")); return a ? parseInt(a.split("=")[1], 10) : 0; })();
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- 1) Đọc tab audit qua gviz (public — 0 lượt GAS) ---------------- */
async function docTabAudit() {
  const url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?sheet=" + encodeURIComponent(TAB) + "&headers=1&tqx=out:json";
  let r = null, loi = null;
  for (let i = 0; i < 3 && !r; i++) {                          // mạng chập chờn: backoff 2s→6s
    try { r = await fetch(url, { signal: AbortSignal.timeout(45000) }); }
    catch (e) { loi = e; if (i < 2) await nghi(2000 * (i * 2 + 1)); }
  }
  if (!r) throw new Error("Không kéo được gviz sau 3 lần: " + (loi && loi.message));
  const t = await r.text();
  const j = JSON.parse(t.slice(t.indexOf("(") + 1, t.lastIndexOf(")")));
  const cols = j.table.cols.map((c) => c.id);                  // 'A','B',…
  const iA = cols.indexOf("A"), iF = cols.indexOf("F"), iH = cols.indexOf("H");
  const rows = [];
  for (const rw of j.table.rows) {
    const v = (i) => (i >= 0 && rw.c[i] && rw.c[i].v != null ? rw.c[i].v : "");
    const maTask = String(v(iF)).trim();
    const maSP = String(v(iH)).trim();
    if (!maTask || !/^HSK-/i.test(maTask) || !maSP) continue;  // chỉ dòng đã có task THẬT + có mã SP
    // "Date(2026,6,17,8,43,8)" — tháng 0-based
    let ngay = "";
    const m = String(v(iA)).match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+))?/);
    if (m) ngay = `${String(+m[3]).padStart(2, "0")}/${String(+m[2] + 1).padStart(2, "0")}/${m[1]}` + (m[4] != null ? ` ${String(+m[4]).padStart(2, "0")}:${String(+m[5]).padStart(2, "0")}` : "");
    rows.push({ maTask, maSP, ngay });
  }
  return rows;
}

/* ---------------- 2) Map mã task → task_id từ kho export sẵn có ---------------- */
function mapTaskId() {
  let cache = null;
  try { cache = JSON.parse(fs.readFileSync(TASKS_CACHE, "utf8")); } catch { /* thiếu kho */ }
  if (!cache || !cache.header || !cache.rows) throw new Error("Thiếu .exports/tasks-cache.json — chạy auto-export-sync.js trước.");
  const iLink = cache.header.findIndex((h) => h === "Link Task");
  const iSt = cache.header.findIndex((h) => h === "Status");
  const map = {};
  for (const [code, r] of Object.entries(cache.rows)) {
    const m = String(r[iLink] || "").match(/task_id=(\d+)/);
    if (m) map[code] = { id: m[1], status: String(r[iSt] || "") };
  }
  return map;
}

/* ---------------- 3) Token work (mượn phiên Edge như push-5s) ---------------- */
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
    for (let i = 0; i < 12 && !token; i++) await nghi(1000);
    if (/auth\/login/.test(page.url()) || !token) throw new Error("Phiên work.hasaki.vn hết hạn — chạy node login-hasaki.js.");
    return token;
  } finally { await browser.close().catch(() => {}); }
}

/* ---------------- 4) Bình luận: đọc + gửi ---------------- */
async function docBinhLuan(token, id) {
  const r = await fetch(API_CMT + "?obj_id=" + id, { headers: { authorization: token }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) return null;                                     // null = không đọc được (khác mảng rỗng)
  const t = await r.text(); if (t[0] !== "{") return null;
  const j = JSON.parse(t);
  return (Array.isArray(j.data) ? j.data : []).map((c) => String(c.comment || c.content || ""));
}

/* POST bình luận. Dạng body chưa có tài liệu — thử lần lượt các dạng ứng viên trên TASK ĐẦU TIÊN,
   xác nhận bằng cách GET lại thấy marker mới tin; khoá dạng thắng cho các task sau. */
let DANG_THANG = null;
const UNG_VIEN = [
  { ten: "form obj_id+comment", lam: (id, text) => { const fd = new FormData(); fd.set("obj_id", id); fd.set("comment", text); return { body: fd }; } },
  { ten: "form obj_id+content", lam: (id, text) => { const fd = new FormData(); fd.set("obj_id", id); fd.set("content", text); return { body: fd }; } },
  { ten: "json obj_id+comment", lam: (id, text) => ({ body: JSON.stringify({ obj_id: id, comment: text }), headers: { "content-type": "application/json" } }) },
  { ten: "form +obj_type=task", lam: (id, text) => { const fd = new FormData(); fd.set("obj_id", id); fd.set("comment", text); fd.set("obj_type", "task"); return { body: fd }; } },
];
async function guiBinhLuan(token, id, text) {
  const cand = DANG_THANG ? [DANG_THANG] : UNG_VIEN;
  for (const c of cand) {
    const { body, headers } = c.lam(id, text);
    let http = 0, raw = "";
    try {
      const r = await fetch(API_CMT, {
        method: "POST", body,
        headers: { authorization: token, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/", ...(headers || {}) },
        signal: AbortSignal.timeout(20000),
      });
      http = r.status; raw = (await r.text()).slice(0, 200);
    } catch (e) { raw = String(e.message); }
    if (http === 401 || http === 403) throw new Error("Token bị từ chối (HTTP " + http + ") — dừng.");
    await nghi(800);
    const ds = await docBinhLuan(token, id);
    if (ds && ds.some((x) => x.includes(MARKER))) {
      if (!DANG_THANG) { DANG_THANG = c; log("  ✓ Dạng POST bình luận dùng được: " + c.ten); }
      return true;
    }
    if (!DANG_THANG) log("  … thử dạng «" + c.ten + "» chưa ăn (HTTP " + http + "): " + raw);
  }
  return false;
}

/* ------------------------------- MAIN ------------------------------- */
(async () => {
  log((THU ? "[DIỄN TẬP] " : "") + "Bổ sung mã SP vào bình luận task 5S — workflow " + WORKFLOW_ID);
  let rows, map;
  try { rows = await docTabAudit(); map = mapTaskId(); }
  catch (e) { log("✗ " + e.message); process.exit(2); }
  let done = {}; try { done = JSON.parse(fs.readFileSync(DONE_FILE, "utf8")); } catch { /* chưa có sổ */ }

  // Gom theo mã task (1 task chỉ 1 bình luận, kể cả sheet có 2 dòng cùng task)
  const theoTask = new Map();
  for (const r of rows) if (!theoTask.has(r.maTask)) theoTask.set(r.maTask, r);
  let viec = [...theoTask.values()].filter((r) => !done[r.maTask]);
  const thieuId = viec.filter((r) => !map[r.maTask]);
  viec = viec.filter((r) => map[r.maTask]);
  if (GIOI_HAN > 0) viec = viec.slice(0, GIOI_HAN);
  log("→ Sheet có " + rows.length + " dòng (task + mã SP); cần xử lý " + viec.length + " task" +
    (thieuId.length ? "; KHÔNG map được id: " + thieuId.map((x) => x.maTask).join(", ") : ""));
  if (!viec.length) { log("Không có gì để bổ sung. Xong."); process.exit(0); }

  let token = null;
  if (!THU) {
    try { token = await layTokenTuPhucHoi(getToken, DIR, log, "work"); log("✓ Đã lấy token."); }
    catch (e) { log("✗ " + e.message); process.exit(2); }
  }

  let ok = 0, bo = 0, loi = 0;
  for (const r of viec) {
    const { id, status } = map[r.maTask];
    const sp = await traCuuSanPham(r.maSP);
    const text = "Bổ sung từ form ghi nhận 5S" + (r.ngay ? " (" + r.ngay + ")" : "") + ": " + dongMoTaSP(r.maSP, sp);
    if (THU) { log("  [thử] " + r.maTask + " (id " + id + ", " + status + ") → " + text.slice(0, 160)); ok++; continue; }
    try {
      const cu = await docBinhLuan(token, id);
      if (cu === null) { loi++; log("  ✗ " + r.maTask + ": không đọc được bình luận (id " + id + ")"); continue; }
      if (cu.some((x) => x.includes(MARKER))) {
        bo++; done[r.maTask] = { at: Date.now(), id, daCo: true };
        log("  ○ " + r.maTask + ": đã có bình luận mã SP từ trước — bỏ qua.");
      } else if (await guiBinhLuan(token, id, text)) {
        ok++; done[r.maTask] = { at: Date.now(), id };
        log("  ✓ " + r.maTask + " (id " + id + ", " + status + "): đã bổ sung.");
      } else { loi++; log("  ✗ " + r.maTask + " (id " + id + "): mọi dạng POST đều không ăn."); }
      fs.mkdirSync(path.dirname(DONE_FILE), { recursive: true });
      fs.writeFileSync(DONE_FILE, JSON.stringify(done));
      await nghi(350);                                        // giãn nhịp, không dội wshr
    } catch (e) { loi++; log("  ✗ " + r.maTask + ": " + e.message); if (/Token bị từ chối/.test(e.message)) break; }
  }
  log("HOÀN TẤT — Bổ sung: " + ok + " | Bỏ qua (đã có): " + bo + " | Lỗi: " + loi);
  process.exit(loi && !ok ? 1 : 0);
})();
