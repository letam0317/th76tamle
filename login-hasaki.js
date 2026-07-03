/**
 * login-hasaki.js — Mở Edge để đăng nhập work.hasaki.vn 1 lần (lưu phiên).
 * TỰ ĐỘNG điền email + mật khẩu (đọc từ .env: HASAKI_EMAIL / HASAKI_PASSWORD),
 * bạn CHỈ CẦN gõ OTP 6 số rồi bấm đăng nhập. Đổi mật khẩu → sửa .env là xong.
 * Nếu .env chưa có thông tin, sẽ để bạn tự nhập tay như trước.
 * Sau khi thấy bảng workflow hiện ra, đóng cửa sổ là được.
 */
import puppeteer from "puppeteer";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOCK = path.join(path.dirname(fileURLToPath(import.meta.url)), ".login-open.lock");
const xoaLock = () => { try { fs.rmSync(LOCK, { force: true }); } catch {} };

const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PROFILE_DIR = process.env.EDGE_PROFILE_DIR || "C:/Users/lechitam/New folder/.wms-session/edge-profile";
const EMAIL = process.env.HASAKI_EMAIL || "";
const PASSWORD = process.env.HASAKI_PASSWORD || "";

const browser = await puppeteer.launch({
  headless: false, defaultViewport: null, executablePath: EDGE_PATH, userDataDir: PROFILE_DIR,
  args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
});
const page = (await browser.pages())[0] || (await browser.newPage());
await page.goto("https://work.hasaki.vn/tasks-workflow?wfid=591", { waitUntil: "domcontentloaded" }).catch(() => {});

if (EMAIL && PASSWORD) {
  console.log("⏳ Đang tự điền email + mật khẩu... (bạn chỉ cần gõ OTP 6 số khi hiện ra)");
} else {
  console.log("ℹ️  Chưa có HASAKI_EMAIL/HASAKI_PASSWORD trong .env → đăng nhập tay như thường.");
}

// Tự điền các bước đăng nhập khi field xuất hiện (SSO có thể chia nhiều bước:
// email → mật khẩu → OTP). Chỉ điền field còn trống, KHÔNG đụng ô OTP.
const daDien = { email: false, pass: false };
async function tuDien() {
  if (!EMAIL || !PASSWORD) return;
  try {
    // 1) Ô email/tài khoản
    if (!daDien.email) {
      const emailSel = 'input[type="email"], input[name*="email" i], input[id*="email" i], input[name*="user" i], input[autocomplete="username"]';
      const filled = await page.evaluate((sel, val) => {
        const el = [...document.querySelectorAll(sel)].find(e => e.offsetParent !== null && !e.value);
        if (!el) return false;
        el.focus(); el.value = val;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }, emailSel, EMAIL);
      if (filled) { daDien.email = true; console.log("  ✓ Đã điền email."); }
    }
    // 2) Ô mật khẩu (không phải ô OTP: OTP thường maxlength<=8, name chứa otp/code)
    if (!daDien.pass) {
      const filled = await page.evaluate((val) => {
        const els = [...document.querySelectorAll('input[type="password"]')]
          .filter(e => e.offsetParent !== null && !e.value);
        const el = els.find(e => !/otp|code|token/i.test(e.name + e.id + (e.placeholder || ""))) || els[0];
        if (!el) return false;
        el.focus(); el.value = val;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }, PASSWORD);
      if (filled) { daDien.pass = true; console.log("  ✓ Đã điền mật khẩu. 👉 Bây giờ gõ OTP 6 số và bấm Đăng nhập."); }
    }
  } catch { /* trang đang chuyển, thử lại vòng sau */ }
}

const heNhip = setInterval(tuDien, 1200);
page.on("framenavigated", () => { /* reset để điền lại nếu SSO sang bước mới */ });

// Tự đóng sau 15 phút nếu không ai hoàn tất đăng nhập — tránh cửa sổ treo
// giữ profile & chặn bộ đẩy (đồng bộ với lock 15' của bộ canh).
const TU_DONG_MS = 15 * 60 * 1000;
const heTuDong = setTimeout(() => {
  console.log("⏰ Quá 15 phút chưa đóng — tự đóng để giải phóng profile.");
  browser.close().catch(() => {});
}, TU_DONG_MS);

console.log("👉 Khi thấy bảng workflow 591 hiện ra là xong. Đóng cửa sổ trình duyệt để lưu phiên.");
await new Promise((resolve) => browser.on("disconnected", resolve));
clearInterval(heNhip);
clearTimeout(heTuDong);
xoaLock();
console.log("Đã lưu phiên. Bạn có thể chạy lại bộ đẩy.");
process.exit(0);
