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
import { trangThaiPhien, DEFER_EXIT } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const LOCK = path.join(DIR, ".login-open.lock");
const xoaLock = () => { try { fs.rmSync(LOCK, { force: true }); } catch {} };

/* ===== CẦU DAO CHỐNG KHOÁ TÀI KHOẢN (31/07/2026) ==============================
 * IdP đếm lượt đăng nhập SAI theo TÀI KHOẢN: "You have N attempts left before your
 * account is locked" → hết thì "Bạn đã thử quá nhiều lần, vui lòng thử lại sau".
 * Đo được: 30/07 15:27 còn 8 lượt → 31/07 08:51 còn 6 ⇒ mỗi lượt bot nộp sai ăn 2 slot.
 * Nguy hiểm ở chỗ CẤP SỐ NHÂN: 3 cửa gọi login (auto-export · cham-cong · day-bao-cao
 * mỗi 15') × 2 lượt/lần, mà một đêm mất phiên là bot được phép login liên tục ⇒ đủ khoá
 * tài khoản, và khoá thì NGƯỜI THẬT cũng không đăng nhập được — đúng triệu chứng hôm nay.
 * LUẬT: nộp sai MỘT lần → cấm mọi lượt sau cho tới khi người xử lý. Dữ liệu cũ vài giờ
 * sửa được; tài khoản bị khoá thì cả người lẫn bot đứng. */
const MOC_SAI = path.join(DIR, ".login-that-bai.json");
const KHOA_GIO = Number(process.env.LOGIN_KHOA_GIO || 12);
const BO_KHOA = process.argv.includes("--bo-khoa") || String(process.env.LOGIN_BO_KHOA || "") === "1";
const docSai = () => { try { return JSON.parse(fs.readFileSync(MOC_SAI, "utf8")); } catch { return null; } };
function ghiSai(mota) {
  const cu = docSai() || {};
  try {
    fs.writeFileSync(MOC_SAI, JSON.stringify({
      lan: (cu.lan || 0) + 1, luc: new Date().toISOString(), mota: String(mota || "").slice(0, 300),
    }, null, 2));
  } catch { /* mốc best-effort */ }
}
const xoaSai = () => { try { fs.rmSync(MOC_SAI, { force: true }); } catch { /* bỏ qua */ } };
/** Lấy phần "thông báo: …" trong ảnh hiện trường để lưu lý do đúng nguyên văn của IdP. */
const loiTuHienTruong = (ht) => { const m = String(ht).match(/thông báo: ([\s\S]+)$/); return m ? m[1].trim() : String(ht).slice(0, 200); };

const PROFILE_DIR = duongDanProfile(DIR);
const EMAIL = process.env.HASAKI_EMAIL || "";
const PASSWORD = process.env.HASAKI_PASSWORD || "";
/* OTP THỦ CÔNG — Đường 2 (12/08/2026). TOTP đã chuyển sang app Hasaki Authenticator, KHÔNG xuất
 * seed base32 nên bot không tự sinh mã được nữa. Bật LOGIN_OTP_TAY=1 (hoặc --otp-tay): coi như
 * KHÔNG có secret → bot điền sẵn email+mật khẩu rồi DỪNG cho người gõ 6 số (đọc từ app điện thoại).
 * Hết đốt lượt bằng mã sai; đăng nhập tự động (--auto) tự hoãn, nhường luồng "nút trong email". */
const OTP_TAY = process.argv.includes("--otp-tay") || String(process.env.LOGIN_OTP_TAY || "") === "1";
const SECRET = OTP_TAY ? "" : (process.env.HASAKI_2FA_SECRET || "").replace(/\s+/g, "");
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
if (AUTO && !SECRET) {
  // OTP thủ công: lượt TỰ ĐỘNG không thể hoàn tất (không có mã để gõ) → HOÃN êm (75, không phải lỗi),
  // để bộ gọi (auto-login) hiểu là "chờ người" chứ không báo động; người đăng nhập qua nút trong email.
  if (OTP_TAY) { log("⏸ OTP thủ công đang bật (LOGIN_OTP_TAY=1) — KHÔNG tự đăng nhập. Chờ người bấm nút trong email rồi gõ OTP tay."); process.exit(DEFER_EXIT); }
  log("✗ --auto cần HASAKI_2FA_SECRET. Thoát."); process.exit(1);
}

if (fs.existsSync(LOCK)) {
  if (Date.now() - fs.statSync(LOCK).mtimeMs < 15 * 60 * 1000) { log("Đã có phiên login đang chạy — bỏ qua."); process.exit(0); }
  xoaLock();
}

// CẦU DAO: đã có lượt bị IdP TỪ CHỐI gần đây → không nộp thêm lượt nào (kể cả lượt người bấm nút:
// script vẫn tự gõ mật khẩu + OTP nên vẫn ăn hạn mức như lượt tự động).
{
  const sai = docSai();
  // khoaDenKhi: mốc gỡ khoá đặt tay (dùng khi cần chặn dài hơn cửa mặc định, vd đang bị IdP throttle).
  const conKhoa = !!sai && (sai.khoaDenKhi
    ? Date.now() < Date.parse(sai.khoaDenKhi)
    : Date.now() - Date.parse(sai.luc || 0) < KHOA_GIO * 3600 * 1000);
  if (conKhoa && !BO_KHOA) {
    log("⛔ CẦU DAO ĐANG NGẮT — lượt đăng nhập gần nhất bị IdP TỪ CHỐI lúc " + new Date(sai.luc).toLocaleString("vi-VN") + " (đã " + sai.lan + " lượt sai).");
    if (sai.mota) log("   IdP nói: " + sai.mota);
    log("   Mỗi lượt sai nữa là một bước tới KHOÁ TÀI KHOẢN — mà khoá thì NGƯỜI THẬT cũng không đăng nhập được.");
    log("   Gỡ khi đã chắc mật khẩu/OTP đúng: xoá " + MOC_SAI + " hoặc chạy kèm --bo-khoa.");
    process.exit(AUTO ? DEFER_EXIT : 4);
  }
  if (conKhoa && BO_KHOA) log("⚠ Cầu dao đang ngắt (" + sai.lan + " lượt sai) nhưng có --bo-khoa → vẫn chạy. Đây là lượt CÓ RỦI RO khoá tài khoản.");
}

/* ================= CỬA KIỂM Ở ĐẦU VÀO (Phần F bước 2, 30/07/2026) =================
 * Trước bản này login-hasaki KHÔNG hỏi session-rules → *bất cứ gì* spawn nó cũng đăng nhập
 * được, và mỗi lượt như thế là một cú đá phiên operator (WMS 1 phiên/tài khoản).
 * Luật: KHÔNG login khi ĐANG CÓ phiên sống — vì chỉ khi có phiên sống thì login mới gây hại.
 *
 * CHỈ áp cho lượt TỰ ĐỘNG (--auto, do auto-login.js gọi khi phiên chết).
 * Lượt người chủ động (nút trong email → watch-login-request spawn KHÔNG kèm --auto, hoặc chạy
 * tay) thì KHÔNG chặn: người đã cố ý yêu cầu thì họ biết mình đang làm gì.
 * EP_RELOGIN=1 để bỏ qua khi cần khẩn cấp.
 *
 * Phân biệt 2 kiểu "không chắc" — khác nhau ở chỗ có thông tin hay không:
 *  • `khongro` (ĐÁNH GIÁ ĐƯỢC, kết luận là không rõ): get-me không trả lời (mất mạng) HOẶC token
 *    trong kho còn SỐNG mà thiếu nhãn nguồn. Cả hai đều KHÔNG nên login — mất mạng thì login cũng
 *    trượt, còn token còn sống thì vốn chẳng cần login. → hoãn (75).
 *  • `tt === null` (đánh giá VĂNG ngoài dự kiến): không có thông tin nào → giữ hành vi bản cũ là
 *    CHO CHẠY, thà thử còn hơn để dữ liệu đứng im vì một lỗi lạ; ghi log rõ để tra. */
if (AUTO && String(process.env.EP_RELOGIN || "") !== "1") {
  const tt = await trangThaiPhien(DIR, log).catch(() => null);
  if (tt && (tt.ai === "nguoi" || tt.ai === "bot")) {
    log("⛔ KHÔNG đăng nhập: " + tt.vi + ".");
    log("   (Đá phiên đang sống là mất việc của người đang làm — bộ gọi hãy dùng token đó qua layTokenSongWms.)");
    process.exit(DEFER_EXIT);
  }
  if (tt && tt.ai === "khong" && !tt.duocLogin) {
    log("⏳ HOÃN đăng nhập: " + tt.vi + " (đệm quanh giờ người tới/rời máy — tránh cắt ngang lượt login đang dở).");
    process.exit(DEFER_EXIT);
  }
  if (tt && tt.ai === "khongro") { log("⚠ " + tt.vi + " — thoát, tick sau thử lại."); process.exit(DEFER_EXIT); }
  if (tt) log("✓ Cửa kiểm phiên: " + tt.vi + ".");
  else log("⚠ Không đánh giá được trạng thái phiên (lỗi bất ngờ) — vẫn chạy như bản cũ, xem log để tra.");
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
    // Nút "phá luồng" — TUYỆT ĐỐI không rơi vào qua fallbackSubmit.
    // 27/07/2026: fallback mù bấm "Use another account" mỗi giây → reset vòng đăng nhập.
    // 30/07/2026: lượt 09:21 máy vừa boot CHƯA CÓ MẠNG (DNS ENOTFOUND) → trang lỗi của Edge
    //   chỉ có nút "Refresh" → fallback bấm Refresh và báo "đăng nhập thành công" oan.
    //   Nhóm resend/gửi lại/đổi phương thức cũng chặn: bấm bừa = tốn lượt gửi OTP, dễ khoá.
    const XAU = /use another|another account|tài khoản khác|tai khoan khac|sign ?out|log ?out|đăng xuất|dang xuat|cancel|huỷ|hủy|quay lại|quay lai|\bback\b|refresh|reload|tải lại|tai lai|làm mới|lam moi|resend|gửi lại|gui lai|send again|try another|another way|phương thức khác|phuong thuc khac|đổi phương thức|doi phuong thuc|\bchange\b/i;
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

/* ---------- ẢNH HIỆN TRƯỜNG (30/07/2026) ----------
 * IdP Hasaki đã đổi giao diện 2 lần trong 1 tuần. Trước đây mỗi lần đổi là một buổi đoán mò vì
 * log chỉ nói "Quá hạn (Turnstile/OTP?)". Nay mọi lối thoát đều ghi: URL, PHƯƠNG THỨC XÁC THỰC
 * mà IdP đòi (tham số auth_methods trên URL — chính IdP khai), ô nhập, nút, và thông báo lỗi.
 * IdP khai dạng: ...&auth_methods=PASSWORD,SMS_OTP,TOTP&method_locked=1 */
const phuongThucIdP = () => { try { return new URL(page.url()).searchParams.get("auth_methods") || ""; } catch { return ""; } };
async function anhHienTruong() {
  let mo = "";
  try {
    mo = await page.evaluate(() => {
      const hienRa = (e) => e.offsetParent !== null;
      const inp = [...document.querySelectorAll("input")].filter(hienRa)
        .map((e) => (e.type || "text") + (e.name ? ":" + e.name : "") + (e.value ? "=có" : "=trống")).slice(0, 8).join(", ");
      const nut = [...document.querySelectorAll('button,[role=button],a,input[type=submit]')].filter(hienRa)
        .map((e) => (e.innerText || e.value || "").trim()).filter(Boolean).slice(0, 10).join(" | ");
      const loi = [...document.querySelectorAll('[role="alert"],.error,.alert,[class*="error" i]')].filter(hienRa)
        .map((e) => (e.innerText || "").trim()).filter(Boolean).join(" / ").slice(0, 200);
      return "ô nhập: [" + (inp || "KHÔNG có") + "] · nút: [" + (nut || "KHÔNG có") + "]" + (loi ? " · thông báo: " + loi : "");
    });
  } catch { mo = "(không đọc được DOM — trang đang chuyển hướng)"; }
  const pt = phuongThucIdP();
  return "URL: " + page.url().slice(0, 170) + (pt ? "\n    IdP đòi phương thức: " + pt : "") + "\n    " + mo;
}
async function dungVoiHienTruong(lyDo, ma = 1) {
  clearInterval(nhip); clearInterval(theoDoi); if (baoSaiMK) clearInterval(baoSaiMK);
  log("✗ " + lyDo);
  log("  ẢNH HIỆN TRƯỜNG:\n    " + (await anhHienTruong()));
  xoaLock();
  try { await browser.close(); } catch { /* đã đóng */ }
  process.exit(ma);
}

/* ---------- Máy trạng thái: điền theo Ô ĐANG TRỐNG (chịu được trang gộp email+mật khẩu+OTP) ---------- */
const st = { otpDone: false, passSubmitted: false, credSubmitted: false, clickedContinue: false, otpWaitLogged: false, loggedEmail: false, loggedPass: false, emailLuc: 0, ssoMiss: 0, manLa: 0, ptLogged: false };
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
    // 0) IdP khai phương thức xác thực trên URL — ghi 1 lần, và DỪNG SỚM nếu không có TOTP.
    //    Đổi hệ authenticator (sang SMS OTP / duyệt trên app / passkey) thì bot KHÔNG thể tự làm:
    //    gõ mã sinh từ HASAKI_2FA_SECRET chỉ tốn lượt sai và có thể khoá tài khoản → dừng, để người
    //    đăng nhập tay 1 lần (phiên trong Edge profile sống tiếp cho các bộ dùng lại).
    {
      // Chỉ tin tham số khi ĐANG ở trên host IdP (auth-idp…): tránh đọc nhầm từ trang khác.
      const pt = /auth-idp/i.test(hostHienTai()) ? phuongThucIdP() : "";
      if (pt && !st.ptLogged) { st.ptLogged = true; log("  ℹ IdP đòi phương thức: " + pt); }
      if (pt && SECRET && !/TOTP/i.test(pt)) {
        await dungVoiHienTruong("IdP KHÔNG còn nhận TOTP cho lượt này (auth_methods=" + pt + ") — hệ xác thực đã đổi."
          + " Bot dừng, KHÔNG gõ mã (tránh tốn lượt/khoá tài khoản). Cần đăng nhập TAY 1 lần, hoặc cập nhật HASAKI_2FA_SECRET nếu đã ghi danh lại TOTP ở app mới.", 3);
      }
    }
    // 1) work.hasaki.vn (so HOST thật): chỉ có nút SSO
    if (hostHienTai() === "work.hasaki.vn" && await hien('button||[role=button]') && !(await hien('input'))) {
      if (!duNhip("sso", 5000)) return;
      const t = await bamNut("hasaki sso|đăng nhập với|dang nhap voi|sso", { fallbackSubmit: true });
      if (t) { st.ssoMiss = 0; log("  → bấm: " + t); return; }
      // Không tìm được nút SSO nào đáng bấm: trang lỗi mạng của Edge cũng lọt vào đây (URL giữ
      // nguyên work.hasaki.vn, chỉ có nút "Refresh" — đã bị XAU chặn). Đếm 4 lượt rồi dừng có ảnh.
      if (++st.ssoMiss >= 4) await dungVoiHienTruong("Ở work.hasaki.vn nhưng KHÔNG thấy nút SSO nào đáng bấm sau " + st.ssoMiss + " lượt (trang lỗi mạng / giao diện đổi?).");
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
    // 4b) MÀN HÌNH LẠ: không còn ô nhập nào, mà cũng không phải trang SSO (1) hay chọn tài khoản (1b).
    //     Ví dụ đúng thực tế: trang QUÉT QR / CHỜ DUYỆT TRÊN APP của hệ authenticator mới, hoặc trang
    //     lỗi. Trước đây rơi xuống bước 5 và bấm nút submit bất kỳ (09:21 30/07 bấm "Refresh").
    //     Nay: đợi 3 nhịp (~24s) cho trang render xong, vẫn lạ thì DỪNG kèm ảnh hiện trường.
    //     CHỈ áp dụng khi CHƯA nộp gì: sau khi nộp mật khẩu/OTP, các trang callback OIDC vốn không
    //     có ô nhập nào trong lúc chuyển hướng — giai đoạn đó để hạn HAN lo (cũng đã có ảnh).
    if (!(await hien('input')) && !st.passSubmitted && !st.credSubmitted) {
      if (!duNhip("man-la", 8000)) return;
      if (++st.manLa >= 3) await dungVoiHienTruong("Màn hình LẠ không có ô nhập nào suốt ~" + st.manLa * 8 + "s — không bấm bừa (tránh reset luồng/tốn lượt gửi OTP).");
      return;
    }
    st.manLa = 0;
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
/* "Incorrect sign-in details" (bản tiếng Anh của IdP) TRƯỚC ĐÂY không khớp regex nào → lượt 08:51
   hôm nay ngồi nhìn thông báo lỗi suốt 3,5 phút rồi mới hết hạn. Thêm vào để dừng ngay. */
const RE_SAI_MK = /sai mật khẩu|mật khẩu không (chính xác|đúng)|không chính xác|thông tin đăng nhập không (đúng|hợp lệ)|invalid (username or )?password|incorrect (password|sign.?in details)|wrong password|đăng nhập thất bại|login failed|invalid credentials/i;
/* Hạn mức lượt sai / bị chặn tạm — nghiêm trọng hơn sai mật khẩu: phải GHI CẦU DAO ngay. */
const RE_KHOA = /attempts? left|account is locked|tài khoản .*(khoá|khóa)|quá nhiều lần|too many (attempts|requests)|try again later|thử lại sau|temporarily (locked|blocked)/i;
let baoSaiMK = null;
if (PASSWORD) baoSaiMK = setInterval(async () => {
  try {
    const loi = await page.evaluate(() => {
      const sel = '[role="alert"], .error, .alert, .alert-danger, .text-danger, .invalid-feedback, .ant-form-item-explain-error, .MuiFormHelperText-root, [class*="error" i], [class*="invalid" i]';
      return [...document.querySelectorAll(sel)]
        .map(e => (e.innerText || "").trim()).filter(Boolean).join(" | ").slice(0, 400);
    }).catch(() => "");
    if (loi && RE_KHOA.test(loi)) {
      clearInterval(baoSaiMK); clearInterval(nhip); clearInterval(theoDoi);
      log("⛔ IdP ĐANG ĐẾM LƯỢT SAI / CHẶN TẠM: " + loi.slice(0, 200));
      log("  → Dừng NGAY và NGẮT CẦU DAO: mọi lượt đăng nhập tự động sau sẽ bị chặn " + KHOA_GIO + "h.");
      ghiSai(loi.slice(0, 200));
      xoaLock();
      try { await browser.close(); } catch { /* đã đóng */ }
      process.exit(1);
    }
    if (loi && RE_SAI_MK.test(loi)) {
      ghiSai(loi.slice(0, 200));
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
let dangKetThuc = false, napDuoc = false;   // napDuoc = đã nạp kho ≥1 token được wshr chấp nhận
// wshr có CHẤP NHẬN token không? — Hasaki ID v2 (27/07/2026) có lúc gửi id_token OIDC của IdP
// lên wshr trước khi app mint JWT thật; nạp nhầm vào kho là các bộ sau gọi API "lặng lẽ rỗng".
const wshrNhan = async (tk) => { try { return (await fetch("https://wshr.hasaki.vn/api/news/staff/search-for-dropdown?limit=1", { headers: { authorization: tk } })).ok; } catch { return false; } };
async function ketThucThanhCong() {
  if (dangKetThuc) return; dangKetThuc = true;
  clearInterval(theoDoi); clearInterval(nhip); if (baoSaiMK) clearInterval(baoSaiMK);
  log("→ Đã bắt được token — xác minh với wshr trước khi kết luận...");
  try {
    if (!tokHr) {
      await page.goto("https://hr.hasaki.vn/", { waitUntil: "networkidle2", timeout: 30000 }).catch(() => {});
      for (let i = 0; i < 12 && !tokHr; i++) await new Promise((r) => setTimeout(r, 700));
    }
  } catch {}
  if (tokWork && !(await wshrNhan(tokWork))) { log("  … token work bắt được bị wshr từ chối (id_token OIDC?) — BỎ, không nạp kho."); tokWork = null; }
  if (tokHr && !(await wshrNhan(tokHr))) { log("  … token hr bắt được bị wshr từ chối (id_token OIDC?) — BỎ, không nạp kho."); tokHr = null; }
  // THÀNH CÔNG = có ÍT NHẤT 1 token được wshr CHẤP NHẬN và đã nạp kho.
  // Vá 30/07/2026: trước đây `ok` bật khi THẤY bất kỳ request nào tới wshr có header authorization —
  // kể cả id_token OIDC của IdP. Sáng nay (09:21, máy vừa boot chưa có mạng) script báo
  // "✅ Đăng nhập thành công" rồi nạp kho RỖNG, exit 0 → auto-login tin là xong, KHÔNG thử lượt 2,
  // và cả cụm 8h40 chết trong im lặng. Nay không có token nào được nhận thì đó là THẤT BẠI.
  napDuoc = !!(tokWork || tokHr);
  if (napDuoc) {
    // Nhãn "bot": token này do CHÍNH BOT login mà có → lượt sau biết phiên đang sống là của mình,
    // không phải của người đang làm (cửa an toàn của luật Phần F).
    try { luuNhieu(DIR, { work: tokWork, hr: tokHr }, "bot"); xoaSai(); log("✅ Đăng nhập thành công — nạp kho token: work=" + (tokWork ? "có" : "—") + ", hr=" + (tokHr ? "có" : "—") + "."); }
    catch (e) { napDuoc = false; log("  ✗ Không nạp được kho token: " + e.message); }
  }
  if (!napDuoc) {
    log("✗ CHƯA đăng nhập được: có thấy request mang token nhưng wshr KHÔNG chấp nhận token nào (id_token OIDC / phiên chưa mint JWT thật).");
    log("  ẢNH HIỆN TRƯỜNG:\n    " + (await anhHienTruong()));
  }
  browser.close().catch(() => {});
}
// Giữ promise của bước kết thúc: nếu cửa sổ đóng GIỮA LÚC đang xác minh token với wshr, khối cuối
// file phải CHỜ nó xong mới kết luận — không thì lượt thành công bị báo thất bại oan (exit 1).
let ketThucXong = null;
const theoDoi = setInterval(async () => {
  if (ok) { ketThucXong = ketThucXong || ketThucThanhCong(); }
  else if (Date.now() - t0 > HAN) {
    clearInterval(theoDoi); clearInterval(nhip); if (baoSaiMK) clearInterval(baoSaiMK);
    // Ghi "ảnh hiện trường" trước khi đóng: kẹt ở đâu, IdP đòi gì, thấy ô/nút gì — khỏi đoán mò.
    log("⏰ Quá hạn chưa đăng nhập được sau " + Math.round(HAN / 60000) + "'.");
    const ht = await anhHienTruong();
    log("  ẢNH HIỆN TRƯỜNG:\n    " + ht);
    // ĐÃ NỘP mà vẫn hết hạn = IdP đã từ chối lượt này ⇒ ngắt cầu dao (không đoán, chỉ ghi khi có nộp).
    if (st.credSubmitted || st.passSubmitted) {
      ghiSai(loiTuHienTruong(ht));
      log("  ⛔ Đã NGẮT CẦU DAO: lượt sau bị chặn " + KHOA_GIO + "h (xoá " + path.basename(MOC_SAI) + " hoặc --bo-khoa để gỡ).");
    }
    browser.close().catch(() => {});
  }
}, 1000);

if (!AUTO) log("👉 " + (SECRET ? "Sẽ tự đăng nhập." : "Gõ OTP xong sẽ tự đóng.") + " (Đóng tay cũng được.)");
await new Promise((resolve) => browser.on("disconnected", resolve));
clearInterval(nhip); clearInterval(theoDoi);
if (ketThucXong) await ketThucXong.catch(() => {});   // chờ xác minh/nạp kho xong mới kết luận
xoaLock();
// Exit 0 CHỈ khi đã nạp kho token được wshr chấp nhận (napDuoc) — không còn tin `ok` (xem Vá 4).
log(napDuoc ? "Đã lưu phiên. Các bộ chạy lại bình thường." : (DRY_OTP ? "Kết thúc DRY-OTP (không nộp OTP)." : "Đã đóng (CHƯA đăng nhập được)."));
process.exit(napDuoc ? 0 : (DRY_OTP ? 0 : 1));
