/**
 * tra-bom.mjs — TRA MỘT TỪ KHOÁ TRÊN bom.inshasaki.com BẰNG PHIÊN SẴN CÓ (chỉ ĐỌC)
 * ===========================================================================================
 *  Vì sao có file này: `bom.inshasaki.com` ("HASAKI | BOM - INSIDE") là SPA, dữ liệu nằm ở
 *  `bom-gw.inshasaki.com/api`, và nó đăng nhập bằng CÙNG HỌ OIDC với WMS
 *  (`auth.inshasaki.com` + `auth-api.inshasaki.com/api/auth/oidc`). Không có token audience của
 *  bom-gw trong kho token, nên đường duy nhất KHÔNG phải đăng nhập mới là: mở đúng trang bằng
 *  profile Edge của bot (`.wms-session/edge-profile`) — nếu cookie IdP còn sống thì SPA tự lấy
 *  token và gọi API, mình chỉ việc NGHE phản hồi.
 *
 *  CHỈ ĐỌC — không điền form, không bấm đăng nhập, không gửi gì lên. Trượt thì báo "chưa có phiên"
 *  rồi thoát, KHÔNG tự tạo phiên mới (luật của dự án: không đá phiên người đang làm).
 *
 *  node tra-bom.mjs "<url đầy đủ>" [--sso] [--hien]
 *    --sso  : nếu bị đẩy về IdP thì BẤM tile tài khoản đã nhớ (SSO im lặng). KHÔNG bao giờ gõ mật
 *             khẩu/OTP — thấy trang đó là dừng, để không tiêu vào hạn mức đăng nhập của tài khoản.
 *    --hien : mở cửa sổ thật (đo 21/08/2026: headless và headful ra KẾT QUẢ Y NHAU ở màn IdP,
 *             nên headless không phải chỗ nghẽn — giữ cờ này để soi bằng mắt khi cần)
 *
 *  ── ĐO THẬT 21/08/2026 (tra "cwpt0019" ở /sales/manufactor-orders) ──────────────────────────
 *  Kết quả: **profile bot KHÔNG có phiên Hasaki ID sống**. Bằng chứng chắc nhất không phải cái màn
 *  đăng nhập, mà là đường đi của OIDC: request tới
 *      auth-gateway-public.inshasaki.com/api/auth/oidc/authorize?app_code=bom&…
 *  bị đẩy sang `auth-idp.inshasaki.com/login/identifier`. Phiên còn sống thì endpoint authorize
 *  nhảy THẲNG về `bom.inshasaki.com/auth/callback?code=…`, không hiện giao diện nào.
 *  Màn IdP có TILE "tamlc@hasaki.vn" — đó chỉ là tài khoản ĐƯỢC NHỚ, không phải phiên sống; dưới
 *  màn có 3 dấu chấm bước (chọn tài khoản → mật khẩu → OTP). Bấm tile 6 nhịp (cả headless lẫn cửa
 *  sổ thật) đều KHÔNG chuyển bước.
 *  ⇒ Muốn lấy dữ liệu BOM thì phải ĐĂNG NHẬP THẬT (mật khẩu + OTP). Việc đó KHÔNG thuộc file này:
 *    gọi `login-hasaki.js` — nó có cầu dao chống khoá tài khoản, có nhịp Turnstile, và có đường xin
 *    OTP qua chat. File này chỉ ĐỌC, và cố ý dừng khi thấy trang mật khẩu/OTP.
 *
 *  ⚠ BẪY ĐÃ CẮN: URL của IdP CHỨA chuỗi "bom.inshasaki.com" trong tham số `redirect_uri`
 *  (…%2Fbom.inshasaki.com%2Fauth%2Fcallback), nên phép kiểm "đã vào được BOM chưa" bằng regex trên
 *  CẢ CHUỖI báo THÀNH CÔNG ngay lúc đang đứng ở trang đăng nhập (dấu "/" bị mã hoá thành %2F nên
 *  mẫu chặn /auth/callback cũng không khớp). Mọi phép "đang ở trang nào" phải xét HOSTNAME +
 *  PATHNAME đã phân giải (`new URL`), không xét chuỗi thô — xem `oDau`/`vaoDuocBom`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH, duongDanProfile } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, ".exports", "bom");
const A = process.argv.slice(2);
const URL_TRA = A.find((x) => /^https?:\/\//.test(x));
const HIEN = A.includes("--hien");
const SSO = A.includes("--sso");
if (!URL_TRA) { console.error("✗ Thiếu URL. Ví dụ: node tra-bom.mjs \"https://bom.inshasaki.com/sales/manufactor-orders?keyword=cwpt0019\""); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const profile = duongDanProfile(DIR);
console.log("• Profile Edge: " + profile);
console.log("• URL        : " + URL_TRA);

const browser = await puppeteer.launch({
  headless: !HIEN, executablePath: EDGE_PATH,
  userDataDir: profile,
  args: ["--no-first-run", "--no-default-browser-check", "--disable-features=msEdgeIdentity"],
});
const page = (await browser.pages())[0] || (await browser.newPage());
await page.setViewport({ width: 1500, height: 950 });

/* NGHE phản hồi của gateway — dữ liệu thật nằm ở đây, không phải trong DOM. */
const api = [];
page.on("response", async (r) => {
  const u = r.url();
  if (!/bom-gw\.inshasaki\.com|auth-api\.inshasaki\.com/.test(u)) return;
  let than = "";
  try { than = (await r.text()).slice(0, 200000); } catch { than = "(không đọc được thân)"; }
  api.push({ url: u, status: r.status(), than });
});

/* ── SSO IM LẶNG (chỉ khi có --sso) ─────────────────────────────────────────────────────────────
 * IdP đẩy về trang "Choose your account to continue" kèm TILE tài khoản. Tile đó nghĩa là IdP CÓ
 * NHỚ tài khoản, nhưng chưa nói phiên còn sống hay không: bấm vào có thể vào thẳng (cookie IdP còn
 * sống ⇒ SSO thật) hoặc rơi sang trang mật khẩu (chỉ là gợi ý tài khoản).
 *
 * ⚠ HÀM NÀY KHÔNG BAO GIỜ GÕ MẬT KHẨU / OTP. Thấy trang mật khẩu hoặc trang OTP là DỪNG NGAY và
 * báo về. Lý do nằm ở khối "CẦU DAO CHỐNG KHOÁ TÀI KHOẢN" trong login-hasaki.js: IdP đếm lượt SAI
 * theo TÀI KHOẢN và mỗi lượt bot nộp sai ăn 2 slot — một luồng tra cứu đọc-thôi không có quyền
 * tiêu vào hạn mức đó. Muốn đăng nhập thật thì gọi đúng `login-hasaki.js` (nó có cầu dao, có nhịp,
 * có đường xin OTP qua chat).
 * Bấm CÓ NHỊP (một lần mỗi 3s, tối đa 6 lượt): IdP v2 ẩn Turnstile sau checkbox first-party, bấm
 * dồn dập là tự reset vòng đăng nhập (sự cố 27/07/2026 ghi trong login-hasaki.js). */
function oDau(u) {
  try { const x = new URL(u); return { host: x.hostname, duong: x.pathname }; }
  catch { return { host: "", duong: "" }; }
}
function vaoDuocBom(u) {
  const { host, duong } = oDau(u);
  return host === "bom.inshasaki.com" && !/^\/auth\/(login|callback)/.test(duong);
}
async function ssoImLang(page, log) {
  const CHO_TOI_DA = 6;
  for (let i = 0; i < CHO_TOI_DA; i++) {
    const u = page.url();
    if (vaoDuocBom(u)) { log("  ✓ đã vào được BOM"); return true; }
    if (/^\/login\/password/.test(oDau(u).duong)) { log("  ⏹ IdP đòi MẬT KHẨU — dừng (không gõ mật khẩu/OTP ở luồng tra cứu)"); return false; }
    const coMk = await page.$('input[type="password"]').catch(() => null);
    const coOtp = await page.evaluate(() => /otp|mã xác thực|ma xac thuc|verification code/i.test(document.body ? document.body.innerText : "")).catch(() => false);
    if (coMk || coOtp) { log("  ⏹ IdP đòi mật khẩu/OTP — dừng, không tiêu vào hạn mức đăng nhập"); return false; }
    /* checkbox "I'm not a robot" (first-party, không iframe) — tick bằng chuột thật */
    const cb = await page.$('[role="checkbox"][aria-checked="false"]').catch(() => null);
    if (cb) { try { await cb.hover(); await cb.click({ delay: 40 }); log("  → tick \"I'm not a robot\""); } catch {} await cb.dispose(); await new Promise((r) => setTimeout(r, 3000)); continue; }
    /* TILE tài khoản: bấm đúng ô có email, KHÔNG bấm "Use another account" (bấm nó là reset vòng) */
    const bam = await page.evaluate(() => {
      const xau = /use another|tài khoản khác|tai khoan khac|đăng xuất|dang xuat|huỷ|huy|cancel|back/i;
      const els = [...document.querySelectorAll('button,[role="button"],a,li,div')];
      const t = els.find((e) => {
        const s = (e.innerText || "").trim();
        return s && s.length < 90 && /@hasaki\.vn/i.test(s) && !xau.test(s) && e.getBoundingClientRect().height > 24;
      });
      if (t) { t.click(); return (t.innerText || "").trim().slice(0, 60); }
      const n = els.find((e) => {
        const s = (e.innerText || "").trim();
        return s && s.length < 40 && /^(tiếp tục|tiep tuc|continue|sign in|đăng nhập|dang nhap)$/i.test(s) && !e.disabled;
      });
      if (n) { n.click(); return (n.innerText || "").trim(); }
      return "";
    }).catch(() => "");
    if (bam) log("  → bấm \"" + bam + "\"");
    else log("  … chưa thấy tile/nút nào để bấm (lượt " + (i + 1) + ")");
    await new Promise((r) => setTimeout(r, 3000));
  }
  return vaoDuocBom(page.url());
}

try { await page.goto(URL_TRA, { waitUntil: "networkidle2", timeout: 60000 }); }
catch (e) { console.log("… goto: " + e.message.slice(0, 90)); }
await new Promise((r) => setTimeout(r, 5000));
if (SSO && !vaoDuocBom(page.url())) {
  console.log("\n• Bị đẩy về IdP — thử SSO im lặng (chỉ bấm tile đã nhớ):");
  const ok = await ssoImLang(page, (s) => console.log(s));
  if (ok) {
    /* Vào được rồi thì mở LẠI đúng URL tra cứu: lượt trước đã bị IdP cắt giữa đường. */
    try { await page.goto(URL_TRA, { waitUntil: "networkidle2", timeout: 60000 }); } catch {}
    await new Promise((r) => setTimeout(r, 6000));
  }
}

const cuoi = page.url();
const tieuDe = await page.title().catch(() => "");
const chu = await page.evaluate(() => document.body ? document.body.innerText.replace(/\n{2,}/g, "\n").slice(0, 4000) : "").catch(() => "");
await page.screenshot({ path: path.join(OUT, "bom.png"), fullPage: false }).catch(() => {});
await browser.close();

console.log("\n• URL cuối   : " + cuoi);
console.log("• Tiêu đề    : " + tieuDe);
const laLogin = !vaoDuocBom(cuoi);
console.log("• Trạng thái : " + (laLogin ? "CHƯA CÓ PHIÊN (bị đẩy về trang đăng nhập)" : "vào được trang"));

console.log("\n════ " + api.length + " lượt gọi gateway ════");
for (const x of api) {
  console.log("  [" + x.status + "] " + x.url.slice(0, 150));
  const t = x.than.trim();
  if (t && t.length < 400) console.log("        " + t.replace(/\s+/g, " "));
}
const kq = api.filter((x) => x.status === 200 && /[[{]/.test(x.than) && x.than.length > 60);
if (kq.length) {
  fs.writeFileSync(path.join(OUT, "bom-api.json"), JSON.stringify(api, null, 1), "utf8");
  console.log("\n✓ Đã lưu toàn bộ phản hồi: " + path.join(OUT, "bom-api.json"));
}
console.log("\n──── chữ trên trang (2000 ký tự đầu) ────\n" + chu.slice(0, 2000));
console.log("\n(ảnh: " + path.join(OUT, "bom.png") + ")");
