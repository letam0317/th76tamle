/**
 * ĐƯỜNG HẦM 8591 → internet (19/10 user duyệt: điện thoại xem được Theo tác vụ / Theo máy / Nhật ký, CHỈ khi đã đăng nhập).
 *
 *  - Chạy bin/cloudflared.exe «quick tunnel» trỏ vào máy chủ Xác minh http://127.0.0.1:8591 (tài khoản Cloudflare đang có
 *    không có tên miền riêng ⇒ chưa đặt được tên miền con cố định; địa chỉ *.trycloudflare.com đổi mỗi lần đường hầm khởi động lại).
 *  - Có địa chỉ mới → ghi summary/xm-may-chu.json lên repo kiemsoatkho (GitHub API, GH_TOKEN ở .env) + bản cục bộ;
 *    trang audit-dc đọc tệp này rồi dò /api/ping. Không đổi địa chỉ thì không ghi (không tốn lượt).
 *  - Gác cổng nằm ở bang-591.mjs: yêu cầu qua đường hầm (tiêu đề cf-connecting-ip/cf-ray) không có phiên → 401.
 *  - Canh sức khoẻ 3' một lần: 3 lần liền không ping được qua đường hầm → khởi động lại cloudflared. cloudflared thoát → chạy lại sau 10 s.
 *
 *  Chạy nền: task «5S Duong ham 8591» (_DUONG-HAM-591.vbs, khi đăng nhập + mỗi 15', chạy cả khi dùng pin). Chỉ 1 bản (khoá .duong-ham-591.pid).
 */
import fs from "node:fs";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EXE = path.join(DIR, "bin", "cloudflared.exe");
const GOC = "http://127.0.0.1:" + (process.env.BANG591_PORT || 8591);
const KHOA = path.join(DIR, ".duong-ham-591.pid");
const TEP = "summary/xm-may-chu.json";
const LOG = path.join(DIR, "duong-ham-591.log");
const log = (...a) => { const d = new Date().toLocaleString("vi-VN", { hour12: false }) + " " + a.join(" "); console.log(d); try { fs.appendFileSync(LOG, d + "\n"); } catch { /* */ } };

// ---- chỉ 1 bản ----
try { const cu = Number(fs.readFileSync(KHOA, "utf8")); if (cu && cu !== process.pid) { try { process.kill(cu, 0); process.exit(0); } catch { /* bản cũ đã chết */ } } } catch { /* */ }
fs.writeFileSync(KHOA, String(process.pid));
process.on("exit", () => { try { if (Number(fs.readFileSync(KHOA, "utf8")) === process.pid) fs.unlinkSync(KHOA); } catch { /* */ } });

async function ghiGithub(o) {
  const noiDung = JSON.stringify(o, null, 1) + "\n";
  try { fs.writeFileSync(path.join(DIR, "kiemsoatkho", TEP), noiDung); } catch { /* */ }
  const T = process.env.GH_TOKEN; if (!T) return log("✗ thiếu GH_TOKEN — không công bố được địa chỉ");
  const U = "https://api.github.com/repos/letam0317/kiemsoatkho/contents/" + TEP, H = { Authorization: "Bearer " + T, "User-Agent": "duong-ham-591", Accept: "application/vnd.github+json" };
  for (let lan = 0; lan < 3; lan++) {
    try {
      const g = await fetch(U, { headers: H }); const sha = g.ok ? (await g.json()).sha : undefined;
      const r = await fetch(U, { method: "PUT", headers: H, body: JSON.stringify({ message: "đường hầm Xác minh: " + o.url, content: Buffer.from(noiDung).toString("base64"), sha, branch: "main" }) });
      if (r.ok) return log("✓ đã công bố", o.url);
      log("✗ GitHub", r.status, (await r.text()).slice(0, 120));
    } catch (e) { log("✗ GitHub", e.message); }
    await new Promise((r) => setTimeout(r, 5000 * (lan + 1)));
  }
}
async function pingQuaHam(url) {
  try { const r = await fetch(url + "/api/ping", { signal: AbortSignal.timeout(10000) }); return r.ok; } catch { return false; }
}

let CF = null, URLH = "", hong = 0;
function chay() {
  URLH = ""; hong = 0;
  log("khởi động cloudflared →", GOC);
  CF = spawn(EXE, ["tunnel", "--no-autoupdate", "--protocol", "http2", "--url", GOC], { windowsHide: true });
  const doc = async (b) => {
    const m = String(b).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (!m || URLH) return;
    URLH = m[0]; log("địa chỉ:", URLH);
    for (let i = 0; i < 24 && !(await pingQuaHam(URLH)); i++) await new Promise((r) => setTimeout(r, 5000));   // DNS mới cần vài giây
    let cu = {}; try { cu = JSON.parse(fs.readFileSync(path.join(DIR, "kiemsoatkho", TEP), "utf8")); } catch { /* */ }
    if (cu.url !== URLH) await ghiGithub({ url: URLH, luc: new Date().toISOString() });
  };
  CF.stdout.on("data", doc); CF.stderr.on("data", doc);
  CF.on("exit", (c) => { log("cloudflared thoát, mã", c, "— chạy lại sau 10 s"); CF = null; setTimeout(chay, 10000); });
}
setInterval(async () => {
  if (!CF || !URLH) return;
  if (await pingQuaHam(URLH)) { hong = 0; return; }
  if (!(await fetch(GOC + "/api/ping").then((r) => r.ok, () => false))) return log("máy chủ 8591 chưa chạy — chờ");
  if (++hong >= 3) { log("3 lần không ping được qua đường hầm → khởi động lại"); CF.kill(); }
}, 3 * 60 * 1000);
try { execSync("taskkill /F /IM cloudflared.exe", { stdio: "ignore" }); } catch { /* không có bản mồ côi */ }   // bản node trước bị giết thì cloudflared con còn sót
chay();
