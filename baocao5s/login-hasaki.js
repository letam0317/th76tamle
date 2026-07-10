/**
 * login-hasaki.js — Tự đăng nhập work.hasaki.vn qua SSO (Hasaki IdP) và lưu phiên.
 *
 * Luồng SSO thật:
 *   work.hasaki.vn/auth/login → bấm "Đăng nhập với Hasaki SSO"
 *   → auth-idp: /login/identifier : CHỈ có ô email → gõ email → CHỜ Turnstile bật nút → "Tiếp tục"
 *   → /login/password : gõ mật khẩu → tiếp
 *   → /login (otp)    : gõ OTP 6 số (tự sinh) → xác nhận
 *   → callback → work.hasaki.vn mint JWT (Authorization tới wshr) = XONG.
 *
 * CHỐNG KHOÁ TÀI KHOẢN:
 *   • Gõ phím THẬT (Puppeteer keyboard) — gán .value không ăn với ô OTP/segmented.
 *   • OTP chỉ NỘP 1 LẦN, không retry (mã đúng, đồng hồ chuẩn → 1 lần là đủ). Sai thì DỪNG, không nộp thêm.
 *   • Chỉ gõ OTP khi mã còn ≥10s hiệu lực.
 *
 * Chế độ:
 *   • thường: mở cửa sổ, tự làm hết; thiếu secret thì bạn gõ OTP tay.
 *   • --auto : tự động hoàn toàn (vẫn hiện cửa sổ vì Turnstile); exit 0 nếu OK, 1 nếu trượt.
 *   • --dry-otp : làm hết tới bước OTP, GÕ OTP nhưng KHÔNG nộp (để test an toàn, không tốn lượt).
 */
import puppeteer from "puppeteer";
import { TOTP, Secret } from "otpauth";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { luuNhieu } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const LOCK = path.join(DIR, ".login-open.lock");
const xoaLock = () => { try { fs.rmSync(LOCK, { force: true }); } catch {} };

const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PROFILE_DIR = process.env.EDGE_PROFILE_DIR || "C:/Users/lechitam/New folder/baocao5s/.wms-session/edge-profile";
const EMAIL = process.env.HASAKI_EMAIL || "";
const PASSWORD = process.env.HASAKI_PASSWORD || "";
const SECRET = (process.env.HASAKI_2FA_SECRET || "").replace(/\s+/g, "");
const AUTO = process.argv.includes("--auto");
const DRY_OTP = process.argv.includes("--dry-otp") || process.env.DRY_OTP === "1";
const SHOW = process.argv.includes("--show");   // --show = hiện cửa sổ để gỡ lỗi; mặc định CHẠY NGẦM ngoài màn hình
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function genOTP() {
  if (!SECRET) return null;
  try { return new TOTP({ secret: Secret.fromBase32(SECRET), digits: 6, period: 30 }).generate(); }
  catch (e) { log("✗ HASAKI_2FA_SECRET không hợp lệ (base32): " + e.message); return null; }
}
const otpConLai = () => 30 - (Math.floor(Date.now() / 1000) % 30);   // giây còn lại của mã hiện tại
if (AUTO && !SECRET) { log("✗ --auto cần HASAKI_2FA_SECRET. Thoát."); process.exit(1); }

if (fs.existsSync(LOCK)) {
  if (Date.now() - fs.statSync(LOCK).mtimeMs < 15 * 60 * 1000) { log("Đã có phiên login đang chạy — bỏ qua."); process.exit(0); }
  xoaLock();
}
fs.writeFileSync(LOCK, String(Date.now()));

try {
  const pref = path.join(PROFILE_DIR, "Default", "Preferences");
  if (fs.existsSync(pref)) {
    const j = JSON.parse(fs.readFileSync(pref, "utf8"));
    j.profile = j.profile || {}; j.profile.exit_type = "Normal"; j.profile.exited_cleanly = true;
    fs.writeFileSync(pref, JSON.stringify(j));
  }
} catch {}

// CHẠY NGẦM: headful (Turnstile cần trình duyệt thật) nhưng đặt cửa sổ NGOÀI MÀN HÌNH
// (-32000,-32000) → không hiện, không che, không cướp thao tác. Các cờ disable-*background*
// giữ cho trang KHÔNG bị Chrome "ngủ" khi ở nền → Turnstile/timer vẫn chạy bình thường.
const browser = await puppeteer.launch({
  headless: false,
  defaultViewport: null, executablePath: EDGE_PATH, userDataDir: PROFILE_DIR,
  args: [
    ...(SHOW ? ["--start-maximized"] : ["--window-position=-32000,-32000", "--window-size=1280,900"]),
    "--disable-blink-features=AutomationControlled",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-background-timer-throttling",
    "--hide-crash-restore-bubble", "--no-first-run", "--no-default-browser-check",
  ],
});
const page = (await browser.pages())[0] || (await browser.newPage());

let ok = false, tokWork = null, tokHr = null;
// Bắt token cho CẢ work lẫn hr trong 1 phiên đăng nhập → 1 lần login đủ cho cả 3 bộ.
page.on("request", (req) => {
  const a = req.headers()["authorization"];
  if (a && /wshr\.hasaki\.vn/.test(req.url())) { ok = true; if (/hr\.hasaki\.vn/.test(page.url())) tokHr = a; else tokWork = a; }
});

await page.goto("https://work.hasaki.vn/tasks-workflow?wfid=591", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
log(SECRET ? ("⏳ Tự đăng nhập" + (DRY_OTP ? " (DRY-OTP: sẽ KHÔNG nộp OTP)..." : "...")) : (EMAIL ? "⏳ Tự điền email+mật khẩu (bạn gõ OTP)..." : "ℹ️  Thiếu .env → đăng nhập tay."));

/* ---------- Thao tác bằng PHÍM/CHUỘT THẬT (đáng tin với React/segmented) ---------- */
// Lấy element đầu tiên KHỚP selector & đang hiển thị.
async function elHien(selCsv) {
  const h = await page.evaluateHandle((s) => {
    for (const sel of s.split("||")) { const el = [...document.querySelectorAll(sel)].find(e => e.offsetParent !== null); if (el) return el; }
    return null;
  }, selCsv);
  const el = h.asElement(); if (!el) { await h.dispose(); return null; } return el;
}
// Focus + xoá sạch + gõ thật.
async function goVao(selCsv, val) {
  const el = await elHien(selCsv); if (!el) return false;
  await el.click({ clickCount: 3 }).catch(() => {});
  await page.keyboard.press("Backspace").catch(() => {});
  await el.type(val, { delay: 45 });
  await el.dispose(); return true;
}
// Gõ OTP: 6 ô rời (gõ liên tục, ô tự nhảy) hoặc 1 ô.
async function goOTP(code) {
  const boxes = await page.$$('input[maxlength="1"]');
  const vis = [];
  for (const b of boxes) { if (await b.evaluate(e => e.offsetParent !== null).catch(() => false)) vis.push(b); else await b.dispose(); }
  if (vis.length >= 6) {
    await vis[0].click({ clickCount: 3 }).catch(() => {});
    await page.keyboard.press("Backspace").catch(() => {});
    await page.keyboard.type(code, { delay: 70 });   // gõ 6 số, ô tự nhảy
    for (const b of vis) await b.dispose();
    return true;
  }
  for (const b of vis) await b.dispose();
  return await goVao('input[autocomplete="one-time-code"]||input[name*="otp" i]||input[id*="otp" i]||input[inputmode="numeric"]||input[maxlength="6"]', code);
}
// Bấm nút ĐANG BẬT (không disabled) khớp regex text. Trả nhãn nút, hoặc null nếu chưa có/đang disabled.
async function bamNut(reSrc) {
  const h = await page.evaluateHandle((rs) => {
    const re = new RegExp(rs, "i");
    const c = [...document.querySelectorAll('button,[role=button],input[type=submit]')].filter(e => e.offsetParent !== null && !e.disabled);
    return c.find(e => re.test((e.innerText || e.value || "").trim())) || c.find(e => e.type === "submit") || null;
  }, reSrc);
  const el = h.asElement(); if (!el) { await h.dispose(); return null; }
  const label = await page.evaluate(e => (e.innerText || e.value || "submit").trim().slice(0, 30), el).catch(() => "submit");
  await el.click().catch(() => {}); await el.dispose(); return label;
}
const hien = (selCsv) => page.evaluate((s) => s.split("||").some(sel => [...document.querySelectorAll(sel)].some(e => e.offsetParent !== null)), selCsv).catch(() => false);
// Có ô KHỚP selector đang HIỆN & TRỐNG (chưa nhập)? — điền theo ô trống, không dùng cờ 1 lần.
const trong = (selCsv) => page.evaluate((s) => s.split("||").some(sel => [...document.querySelectorAll(sel)].some(e => e.offsetParent !== null && !e.value)), selCsv).catch(() => false);

const EMAIL_SEL = 'input[type=email]||input[name*="email" i]||input[id*="email" i]||input[name*="user" i]||input[autocomplete="username"]';
const OTP_SEL = 'input[autocomplete="one-time-code"]||input[maxlength="1"]||input[name*="otp" i]||input[id*="otp" i]||input[inputmode="numeric"]||input[maxlength="6"]';

/* ---------- Máy trạng thái: điền theo Ô ĐANG TRỐNG (chịu được trang gộp email+mật khẩu+OTP) ---------- */
const st = { otpDone: false, passSubmitted: false, credSubmitted: false, clickedContinue: false, otpWaitLogged: false, loggedEmail: false, loggedPass: false };
let busy = false;
async function tick() {
  if (ok || busy) return; busy = true;
  try {
    // 1) work.hasaki.vn: chỉ có nút SSO
    if (/work\.hasaki\.vn/.test(page.url()) && await hien('button||[role=button]') && !(await hien('input'))) {
      const t = await bamNut("hasaki sso|đăng nhập với|dang nhap voi|sso"); if (t) log("  → bấm: " + t);
      return;
    }
    const coPass = await hien('input[type=password]');
    const coOTP = await hien(OTP_SEL);
    const emailTrong = await trong(EMAIL_SEL);
    const passTrong = await trong('input[type=password]');

    // 2) Điền email vào BẤT KỲ ô email trống nào (kể cả trang gộp — sửa lỗi "chưa nhập email")
    if (EMAIL && emailTrong) {
      if (await goVao(EMAIL_SEL, EMAIL) && !st.loggedEmail) { log("  ✓ gõ email"); st.loggedEmail = true; }
      return;
    }
    // 3) Điền mật khẩu vào ô mật khẩu trống
    if (PASSWORD && passTrong) {
      if (await goVao('input[type=password]', PASSWORD) && !st.loggedPass) { log("  ✓ gõ mật khẩu"); st.loggedPass = true; }
      return;
    }
    // 4) OTP: chỉ gõ khi email & mật khẩu ĐÃ ĐẦY, mã còn ≥10s; GÕ 1 LẦN DUY NHẤT (chống khoá)
    if (SECRET && coOTP && !emailTrong && !passTrong && !st.otpDone) {
      const conLai = otpConLai();
      if (conLai < 10) { if (!st.otpWaitLogged) { log("  … chờ mã OTP mới (còn " + conLai + "s)"); st.otpWaitLogged = true; } return; }
      const code = genOTP(); if (!code) return;
      await goOTP(code); st.otpDone = true;
      if (DRY_OTP) { log("  ✓ [DRY-OTP] đã GÕ OTP " + code + " nhưng KHÔNG nộp. Kết thúc test."); setTimeout(() => browser.close().catch(() => {}), 800); return; }
      log("  ✓ gõ OTP " + code + " (còn " + conLai + "s)");
      return;
    }
    // 5) Trang identifier (chỉ email) → bấm "Tiếp tục" khi Turnstile bật (bamNut chỉ trả nút ĐANG BẬT)
    if (!coPass && !coOTP && !emailTrong) {
      const t = await bamNut("tiếp tục|tiep tuc|tiếp|tiep|continue|next|đăng nhập|dang nhap|submit");
      if (t && !st.clickedContinue) { st.clickedContinue = true; log("  → bấm '" + t + "' (Turnstile xong)"); }
      return;
    }
    // 6) Trang mật khẩu KHÔNG kèm OTP (luồng nhiều trang) → nộp để sang bước OTP
    if (coPass && !coOTP && !emailTrong && !passTrong && !st.passSubmitted) {
      const t = await bamNut("đăng nhập|dang nhap|tiếp|tiep|next|continue|submit");
      if (t) { st.passSubmitted = true; log("  → tiếp sau mật khẩu: " + t); }
      return;
    }
    // 7) Trang có OTP & đã gõ OTP xong & email/mật khẩu đầy → NỘP 1 LẦN DUY NHẤT
    if (coOTP && st.otpDone && !emailTrong && !passTrong && !st.credSubmitted && !DRY_OTP) {
      const t = await bamNut("đăng nhập|dang nhap|xác nhận|xac nhan|verify|submit|continue");
      if (t) { st.credSubmitted = true; log("  → NỘP đăng nhập (1 lần duy nhất): " + t); }
      return;
    }
  } catch { /* trang đang chuyển */ } finally { busy = false; }
}
const nhip = setInterval(tick, 1000);

const HAN = AUTO ? 4 * 60 * 1000 : 15 * 60 * 1000;
const t0 = Date.now();
// Sau khi đăng nhập OK: chụp LUÔN token hr.hasaki (session đã có) → nạp kho CẢ work + hr,
// để 1 lần đăng nhập là đủ cho cả 3 bộ, các bộ khác không phải mở trình duyệt/đăng nhập lại.
let dangKetThuc = false;
async function ketThucThanhCong() {
  if (dangKetThuc) return; dangKetThuc = true;
  clearInterval(theoDoi); clearInterval(nhip);
  log("✅ Đăng nhập thành công.");
  try {
    if (!tokHr) {
      await page.goto("https://hr.hasaki.vn/", { waitUntil: "networkidle2", timeout: 30000 }).catch(() => {});
      for (let i = 0; i < 12 && !tokHr; i++) await new Promise((r) => setTimeout(r, 700));
    }
  } catch {}
  try { luuNhieu(DIR, { work: tokWork, hr: tokHr }); log("  ✓ Nạp kho token: work=" + (tokWork ? "có" : "—") + ", hr=" + (tokHr ? "có" : "—") + "."); } catch (e) { log("  (không nạp được kho token: " + e.message + ")"); }
  browser.close().catch(() => {});
}
const theoDoi = setInterval(() => {
  if (ok) { ketThucThanhCong(); }
  else if (Date.now() - t0 > HAN) {
    clearInterval(theoDoi); clearInterval(nhip);
    log("⏰ Quá hạn chưa đăng nhập được (Turnstile/OTP?). Đóng.");
    browser.close().catch(() => {});
  }
}, 1000);

if (!AUTO) log("👉 " + (SECRET ? "Sẽ tự đăng nhập." : "Gõ OTP xong sẽ tự đóng.") + " (Đóng tay cũng được.)");
await new Promise((resolve) => browser.on("disconnected", resolve));
clearInterval(nhip); clearInterval(theoDoi);
xoaLock();
log(ok ? "Đã lưu phiên. Các bộ chạy lại bình thường." : (DRY_OTP ? "Kết thúc DRY-OTP (không nộp OTP)." : "Đã đóng (chưa xác nhận đăng nhập)."));
process.exit(ok ? 0 : (DRY_OTP ? 0 : 1));
