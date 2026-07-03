/**
 * watch-login-request.js — Bộ canh trên MÁY PC (chạy định kỳ mỗi ~2 phút).
 * Hỏi Apps Script "có ai vừa bấm nút Yêu cầu đăng nhập không?" (từ điện thoại/web).
 * Nếu có → xoá cờ + mở màn hình đăng nhập (login-hasaki.js) ngay trên máy này.
 * Chống mở trùng bằng lockfile .login-open.lock.
 *
 * Chạy 1 lần:  node watch-login-request.js   (hoặc để Task Scheduler gọi mỗi 2 phút)
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

// Nếu cửa sổ login đang mở (lock < 15 phút) thì bỏ qua để khỏi mở nhiều cửa sổ.
if (fs.existsSync(LOCK)) {
  const tuoi = Date.now() - fs.statSync(LOCK).mtimeMs;
  if (tuoi < 15 * 60 * 1000) { log("Cửa sổ đăng nhập đang mở, bỏ qua."); process.exit(0); }
  fs.rmSync(LOCK, { force: true });   // lock cũ quá 15' -> coi như đã đóng
}

const res = await fetch(APPSCRIPT_URL + "?action=loginStatus&key=" + encodeURIComponent(KEY)).catch(() => null);
const data = res && res.ok ? await res.json().catch(() => null) : null;
if (!data || !data.requested) { log("Không có yêu cầu đăng nhập."); process.exit(0); }

log("⚡ Có yêu cầu đăng nhập! Đang mở màn hình login...");
await fetch(APPSCRIPT_URL + "?action=clearLogin&key=" + encodeURIComponent(KEY)).catch(() => {});   // xoá cờ ngay

// login-hasaki.js TỰ quản lock (tự khoá khi mở, tự thoát nếu đã có cửa sổ) →
// bộ canh chỉ cần spawn, không đụng lock để tránh mở trùng.
const child = spawn(process.execPath, [path.join(DIR, "login-hasaki.js")], {
  cwd: DIR, detached: true, stdio: "ignore",
});
child.unref();
log("Đã gọi login-hasaki.js. Hãy gõ OTP 6 số trên máy này.");
process.exit(0);
