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
import { luuNhieu, EDGE_PATH, duongDanProfile } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const LOCK = path.join(DIR, ".login-open.lock");
const xoaLock = () => { try { fs.rmSync(LOCK, { force: true }); } catch {} };

const PROFILE_DIR = duongDanProfile(DIR);
const EMAIL = process.env.HASAKI_EMAIL || "";
const PASSWORD = process.env.HASAKI_PASSWORD || "";
const SECRET = (process.env.HASAKI_2FA_SECRET || "").replace(/\s+/g, "");
const AUTO = process.argv.includes("--auto");
const DRY_OTP = process.argv.includes("--dry-otp") || process.env.DRY_OTP === "1";
const SHOW = process.argv.includes("--show");   // --show = hiện cửa sổ để gỡ lỗi; mặc định CHẠY NGẦM ngoài màn hình
// Log theo GIỜ VN THẬT (log cũ dùng toISOString = UTC, lệch 7h — sự cố 27/07/2026 đọc nhầm "01:44" tưởng máy chạy nửa đêm).
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

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
// Bấm nút ĐANG BẬT khớp regex text (disabled thật, aria-disabled hay class disabled đều coi là tắt —
// trước chỉ xét e.disabled nên từng bấm nút Continue còn "mờ" khi Turnstile chưa xong).
// fallbackSubmit: hết regex mới rơi xuống nút type=submit, và LOẠI các nút "phá luồng"
// (Use another account / đăng xuất / huỷ / quay lại) — sự cố 27/07/2026: fallback mù bấm
// "Use another account" mỗi giây suốt 4 phút, reset vòng đăng nhập liên tục → mail báo thất bại.
async function bamNut(reSrc, { fallbackSubmit = false } = {}) {
  const h = await page.evaluateHandle((rs, fb) => {
    const re = new RegExp(rs, "i");
    const XAU = /use another|another account|tài khoản khác|tai khoan khac|sign ?out|log ?out|đăng xuất|dang xuat|cancel|huỷ|hủy|quay lại|quay lai|\bback\b/i;
    const tat = (e) => e.disabled || e.getAttribute("aria-disabled") === "true" || /(^|\s)disabled(\s|$)/i.test(e.className || "");
    const c = [...document.querySelectorAll('button,[role=button],input[type=submit]')].filter(e => e.offsetParent !== null && !tat(e));
    return c.find(e => re.test((e.innerText || e.value || "").trim()))
        || (fb ? c.find(e => e.type === "submit" && !XAU.test((e.innerText || e.value || "").trim())) : null)
        || null;
  }, reSrc, fallbackSubmit);
  const el = h.asElement(); if (!el) { await h.dispose(); return null; }
  const label = await page.evaluate(e => (e.innerText || e.value || "submit").trim().slice(0, 30), el).catch(() => "submit");
  await el.click().catch(() => {}); await el.dispose(); return label;
}
// Bấm phần tử hiển thị khớp regex trong tập selector RỘNG (nút + link) — cho trang chọn tài khoản.
async function bamKhop(reSrc, sel = 'button,[role=button],a,input[type=submit]') {
  const h = await page.evaluateHandle((rs, s) => {
    const re = new RegExp(rs, "i");
    return [...document.querySelectorAll(s)].find(e => e.offsetParent !== null && re.test((e.innerText || e.value || "").trim())) || null;
  }, reSrc, sel);
  const el = h.asElement(); if (!el) { await h.dispose(); return null; }
  const label = await page.evaluate(e => (e.innerText || e.value || "").trim().slice(0, 40), el).catch(() => "?");
  await el.click().catch(() => {}); await el.dispose(); return label;
}
const hien = (selCsv) => page.evaluate((s) => s.split("||").some(sel => [...document.querySelectorAll(sel)].some(e => e.offsetParent !== null)), selCsv).catch(() => false);
// Có ô KHỚP selector đang HIỆN & TRỐNG (chưa nhập)? — điền theo ô trống, không dùng cờ 1 lần.
const trong = (selCsv) => page.evaluate((s) => s.split("||").some(sel => [...document.querySelectorAll(sel)].some(e => e.offsetParent !== null && !e.value)), selCsv).catch(() => false);

const EMAIL_SEL = 'input[type=email]||input[name*="email" i]||input[id*="email" i]||input[name*="user" i]||input[autocomplete="username"]';
const OTP_SEL = 'input[autocomplete="one-time-code"]||input[maxlength="1"]||input[name*="otp" i]||input[id*="otp" i]||input[inputmode="numeric"]||input[maxlength="6"]';

/* ---------- Máy trạng thái: điền theo Ô ĐANG TRỐNG (chịu được trang gộp email+mật khẩu+OTP) ---------- */
const st = { otpDone: false, passSubmitted: false, credSubmitted: false, clickedContinue: false, otpWaitLogged: false, loggedEmail: false, loggedPass: false, emailLuc: 0 };
// Host THẬT của trang — URL IdP mang redirect_uri chứa "work.hasaki.vn" trong query nên
// regex substring từng làm bước SSO misfire ngay trên trang IdP (sự cố 27/07/2026).
const hostHienTai = () => { try { return new URL(page.url()).hostname; } catch { return ""; } };
// Chống bấm dồn dập: mỗi việc bấm phải cách lượt trước ≥ nhipMs — click cần thời gian điều hướng,
// bấm mỗi giây là tự reset luồng (nguồn cơn vòng lặp "Use another account" 27/07/2026).
const lanBam = {};
const duNhip = (viec, nhipMs) => { const t = Date.now(); if (t - (lanBam[viec] || 0) < nhipMs) return false; lanBam[viec] = t; return true; };
let busy = false;
async function tick() {
  if (ok || busy) return; busy = true;
  try {
    // 1) work.hasaki.vn (so HOST thật): chỉ có nút SSO
    if (hostHienTai() === "work.hasaki.vn" && await hien('button||[role=button]') && !(await hien('input'))) {
      if (!duNhip("sso", 5000)) return;
      const t = await bamNut("hasaki sso|đăng nhập với|dang nhap voi|sso", { fallbackSubmit: true }); if (t) log("  → bấm: " + t);
      return;
    }
    // 1a) Checkbox "I'm not a robot" (Hasaki ID v2 từ 27/07/2026 — Turnstile ẩn sau checkbox first-party,
    //     div[role=checkbox], KHÔNG iframe): bấm bằng CHUỘT THẬT (di tới rồi click) một nhịp mỗi 6s.
    //     Chưa tick xong thì mọi nút khác trên trang đều vô nghĩa — phải xử lý TRƯỚC các bước còn lại.
    {
      const cb = await elHien('[role="checkbox"][aria-checked="false"]');
      if (cb) {
        const laRobot = await page.evaluate((e) => /not a robot|không phải.*robot|khong phai.*robot/i.test((e.getAttribute("aria-label") || "") + " " + (e.innerText || "")), cb).catch(() => false);
        if (laRobot) {
          if (!duNhip("robot", 6000)) { await cb.dispose(); return; }
          const bb = await cb.boundingBox().catch(() => null);
          if (bb) {
            const cx = bb.x + Math.min(26, bb.width / 2), cy = bb.y + bb.height / 2;   // nhắm ô vuông bên trái
            await page.mouse.move(cx - 70, cy + 35, { steps: 10 }).catch(() => {});
            await page.mouse.move(cx, cy, { steps: 8 }).catch(() => {});
            await new Promise((r) => setTimeout(r, 350));
            await page.mouse.click(cx, cy).catch(() => {});
          } else await cb.click().catch(() => {});
          await cb.dispose();
          log("  → tick \"I'm not a robot\" (chờ IdP xác minh)...");
          return;
        }
        await cb.dispose();
      }
    }
    // 1b) Trang CHỌN TÀI KHOẢN của IdP ("Pick an account" — xuất hiện 27/07/2026, không ô nhập nào):
    //     ưu tiên bấm ĐÚNG ô tài khoản đã lưu (khớp EMAIL) để đi tiếp; không thấy thì
    //     "Use another account" MỘT nhịp mỗi 8s cho trang identifier kịp render — cấm bấm mỗi giây.
    if (!(await hien('input')) && await page.evaluate(() =>
      [...document.querySelectorAll('button,[role=button],a,input[type=submit]')].some(e => e.offsetParent !== null && /use another|another account|tài khoản khác|tai khoan khac/i.test(e.innerText || e.value || ""))).catch(() => false)) {
      if (!duNhip("chon-tai-khoan", 8000)) return;
      if (EMAIL) {
        const h = await page.evaluateHandle((email) => {
          const cs = [...document.querySelectorAll('button,[role=button],a,li')].filter(e =>
            e.offsetParent !== null && (e.innerText || "").toLowerCase().includes(email) && (e.innerText || "").length < 200);
          cs.sort((a, b) => (a.innerText || "").length - (b.innerText || "").length);   // phần tử NHỎ NHẤT chứa email
          return cs[0] || null;
        }, EMAIL.toLowerCase());
        const el = h.asElement();
        if (el) { await el.click().catch(() => {}); await el.dispose(); log("  → chọn tài khoản đã lưu (" + EMAIL + ")"); return; }
        await h.dispose();
      }
      const t = await bamKhop("use another|another account|tài khoản khác|tai khoan khac");
      if (t) log("  → bấm '" + t + "' (sang trang gõ email — chờ trang render)");
      return;
    }
    const coPass = await hien('input[type=password]');
    const coOTP = await hien(OTP_SEL);
    const emailTrong = await trong(EMAIL_SEL);
    const passTrong = await trong('input[type=password]');

    // 2) Điền email vào BẤT KỲ ô email trống nào (kể cả trang gộp — sửa lỗi "chưa nhập email")
    if (EMAIL && emailTrong) {
      if (await goVao(EMAIL_SEL, EMAIL)) { st.emailLuc = Date.now(); if (!st.loggedEmail) { log("  ✓ gõ email"); st.loggedEmail = true; } }
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
      if (DRY_OTP) { log("  ✓ [DRY-OTP] đã GÕ OTP (6 số, ẩn) nhưng KHÔNG nộp. Kết thúc test."); setTimeout(() => browser.close().catch(() => {}), 800); return; }
      log("  ✓ gõ OTP (còn " + conLai + "s)");
      return;
    }
    // 5) Trang identifier (chỉ email) → bấm "Tiếp tục" khi Turnstile bật (bamNut chỉ trả nút ĐANG BẬT).
    //    NHƯỜNG Turnstile ≥4s sau khi gõ email + tối đa 1 lượt bấm/4s — 27/07/2026 bấm Continue
    //    ngay giây gõ email → form nộp thiếu token Turnstile → IdP đá về trang chọn tài khoản, kẹt vòng lặp.
    if (!coPass && !coOTP && !emailTrong) {
      if (st.emailLuc && Date.now() - st.emailLuc < 4000) return;
      if (!duNhip("continue", 4000)) return;
      const t = await bamNut("tiếp tục|tiep tuc|tiếp|tiep|continue|next|đăng nhập|dang nhap|submit", { fallbackSubmit: true });
      if (t && !st.clickedContinue) { st.clickedContinue = true; log("  → bấm '" + t + "' (Turnstile xong)"); }
      return;
    }
    // 6) Trang mật khẩu KHÔNG kèm OTP (luồng nhiều trang) → nộp để sang bước OTP
    if (coPass && !coOTP && !emailTrong && !passTrong && !st.passSubmitted) {
      const t = await bamNut("đăng nhập|dang nhap|tiếp|tiep|next|continue|submit", { fallbackSubmit: true });
      if (t) { st.passSubmitted = true; log("  → tiếp sau mật khẩu: " + t); }
      return;
    }
    // 7) Trang có OTP & đã gõ OTP xong & email/mật khẩu đầy → NỘP 1 LẦN DUY NHẤT
    if (coOTP && st.otpDone && !emailTrong && !passTrong && !st.credSubmitted && !DRY_OTP) {
      const t = await bamNut("đăng nhập|dang nhap|xác nhận|xac nhan|verify|submit|continue", { fallbackSubmit: true });
      if (t) { st.credSubmitted = true; log("  → NỘP đăng nhập (1 lần duy nhất): " + t); }
      return;
    }
  } catch { /* trang đang chuyển */ } finally { busy = false; }
}
const nhip = setInterval(tick, 1000);

/* ---------- PHÁT HIỆN SAI MẬT KHẨU TỨC THÌ (quét 200ms) ----------
   IdP (auth-idp.inshasaki.com / SSO) hiện thông báo lỗi -> thoát NGAY exit(1),
   không ngồi chờ hết hạn 4 phút. Chỉ bật khi script TỰ điền mật khẩu (.env);
   đăng nhập tay thì không bật — người dùng còn gõ lại. */
const RE_SAI_MK = /sai mật khẩu|mật khẩu không (chính xác|đúng)|không chính xác|thông tin đăng nhập không (đúng|hợp lệ)|invalid (username or )?password|incorrect password|wrong password|đăng nhập thất bại|login failed|invalid credentials/i;
let baoSaiMK = null;
if (PASSWORD) baoSaiMK = setInterval(async () => {
  try {
    const loi = await page.evaluate(() => {
      const sel = '[role="alert"], .error, .alert, .alert-danger, .text-danger, .invalid-feedback, .ant-form-item-explain-error, .MuiFormHelperText-root, [class*="error" i], [class*="invalid" i]';
      return [...document.querySelectorAll(sel)]
        .map(e => (e.innerText || "").trim()).filter(Boolean).join(" | ").slice(0, 400);
    }).catch(() => "");
    if (loi && RE_SAI_MK.test(loi)) {
      clearInterval(baoSaiMK); clearInterval(nhip); clearInterval(theoDoi);
      log("✗ SAI MẬT KHẨU — IdP báo: " + loi.slice(0, 140));
      log("  → Dừng NGAY (không chờ hết hạn). Kiểm tra lại HASAKI_PASSWORD trong .env.");
      xoaLock();
      try { await browser.close(); } catch {}
      process.exit(1);
    }
  } catch { /* trang đang chuyển hướng */ }
}, 200);

const HAN = AUTO ? 4 * 60 * 1000 : 15 * 60 * 1000;
const t0 = Date.now();
// Sau khi đăng nhập OK: chụp LUÔN token hr.hasaki (session đã có) → nạp kho CẢ work + hr,
// để 1 lần đăng nhập là đủ cho cả 3 bộ, các bộ khác không phải mở trình duyệt/đăng nhập lại.
let dangKetThuc = false;
// wshr có CHẤP NHẬN token không? — Hasaki ID v2 (27/07/2026) có lúc gửi id_token OIDC của IdP
// lên wshr trước khi app mint JWT thật; nạp nhầm vào kho là các bộ sau gọi API "lặng lẽ rỗng".
const wshrNhan = async (tk) => { try { return (await fetch("https://wshr.hasaki.vn/api/news/staff/search-for-dropdown?limit=1", { headers: { authorization: tk } })).ok; } catch { return false; } };
async function ketThucThanhCong() {
  if (dangKetThuc) return; dangKetThuc = true;
  clearInterval(theoDoi); clearInterval(nhip); if (baoSaiMK) clearInterval(baoSaiMK);
  log("✅ Đăng nhập thành công.");
  try {
    if (!tokHr) {
      await page.goto("https://hr.hasaki.vn/", { waitUntil: "networkidle2", timeout: 30000 }).catch(() => {});
      for (let i = 0; i < 12 && !tokHr; i++) await new Promise((r) => setTimeout(r, 700));
    }
  } catch {}
  if (tokWork && !(await wshrNhan(tokWork))) { log("  … token work bắt được bị wshr từ chối (id_token OIDC?) — BỎ, không nạp kho."); tokWork = null; }
  if (tokHr && !(await wshrNhan(tokHr))) { log("  … token hr bắt được bị wshr từ chối (id_token OIDC?) — BỎ, không nạp kho."); tokHr = null; }
  try { luuNhieu(DIR, { work: tokWork, hr: tokHr }); log("  ✓ Nạp kho token: work=" + (tokWork ? "có" : "—") + ", hr=" + (tokHr ? "có" : "—") + "."); } catch (e) { log("  (không nạp được kho token: " + e.message + ")"); }
  browser.close().catch(() => {});
}
const theoDoi = setInterval(async () => {
  if (ok) { ketThucThanhCong(); }
  else if (Date.now() - t0 > HAN) {
    clearInterval(theoDoi); clearInterval(nhip); if (baoSaiMK) clearInterval(baoSaiMK);
    // Ghi "ảnh hiện trường" trước khi đóng: kẹt ở URL nào, thấy nút gì — để lần sau khỏi đoán mò.
    try {
      const nut = await page.evaluate(() => [...document.querySelectorAll('button,[role=button],a,input[type=submit]')]
        .filter(e => e.offsetParent !== null).map(e => (e.innerText || e.value || "").trim()).filter(Boolean).slice(0, 8).join(" | "));
      log("⏰ Quá hạn chưa đăng nhập được (Turnstile/OTP?). Kẹt tại: " + page.url() + (nut ? " — nút thấy được: " + nut : ""));
    } catch { log("⏰ Quá hạn chưa đăng nhập được (Turnstile/OTP?). Đóng."); }
    browser.close().catch(() => {});
  }
}, 1000);

if (!AUTO) log("👉 " + (SECRET ? "Sẽ tự đăng nhập." : "Gõ OTP xong sẽ tự đóng.") + " (Đóng tay cũng được.)");
await new Promise((resolve) => browser.on("disconnected", resolve));
clearInterval(nhip); clearInterval(theoDoi);
xoaLock();
log(ok ? "Đã lưu phiên. Các bộ chạy lại bình thường." : (DRY_OTP ? "Kết thúc DRY-OTP (không nộp OTP)." : "Đã đóng (chưa xác nhận đăng nhập)."));
process.exit(ok ? 0 : (DRY_OTP ? 0 : 1));
