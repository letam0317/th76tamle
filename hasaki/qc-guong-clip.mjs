/* QC 22/10 GƯƠNG CLIP (user «laptop tắt vẫn xem được các clip ở theo tác vụ/theo máy/vi phạm»): laptop đẩy clip/ảnh sang bản dự phòng.
 * KHÔNG đụng máy chủ 8591 / đường hầm đang chạy, KHÔNG ghi dữ liệu thật:
 *   · bật bản dự phòng THỬ ở cổng 8593 (XM_DU_PHONG=1) với thư mục bằng chứng TẠM (BAIXE_DIR=<tạm>/bai-xe) — 8591 thật chỉ bị ĐỌC /api/du-lieu;
 *   · bản thứ 2 ở 8594 trần gương rất nhỏ để thử «vượt trần → xoá tệp gương cũ nhất không còn tham chiếu»;
 *   · (mặc định) 1 đường hầm cloudflared riêng trỏ vào 8593 — ca đi qua hầm. --khong-ham để bỏ.
 * Dùng: node qc-guong-clip.mjs [--khong-ham]   → xoá thư mục tạm + tắt mọi tiến trình thử khi xong. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { phienQC } from "./xacminh-dang-nhap.mjs";
import { ghiJson } from "./so-ghi.mjs";
import { kyGuong } from "./guong-clip-chung.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const TAM = fs.mkdtempSync(path.join(os.tmpdir(), "qc-guong-"));
const TAM2 = fs.mkdtempSync(path.join(os.tmpdir(), "qc-guong2-"));
const BC_THAT = path.dirname(process.env.BAIXE_DIR || "C:/Users/lechitam/Videos/5S-bang-chung/bai-xe");
const KHOA = process.env.APPSCRIPT_KEY || "";
const PHIEN = phienQC();
const D = "http://127.0.0.1:8593", D2 = "http://127.0.0.1:8594";
let dat = 0, truot = 0; const ok = (d, t) => { d ? dat++ : truot++; console.log((d ? "  ✓ " : "  ✗ ") + t); };
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const ky = (pt, rel, co, s, luc = Date.now(), khoa = KHOA) => ({ "x-guong-luc": String(luc), "x-guong-ky": kyGuong(khoa, { pt, rel, luc, co, sha: s }) });
const put = (goc, rel, buf, h = ky("PUT", rel, buf.length, sha(buf))) => fetch(goc + "/api/guong-clip?p=" + encodeURIComponent(rel), { method: "PUT", body: buf, headers: { "x-guong-sha256": sha(buf), ...h } }).then(async (r) => ({ ma: r.status, j: await r.json().catch(() => ({})) }), () => ({ ma: 0, j: {} }));
const coDs = (goc) => fetch(goc + "/api/guong-clip/co", { headers: ky("GET", "", 0, "") }).then((r) => r.json()).then((j) => j.tep || {}, () => ({}));
const chayGuong = (...a) => { const r = spawnSync(process.execPath, ["guong-clip-du-phong.mjs", ...a], { cwd: DIR, encoding: "utf8", env: { ...process.env, TIEN_DO: "0" }, timeout: 600e3 }); return String(r.stdout || "") + String(r.stderr || ""); };

const tienTrinh = [];
const bat = (cong, tam, them = {}) => { const c = spawn(process.execPath, ["bang-591.mjs"], { cwd: DIR, env: { ...process.env, XM_DU_PHONG: "1", BANG591_PORT: String(cong), BAIXE_DIR: path.join(tam, "bai-xe"), ...them }, windowsHide: true, stdio: "ignore" }); tienTrinh.push(c); return c; };
const don = () => { for (const c of tienTrinh) try { c.kill(); } catch { /* */ } };
process.on("exit", don);

// 5 tệp thật nhỏ: 3 ảnh phiếu (Theo tác vụ) + 1 ảnh lượt + 1 video lượt (Theo máy)
const LOC = "^may/(13808701_CHUP-09190804|13881466_CHUP-09240843|14047709_KHO-10041614)\\.jpg$|^bai-xe/2026-10-15/BXM-080832\\.jpg$|^bai-xe-tam/2026-10-15/BXM-luot-080642-113s\\.mp4$";
try {
  if (!KHOA) throw new Error("thiếu APPSCRIPT_KEY");
  // dữ liệu lượt (kho Drive kéo về PC) — chép ket-qua.json ngày 15/10 vào thư mục tạm để /video/ tra được lượt
  fs.mkdirSync(path.join(TAM, "bai-xe", "2026-10-15"), { recursive: true });
  /* giả máy KHÁC đã cắt video: đổi đường video thành đường không có trên máy này (ổ Z:) — bản dự phòng phải tự tìm ra bản gương <BC>/bai-xe-tam */
  const kqGoc = JSON.parse(fs.readFileSync(path.join(BC_THAT, "bai-xe", "2026-10-15", "ket-qua.json"), "utf8"));
  for (const l of kqGoc.luot || []) for (const n of [...(l.nguon || []), ...(l.gocPhu || [])]) if (n && n.file) n.file = String(n.file).replace(/^.*?([\\/]\.bai-xe-tam[\\/])/i, "Z:\\khong-co\\hasaki\\.exports$1");
  ghiJson(path.join(TAM, "bai-xe", "2026-10-15", "ket-qua.json"), kqGoc, { thut: 0 });
  bat(8593, TAM); bat(8594, TAM2, { GUONG_TRAN_GB: String(250e3 / 1024 ** 3) });   // 8594: trần ~250 KB
  for (let i = 0; i < 40; i++) { if (await fetch(D + "/api/ping").then((r) => r.ok, () => false) && await fetch(D2 + "/api/ping").then((r) => r.ok, () => false)) break; await ngu(500); }
  const pj = await fetch(D + "/api/ping").then((r) => r.json(), () => ({}));
  ok(pj.duPhong === 1 && pj.guong === 1, "ping bản dự phòng thử: duPhong + guong");

  // --- xác thực ---
  ok((await fetch(D + "/api/guong-clip/co")).status === 401, "không chữ ký → 401");
  ok((await fetch(D + "/api/guong-clip/co", { headers: ky("GET", "", 0, "", Date.now(), "khoa-sai") })).status === 401, "khoá sai → 401");
  ok((await fetch(D + "/api/guong-clip/co", { headers: ky("GET", "", 0, "", Date.now() - 6 * 60e3) })).status === 401, "chữ ký quá 5 phút (phát lại) → 401");
  const b0 = Buffer.from("thu");
  ok((await put(D, "may/x.jpg", b0, ky("PUT", "may/khac.jpg", b0.length, sha(b0)))).ma === 401, "chữ ký của đường khác → 401");
  ok((await put(D, "may/x.jpg", b0, ky("PUT", "may/x.jpg", b0.length, sha(Buffer.from("khac"))))).ma === 401, "chữ ký của nội dung khác → 401");
  // --- đường dẫn / đuôi ---
  for (const r of ["../x.jpg", "may/../../x.jpg", "C:/Windows/x.jpg", "/abs/x.jpg", "may\\x.jpg", ".an/x.jpg"]) ok((await put(D, r, b0)).ma === 400, "đường «" + r + "» → 400");
  for (const r of ["may/x.exe", "may/x.json", "may/x.mjs", "x.jpg.bat"]) ok((await put(D, r, b0)).ma === 400, "đuôi «" + r + "» → 400");
  ok(!fs.existsSync(path.join(TAM, "..", "x.jpg")) && !fs.existsSync(path.join(os.tmpdir(), "x.jpg")), "không tệp nào lọt ra ngoài thư mục bằng chứng");
  // --- tệp > 100 MB: khai Content-Length 101 MB, không gửi thân ---
  const lon = await new Promise((res) => { const co = 101 * 1024 * 1024, rel = "may/lon.mp4", s = "0".repeat(64);
    const rq = http.request(D + "/api/guong-clip?p=" + encodeURIComponent(rel), { method: "PUT", headers: { "content-length": co, "x-guong-sha256": s, ...ky("PUT", rel, co, s) } }, (r) => { r.resume(); res(r.statusCode); rq.destroy(); });
    rq.on("error", () => res(0)); rq.flushHeaders(); });
  ok(lon === 413, "tệp khai 101 MB → 413 (" + lon + "), không ghi");
  // --- sai sha → 400, không để lại tệp ---
  const sai = await fetch(D + "/api/guong-clip?p=may%2Fsai.jpg", { method: "PUT", body: b0, headers: { "x-guong-sha256": sha(Buffer.from("x")), ...ky("PUT", "may/sai.jpg", 3, sha(Buffer.from("x"))) } });
  ok(sai.status === 400 && !fs.existsSync(path.join(TAM, "may", "sai.jpg")), "thân không khớp sha256 → 400, không để lại tệp");

  // --- script: --thu không đẩy; lần 1 đẩy 5; lần 2 đẩy 0 ---
  const t0 = chayGuong("--thu", "--dich=" + D, "--loc=" + LOC);
  ok(/sẽ đẩy 5 tệp/.test(t0) && Object.keys(await coDs(D)).length === 0, "--thu: liệt kê 5 tệp, không đẩy (" + (t0.match(/sẽ đẩy \d+ tệp[^\n]*/) || [""])[0] + ")");
  const t1 = chayGuong("--dich=" + D, "--loc=" + LOC);
  ok(/đã đẩy 5 tệp/.test(t1) && /hỏng 0/.test(t1), "lượt 1 đẩy 5 tệp (" + (t1.match(/đã đẩy[^\n]*/) || [t1.slice(-200)])[0] + ")");
  const co = await coDs(D); let khop = 0, n = 0;
  for (const [rel, c] of Object.entries(co)) { n++; const goc = rel.startsWith("bai-xe-tam/") ? path.join(DIR, ".exports", ".bai-xe-tam", ...rel.split("/").slice(1)) : path.join(BC_THAT, ...rel.split("/")); if (fs.statSync(goc).size === c) khop++; }
  ok(n === 5 && khop === 5, "«co» liệt kê " + n + " tệp, đúng cỡ " + khop + "/5");
  for (const rel of Object.keys(co).filter((r) => r.startsWith("may/"))) {
    const b = Buffer.from(await (await fetch(D + "/bc/" + rel, { headers: { "x-hx-phien": PHIEN, "user-agent": "Mozilla/5.0" } })).arrayBuffer());
    ok(sha(b) === sha(fs.readFileSync(path.join(BC_THAT, ...rel.split("/")))), "GET /bc/" + rel + " từ bản dự phòng = đúng byte gốc (SHA-256)");
  }
  const bAnh = Buffer.from(await (await fetch(D + "/anh/2026-10-15/BXM-080832.jpg", { headers: { "x-hx-phien": PHIEN, "user-agent": "Mozilla/5.0" } })).arrayBuffer());
  ok(sha(bAnh) === sha(fs.readFileSync(path.join(BC_THAT, "bai-xe", "2026-10-15", "BXM-080832.jpg"))), "Theo máy: /anh/ lượt từ bản dự phòng = đúng byte gốc");
  const kq = JSON.parse(fs.readFileSync(path.join(TAM, "bai-xe", "2026-10-15", "ket-qua.json"), "utf8"));
  const lId = (kq.luot.find((l) => (l.nguon || []).some((x) => /BXM-luot-080642-113s/.test(x.file))) || {}).id;
  const rv = await fetch(D + "/video/" + lId + "/0", { headers: { "x-hx-phien": PHIEN, "user-agent": "Mozilla/5.0" } });
  const bVid = Buffer.from(await rv.arrayBuffer());
  ok(rv.status === 200 && sha(bVid) === sha(fs.readFileSync(path.join(DIR, ".exports", ".bai-xe-tam", "2026-10-15", "BXM-luot-080642-113s.mp4"))), "Theo máy: /video/" + lId + "/0 (ket-qua.json ghi đường của máy khác) → tìm ra bản gương, đúng byte");
  const rr = await fetch(D + "/video/" + lId + "/0", { headers: { "x-hx-phien": PHIEN, "user-agent": "Mozilla/5.0", range: "bytes=0-99" } });
  ok(rr.status === 206 && (await rr.arrayBuffer()).byteLength === 100, "video gương tua được (Range → 206)");
  const t2 = chayGuong("--dich=" + D, "--loc=" + LOC);
  ok(/thiếu\/khác cỡ 0/.test(t2) && /đã đẩy 0 tệp/.test(t2), "lượt 2: đã đủ, đẩy 0 tệp");
  // giờ sửa giữ theo laptop (để dong-bo-xm «ra» trên PC không đẩy ngược lên kho Drive)
  const mtG = fs.statSync(path.join(TAM, "may", "13808701_CHUP-09190804.jpg")).mtimeMs, mtL = fs.statSync(path.join(BC_THAT, "may", "13808701_CHUP-09190804.jpg")).mtimeMs;
  ok(Math.abs(mtG - mtL) < 2000, "tệp gương giữ giờ sửa của laptop");
  // --- vẫn chỉ xem ---
  const ghi = await fetch(D + "/api/quyet-dinh", { method: "POST", headers: { "x-hx-phien": PHIEN, "content-type": "application/json", "user-agent": "Mozilla/5.0" }, body: "{}" });
  ok(ghi.status === 503, "POST /api/quyet-dinh trên bản dự phòng thử → 503 (" + ghi.status + ")");
  const ghi2 = await fetch(D + "/api/ghi-chu", { method: "POST", headers: { "x-hx-phien": PHIEN, "content-type": "application/json", "user-agent": "Mozilla/5.0" }, body: "{}" });
  ok(ghi2.status === 503, "POST /api/ghi-chu → 503 (" + ghi2.status + ")");
  ok((await fetch("http://127.0.0.1:8591/api/guong-clip/co", { headers: ky("GET", "", 0, "") })).status !== 200, "máy chủ chính 8591 (không dự phòng) KHÔNG mở đường gương");

  // --- trần tổng: 8594 trần ~250 KB, 3 ảnh ~90 KB → ảnh thứ 3 đẩy ảnh cũ nhất (không tham chiếu) ra ---
  const anh = ["may/13808701_CHUP-09190804.jpg", "may/13881466_CHUP-09240843.jpg", "may/14047709_KHO-10041614.jpg"].map((r) => fs.readFileSync(path.join(BC_THAT, ...r.split("/"))));
  const rA = await put(D2, "thu/a.jpg", anh[0]); await ngu(20); const rB = await put(D2, "thu/b.jpg", anh[1]); await ngu(20); const rC = await put(D2, "thu/c.jpg", anh[2]);
  const co2 = await coDs(D2);
  ok(rA.ma === 200 && rB.ma === 200 && rC.ma === 200 && !co2["thu/a.jpg"] && co2["thu/b.jpg"] && co2["thu/c.jpg"], "vượt trần → xoá tệp gương cũ nhất (a), giữ b + c (" + Object.keys(co2).join(", ") + ")");
  fs.writeFileSync(path.join(TAM2, "pc-tu-sinh.jpg"), anh[0]);   // tệp PC tự sinh (không qua gương) — không bao giờ bị xoá
  await put(D2, "thu/d.jpg", anh[1]);
  ok(fs.existsSync(path.join(TAM2, "pc-tu-sinh.jpg")), "tệp PC tự sinh không bị dọn khi vượt trần");

  // --- đi qua đường hầm ---
  if (!process.argv.includes("--khong-ham") && fs.existsSync(path.join(DIR, "bin", "cloudflared.exe"))) {
    let HAM = ""; const cf = spawn(path.join(DIR, "bin", "cloudflared.exe"), ["tunnel", "--no-autoupdate", "--protocol", "http2", "--url", D], { windowsHide: true }); tienTrinh.push(cf);
    const doc = (b) => { const m = String(b).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/); if (m && !HAM) HAM = m[0]; };
    cf.stdout.on("data", doc); cf.stderr.on("data", doc);
    for (let i = 0; i < 60 && !HAM; i++) await ngu(1000);
    let song = false; for (let i = 0; i < 30 && HAM && !song; i++) { song = await fetch(HAM + "/api/ping").then((r) => r.ok, () => false); if (!song) await ngu(4000); }
    ok(song, "hầm thử sống: " + HAM);
    if (song) {
      ok((await fetch(HAM + "/api/guong-clip/co")).status === 401, "qua hầm, không chữ ký → 401");
      ok((await fetch(HAM + "/api/guong-clip/co", { headers: { "x-hx-phien": PHIEN, "user-agent": "Mozilla/5.0" } })).status === 401, "qua hầm, có PHIÊN đăng nhập nhưng không chữ ký → 401 (phiên không mở được gương)");
      const th = chayGuong("--dich=" + HAM, "--loc=^may/14047705_CHUP-10050943\\.jpg$");
      ok(/đã đẩy 1 tệp/.test(th), "qua hầm: đẩy 1 tệp (" + (th.match(/đã đẩy[^\n]*/) || [th.slice(-200)])[0] + ")");
      ok((await fetch(HAM + "/bc/may/14047705_CHUP-10050943.jpg", { headers: { "user-agent": "Mozilla/5.0" } })).status === 401, "qua hầm: xem /bc/ không phiên → 401");
      const bh = Buffer.from(await (await fetch(HAM + "/bc/may/14047705_CHUP-10050943.jpg", { headers: { "x-hx-phien": PHIEN, "user-agent": "Mozilla/5.0" } })).arrayBuffer());
      ok(sha(bh) === sha(fs.readFileSync(path.join(BC_THAT, "may", "14047705_CHUP-10050943.jpg"))), "qua hầm: /bc/ có phiên = đúng byte gốc");
    }
  }
} catch (e) { ok(false, "lỗi QC: " + e.message); }
don(); await ngu(800);
for (const t of [TAM, TAM2]) try { fs.rmSync(t, { recursive: true, force: true }); } catch { /* */ }
ok(!fs.existsSync(TAM) && !fs.existsSync(TAM2), "đã xoá thư mục tạm");
console.log((truot ? "✗ " : "✓ ") + dat + "/" + (dat + truot) + " đạt");
process.exit(truot ? 1 : 0);
