/**
 * day-cloudflare.mjs — đẩy 2 dashboard lên Cloudflare Pages, dự án «audit-dc» → https://audit-dc.pages.dev (13/10/2026, kế hoạch async-wibbling-haven giai đoạn E).
 * GitHub vẫn là NGUỒN GỐC; Cloudflare chỉ là MẶT TIỀN:  /retail/ ← repo kiemsoatkho · /factory/ ← repo stocklocationfactory.
 *   node day-cloudflare.mjs                          # nguồn = bản đã đẩy lên GitHub · nhánh main (tên miền chính)
 *   node day-cloudflare.mjs --nguon=local --nhanh=xemtruoc   # nguồn = bản NỘI BỘ đang sửa (chưa đẩy GitHub) · bản xem trước https://xemtruoc.audit-dc.pages.dev
 *   thêm --ep  để đẩy kể cả khi không đổi · --kho  chỉ ráp thư mục, không đẩy
 * KHÔNG đẩy: summary/ + thu/ (đổi liên tục — trang đọc thẳng từ github.io qua window.GOC_DL), .git, bộ chỉnh dash-bocuc-sua.js (chỉ bản QC),
 *   thư mục tiện ích wms-bridge* / backend, tệp khoá *.pem. Retail lấy theo DANH SÁCH cho phép của deploy-kiemsoatkho.mjs (không chép bừa thư mục máy).
 * Hạn mức gói Free: không đổi thì BỎ QUA (băm SHA-256 cả cây) · nhánh main CHỈ lịch mỗi 60 phút (--lich) đẩy, tối đa 24 lượt/ngày. Khoá CF_API_TOKEN / CF_ACCOUNT_ID ở .env.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const DIR = path.dirname(fileURLToPath(import.meta.url)), GOC = path.join(DIR, "..");
const A = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const NGUON = A.nguon || "github", NHANH = A.nhanh || "main", DU_AN = "audit-dc";
const CF = path.join(DIR, ".exports", "cf"), DIST = path.join(CF, "dist"), SO = path.join(CF, "lan-cuoi.json");
const REPO_R = path.join(DIR, ".exports", "repo-kiemsoatkho"), REPO_F = path.join(CF, "repo-factory");
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
if (!process.env.CF_API_TOKEN || !process.env.CF_ACCOUNT_ID) { log("✗ thiếu CF_API_TOKEN / CF_ACCOUNT_ID trong .env"); process.exit(2); }
const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim();
const BO = (rel) => /(^|\/)(\.git|summary|thu|wms-bridge[^/]*|backend|node_modules)(\/|$)/.test(rel) || /\.pem$/i.test(rel) || /(^|\/)dash-bocuc-sua\.js$/.test(rel);
function chep(tu, den) { fs.mkdirSync(path.dirname(den), { recursive: true }); fs.copyFileSync(tu, den); }
function chepCay(goc, dich, loc) {
  (function di(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const ab = path.join(d, f.name), rel = path.relative(goc, ab).replace(/\\/g, "/");
    if (BO(rel) || (loc && !loc(rel))) continue; if (f.isDirectory()) di(ab); else chep(ab, path.join(dich, rel)); } })(goc);
}
function layRepo(dir, url) {
  if (!fs.existsSync(path.join(dir, ".git"))) { fs.mkdirSync(path.dirname(dir), { recursive: true }); execFileSync("git", ["clone", "--depth=1", "-q", url, dir], { windowsHide: true, stdio: "ignore" }); }
  else { try { git(dir, "fetch", "-q", "--depth=1", "origin", "main"); git(dir, "reset", "-q", "--hard", "origin/main"); }
    catch (e) { if (NGUON !== "local") throw e; log("⚠ không lấy được bản mới của " + path.basename(dir) + " (mạng) — dùng bản đã có trên máy"); } }
}

/* ---- 1) ráp thư mục ---- */
fs.rmSync(DIST, { recursive: true, force: true }); fs.mkdirSync(DIST, { recursive: true });
layRepo(REPO_R, "https://github.com/letam0317/kiemsoatkho.git");
chepCay(REPO_R, path.join(DIST, "retail"));
if (NGUON === "local") {   // phủ bản nội bộ theo danh sách cho phép của bộ đẩy Retail
  const ds = [...fs.readFileSync(path.join(DIR, "deploy-kiemsoatkho.mjs"), "utf8").matchAll(/\[\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\]/g)].map((m) => [m[1], m[2]]);
  for (const [loc, rem] of ds) { const ab = path.join(DIR, loc); if (fs.existsSync(ab) && !BO(rem)) chep(ab, path.join(DIST, "retail", rem)); }
  log("Retail: phủ " + ds.length + " tệp bản nội bộ");
}
if (NGUON === "local") {   // Factory: tệp git đang theo dõi (bản đang sửa trên đĩa) + tệp bố cục mới
  const ds = git(path.join(GOC, "factory"), "ls-files").split(/\r?\n/).concat(["dash-bocuc.js", "dash-bocuc-ap.js", "factory-logo.png"]).filter((f) => f && !BO(f));
  for (const f of ds) { const ab = path.join(GOC, "factory", f); if (fs.existsSync(ab)) chep(ab, path.join(DIST, "factory", f)); }
} else { layRepo(REPO_F, "https://github.com/letam0317/stocklocationfactory.git"); chepCay(REPO_F, path.join(DIST, "factory")); }
fs.writeFileSync(path.join(DIST, "_redirects"), [
  "/ /retail/ 302",
  "/kiemsoatkho /retail/ 301", "/kiemsoatkho/* /retail/:splat 301",
  "/stocklocationfactory /factory/ 301", "/stocklocationfactory/* /factory/:splat 301",
  "/hasaki /retail/ 301", "/hasaki/* /retail/:splat 301",
].join("\n") + "\n");
/* link theo tab (/retail/tonkho/batthuong): Cloudflare áp luật 200 của _redirects TRƯỚC tệp tĩnh (thử 13/10: .js bị trả về HTML) ⇒ dùng 404.html:
   đường không có tệp → Pages trả 404.html GẦN NHẤT trong thư mục cha = bản sao trang của app. Gốc có 404.html riêng (chuyển về /retail/) để tắt chế độ SPA gốc. */
/* bản sao trang cho đường sâu mang SẴN <base href="/<app>/"> tĩnh ngay sau <meta charset> — trình duyệt tải đón trước (preload scanner) theo base này luôn,
   không còn 404 do tải đón trước theo đường sâu (base ghi bằng document.write thì máy quét không thấy) */
const voiBase = (app) => fs.readFileSync(path.join(DIST, app, "index.html"), "utf8").replace(/(<meta charset=[^>]*>)/i, '$1\n<base href="/' + app + '/">');
for (const app of ["retail", "factory"]) { const ix = path.join(DIST, app, "index.html"); if (fs.existsSync(ix)) fs.writeFileSync(path.join(DIST, app, "404.html"), voiBase(app)); }
/* …nhưng 404.html trả MÃ 404 (trang vẫn chạy) ⇒ dựng sẵn bản trang cho MỌI link tab đã biết (mã 200): đọc danh sách thanh bên trong mã
   (Retail: mảng HM · Factory: HOME_MUC) + tên/nhóm đã đổi bằng bộ Chỉnh bố cục (dash-bocuc.js). Quy tắc bỏ dấu = boDau() của lớp antd. */
const boDau = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]+/g, "");
function duongApp(app) {
  const ix = path.join(DIST, app, "index.html"); if (!fs.existsSync(ix)) return [];
  const h = fs.readFileSync(ix, "utf8"), cap = [];
  if (app === "retail") {
    const khoi = (h.match(/var HM = \[([\s\S]*?)\];/) || [])[1] || "";
    for (const g of khoi.matchAll(/\{\s*g:\s*"([^"]*)"[^{}]*?items:\s*\[([\s\S]*?)\]\s*\}/g)) for (const it of g[2].matchAll(/\[\s*"[^"]+"\s*,\s*"([^"]+)"/g)) cap.push([g[1], it[1]]);
  } else {
    const khoi = (h.match(/var HOME_MUC=\[([\s\S]*?)\n\];/) || [])[1] || "";
    khoi.split(/\{\s*g:'/).slice(1).forEach((p) => { const g = p.slice(0, p.indexOf("'")); for (const it of p.matchAll(/\{\s*t:'[^']+',\s*ten:'([^']+)'/g)) cap.push([g, it[1]]); });
  }
  try { const t = fs.readFileSync(path.join(DIST, app, "dash-bocuc.js"), "utf8"), j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    (j.tab || []).forEach((x) => { if (x.ten && !x.an) cap.push([x.nhom || "", x.ten]); }); } catch (e) { /* chưa có bố cục */ }
  return [...new Set(cap.filter((x) => x[0] && x[1]).map((x) => boDau(x[0]) + "/" + boDau(x[1])))];
}
for (const app of ["retail", "factory"]) {
  const ds = duongApp(app), ix = path.join(DIST, app, "index.html");
  const html = fs.existsSync(ix) ? voiBase(app) : "";
  ds.forEach((d) => { const den = path.join(DIST, app, d, "index.html"); if (!fs.existsSync(den)) { fs.mkdirSync(path.dirname(den), { recursive: true }); fs.writeFileSync(den, html); } });
  log(app + ": dựng sẵn " + ds.length + " link tab · " + ds.join(" "));
}
fs.writeFileSync(path.join(DIST, "404.html"), '<!doctype html><meta charset="utf-8"><title>Audit</title><script>location.replace("/retail/")</script><a href="/retail/">Audit Retail</a>');
/* 13/10 QC bảo mật: header chung cho MỌI tệp — chặn nhúng trang vào web lạ (form ghi nhận 5S chỉ được iframe cùng gốc), chặn đoán kiểu tệp,
   không gửi đường dẫn sâu sang web khác, chặn máy tìm kiếm lập chỉ mục (dữ liệu nội bộ: tên NV, ảnh vi phạm), camera chỉ cho chính trang (quét mã). */
fs.writeFileSync(path.join(DIST, "robots.txt"), "User-agent: *\nDisallow: /\n");
fs.writeFileSync(path.join(DIST, "_headers"), "/*\n  X-Frame-Options: SAMEORIGIN\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Robots-Tag: noindex, nofollow\n  Permissions-Policy: camera=(self), microphone=(self), geolocation=(), payment=()\n/*/index.html\n  Cache-Control: no-cache\n/retail/\n  Cache-Control: no-cache\n/factory/\n  Cache-Control: no-cache\n");

/* ---- 2) không đổi thì bỏ qua · trần lượt/ngày ---- */
const tep = []; (function di(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const ab = path.join(d, f.name); if (f.isDirectory()) di(ab); else tep.push(ab); } })(DIST);
tep.sort(); const h = crypto.createHash("sha256"); for (const f of tep) { h.update(path.relative(DIST, f)); h.update(fs.readFileSync(f)); } const bam = h.digest("hex");
const so = (() => { try { return JSON.parse(fs.readFileSync(SO, "utf8")); } catch { return {}; } })(), hn = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
const nh = so[NHANH] || (so[NHANH] = { bam: "", ngay: hn, dem: 0 }); if (nh.ngay !== hn) { nh.ngay = hn; nh.dem = 0; }
log("ráp xong " + tep.length + " tệp · " + (NGUON === "local" ? "bản nội bộ" : "bản GitHub") + " → nhánh " + NHANH);
if ("kho" in A) { log("(--kho) chỉ ráp, không đẩy: " + DIST); process.exit(0); }
if (nh.bam === bam && !("ep" in A)) { log("✓ không đổi so với lần đẩy trước — bỏ qua (giữ hạn mức)"); process.exit(0); }
/* 14/10 user: «chia ra đúng 60p đẩy 1 lần (có thay đổi mới đẩy), còn lại t xem/chỉnh ở bản xem trước» — nhánh main CHỈ do lịch mỗi giờ (--lich) đẩy;
   phiên sửa / deploy-kiemsoatkho / day-bocuc-factory gọi tay thì dừng ở đây (bản GitHub đã lên, lượt giờ kế tiếp tự mang lên audit-dc). Trần 24 = 1 lượt/giờ. */
if (NHANH === "main" && !("lich" in A) && !("ep" in A)) { log("· có thay đổi — chờ lượt đẩy mỗi 60 phút (task «5S Day Cloudflare audit-dc», phút :05)"); process.exit(0); }
if (NHANH === "main" && nh.dem >= 24) { log("✗ đã đẩy " + nh.dem + " lượt hôm nay (trần 24) — chờ ngày mai / lượt sau"); process.exit(1); }

/* ---- 3) đẩy ---- */
const kq = spawnSync(process.execPath, [path.join(DIR, "node_modules", "wrangler", "bin", "wrangler.js"), "pages", "deploy", DIST, "--project-name", DU_AN, "--branch", NHANH, "--commit-dirty=true"],
  { cwd: DIR, env: { ...process.env, CLOUDFLARE_API_TOKEN: process.env.CF_API_TOKEN, CLOUDFLARE_ACCOUNT_ID: process.env.CF_ACCOUNT_ID, WRANGLER_SEND_METRICS: "false" }, encoding: "utf8", windowsHide: true });
const ra = (kq.stdout || "") + (kq.stderr || "");
if (kq.status !== 0) { log("✗ wrangler lỗi:\n" + ra.split(/\r?\n/).filter((l) => l.trim()).slice(-8).join("\n")); process.exit(1); }
const url = (ra.match(/https:\/\/[a-z0-9.-]+\.pages\.dev/g) || []).pop() || "";
nh.bam = bam; nh.dem++; nh.luc = new Date().toISOString(); nh.url = url; fs.mkdirSync(CF, { recursive: true }); fs.writeFileSync(SO, JSON.stringify(so, null, 1));
log("✓ đã đẩy (" + nh.dem + " lượt hôm nay) · " + url + (NHANH === "main" ? " · tên miền chính https://" + DU_AN + ".pages.dev" : " · bản xem trước https://" + NHANH + "." + DU_AN + ".pages.dev"));

/* 13/10 QC bảo mật: Cloudflare giữ VĨNH VIỄN mỗi lượt đẩy dưới link phụ <mã>.audit-dc.pages.dev (kể cả bản xem trước chưa duyệt).
   Sau mỗi lượt: xoá mọi bản cũ, chỉ giữ bản đang chạy của tên miền chính + bản mới nhất của nhánh xemtruoc. Lỗi dọn KHÔNG làm hỏng lượt đẩy. */
try {
  const B = "https://api.cloudflare.com/client/v4/accounts/" + process.env.CF_ACCOUNT_ID + "/pages/projects/" + DU_AN, H = { Authorization: "Bearer " + process.env.CF_API_TOKEN };
  const dang = ((await (await fetch(B, { headers: H })).json()).result || {}).canonical_deployment?.id;
  const ds = (await (await fetch(B + "/deployments?per_page=25", { headers: H })).json()).result || [];
  const giuXt = ds.filter((d) => d.environment === "preview").sort((a, b) => b.created_on.localeCompare(a.created_on))[0]?.id;
  let xoa = 0;
  for (const d of ds) if (d.id !== dang && d.id !== giuXt) { const x = await (await fetch(B + "/deployments/" + d.id + "?force=true", { method: "DELETE", headers: H })).json(); if (x.success) xoa++; }
  if (xoa) log("  dọn " + xoa + " link phụ cũ");
} catch (e) { log("  ⚠ dọn link phụ lỗi: " + String(e.message).slice(0, 120)); }
