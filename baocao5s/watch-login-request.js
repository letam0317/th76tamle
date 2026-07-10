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

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const KEY = process.env.APPSCRIPT_KEY;
const LOCK = path.join(DIR, ".login-open.lock");
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

if (!KEY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

const hoi = async (act) => { const r = await fetch(APPSCRIPT_URL + "?action=" + act + "&key=" + encodeURIComponent(KEY)).catch(() => null); return r && r.ok ? r.json().catch(() => null) : null; };
const chay = (file) => { const c = spawn(process.execPath, [path.join(DIR, file)], { cwd: DIR, detached: true, stdio: "ignore" }); c.unref(); };   // GUI (login): chạy nền, không chờ
const chayCho = (file) => new Promise((res) => { const c = spawn(process.execPath, [path.join(DIR, file)], { cwd: DIR, stdio: "ignore" }); c.on("exit", res); c.on("error", res); });   // nền (auto-export): CHỜ xong

// 1) Yêu cầu CẬP NHẬT dashboard (nút "Cập nhật ngay" + PIN)
const s = await hoi("syncStatus");
if (s && s.requested) {
  log("⚡ Có yêu cầu cập nhật dashboard! Chạy auto-export (chờ xong)...");
  await fetch(APPSCRIPT_URL + "?action=clearSync&key=" + encodeURIComponent(KEY)).catch(() => {});
  await chayCho("auto-export-sync.js");   // chờ hoàn tất; auto-export có khoá chống chạy chồng
  log("Auto-export xong.");
} else log("Không có yêu cầu cập nhật.");

// 1b) Yêu cầu CẬP NHẬT CHẤM CÔNG (nút "Cập nhật chấm công" + PIN)
const tsq = await hoi("timesheetStatus");
if (tsq && tsq.requested) {
  log("⚡ Có yêu cầu cập nhật chấm công! Chạy pull-timesheet (chờ xong)...");
  await fetch(APPSCRIPT_URL + "?action=clearTimesheet&key=" + encodeURIComponent(KEY)).catch(() => {});
  await chayCho("pull-timesheet.js");
  log("Pull-timesheet xong.");
} else log("Không có yêu cầu chấm công.");

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
    await fetch(APPSCRIPT_URL + "?action=clearLogin&key=" + encodeURIComponent(KEY)).catch(() => {});
    chay("login-hasaki.js");   // login-hasaki.js tự quản lock
  } else log("Không có yêu cầu đăng nhập.");
}
process.exit(0);
