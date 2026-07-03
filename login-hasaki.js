/**
 * login-hasaki.js — Mở Edge đăng nhập work.hasaki.vn 1 lần (lưu phiên).
 *
 * - CHỈ mở 1 cửa sổ: nếu đã có cửa sổ login đang chạy (lock < 15') thì thoát ngay.
 * - TỰ ĐIỀN email + mật khẩu (.env: HASAKI_EMAIL / HASAKI_PASSWORD); bạn chỉ gõ OTP 6 số.
 * - Đăng nhập THÀNH CÔNG → hiện banner "✅ thành công" → tự đóng sau 5 giây.
 * - Không hoàn tất trong 15' → tự đóng để khỏi treo giữ profile.
 */
import puppeteer from "puppeteer";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const LOCK = path.join(DIR, ".login-open.lock");
const xoaLock = () => { try { fs.rmSync(LOCK, { force: true }); } catch {} };

const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PROFILE_DIR = process.env.EDGE_PROFILE_DIR || "C:/Users/lechitam/New folder/.wms-session/edge-profile";
const EMAIL = process.env.HASAKI_EMAIL || "";
const PASSWORD = process.env.HASAKI_PASSWORD || "";

// 1) Chống mở 2 cửa sổ: đã có cửa sổ login đang chạy thì thoát.
if (fs.existsSync(LOCK)) {
  const tuoi = Date.now() - fs.statSync(LOCK).mtimeMs;
  if (tuoi < 15 * 60 * 1000) { console.log("Đã có cửa sổ đăng nhập đang mở — bỏ qua, không mở thêm."); process.exit(0); }
  xoaLock();
}
fs.writeFileSync(LOCK, String(Date.now()));

// 2) Đánh dấu profile "thoát sạch" để Edge KHÔNG bật cửa sổ khôi phục tab cũ.
try {
  const pref = path.join(PROFILE_DIR, "Default", "Preferences");
  if (fs.existsSync(pref)) {
    const j = JSON.parse(fs.readFileSync(pref, "utf8"));
    j.profile = j.profile || {}; j.profile.exit_type = "Normal"; j.profile.exited_cleanly = true;
    fs.writeFileSync(pref, JSON.stringify(j));
  }
} catch { /* không sao nếu chưa có */ }

const browser = await puppeteer.launch({
  headless: false, defaultViewport: null, executablePath: EDGE_PATH, userDataDir: PROFILE_DIR,
  args: ["--start-maximized", "--disable-blink-features=AutomationControlled",
         "--hide-crash-restore-bubble", "--no-first-run", "--no-default-browser-check"],
});
const page = (await browser.pages())[0] || (await browser.newPage());

// 3) Tín hiệu đăng nhập thành công = có request kèm Authorization tới wshr.hasaki.vn.
let dangNhapOk = false;
page.on("request", (req) => {
  const a = req.headers()["authorization"];
  if (a && /wshr\.hasaki\.vn/.test(req.url())) dangNhapOk = true;
});

await page.goto("https://work.hasaki.vn/tasks-workflow?wfid=591", { waitUntil: "domcontentloaded" }).catch(() => {});

if (EMAIL && PASSWORD) console.log("⏳ Tự điền email + mật khẩu... (bạn chỉ cần gõ OTP 6 số khi hiện ra)");
else console.log("ℹ️  Chưa có HASAKI_EMAIL/HASAKI_PASSWORD trong .env → đăng nhập tay.");

// Tự điền email/mật khẩu khi field xuất hiện (SSO nhiều bước); KHÔNG đụng ô OTP.
const daDien = { email: false, pass: false };
async function tuDien() {
  if (!EMAIL || !PASSWORD || dangNhapOk) return;
  try {
    if (!daDien.email) {
      const sel = 'input[type="email"], input[name*="email" i], input[id*="email" i], input[name*="user" i], input[autocomplete="username"]';
      const ok = await page.evaluate((s, v) => {
        const el = [...document.querySelectorAll(s)].find(e => e.offsetParent !== null && !e.value);
        if (!el) return false;
        el.focus(); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }, sel, EMAIL);
      if (ok) { daDien.email = true; console.log("  ✓ Đã điền email."); }
    }
    if (!daDien.pass) {
      const ok = await page.evaluate((v) => {
        const els = [...document.querySelectorAll('input[type="password"]')].filter(e => e.offsetParent !== null && !e.value);
        const el = els.find(e => !/otp|code|token/i.test(e.name + e.id + (e.placeholder || ""))) || els[0];
        if (!el) return false;
        el.focus(); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }, PASSWORD);
      if (ok) { daDien.pass = true; console.log("  ✓ Đã điền mật khẩu. 👉 Gõ OTP 6 số và bấm Đăng nhập."); }
    }
  } catch { /* trang đang chuyển, thử lại */ }
}
const heNhip = setInterval(tuDien, 1200);

// Banner thông báo trong trang rồi tự đóng.
async function banner(text, mau) {
  try {
    await page.evaluate((t, m) => {
      let d = document.getElementById("__hsk5s_banner");
      if (!d) { d = document.createElement("div"); d.id = "__hsk5s_banner"; document.body.appendChild(d); }
      d.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:" + m +
        ";color:#fff;font:bold 18px Arial;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.3)";
      d.textContent = t;
    }, text, mau);
  } catch {}
}

// 4) Vòng theo dõi: thành công → banner → đóng sau 5s. Hết 15' → tự đóng.
const HAN_MS = 15 * 60 * 1000;
const batDau = Date.now();
const heTheoDoi = setInterval(async () => {
  if (dangNhapOk) {
    clearInterval(heTheoDoi); clearInterval(heNhip);
    console.log("✅ Đăng nhập thành công. Cửa sổ tự đóng sau 5 giây...");
    await banner("✅ Đăng nhập thành công! Cửa sổ tự đóng sau 5 giây...", "#1a7f37");
    setTimeout(() => browser.close().catch(() => {}), 5000);
  } else if (Date.now() - batDau > HAN_MS) {
    clearInterval(heTheoDoi); clearInterval(heNhip);
    console.log("⏰ Quá 15 phút chưa đăng nhập — tự đóng để giải phóng profile.");
    browser.close().catch(() => {});
  }
}, 1000);

console.log("👉 Đăng nhập xong sẽ tự đóng. (Đóng tay cũng được.)");
await new Promise((resolve) => browser.on("disconnected", resolve));
clearInterval(heNhip); clearInterval(heTheoDoi);
xoaLock();
console.log(dangNhapOk ? "Đã lưu phiên. Bộ đẩy chạy lại bình thường." : "Đã đóng (chưa xác nhận đăng nhập).");
process.exit(0);
