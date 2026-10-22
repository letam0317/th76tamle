/* QC 22/10 BẢN DỰ PHÒNG MÃ HOÁ (user: «máy gương clip dự phòng phải để CẢ ADMIN của máy đó cũng KHÔNG xem được clip lẫn dữ liệu Xác minh,
 * mà clip vẫn phát nhanh, tua được»). KHÔNG đụng máy chủ 8591 / đường hầm thật, KHÔNG ghi dữ liệu thật, KHÔNG dùng khoá thật:
 *   · khoá THỬ ngẫu nhiên mỗi lượt (XM_MA_KHOA chỉ đặt trong biến môi trường tiến trình con);
 *   · «laptop giả» = bang-591 cổng 8595 (XM_DU_PHONG=1, XM_MA_HOA=0 ⇒ chỉ đọc .exports/bằng chứng thật, mọi POST 503);
 *   · bản dự phòng MÃ HOÁ thử cổng 8593 (thư mục bằng chứng TẠM) + 8594 (trần rất nhỏ — thử dọn); sổ gương laptop → thư mục tạm;
 *   · (mặc định) 1 đường hầm cloudflared riêng trỏ 8593 — ca Range/CORS qua Cloudflare + trình duyệt đi qua hầm. --khong-ham để bỏ;
 *   · trình duyệt Edge giả điện thoại 390×844 mở bản nội bộ localhost:8123, Apps Script giả trong trang (xmKhoaMa/pcBangPh/tk_toi), chặn 8591.
 * Dùng: node qc-guong-ma-hoa.mjs [--khong-ham] [--khong-trinh-duyet]   → tắt mọi tiến trình thử + xoá thư mục tạm khi xong. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { phienQC } from "./xacminh-dang-nhap.mjs";
import { kyGuong } from "./guong-clip-chung.mjs";
import * as GM from "./guong-ma-hoa.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
/* ổ cắm giữ-sống của fetch bị máy chủ thử đóng sau 5 s rảnh (khi QC chờ tiến trình con lâu) → ECONNRESET ở lượt kế: thử lại 1 lần */
{ const f0 = globalThis.fetch; globalThis.fetch = async (...a) => { try { return await f0(...a); } catch (e) { if (e && e.cause && /ECONNRESET|UND_ERR_SOCKET/.test(e.cause.code || "")) return f0(...a); throw e; } }; }
const SP = "C:/Users/lechitam/AppData/Local/Temp/claude/C--Users-lechitam-New-folder/33f18329-d7d8-40ed-8adc-e7a1dab754da/scratchpad";
const TAM = fs.mkdtempSync(path.join(os.tmpdir(), "qc-gm-")), TAM2 = fs.mkdtempSync(path.join(os.tmpdir(), "qc-gm2-")), TAM3 = fs.mkdtempSync(path.join(os.tmpdir(), "qc-gm3-"));
const BC_THAT = path.dirname(process.env.BAIXE_DIR || "C:/Users/lechitam/Videos/5S-bang-chung/bai-xe");
const KY = process.env.APPSCRIPT_KEY || "";
const K_THU = crypto.randomBytes(32), K_SAI = crypto.randomBytes(32), B64 = K_THU.toString("base64");
const PHIEN = phienQC();
const D = "http://127.0.0.1:8593", D2 = "http://127.0.0.1:8594", L = "http://127.0.0.1:8595";
const MOZ = { "user-agent": "Mozilla/5.0 (QC)" };
const PHIEU = "13374021", CLIP_BC = "/bc/may/13374021_KHO-08181359_ch17.mp4", LID = "2026-10-15_BXM_080832", CLIP_VID = "/video/" + LID + "/0";
const F_CLIP = path.join(BC_THAT, "may", "13374021_KHO-08181359_ch17.mp4"), F_VID = path.join(DIR, ".exports", ".bai-xe-tam", "2026-10-15", "BXM-luot-080642-113s.mp4");
/* 22/10 đường lùi iPhone: thêm clip phiếu ~5 MB (14123239) và ~8,5 MB (13808708 — lớn nhất trong dữ liệu) để đo thời gian tải trọn + giải trong trang */
const CLIP5 = { id: "14123239", url: "/bc/may/14123239_KHO-10061602_ch8.mp4" }, CLIP9 = { id: "13808708", url: "/bc/may/13808708_KHO-09161510_ch31.mp4" };
const LOC = "^api:|^tep:/bc/may/(13374021_KHO-08181359_ch17|14123239_KHO-10061602_ch8|13808708_KHO-09161510_ch31)\\.mp4$|^tep:/video/2026-10-15_BXM_080832/0$|^(tep|thu):/anh/2026-10-15/";
let dat = 0, truot = 0; const ok = (d, t) => { d ? dat++ : truot++; console.log((d ? "  ✓ " : "  ✗ ") + t); };
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const ky = (pt, rel, co, s, luc = Date.now(), khoa = KY) => ({ "x-guong-luc": String(luc), "x-guong-ky": kyGuong(khoa, { pt, rel, luc, co, sha: s }) });
const putMa = (goc, ten, buf, h) => fetch(goc + "/api/guong-ma?ten=" + ten, { method: "PUT", body: buf, headers: { "x-guong-sha256": sha(buf), ...(h || ky("PUT", "ma:" + ten, buf.length, sha(buf))) } })
  .then(async (r) => ({ ma: r.status, j: await r.json().catch(() => ({})) }), () => ({ ma: 0, j: {} }));
const coDs = (goc) => fetch(goc + "/api/guong-ma/co", { headers: ky("GET", "", 0, "") }).then((r) => r.json()).then((j) => j.tep || {}, () => ({}));
const chayGuong = (...a) => { const r = spawnSync(process.execPath, ["guong-clip-du-phong.mjs", "--nguon=" + L, ...a], { cwd: DIR, encoding: "utf8", timeout: 900e3,
  env: { ...process.env, TIEN_DO: "0", XM_MA_KHOA: B64, GUONG_MA_SO: path.join(TAM3, "so-gm.json") } }); return String(r.stdout || "") + String(r.stderr || ""); };
const tienTrinh = [];
const bat = (cong, them) => { const c = spawn(process.execPath, ["bang-591.mjs"], { cwd: DIR, env: { ...process.env, XM_DU_PHONG: "1", XM_KHONG_TU_NAP: "1", BANG591_PORT: String(cong), ...them }, windowsHide: true, stdio: "ignore" }); tienTrinh.push(c); return c; };
const don = () => { for (const c of tienTrinh) try { c.kill(); } catch { /* */ } };
process.on("exit", don);
const ten = (k) => GM.tenAn(K_THU, k);
const layMa = async (goc, t, range) => { const r = await fetch(goc + "/ma/" + t + "?phien=" + PHIEN, { headers: { ...MOZ, ...(range ? { range } : {}) } }); return { ma: r.status, b: Buffer.from(await r.arrayBuffer()), h: r.headers }; };
function diQua(d) { const ra = []; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) ra.push(...diQua(f)); else ra.push(f); } return ra; }

/* sw.js (bản trình duyệt) chạy trong vm của Node — cùng WebCrypto/fetch/ReadableStream ⇒ thử Range đúng mã trang dùng */
function napSW() {
  const nghe = {}, self = { addEventListener: (t, f) => (nghe[t] = f), skipWaiting() {}, location: new URL("http://localhost:8123/kiemsoatkho/sw.js"),
    clients: { claim: async () => {}, get: async () => null, matchAll: async () => [] } };
  const ctx = vm.createContext({ self, crypto: globalThis.crypto, fetch, Response, Request, Headers, ReadableStream, TextEncoder, MessageChannel, URL, atob, setTimeout, clearTimeout, AbortController, console, Uint8Array, DataView, ArrayBuffer });
  ctx.importScripts = (f) => vm.runInContext(fs.readFileSync(path.join(DIR, "kiemsoatkho", f), "utf8"), ctx);   // sw.js nạp giai-ma-guong.js
  vm.runInContext(fs.readFileSync(path.join(DIR, "kiemsoatkho", "sw.js"), "utf8"), ctx);
  const khoa = (k, goc) => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = (e) => { r(e.data); ch.port1.close(); }; nghe.message({ data: { hxGm: "khoa", khoa: k.toString("base64"), goc, phien: PHIEN }, ports: [ch.port2] }); });
  const goi = async (k, range, du) => { let p = null; const u = "http://localhost:8123/kiemsoatkho/__giai-ma/k?u=" + encodeURIComponent(k) + (du ? "&du=" + encodeURIComponent(du) : "");
    nghe.fetch({ request: new Request(u, { headers: range ? { range } : {} }), clientId: "", respondWith: (x) => (p = x) }); const r = await p; return { ma: r.status, h: r.headers, b: Buffer.from(await r.arrayBuffer()) }; };
  return { khoa, goi };
}

let HAM = "";
try {
  if (!KY) throw new Error("thiếu APPSCRIPT_KEY (chữ ký gương)");
  if (!PHIEN) throw new Error("chưa có tài khoản Xác minh trên máy (phienQC rỗng)");
  console.log("— 0) cú pháp trang (22/10 sự cố: regex mất «\\» trước «/» lên live → «Invalid regular expression flags»)");
  { const H = fs.readFileSync(path.join(DIR, "kiemsoatkho", "index.html"), "utf8"), loiK = []; let n = 0;
    for (const m of H.matchAll(/<script>([\s\S]*?)<\/script>/g)) { n++; try { new Function(m[1]); } catch (e) { loiK.push("khối " + n + ": " + e.message); } }
    ok(n > 0 && loiK.length === 0, "index.html: " + n + " khối <script> nội tuyến, 0 lỗi cú pháp" + (loiK.length ? " — " + loiK.join(" | ") : ""));
    for (const f of ["sw.js", "hasaki-xacminh.js", "tai-khoan.js"]) { let e0 = ""; try { new Function(fs.readFileSync(path.join(DIR, "kiemsoatkho", f), "utf8")); } catch (e) { e0 = e.message; } ok(!e0, "kiemsoatkho/" + f + ": cú pháp " + (e0 || "đạt")); } }
  console.log("— 1) định dạng tệp (guong-ma-hoa.mjs)");
  for (const n of [0, 1, GM.DOAN - 1, GM.DOAN, GM.DOAN + 1, 3 * GM.DOAN + 777]) {
    const b = crypto.randomBytes(n), m = await GM.maHoa(K_THU, b, { khoa: "tep:/x", loai: 1 });
    ok(m.length === GM.coMa(n) && GM.giaiMa(K_THU, m, "tep:/x").equals(b), "mã hoá ↔ giải mã đúng byte, cỡ đúng công thức (" + n + " byte)");
  }
  { const b = crypto.randomBytes(5000), m = await GM.maHoa(K_THU, b, { khoa: "tep:/a" });
    const thu = (f) => { try { f(); return false; } catch { return true; } };
    ok(thu(() => GM.giaiMa(K_SAI, m, "tep:/a")), "khoá sai → không giải được");
    ok(thu(() => GM.giaiMa(K_THU, m, "tep:/b")), "bản mã của tên khác (PC tráo tệp) → không giải được (khoá nằm trong AAD)");
    const h = Buffer.from(m); h[100] ^= 1; ok(thu(() => GM.giaiMa(K_THU, h, "tep:/a")), "sửa 1 byte thân → không giải được");
    const c = Buffer.from(m.subarray(0, m.length - 1)); ok(thu(() => GM.giaiMa(K_THU, c, "tep:/a")), "cắt cụt → không giải được");
    ok(ten("tep:/a") !== ten("tep:/b") && ten("tep:/a") === GM.tenAn(K_THU, "tep:/a") && ten("tep:/a") !== GM.tenAn(K_SAI, "tep:/a") && GM.RE_TEN.test(ten("tep:/a")), "tên ẩn: 64 hex, ổn định, khác theo khoá + đường");
    const s1 = await GM.maHoa(K_THU, b, { khoa: "tep:/a" }), s2 = await GM.maHoa(K_THU, b, { khoa: "tep:/a" });
    ok(!s1.equals(s2), "cùng tệp mã 2 lần → bản mã khác (salt ngẫu nhiên mỗi lần)"); }

  console.log("— 2) Apps Script xmKhoaMa / xmDatKhoaMa (mã THẬT cắt từ google-script-XacMinh.gs + sân giả)");
  { const G = fs.readFileSync(path.join(DIR, "google-script-XacMinh.gs"), "utf8"), i = G.indexOf("function xmVanTay_("), j = G.indexOf("/* ====", i);
    const kyHieu = (b) => Array.from(b).map((x) => (x > 127 ? x - 256 : x));
    const Utilities = { DigestAlgorithm: { SHA_256: 1 }, computeDigest: (_, v) => kyHieu(crypto.createHash("sha256").update(Buffer.from(v.map((x) => x & 255))).digest()), base64Decode: (s) => kyHieu(Buffer.from(s, "base64")) };
    const props = {}, cache = {}, PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v); } }) };
    const CacheService = { getScriptCache: () => ({ get: (k) => cache[k] ?? null, put: (k, v) => { cache[k] = v; } }) };
    const tk = { "ph-xem-000000000000000000000000000000": { id: "xem", quyen: { "r.xacminh": "xem" } }, "ph-khong-0000000000000000000000000000": { id: "khong", quyen: { "r.xacminh": "khong" } } };
    const api = new Function("Utilities", "PropertiesService", "CacheService", "phanHoiJson", "tkPhien_", G.slice(i, j) + "\nreturn { apiXmKhoaMa_, apiXmDatKhoaMa_ };")(Utilities, PropertiesService, CacheService, (o) => o, (p) => tk[p] || null);
    ok(api.apiXmKhoaMa_({ key: KY }).code === 401, "xmKhoaMa chỉ có SECRET (máy trạm) → 401, không trả khoá");
    ok(api.apiXmKhoaMa_({ phien: "ph-khong-0000000000000000000000000000" }).code === 403, "phiên không có quyền Xác minh → 403");
    ok(api.apiXmKhoaMa_({ phien: "ph-xem-000000000000000000000000000000" }).code === 503, "chưa nạp khoá → 503");
    ok(api.apiXmDatKhoaMa_({ khoa: "abc" }).status === "error", "xmDatKhoaMa khoá hỏng → từ chối");
    ok(api.apiXmDatKhoaMa_({ khoa: B64 }).vanTay === GM.vanTay(K_THU), "xmDatKhoaMa nạp khoá → vân tay trùng laptop");
    ok(api.apiXmDatKhoaMa_({ khoa: K_SAI.toString("base64") }).code === 409, "thay khoá khác không kèm vân tay khoá cũ → 409 (máy trạm không tráo được)");
    ok(api.apiXmDatKhoaMa_({ khoa: B64, cuVanTay: GM.vanTay(K_THU) }).status === "success", "thay khoá kèm đúng vân tay cũ → được");
    const r = api.apiXmKhoaMa_({ phien: "ph-xem-000000000000000000000000000000" });
    ok(r.status === "success" && r.khoa === B64 && r.vanTay === GM.vanTay(K_THU), "phiên có quyền «xem» → nhận đúng khoá");
    for (const k of Object.keys(cache)) delete cache[k];
    let n = 0; while (n < 40 && api.apiXmKhoaMa_({ phien: "ph-xem-000000000000000000000000000000" }).status === "success") n++;
    ok(n === 30, "trần 30 lần / 10 phút / tài khoản (" + n + " lần được, lần thứ " + (n + 1) + " bị 429)"); }

  console.log("— 3) máy chủ thử");
  fs.mkdirSync(path.join(TAM, "bai-xe"), { recursive: true });
  bat(8595, { XM_MA_HOA: "0" }); bat(8593, { BAIXE_DIR: path.join(TAM, "bai-xe") }); bat(8594, { BAIXE_DIR: path.join(TAM2, "bai-xe"), GUONG_TRAN_GB: String(2.5e6 / 1024 ** 3) });
  for (let i = 0; i < 60; i++) { if ((await Promise.all([D, D2, L].map((g) => fetch(g + "/api/ping").then((r) => r.ok, () => false)))).every(Boolean)) break; await ngu(500); }
  const pj = await fetch(D + "/api/ping").then((r) => r.json(), () => ({}));
  ok(pj.duPhong === 1 && pj.maHoa === 1 && pj.guong === 0, "ping bản dự phòng: duPhong + maHoa:1 (mặc định) + guong:0 (laptop bản cũ không đẩy bản rõ)");

  console.log("— 4) cổng nhận bản mã");
  const m0 = await GM.maHoa(K_THU, Buffer.from("thu"), { khoa: "tep:/x.jpg" }), t0 = ten("tep:/x.jpg");
  ok((await fetch(D + "/api/guong-ma/co")).status === 401, "liệt kê không chữ ký → 401");
  ok((await fetch(D + "/api/guong-ma/co", { headers: ky("GET", "", 0, "", Date.now(), "khoa-sai") })).status === 401, "chữ ký khoá sai → 401");
  ok((await fetch(D + "/api/guong-ma/co", { headers: ky("GET", "", 0, "", Date.now() - 6 * 60e3) })).status === 401, "chữ ký quá 5 phút (phát lại) → 401");
  ok((await putMa(D, t0, m0, ky("PUT", "ma:" + "0".repeat(64), m0.length, sha(m0)))).ma === 401, "chữ ký của tên khác → 401");
  ok((await putMa(D, "x".repeat(64), m0)).ma === 400 || (await putMa(D, "../" + t0.slice(3), m0)).ma === 400, "tên ẩn không phải 64 hex → 400");
  const ro = Buffer.from("ftyp — bản rõ giả làm bản mã"); ok((await putMa(D, t0, ro)).ma === 400 && !fs.existsSync(path.join(TAM, ".guong-ma", t0 + ".bin")), "thân không đúng định dạng mã hoá (bản rõ) → 400, không lưu");
  const cut = m0.subarray(0, m0.length - 2); ok((await putMa(D, t0, cut)).ma === 400, "bản mã cụt (cỡ ≠ đầu tệp) → 400");
  ok((await putMa(D, t0, m0)).ma === 200, "bản mã hợp lệ + chữ ký đúng → 200");
  const pg0 = await fetch(D + "/api/guong-clip?p=may%2Fx.jpg", { method: "PUT", body: Buffer.from("x"), headers: { "x-guong-sha256": sha(Buffer.from("x")), ...ky("PUT", "may/x.jpg", 1, sha(Buffer.from("x"))) } });
  ok(pg0.status === 410, "đường gương BẢN RÕ cũ (/api/guong-clip) → 410 (" + pg0.status + ")");

  console.log("— 5) laptop đẩy bản mã (guong-clip-du-phong.mjs, khoá thử, nguồn = laptop giả 8595)");
  const t1 = chayGuong("--thu", "--dich=" + D, "--loc=" + LOC), soThu = Number((t1.match(/sẽ đẩy (\d+) mục/) || [])[1] || 0);
  ok(soThu >= 6 && Object.keys(await coDs(D)).length === 1, "--thu: liệt kê " + soThu + " mục, không đẩy (" + (t1.match(/cần[^\n]*/) || [t1.slice(-300)])[0] + ")");
  const tg0 = Date.now(), t2 = chayGuong("--dich=" + D, "--loc=" + LOC);
  ok(new RegExp("đã đẩy " + soThu + " mục").test(t2) && /hỏng 0/.test(t2), "lượt 1 đẩy đủ " + soThu + " mục trong " + Math.round((Date.now() - tg0) / 1000) + " s (" + (t2.match(/đã đẩy[^\n]*/) || [t2.slice(-300)])[0] + ")");
  const t3 = chayGuong("--dich=" + D, "--loc=" + LOC);
  ok(/thiếu\/đổi 0/.test(t3) && /đã đẩy 0 mục/.test(t3), "lượt 2: đã đủ, đẩy 0 (" + (t3.match(/thiếu\/đổi[^\n·]*/) || [""])[0] + ")");
  const dung = JSON.parse(fs.readFileSync(path.join(TAM, ".guong-ma", ".dung.json"), "utf8"));   // đọc trước lượt --lien-tuc (lượt đó gửi danh sách hẹp theo --loc)
  { const tl = chayGuong("--lien-tuc", "--tran-mb=1", "--dich=" + D, "--loc=^(tep|thu):/anh/2026-10-13/"), dong = tl.split(/\r?\n/).filter((x) => /✓ (thu|tep):/.test(x));
    const iThu = dong.map((x, i) => (/✓ thu:/.test(x) ? i : -1)).filter((i) => i >= 0), iTep = dong.map((x, i) => (/✓ tep:/.test(x) ? i : -1)).filter((i) => i >= 0);
    ok(/hỏng 0/.test(tl) && /thiếu\/đổi/.test(tl) && dong.length > 2 && Math.max(...iThu) < Math.min(...iTep) && !/dừng giữa chừng/.test(tl),
      "--lien-tuc: bỏ trần lượt (--tran-mb=1 vẫn đẩy đủ " + dong.length + " mục), ảnh nhỏ trước tệp gốc (" + (tl.match(/đã đẩy[^\n]*/) || [tl.slice(-200)])[0] + ")");
    const tl2 = chayGuong("--lien-tuc", "--dich=" + D, "--loc=^(tep|thu):/anh/2026-10-13/");
    ok(/thiếu\/đổi 0/.test(tl2) && /đã đẩy 0 mục/.test(tl2), "--lien-tuc lần 2: đủ rồi → dừng ngay, không vòng lặp"); }
  ok(dung.ds.length >= soThu && dung.ds.every((x) => GM.RE_TEN.test(x)), "PC nhận danh sách còn dùng: " + dung.ds.length + " tên ẩn, toàn hex");

  console.log("— 6) trên đĩa máy dự phòng: không lộ tên / nội dung");
  const dlRo = Buffer.from(await (await fetch(L + "/api/du-lieu?go=1")).arrayBuffer()), dl = JSON.parse(dlRo.toString("utf8"));
  const email = (dlRo.toString("utf8").match(/[a-z0-9._-]+@hasaki\.vn/) || [])[0] || "@hasaki.vn";
  const tepDia = diQua(TAM);
  ok(tepDia.every((f) => /^[0-9a-f]{64}\.bin$|^\.dung\.json$/.test(path.basename(f))), "mọi tệp trên đĩa PC chỉ có tên ẩn (" + tepDia.length + " tệp: " + [...new Set(tepDia.map((f) => path.basename(f).replace(/^[0-9a-f]{64}/, "<64hex>")))].join(", ") + ")");
  ok(!tepDia.some((f) => /\d{8}|bai-xe|BXM|\.mp4|\.jpg|may[\\/]/i.test(path.relative(TAM, f).replace(/[0-9a-f]{64}\.bin$/, ""))), "không đường dẫn nào chứa mã phiếu / bai-xe / camera / đuôi mp4-jpg");
  /* chuỗi ≥ 6 byte (chuỗi 3–4 byte trùng ngẫu nhiên trong ~20 MB bản mã): «ftyp»+3 ký tự chữ/số = đầu mp4, «JFIF» + byte 0 = đầu jpeg */
  const chuoiRo = [PHIEU, email, "JFIF\u0000", "\"phieu\"", "\"luot\"", "hasaki", "bai-xe", "may/"];
  const coFtyp = (b) => { for (let i = b.indexOf("ftyp"); i >= 0; i = b.indexOf("ftyp", i + 1)) if (/^[a-z0-9]{3}/i.test(b.toString("latin1", i + 4, i + 7))) return true; return false; };
  const lo = []; for (const f of tepDia) { const b = fs.readFileSync(f); if (coFtyp(b)) lo.push(path.basename(f).slice(0, 10) + "∋ftyp…"); for (const c of chuoiRo) if (b.includes(Buffer.from(c, "utf8"))) lo.push(path.basename(f).slice(0, 10) + "∋" + c); }
  ok(lo.length === 0, "nội dung không chứa chuỗi bản rõ (ftyp+brand · " + chuoiRo.map((c) => c.replace("\u0000", "\\0")).join(" · ") + ")" + (lo.length ? " — LỘ: " + lo.slice(0, 5).join(", ") : ""));
  ok(dlRo.includes(Buffer.from(PHIEU)) && dlRo.includes(Buffer.from(email)), "(đối chứng) bản rõ laptop CÓ chứa mã phiếu " + PHIEU + " + email mẫu");
  const ROUTES = ["/api/du-lieu", "/api/quy-dinh", "/api/ghi-chu", "/api/ghi-chu?id=" + PHIEU, "/api/nv?q=ng", "/api/bo-cai-pc", CLIP_BC, "/anh/2026-10-15/BXM-080832.jpg", CLIP_VID,
    "/thu?u=" + encodeURIComponent("/anh/2026-10-15/BXM-080832.jpg"), "/cs/" + PHIEU + "/soi-x.jpg", "/api/guong-clip/co"];
  const roLo = []; for (const r of ROUTES) { const x = await fetch(D + r, { headers: { ...MOZ, "x-hx-phien": PHIEN } }); const b = Buffer.from(await x.arrayBuffer());
    if (x.status === 200 || b.includes(Buffer.from(PHIEU)) || b.includes(Buffer.from("ftyp")) || b.includes(Buffer.from("JFIF"))) roLo.push(r + " → " + x.status); }
  ok(roLo.length === 0, "mọi đường GET bản rõ của bản dự phòng (có phiên) không trả bản rõ (" + ROUTES.length + " đường → 410/404)" + (roLo.length ? " — LỘ: " + roLo.join(", ") : ""));
  ok((await fetch(D + "/ma/" + ten("tep:" + CLIP_BC), { headers: MOZ })).status === 401, "/ma/ từ trình duyệt không phiên → 401");
  ok((await fetch(D + "/api/may-tram", { headers: { ...MOZ, "x-hx-phien": PHIEN } })).status !== 410, "Máy trạm (/api/may-tram) vẫn trả thẳng (trạng thái PC, không phải dữ liệu Xác minh)");

  console.log("— 7) giải mã: đúng byte gốc, Range, bản chụp API");
  for (const [k, f] of [["tep:" + CLIP_BC, F_CLIP], ["tep:" + CLIP_VID, F_VID], ["tep:/anh/2026-10-15/BXM-080832.jpg", path.join(BC_THAT, "bai-xe", "2026-10-15", "BXM-080832.jpg")]]) {
    const x = await layMa(D, ten(k)); ok(x.ma === 200 && sha(GM.giaiMa(K_THU, x.b, k)) === sha(fs.readFileSync(f)), k + " → giải ra đúng SHA-256 gốc (" + Math.round(x.b.length / 1e4) / 100 + " MB bản mã)"); }
  const apiGiai = async (p) => JSON.parse(GM.giaiMa(K_THU, (await layMa(D, ten(GM.khoaApi(p)))).b, GM.khoaApi(p)).toString("utf8"));
  const dlMa = await apiGiai("/api/du-lieu"), boGio = (o) => JSON.stringify(Object.assign({}, o, { capNhat: 0 }));
  const dlLap = JSON.parse((await (await fetch(L + "/api/du-lieu?go=1")).arrayBuffer().then((a) => Buffer.from(a))).toString("utf8"));
  ok(boGio(dlMa) === boGio(dlLap) && dlMa.phieu.length > 0 && dlMa.luot.length > 0, "api:/api/du-lieu giải ra JSON trùng bản laptop (" + dlMa.phieu.length + " phiếu · " + dlMa.luot.length + " lượt · " + (dlMa.tacGia?.ds || []).length + " dòng Nhật ký)");
  ok(!dlMa.phieu.some((p) => p.nguoiGui) && !(dlMa.tacGia?.ds || []).some((x) => x.nguoi), "bản chụp đã GỠ người gửi 5S (khoá cấp cho mọi tài khoản Xác minh, không riêng tamlc)");
  ok(JSON.stringify(await apiGiai("/api/quy-dinh")) === JSON.stringify(await (await fetch(L + "/api/quy-dinh")).json()), "api:/api/quy-dinh trùng bản laptop");
  ok(JSON.stringify(await apiGiai("/api/ghi-chu")) === JSON.stringify(await (await fetch(L + "/api/ghi-chu")).json()), "api:/api/ghi-chu trùng bản laptop");
  const SW = napSW(); ok((await SW.khoa(K_THU, D)).ok === 1, "sw.js (chạy trong Node) nhận khoá");
  const goc = fs.readFileSync(F_CLIP), S = GM.DOAN, N = goc.length;
  const ca = [[0, 99], [S - 10, S + 9], [2 * S - 1, 2 * S], [S * 3 + 5, S * 5 + 17], [N - 100, N - 1], [Math.floor(N / 2), null], [null, 500], [0, null]];
  for (let i = 0; i < 6; i++) { const a = crypto.randomInt(0, N - 1), z = Math.min(N - 1, a + crypto.randomInt(1, 3 * S)); ca.push([a, z]); }
  for (const [a, z] of ca) {
    const range = a == null ? "bytes=-" + z : "bytes=" + a + "-" + (z == null ? "" : z), A0 = a == null ? N - z : a, Z0 = a == null ? N - 1 : z == null ? Math.min(N - 1, (Math.floor(a / S) + 4) * S - 1) : z;   // hỏi mở → tối đa 4 đoạn
    const r = await SW.goi("tep:" + CLIP_BC, range);
    ok(r.ma === 206 && r.h.get("content-range") === "bytes " + A0 + "-" + Z0 + "/" + N && r.b.equals(goc.subarray(A0, Z0 + 1)), "Range " + range + " → 206, đúng " + (Z0 - A0 + 1) + " byte gốc" + (Math.floor(A0 / S) !== Math.floor(Z0 / S) ? " (vắt qua ranh đoạn)" : ""));
  }
  const rFull = await SW.goi("tep:/anh/2026-10-15/BXM-080832.jpg");
  ok(rFull.ma === 200 && rFull.h.get("content-type") === "image/jpeg" && sha(rFull.b) === sha(fs.readFileSync(path.join(BC_THAT, "bai-xe", "2026-10-15", "BXM-080832.jpg"))), "ảnh không Range → 200 image/jpeg đủ byte");
  const rThu = await SW.goi("thu:/anh/2026-10-15/BXM-080832.jpg", null, "tep:/anh/2026-10-15/BXM-080832.jpg");
  ok(rThu.ma === 200 && rThu.b.length > 1000 && rThu.b.length < rFull.b.length, "ảnh nhỏ (thu:) có sẵn, nhỏ hơn ảnh gốc (" + Math.round(rThu.b.length / 1024) + " KB / " + Math.round(rFull.b.length / 1024) + " KB)");
  const rLui = await SW.goi("thu:/bc/may/khong-co.jpg", null, "tep:" + CLIP_BC);
  ok(rLui.ma === 200 && rLui.b.length === N, "ảnh nhỏ thiếu → tự lùi về tệp gốc (du=)");
  const rApi = await SW.goi("api:/api/du-lieu");
  ok(rApi.ma === 200 && boGio(JSON.parse(rApi.b.toString("utf8"))) === boGio(dlLap), "sw.js giải bản chụp api:/api/du-lieu = JSON laptop");
  ok((await SW.goi("tep:/bc/khong/co.mp4")).ma === 404, "tệp laptop chưa đẩy → 404 gọn");
  const SW2 = napSW(); await SW2.khoa(K_SAI, D); const rSai = await SW2.goi("tep:" + CLIP_BC, "bytes=0-99");
  ok(rSai.ma === 404 || rSai.ma === 500, "khoá SAI: tên ẩn khác → máy dự phòng không có (" + rSai.ma + "), không ra byte nào");
  { const SW3 = napSW(); await SW3.khoa(K_THU, D); const m = await layMa(D, ten("tep:" + CLIP_BC)), kSai = GM.tenAn(K_THU, "tep:/gia");   // bản mã đúng nhưng đặt dưới tên khác (PC tráo)
    await putMa(D, kSai, m.b); const r = await SW3.goi("tep:/gia", "bytes=0-99").catch((e) => ({ ma: -1, e }));
    ok(r.ma !== 206 || !r.b.equals(goc.subarray(0, 100)), "PC tráo bản mã sang tên khác → giải mã hỏng, không phát (" + r.ma + ")"); }
  { const t = Date.now(); for (let i = 0; i < 20; i++) await SW.goi("tep:" + CLIP_BC, "bytes=" + i * S + "-" + (i * S + 10)); const ms = (Date.now() - t) / 20;
    ok(ms < 500, "Node+WebCrypto: kéo + giải 1 đoạn 1 MiB qua cổng nội bộ ≈ " + Math.round(ms) + " ms/đoạn"); }

  console.log("— 8) dọn khi vượt trần (8594 trần ~2,5 MB)");
  const ba = [0, 1, 2].map(() => crypto.randomBytes(900e3)), tb = ["tep:/t/a", "tep:/t/b", "tep:/t/c"];
  const mb = await Promise.all(ba.map((b, i) => GM.maHoa(K_THU, b, { khoa: tb[i] })));
  await putMa(D2, ten(tb[0]), mb[0]); await ngu(30); await putMa(D2, ten(tb[1]), mb[1]); await ngu(30);
  { const bd = Buffer.from(JSON.stringify({ ds: [ten(tb[0])] })); await fetch(D2 + "/api/guong-ma/dung", { method: "PUT", body: bd, headers: { "x-guong-sha256": sha(bd), ...ky("PUT", "dung", bd.length, sha(bd)) } }); }
  const r3 = await putMa(D2, ten(tb[2]), mb[2]); const co2 = await coDs(D2);
  ok(r3.ma === 200 && co2[ten(tb[0])] && !co2[ten(tb[1])] && co2[ten(tb[2])], "vượt trần → xoá bản KHÔNG còn dùng (b) trước, giữ bản còn dùng (a) dù cũ hơn");

  console.log("— 9) dọn bản rõ cũ trên PC (don-ban-ro-du-phong.mjs, thư mục tạm)");
  { const { donBanRo } = await import("./don-ban-ro-du-phong.mjs"), g = path.join(TAM3, "pc"), bc = path.join(g, "bc"), ex = path.join(g, "hasaki");
    const viet = (f, s = "x") => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
    viet(path.join(bc, "may", "1_CLIP.mp4")); viet(path.join(bc, "bai-xe-tam", "d", "v.mp4")); viet(path.join(bc, "may", "pc-tu-sinh.jpg"));
    viet(path.join(bc, ".guong-clip-so.json"), JSON.stringify({ "may/1_CLIP.mp4": { co: 1 }, "bai-xe-tam/d/v.mp4": { co: 1 }, "../ngoai.mp4": { co: 1 } })); viet(path.join(g, "ngoai.mp4"));
    viet(path.join(ex, ".exports", ".thu-cache", "a.jpg")); viet(path.join(ex, ".du-phong-keo"), "1");
    viet(path.join(ex, ".exports", "tasks-cache.json")); viet(path.join(ex, ".exports", ".dbxm-goc", "x")); viet(path.join(bc, "bai-xe", "d1", "ket-qua.json")); viet(path.join(bc, "bai-xe", "d2", "ket-qua.json")); viet(path.join(bc, "bai-xe", "d2", "anh-pc.jpg"));
    const ds = [{ ten: ".exports/tasks-cache.json", abs: path.join(ex, ".exports", "tasks-cache.json") }, { ten: "@BC/bai-xe/d1/ket-qua.json", abs: path.join(bc, "bai-xe", "d1", "ket-qua.json") }, { ten: "@BC/bai-xe/d2/ket-qua.json", abs: path.join(bc, "bai-xe", "d2", "ket-qua.json") }];
    const r = await donBanRo(() => {}, { ep: 1, bc, dir: ex, coChayXm: () => false, tepMay: () => ds });
    ok(r && r.guong === 2 && !fs.existsSync(path.join(bc, "may", "1_CLIP.mp4")) && !fs.existsSync(path.join(bc, ".guong-clip-so.json")), "xoá đúng 2 tệp gương bản rõ trong sổ + sổ");
    ok(fs.existsSync(path.join(bc, "may", "pc-tu-sinh.jpg")) && fs.existsSync(path.join(g, "ngoai.mp4")), "KHÔNG xoá tệp PC tự sinh / đường ngoài thư mục bằng chứng (../)");
    ok(!fs.existsSync(path.join(ex, ".exports", ".thu-cache")) && !fs.existsSync(path.join(ex, ".exports", "tasks-cache.json")) && !fs.existsSync(path.join(ex, ".exports", ".dbxm-goc")), "xoá ảnh nhỏ bản rõ + dữ liệu kéo kho Drive + bản gốc gộp");
    ok(!fs.existsSync(path.join(bc, "bai-xe", "d1", "ket-qua.json")) && fs.existsSync(path.join(bc, "bai-xe", "d2", "ket-qua.json")), "ket-qua.json: xoá ngày chỉ có tệp kéo về, GIỮ ngày có ảnh PC tự chụp");
    ok(!fs.existsSync(path.join(ex, ".du-phong-keo")) && fs.existsSync(path.join(ex, ".du-phong-da-don.json")), "gỡ dấu .du-phong-keo, ghi .du-phong-da-don.json");
    viet(path.join(ex, ".du-phong-keo"), "1"); viet(path.join(ex, ".exports", "tasks-cache.json")); viet(path.join(ex, "dong-bo-xm.log"), "09:00:01 [canh-b11] kéo 12 tệp\n");
    const r2 = await donBanRo(() => {}, { ep: 1, bc, dir: ex, coChayXm: () => false, tepMay: () => ds });
    ok(r2 && r2.keo === 0 && /từng chạy cò/.test(r2.giu) && fs.existsSync(path.join(ex, ".exports", "tasks-cache.json")), "máy TỪNG chạy cò xác minh → giữ dữ liệu cò (" + (r2 && r2.giu) + ")");
    fs.rmSync(path.join(ex, "dong-bo-xm.log")); viet(path.join(ex, ".du-phong-keo"), "1");
    const r3b = await donBanRo(() => {}, { ep: 1, bc, dir: ex, coChayXm: () => { throw new Error("không dò được"); }, tepMay: () => ds });
    ok(r3b && r3b.keo === 0 && fs.existsSync(path.join(ex, ".exports", "tasks-cache.json")) && fs.existsSync(path.join(ex, ".du-phong-keo")), "không dò được tiến trình → KHÔNG xoá (fail-closed), giữ dấu để lượt sau");
    const env0 = process.env.RUNNER_VAI; delete process.env.RUNNER_VAI;
    ok((await donBanRo(() => {}, { bc, dir: ex })) === null, "laptop (không RUNNER_VAI=pc) → không làm gì"); if (env0 != null) process.env.RUNNER_VAI = env0; }

  console.log("— 10) đường hầm Cloudflare (Range + CORS qua hầm)");
  if (!process.argv.includes("--khong-ham") && fs.existsSync(path.join(DIR, "bin", "cloudflared.exe"))) {
    const cf = spawn(path.join(DIR, "bin", "cloudflared.exe"), ["tunnel", "--no-autoupdate", "--protocol", "http2", "--url", D], { windowsHide: true }); tienTrinh.push(cf);
    const doc = (b) => { const m = String(b).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/); if (m && !HAM) HAM = m[0]; };
    cf.stdout.on("data", doc); cf.stderr.on("data", doc);
    for (let i = 0; i < 60 && !HAM; i++) await ngu(1000);
    let song = false; for (let i = 0; i < 30 && HAM && !song; i++) { song = await fetch(HAM + "/api/ping").then((r) => r.ok, () => false); if (!song) await ngu(4000); }
    ok(song, "hầm thử sống: " + HAM);
    if (song) {
      const t = ten("tep:" + CLIP_BC), O = { ...MOZ, origin: "http://localhost:8123" };
      ok((await fetch(HAM + "/ma/" + t, { headers: O })).status === 401, "qua hầm: /ma/ không phiên → 401");
      const pf = await fetch(HAM + "/ma/" + t, { method: "OPTIONS", headers: { ...O, "access-control-request-method": "GET", "access-control-request-headers": "range" } });
      ok(pf.status === 204 && /range/i.test(pf.headers.get("access-control-allow-headers") || "") && pf.headers.get("access-control-allow-origin") === "http://localhost:8123", "qua hầm: preflight CORS cho tiêu đề Range → 204 (" + pf.headers.get("access-control-allow-headers") + ")");
      const rr = await fetch(HAM + "/ma/" + t + "?phien=" + PHIEN, { headers: { ...O, range: "bytes=36-1048627" } }), bb = Buffer.from(await rr.arrayBuffer());
      ok(rr.status === 206 && bb.length === 1048592 && /^bytes 36-1048627\//.test(rr.headers.get("content-range") || ""), "qua hầm: Range đoạn 0 (1 MiB + thẻ) → 206 đúng " + bb.length + " byte");
      const SWh = napSW(); await SWh.khoa(K_THU, HAM); const t9 = Date.now(), rh = await SWh.goi("tep:" + CLIP_BC, "bytes=" + (3 * S - 50) + "-" + (3 * S + 49));
      ok(rh.ma === 206 && rh.b.equals(goc.subarray(3 * S - 50, 3 * S + 50)), "qua hầm: sw.js giải Range vắt ranh đoạn 3 đúng byte gốc (" + (Date.now() - t9) + " ms, gồm đọc đầu tệp)");
      const tq = chayGuong("--dich=" + HAM, "--loc=^tep:/anh/2026-10-14/");
      ok(/hỏng 0/.test(tq) && /đã đẩy \d+ mục/.test(tq), "qua hầm: laptop đẩy luồng bản mã có Content-Length (" + (tq.match(/đã đẩy[^\n]*/) || [tq.slice(-200)])[0] + ")");
    }
  }

  if (!process.argv.includes("--khong-trinh-duyet")) {
    console.log("— 11) trình duyệt (Edge giả điện thoại 390×844, bản nội bộ localhost:8123)");
    const { default: puppeteer } = await import("puppeteer-core"), { EDGE_PATH } = await import("./token-store.js");
    const DICH = HAM || D;
    const b = await puppeteer.launch({ executablePath: EDGE_PATH, headless: "new", args: ["--autoplay-policy=no-user-gesture-required"] });
    /* o2.iphone: UA iOS Safari · o2.tatSW: trình duyệt KHÔNG có service worker · o2.swLoi: có sw.js nhưng máy dự phòng trả 500 cho mọi yêu cầu
       của sw.js (giả phát hỏng — chặn ở đích service worker qua CDP) ⇒ trang phải tự lùi về giải trong trang */
    const moTrang = async (khoa, o2 = {}) => {
      const ctx = await b.createBrowserContext(), loi = [], goiDich = [], ct = [];
      if (o2.swLoi) ctx.on("targetcreated", async (t) => { if (t.type() !== "service_worker") return;
        try { const s = await t.createCDPSession(); s.on("Fetch.requestPaused", (e) => s.send("Fetch.fulfillRequest", { requestId: e.requestId, responseCode: 500, body: "" }).catch(() => {}));
          await s.send("Fetch.enable", { patterns: [{ urlPattern: "*/ma/*" }] }); } catch (e) { /* */ } });
      const pg = await ctx.newPage();
      pg.on("console", (m) => ct.push(m.type() + ": " + m.text().slice(0, 200)));
      pg.on("pageerror", (e) => loi.push(e.message)); pg.on("request", (r) => { if (r.url().startsWith(DICH)) goiDich.push(r.url().slice(DICH.length).split("?")[0]); });
      await pg.setUserAgent(o2.iphone ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
        : "Mozilla/5.0 (Linux; Android 14; 23116PN5BC) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36");
      await pg.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await pg.evaluateOnNewDocument((o) => {
        if (window.top !== window) return;
        if (o.tatSW) try { Object.defineProperty(Navigator.prototype, "serviceWorker", { get: function () { return undefined; }, configurable: true }); } catch (e) { /* */ }
        try { localStorage.setItem("hx-phien", o.ph); localStorage.setItem("hx-ham", o.dich); localStorage.removeItem("hx-api"); localStorage.removeItem("hx-loc"); localStorage.setItem("tk-phien", "qc-phien-gia-0123456789abcdef0123456789abcdef");
          localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: { id: "qc", ten: "QC", vaiTro: "quantri" }, quyen: { "r.xacminh": "lam", "r.maytram": "lam" } })); } catch (e) { /* */ }
        const goc = window.fetch.bind(window); window.__QC_GAS = [];
        const tra = (j) => Promise.resolve(new Response(JSON.stringify(j), { status: 200, headers: { "content-type": "application/json" } }));
        window.fetch = function (u, opt) {
          const s = String((u && u.url) || u);
          if (/127\.0\.0\.1:8591/.test(s)) return Promise.reject(new TypeError("QC chặn 8591 thật"));
          if (/\/api\/tk-thu|script\.google\.com/.test(s)) {   // Apps Script giả — không gọi Google
            let d = {}; try { d = JSON.parse((opt && opt.body) || "{}"); } catch (e) { /* */ } window.__QC_GAS.push(d.action);
            if (d.action === "xmKhoaMa") return o.khoa ? tra({ status: "success", khoa: o.khoa }) : tra({ status: "error", code: 401, message: "Phiên đăng nhập đã hết — đăng nhập lại." });
            if (d.action === "tk_toi") return tra({ status: "success", nguoi: { id: "qc", ten: "QC", vaiTro: "quantri", quyen: { "r.xacminh": "lam", "r.xm.treo": "lam", "r.xm.cam": "lam", "r.xm.tg": "lam", "r.maytram": "lam" } } });
            if (d.action === "pcBangPh") return tra({ status: "success", srvNow: Date.now(), may: [{ may: "QC-DU-PHONG", xmHam: o.dich, luc: new Date().toISOString() }] });
            if (d.action === "tk_khach") return tra({ status: "success", quyen: {} });
            return tra({ status: "error", message: "QC chặn " + d.action });
          }
          if (opt && opt.method && !/^(GET|HEAD|OPTIONS)$/i.test(opt.method)) return Promise.reject(new TypeError("QC chặn ghi " + s));
          return goc(u, opt);
        };
      }, { ph: PHIEN, dich: DICH, khoa, tatSW: !!o2.tatSW });
      await pg.goto("http://localhost:8123/kiemsoatkho/?tab=xacminh", { waitUntil: "domcontentloaded", timeout: 60000 });
      return { ctx, pg, loi, goiDich, ct };
    };
    /* mở clip bằng lệnh `moi`, chờ khung hình, tua 60%, phát 2 s → số đo (chạy trong trang) */
    const xemClip = (p, moi, sel) => p.evaluate(async (moi, sel) => {
      const cho = (f, ms) => new Promise((ok2, h) => { const t = Date.now(); (function l() { let v = null; try { v = f(); } catch (e) { /* */ } if (v) return ok2(v); if (Date.now() - t > ms) return h(new Error("quá giờ")); setTimeout(l, 40); })(); });
      const t0 = performance.now(); if (!eval(moi)) return { loi: "không mở được" };
      try {
        const v = await cho(() => document.querySelector(sel), 15000);
        await cho(() => v.readyState >= 2, 90000); const tKhung = performance.now() - t0, dur = v.duration;
        const t1 = performance.now(); v.currentTime = dur * 0.6; await cho(() => !v.seeking && v.readyState >= 2, 45000); const tTua = performance.now() - t1;
        v.muted = true; await v.play().catch(() => {}); const c0 = v.currentTime; await new Promise((r) => setTimeout(r, 2000));
        const anhGN = document.querySelector("#lvAnhGN");
        return { tKhung, tTua, dur, chay: v.currentTime - c0, src: v.currentSrc, anh: anhGN ? anhGN.naturalWidth : null, loiKhung: !!document.querySelector("#mBody .hx-loi-clip"), chiBao: !!document.querySelector("#mBody .hx-gm-tai") };
      } catch (e) { const v = document.querySelector(sel); return { loi: e.message, rs: v && v.readyState, err: v && v.error && v.error.code, src: v && v.currentSrc, chu: ((document.querySelector("#mBody .hx-gm-tai") || {}).textContent || "") }; }
    }, moi, sel);
    const T = await moTrang(B64), pg = T.pg;
    const coDl = await pg.waitForFunction(() => window.HXACMINH && window.HXACMINH.coDuLieu(), { timeout: 90000 }).then(() => 1, () => 0);
    if (!coDl) console.log("    chẩn đoán:", JSON.stringify(await pg.evaluate(() => ({ ma: window.__HX_MA_HOA, du: window.__HX_DU_PHONG, api: window.HX_API, may: window.__HX_MAY_CHU,
      gas: window.__QC_GAS, sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller), pane: ((document.querySelector("#pane-xacminh") || {}).innerText || "").slice(0, 200) }))),
      "\n    console: " + T.ct.slice(-15).join("\n      "), "\n    gọi: " + T.goiDich.slice(0, 10).join(" "), T.loi.join(" | "));
    ok(coDl && await pg.evaluate(() => window.__HX_MA_HOA === 1 && window.__HX_DU_PHONG === 1), "điện thoại dò ra bản dự phòng MÃ HOÁ (" + DICH + "), lấy khoá, tải dữ liệu");
    ok(await pg.evaluate(() => !!(navigator.serviceWorker.controller && /\/sw\.js$/.test(navigator.serviceWorker.controller.scriptURL))), "sw.js điều khiển trang (scope " + await pg.evaluate(() => navigator.serviceWorker.controller ? new URL(".", navigator.serviceWorker.controller.scriptURL).pathname : "—") + ")");
    ok(await pg.evaluate(() => { try { return !Object.keys(localStorage).some((k) => /khoa|xm-ma/i.test(k) || String(localStorage.getItem(k)).length === 44 && /=$/.test(localStorage.getItem(k))); } catch (e) { return false; } }), "khoá KHÔNG nằm trong localStorage");
    for (const [sub, sel, tn] of [["treo", "[data-p]", "Theo tác vụ"], ["cam", "[data-lid]", "Theo máy"], ["tg", "tr.hx-tg-nhom", "Nhật ký"]]) {
      if (!coDl) break;
      await pg.evaluate((s) => window.HXACMINH.sub(s), sub); await ngu(2000);
      const n = await pg.evaluate((s) => document.querySelectorAll(s.startsWith("tr.") ? s : "#hxBody " + s).length, sel);
      ok(n > 0, tn + ": có dữ liệu (" + n + " phần tử)");
      await pg.screenshot({ path: SP + "/gm-" + sub + ".png" });
    }
    if (coDl) {
      const anh = await pg.evaluate((u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i.naturalWidth); i.onerror = () => r(-1); i.src = window.hxGuongMa.thu(u); }), "/anh/2026-10-15/BXM-080832.jpg");
      ok(anh > 0, "ảnh nhỏ (đường giải mã) hiện được — rộng " + anh + " px");
      const xem = (moi, sel) => xemClip(pg, moi, sel);
      const k1 = await xem(`window.HXACMINH.moPhieuId("${PHIEU}")`, "#mBody video");
      ok(!k1.loi && /__giai-ma\/k\?u=tep%3A%2Fbc%2F/.test(k1.src || ""), "Theo tác vụ: clip phiếu " + PHIEU + " đi đường giải mã (" + String(k1.src || k1.loi).slice(-60) + ")");
      ok(!k1.loi && k1.tKhung < 15000, "Theo tác vụ: <video> readyState≥2 sau " + Math.round(k1.tKhung || -1) + " ms");
      ok(!k1.loi && k1.tTua < 15000 && k1.chay > 0.5, "Theo tác vụ: tua tới 60% (" + Math.round(k1.tTua || -1) + " ms) rồi phát tiếp " + (k1.chay || 0).toFixed(1) + " s" + (k1.loi ? " — " + JSON.stringify(k1) : ""));
      await pg.keyboard.press("Escape"); await ngu(500); await pg.evaluate(() => { const x = document.querySelector("#modal .close, #mClose, [data-dong]"); if (x) x.click(); });
      await pg.evaluate(() => window.HXACMINH.sub("cam")); await ngu(1500);
      const k2 = await xem(`window.HXACMINH.moLuotId("${LID}")`, "#mBody video");
      ok(!k2.loi && /__giai-ma\/k\?u=tep%3A%2Fvideo%2F/.test(k2.src || "") && k2.tKhung < 15000, "Theo máy: clip lượt " + LID + " phát sau " + Math.round(k2.tKhung || -1) + " ms" + (k2.loi ? " — " + JSON.stringify(k2) : ""));
      ok(!k2.loi && k2.tTua < 15000 && k2.chay > 0.5, "Theo máy: tua giữa clip " + Math.round(k2.tTua || -1) + " ms, phát tiếp " + (k2.chay || 0).toFixed(1) + " s");
      ok(k2.anh == null || k2.anh > 0, "Theo máy: ảnh ghi nhận hiện (" + k2.anh + " px)");
      await pg.screenshot({ path: SP + "/gm-clip.png" });
      const dRo = T.goiDich.filter((u) => /^\/(bc|anh|video|cs|thu)\b|^\/api\/(du-lieu|quy-dinh|ghi-chu|nv)/.test(u));
      ok(dRo.length === 0, "trang không gọi đường bản rõ nào của máy dự phòng (" + T.goiDich.length + " lượt gọi trang: " + [...new Set(T.goiDich)].slice(0, 4).join(", ") + ")");
      ok(T.loi.length === 0, "không lỗi trang " + T.loi.slice(0, 2).join(" | "));
      // hiệu năng: giải 1 đoạn 1 MiB trong trình duyệt (bình thường + CPU chậm ×4 kiểu điện thoại)
      const doGiai = () => pg.evaluate(async () => { const k = await crypto.subtle.importKey("raw", crypto.getRandomValues(new Uint8Array(32)), "AES-GCM", false, ["encrypt", "decrypt"]);
        const d = new Uint8Array(1048576); for (let i = 0; i < d.length; i += 65536) crypto.getRandomValues(d.subarray(i, i + 65536));
        const iv = new Uint8Array(12), ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, d); const t = performance.now();
        for (let i = 0; i < 10; i++) await crypto.subtle.decrypt({ name: "AES-GCM", iv }, k, ct); return (performance.now() - t) / 10; });
      const g1 = await doGiai(); const cdp = await pg.createCDPSession(); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 }); const g4 = await doGiai(); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      ok(g4 < 200, "giải 1 đoạn 1 MiB trong trình duyệt: " + g1.toFixed(1) + " ms (máy này) · " + g4.toFixed(1) + " ms (CPU chậm ×4)");
    }
    await T.ctx.close();
    /* 22/10 user «iPhone: nhiều» — ĐƯỜNG LÙI: trình duyệt KHÔNG có service worker (UA iOS Safari) → giải trong trang, clip = blob tải trọn */
    { const X = await moTrang(B64, { iphone: 1, tatSW: 1 }), p = X.pg;
      const co = await p.waitForFunction(() => window.HXACMINH && window.HXACMINH.coDuLieu(), { timeout: 120000 }).then(() => 1, () => 0);
      ok(co && await p.evaluate(() => !navigator.serviceWorker && window.hxGuongMa.coSW() === false), "iPhone KHÔNG service worker: vẫn lấy khoá + tải dữ liệu (giải trong trang)");
      for (const [sub, sel, tn] of [["treo", "[data-p]", "Theo tác vụ"], ["cam", "[data-lid]", "Theo máy"], ["tg", "tr.hx-tg-nhom", "Nhật ký"]]) {
        if (!co) break;
        await p.evaluate((x) => window.HXACMINH.sub(x), sub); await ngu(2000);
        ok(await p.evaluate((x) => document.querySelectorAll(x.startsWith("tr.") ? x : "#hxBody " + x).length, sel) > 0, "iPhone không SW · " + tn + ": có dữ liệu");
      }
      if (co) {
        const w = await p.evaluate((u) => new Promise((r) => { const i = new Image(); document.body.appendChild(i); i.onload = () => { if (i.src.indexOf("blob:") === 0) r(i.naturalWidth); };
          i.src = window.hxGuongMa.thu(u); setTimeout(() => r(-1), 30000); }), "/anh/2026-10-15/BXM-080832.jpg");
        ok(w > 0, "iPhone không SW · ảnh nhỏ giải trong trang → blob, rộng " + w + " px");
        await p.evaluate(() => window.HXACMINH.sub("treo")); await ngu(1500);
        for (const [c, ten] of [[CLIP5, "~5 MB"], [CLIP9, "~8,5 MB"]]) {
          const mb = Math.round(fs.statSync(path.join(BC_THAT, ...c.url.slice(4).split("/"))).size / 1e5) / 10;
          const k = await xemClip(p, `window.HXACMINH.moPhieuId("${c.id}")`, "#mBody video");
          ok(!k.loi && /^blob:/.test(k.src || "") && !k.loiKhung && !k.chiBao, "iPhone không SW · clip phiếu " + c.id + " (" + mb + " MB) tải trọn + giải → phát sau " + Math.round(k.tKhung || -1) + " ms" + (k.loi ? " — " + JSON.stringify(k) : ""));
          ok(!k.loi && k.tTua < 5000 && k.chay > 0.5, "iPhone không SW · tua 60% " + Math.round(k.tTua || -1) + " ms, phát tiếp " + (k.chay || 0).toFixed(1) + " s");
          await p.keyboard.press("Escape"); await ngu(400);
        }
        await p.evaluate(() => window.HXACMINH.sub("cam")); await ngu(1500);
        const k3 = await xemClip(p, `window.HXACMINH.moLuotId("${LID}")`, "#mBody video");
        ok(!k3.loi && /^blob:/.test(k3.src || "") && k3.chay > 0.5 && (k3.anh == null || k3.anh > 0), "iPhone không SW · Theo máy: clip lượt phát sau " + Math.round(k3.tKhung || -1) + " ms, tua " + Math.round(k3.tTua || -1) + " ms, ảnh ghi nhận " + k3.anh + " px" + (k3.loi ? " — " + JSON.stringify(k3) : ""));
        await p.screenshot({ path: SP + "/gm-iphone-clip.png" });
        ok(X.loi.length === 0, "iPhone không SW · không lỗi trang " + X.loi.slice(0, 2).join(" | "));
      }
      await X.ctx.close(); }
    /* có sw.js nhưng phát hỏng (máy dự phòng trả 500 cho mọi yêu cầu của sw.js) → dữ liệu + clip tự lùi về giải trong trang */
    { const X = await moTrang(B64, { swLoi: 1 }), p = X.pg;
      const co = await p.waitForFunction(() => window.HXACMINH && window.HXACMINH.coDuLieu(), { timeout: 120000 }).then(() => 1, () => 0);
      ok(co && await p.evaluate(() => window.hxGuongMa.coSW() === true), "sw.js có nhưng máy dự phòng trả 500 cho nó → dữ liệu vẫn tải (lùi về giải trong trang)");
      if (co) {
        await p.evaluate(() => window.HXACMINH.sub("treo")); await ngu(1500);
        const k = await xemClip(p, `window.HXACMINH.moPhieuId("${PHIEU}")`, "#mBody video");
        ok(!k.loi && /^blob:/.test(k.src || "") && !k.loiKhung && k.chay > 0.5, "sw.js phát hỏng → clip tự lùi sang blob, phát sau " + Math.round(k.tKhung || -1) + " ms, tua " + Math.round(k.tTua || -1) + " ms" + (k.loi ? " — " + JSON.stringify(k) : ""));
      }
      await X.ctx.close(); }
    // khoá sai / không phiên → báo lỗi gọn, không treo
    for (const [khoa, tn, re] of [[K_SAI.toString("base64"), "khoá SAI", /Không mở được bản dự phòng mã hoá/], ["", "không phiên (xmKhoaMa 401)", /Không mở được bản dự phòng mã hoá[\s\S]*Phiên đăng nhập/]]) {
      const X = await moTrang(khoa), t0 = Date.now();
      const chu = await X.pg.waitForFunction((r) => new RegExp(r).test((document.querySelector("#pane-xacminh") || {}).innerText || ""), { timeout: 60000 }, re.source).then(() => 1, () => 0);
      const txt = await X.pg.evaluate(() => ((document.querySelector("#pane-xacminh") || {}).innerText || "").replace(/\s+/g, " ").slice(0, 160));
      ok(chu, tn + " → trang báo lỗi gọn sau " + Math.round((Date.now() - t0) / 1000) + " s: «" + txt + "»");
      await X.ctx.close();
    }
    await b.close();
  }
} catch (e) { ok(false, "lỗi QC: " + (e.stack || e.message) + (e.cause ? " · nguyên nhân: " + (e.cause.code || "") + " " + (e.cause.message || "") : "")); }
don(); await ngu(800);
for (const t of [TAM, TAM2, TAM3]) try { fs.rmSync(t, { recursive: true, force: true }); } catch { /* */ }
ok(![TAM, TAM2, TAM3].some((t) => fs.existsSync(t)), "đã xoá thư mục tạm");
console.log((truot ? "✗ " : "✓ ") + dat + "/" + (dat + truot) + " đạt");
process.exit(truot ? 1 : 0);
