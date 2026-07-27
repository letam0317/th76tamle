/**
 * watch-login-request.js — Bộ canh trên MÁY PC (chạy định kỳ mỗi ~2 phút).
 * Hỏi Apps Script 2 việc (cờ đặt từ điện thoại/web/dashboard):
 *   1) "Cập nhật dashboard?" (nút Cập nhật ngay + PIN) → chạy auto-export-sync.js
 *   2) "Đăng nhập lại?" (nút trong email) → mở login-hasaki.js
 *
 * Chạy 1 lần:  node watch-login-request.js   (Task Scheduler gọi mỗi 2 phút)
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { docTokenCu } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const KEY = process.env.APPSCRIPT_KEY;
const LOCK = path.join(DIR, ".login-open.lock");
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

if (!KEY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

// SECRET đi trong POST body (không qua query → không lọt access-log)
const apiPost = async (act, extra) => { const r = await fetch(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: act, key: KEY, ...(extra || {}) }) }).catch(() => null); return r && r.ok ? r.json().catch(() => null) : null; };
const hoi = (act) => apiPost(act);
const chay = (file) => { const c = spawn(process.execPath, [path.join(DIR, file)], { cwd: DIR, detached: true, stdio: "ignore" }); c.unref(); };   // GUI (login): chạy nền, không chờ
const chayCho = (file) => new Promise((res) => { const c = spawn(process.execPath, [path.join(DIR, file)], { cwd: DIR, stdio: "ignore" }); c.on("exit", res); c.on("error", res); });   // nền (auto-export): CHỜ xong
const chayGuard = (force = true) => new Promise((res) => { const c = spawn("cmd.exe", ["/c", "node sync-guard.js " + (force ? "--force " : "") + ">> sync-guard.log 2>&1"], { cwd: DIR, stdio: "ignore", windowsHide: true }); c.on("exit", res); c.on("error", res); });   // guard: CHỜ xong, log riêng (force=true bỏ kiểm mới/cũ)

// 1) Yêu cầu CẬP NHẬT dashboard (nút "Cập nhật ngay" + PIN)
const s = await hoi("syncStatus");
if (s && s.requested) {
  log("⚡ Có yêu cầu cập nhật dashboard! Chạy auto-export (chờ xong)...");
  await apiPost("clearSync");
  await chayCho("auto-export-sync.js");   // chờ hoàn tất; auto-export có khoá chống chạy chồng
  log("Auto-export xong.");
} else log("Không có yêu cầu cập nhật.");

// 1b) Yêu cầu CẬP NHẬT CHẤM CÔNG (nút "Cập nhật chấm công" + PIN)
const tsq = await hoi("timesheetStatus");
if (tsq && tsq.requested) {
  log("⚡ Có yêu cầu cập nhật chấm công! Chạy pull-timesheet (chờ xong)...");
  await apiPost("clearTimesheet");
  await chayCho("pull-timesheet.js");
  log("Pull-timesheet xong.");
} else log("Không có yêu cầu chấm công.");

// 1c) Yêu cầu TẢI LẠI TỒN KHO FACTORY (nút "Tải lại dữ liệu" dashboard đặt cờ qua GAS).
// CHỈ hỏi khi backend đã có action này (caps.stockFlag) — hỏi action lạ trên GAS bản cũ
// sẽ rơi vào nhánh appendRow mặc định và ghi rác vào sheet 5S.
const caps = await hoi("caps");
let daChayGuard = false;
if (caps && caps.stockFlag) {
  const sk = await hoi("stockSyncStatus");
  if (sk && sk.requested) {
    log("⚡ Có yêu cầu tải lại tồn kho factory! Chạy sync-guard --force (chờ xong, log: sync-guard.log)...");
    await apiPost("clearStockSync");
    await chayGuard();   // guard tự lo luật phiên (bridge/khung an toàn) — không đá ai trong giờ làm
    daChayGuard = true;
    log("Sync-guard xong.");
  } else log("Không có yêu cầu tồn kho.");
}

// 1d) CHỦ ĐỘNG GIỮ DỮ LIỆU TƯƠI (23/07/2026) — thay vì chỉ trông vào tick guard mỗi GIỜ:
// mỗi lượt canh (~2'), gọi guard KHÔNG --force. Guard tự kiểm mới/cũ (rẻ, chỉ 1 lượt đọc Metadata
// khi đã mới) và CHỈ đồng bộ khi dữ liệu CŨ + mượn được token SỐNG (kho/bridge — phiên operator
// đang đăng nhập, extension đẩy lên). Tận dụng thực tế "giờ làm LUÔN có phiên WMS đăng nhập":
// data sáng (máy vừa boot) tự bắt kịp trong ≤2' NGAY KHI có token sống — không chờ tick giờ,
// KHÔNG re-login SSO, KHÔNG đá ai. Guard tự có khoá 45' + né cụm đang chạy nên không chạy chồng.
if (caps && caps.stockFlag && !daChayGuard) {
  await chayGuard(false);
}

// 1f) NHỊP PHÂN TẦNG (26/07/2026 — sync-poller.js, log: poller.log): giữ vệ sinh/kiểm kê
// tươi 15-30' trong ngày + 2 slot trưa/chiều cho tồn kho. Poller TỰ quyết có việc hay không
// (đọc mốc .sync-ok-*, ping rẻ), CHỈ chạy khi có token phiên sống, tự né cụm đang chạy —
// nên gọi mỗi tick 2' là an toàn, đa số tick nó thoát ngay không tốn gì.
await new Promise((res) => { const c = spawn("cmd.exe", ["/c", "node sync-poller.js >> poller.log 2>&1"], { cwd: DIR, stdio: "ignore", windowsHide: true }); c.on("exit", res); c.on("error", res); });

// 1e) SỔ NHẬT KÝ PHIÊN WMS (25/07/2026 — điều tra "bị đá văng phiên"): mỗi tick 2' kiểm
// get-me trên token wms trong kho, ghi session-ledger.log khi phiên ĐỔI (jti mới) hoặc CHẾT.
// Bot này KHÔNG re-login trong giờ làm (session-rules) — nên mọi cú "phiên vừa chết" trong
// sổ = có người/máy KHÁC đăng nhập cùng tài khoản (WMS 1 phiên/tài khoản) hoặc hết hạn idle.
// Nhờ đó lần sau bị đá là tra được ĐÚNG PHÚT, khỏi đổ oan cho bộ đồng bộ.
try {
  const LEDGER = path.join(DIR, "session-ledger.log");
  const LSTATE = path.join(DIR, ".session-ledger-state.json");
  const jtiOf = (t) => { try { return JSON.parse(Buffer.from(String(t).replace(/^Bearer /i, "").split(".")[1], "base64url").toString()).jti || "?"; } catch { return "?"; } };
  const cu = docTokenCu(DIR, "wms");
  if (cu && cu.token) {
    const me = await fetch("https://wms-gw.inshasaki.com/api/v1/auth/user/get-me", { headers: { authorization: cu.token } }).catch(() => null);
    if (me) {   // chỉ kết luận khi có câu trả lời chắc chắn (lỗi mạng thì bỏ qua tick này)
      const jti = jtiOf(cu.token), song = me.ok;
      let st = {}; try { st = JSON.parse(fs.readFileSync(LSTATE, "utf8")); } catch { /* chưa có sổ */ }
      const ghi = (dong) => fs.appendFileSync(LEDGER, new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false }) + "  " + dong + "\n");
      if (st.jti !== jti) ghi("PHIÊN MỚI trong kho: jti=" + jti + (song ? " (đang sống)" : " (đã chết ngay khi ghi nhận)"));
      else if (st.song === true && !song) ghi("PHIÊN jti=" + jti + " VỪA CHẾT (get-me " + me.status + ") — có người/máy khác vừa đăng nhập tài khoản này (WMS 1 phiên/tài khoản) hoặc phiên hết hạn.");
      else if (st.song === false && song) ghi("PHIÊN jti=" + jti + " sống lại (hiếm — kiểm tra đồng hồ/proxy).");
      if (st.jti !== jti || st.song !== song) fs.writeFileSync(LSTATE, JSON.stringify({ jti, song, luc: Date.now() }));
    }
  }
} catch { /* sổ phiên best-effort — không chặn các việc chính */ }

// 2) Yêu cầu ĐĂNG NHẬP (nút trong email). Bỏ qua nếu cửa sổ login đang mở (<15').
let boQuaLogin = false;
if (fs.existsSync(LOCK)) {
  if (Date.now() - fs.statSync(LOCK).mtimeMs < 15 * 60 * 1000) boQuaLogin = true;
  else fs.rmSync(LOCK, { force: true });
}
if (!boQuaLogin) {
  const d = await hoi("loginStatus");
  if (d && d.requested) {
    log("⚡ Có yêu cầu đăng nhập! Mở màn hình login...");
    await apiPost("clearLogin");
    chay("login-hasaki.js");   // login-hasaki.js tự quản lock
  } else log("Không có yêu cầu đăng nhập.");
}
process.exit(0);
