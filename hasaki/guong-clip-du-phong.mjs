/**
 * guong-clip-du-phong.mjs — GƯƠNG CLIP sang máy chủ Xác minh DỰ PHÒNG (chạy trên LAPTOP).
 *
 *  22/10 user: «cải tiến để laptop tắt vẫn xem được các clip ở theo tác vụ/theo máy/vi phạm».
 *  Bản dự phòng trên PC (may-chu-du-phong.mjs → bang-591.mjs XM_DU_PHONG=1) có danh sách (JSON qua kho Drive) nhưng KHÔNG có clip/ảnh
 *  (kho Drive đi qua Apps Script, trần 40 MB/tệp). Mỗi lượt cò này:
 *   1) hỏi Apps Script pcBang 1 lần → máy có xmHam mà /api/ping trả duPhong + guong ⇒ địa chỉ hầm của bản dự phòng;
 *   2) hỏi 8591 nội bộ của laptop /api/du-lieu → mọi tệp đang được dùng: /bc/… (Theo tác vụ), /anh/… + video lượt (Theo máy);
 *   3) hỏi bản dự phòng GET /api/guong-clip/co → đẩy tệp THIẾU / KHÁC CỠ bằng PUT /api/guong-clip?p=<rel>, tuần tự từng tệp,
 *      ưu tiên tệp phiếu (Theo tác vụ) rồi lượt camera, trong mỗi nhóm tệp MỚI NHẤT trước; trần mỗi lượt (mặc định 600 MB),
 *      tệp > 100 MB bỏ (trần Cloudflare); thử lại 3 lần (2 → 6 → 18 s).
 *  Xác thực: chữ ký HMAC dẫn từ APPSCRIPT_KEY (guong-clip-chung.mjs) — không bao giờ gửi khoá gốc.
 *  Mục «Vi phạm» (dashboard Kiểm soát kho) lấy ảnh/clip thẳng từ hr-media.hasaki.vn — vốn không phụ thuộc laptop, không cần gương.
 *  Tải: 0 lượt work/wms/hr/planogram — chỉ 8591 nội bộ, GAS pcBang 1 lần/lượt (+ tiến độ pcPhu), và hầm của PC.
 *
 *  node guong-clip-du-phong.mjs [--thu] [--tran-mb=600] [--toi-da=<số tệp>] [--loc=<regex trên rel>] [--dich=<url bản dự phòng>] [--nguon=<url 8591>]
 *    --thu : chỉ liệt kê sẽ đẩy gì, không đẩy.   Log: guong-clip-du-phong.log
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { kyGuong, kiemRel, relTuDuong, relTepLuot, timTepLuot, TRAN_TEP } from "./guong-clip-chung.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EXP = path.join(DIR, ".exports");
const GOC = process.env.BAIXE_DIR || "C:/Users/lechitam/Videos/5S-bang-chung/bai-xe";   // cùng cách tính với bang-591.mjs
const BC = path.dirname(GOC);
const A = Object.fromEntries(process.argv.slice(2).map((x) => { const [k, ...v] = x.replace(/^--/, "").split("="); return [k, v.length ? v.join("=") : true]; }));
const THU = !!A.thu, TRAN_LUOT = Number(A["tran-mb"] || 600) * 1024 * 1024, TOI_DA = Number(A["toi-da"] || Infinity);
const LOC = A.loc ? new RegExp(String(A.loc)) : null;
const NGUON = String(A.nguon || "http://127.0.0.1:8591").replace(/\/$/, "");
const LOG = path.join(DIR, "guong-clip-du-phong.log");
const log = (...a) => { const d = new Date().toLocaleString("vi-VN", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }) + " " + a.join(" "); console.log(d); try { fs.appendFileSync(LOG, d + "\n"); } catch { /* */ } };
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const KHOA = process.env.APPSCRIPT_KEY || "";

if (String(process.env.RUNNER_VAI || "").toLowerCase() === "pc") { log("PC không đẩy gương (chỉ laptop có tệp gốc) — bỏ qua"); process.exit(0); }
if (!KHOA) { log("✗ thiếu APPSCRIPT_KEY trong .env — không ký được"); process.exit(1); }

// 1 bản chạy 1 lúc (task IgnoreNew + chạy tay)
const PID_F = path.join(DIR, ".guong-clip.pid");
try { const cu = Number(fs.readFileSync(PID_F, "utf8")); if (cu && cu !== process.pid) { try { process.kill(cu, 0); log("lượt trước (pid " + cu + ") còn chạy — bỏ qua"); process.exit(0); } catch { /* đã chết */ } } } catch { /* */ }
fs.writeFileSync(PID_F, String(process.pid));
process.on("exit", () => { try { if (Number(fs.readFileSync(PID_F, "utf8")) === process.pid) fs.unlinkSync(PID_F); } catch { /* */ } });

const kyHeader = (pt, rel, co, sha) => { const luc = Date.now(); return { "x-guong-luc": String(luc), "x-guong-ky": kyGuong(KHOA, { pt, rel, luc, co, sha }) }; };

// ---- 1) địa chỉ bản dự phòng ----
async function timDich() {
  if (A.dich) return String(A.dich).replace(/\/$/, "");
  const { gasPost } = await import("./session-rules.js");
  const j = await gasPost({ action: "pcBang", key: KHOA }, () => {}, "pcBang (gương clip)");
  if (!j || j.status !== "success") throw new Error((j && j.message) || "Apps Script không trả bảng máy trạm");
  const ds = (j.may || []).filter((m) => /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(String(m.xmHam || ""))).sort((a, b) => Date.parse(b.luc || 0) - Date.parse(a.luc || 0));
  /* 22/10 user «ưu tiên BANGCHUYEN-2 (ổ D 931 GB) làm máy gương»: nhiều bản dự phòng cùng sống → chọn máy báo diaGB (chỗ trống ổ bằng chứng) LỚN nhất */
  let cu = "", tot = null;
  for (const m of ds) {
    const pj = await fetch(m.xmHam + "/api/ping", { signal: AbortSignal.timeout(10000) }).then((r) => (r.ok ? r.json() : null), () => null);
    if (pj && pj.duPhong && pj.guong) { if (!tot || (pj.diaGB || 0) > tot.dia) tot = { may: m.may, url: m.xmHam, dia: pj.diaGB || 0 }; }
    else if (pj && pj.duPhong) cu = m.may;
  }
  if (tot) { log("bản dự phòng: " + tot.may + " · " + tot.url + " · ổ trống " + tot.dia + " GB"); return tot.url; }
  if (cu) log("⚠ " + cu + " đang chạy bản dự phòng CŨ (chưa có gương clip) — chờ PC kéo code mới (git pull 2 giờ/lần, bản dự phòng tự nạp lại)");
  return "";
}

// ---- 2) tệp laptop đang dùng ----
async function tepCanCo() {
  const r = await fetch(NGUON + "/api/du-lieu", { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error("8591 nội bộ trả " + r.status);
  const d = await r.json(), t = JSON.stringify(d), ra = new Map();   // rel → { abs, nhom }
  const them = (rel, abs, nhom) => { if (!rel || ra.has(rel) || kiemRel(rel)) return; if (!fs.existsSync(abs)) return; ra.set(rel, { abs, nhom }); };
  for (const m of t.matchAll(/"\/bc\/([^"?]+)/g)) { let rel = m[1]; try { rel = decodeURIComponent(rel); } catch { /* */ } them(rel, path.join(BC, ...rel.split("/")), 0); }
  const relGoc = path.relative(BC, GOC).split(path.sep).join("/");
  for (const m of t.matchAll(/"\/anh\/(\d{4}-\d{2}-\d{2})\/([^"?/]+)"/g)) them(relGoc + "/" + m[1] + "/" + m[2], path.join(GOC, m[1], m[2]), 1);
  for (const l of d.luot || []) {   // video lượt: /video/<id>/<i> → tệp trong ket-qua.json (đọc thẳng đĩa laptop)
    const ng = /^(\d{4}-\d{2}-\d{2})_/.exec(String(l.id || "")); if (!ng) continue;
    let k = null; try { k = JSON.parse(fs.readFileSync(path.join(GOC, ng[1], "ket-qua.json"), "utf8")); } catch { continue; }
    const luot = (k.luot || []).find((x) => x.id === l.id); if (!luot) continue;
    for (const n of [...(luot.nguon || []), ...(luot.gocPhu || [])]) { const abs = timTepLuot(n && n.file, BC, EXP); if (abs) them(relTepLuot(n.file, BC, EXP) || relTuDuong(abs, BC, EXP), abs, 1); }
  }
  return ra;
}

// ---- 3) đẩy ----
async function day(dich, rel, abs) {
  const buf = fs.readFileSync(abs), sha = crypto.createHash("sha256").update(buf).digest("hex"), mt = Math.round(fs.statSync(abs).mtimeMs);
  const r = await fetch(dich + "/api/guong-clip?p=" + encodeURIComponent(rel), {
    method: "PUT", body: buf, signal: AbortSignal.timeout(Math.round(Math.min(600e3, 60e3 + buf.length / 200))),
    headers: { "content-type": "application/octet-stream", "x-guong-sha256": sha, "x-guong-mtime": String(mt), ...kyHeader("PUT", rel, buf.length, sha) } });
  const j = await r.json().catch(() => ({}));
  return { ma: r.status, loi: j.loi || "" };
}

const TD = THU || A.dich ? null : await import("./tien-do.mjs");   // --dich = chạy thử → không báo tab Máy trạm
let daDay = 0, daMB = 0, hong = 0, boLon = 0;
try {
  const dich = await timDich();
  if (!dich) { log("không thấy bản dự phòng có gương (máy nào có xmHam + ping duPhong/guong) — thôi lượt này"); process.exit(0); }
  const can = await tepCanCo();
  const co = await fetch(dich + "/api/guong-clip/co", { headers: kyHeader("GET", "", 0, ""), signal: AbortSignal.timeout(60000) }).then(async (r) => ({ ma: r.status, j: await r.json().catch(() => ({})) }));
  if (co.ma !== 200) throw new Error("bản dự phòng từ chối liệt kê (" + co.ma + " " + (co.j.loi || "") + ")");
  const daCo = co.j.tep || {};
  const thieu = [...can].filter(([rel, x]) => (!LOC || LOC.test(rel)) && daCo[rel] !== fs.statSync(x.abs).size)
    .map(([rel, x]) => ({ rel, ...x, co: fs.statSync(x.abs).size, mt: fs.statSync(x.abs).mtimeMs }))
    .sort((a, b) => a.nhom - b.nhom || b.mt - a.mt);
  const tong = thieu.reduce((s, x) => s + x.co, 0);
  log(`cần ${can.size} tệp · bản dự phòng đã có ${Object.keys(daCo).length} · thiếu/khác cỡ ${thieu.length} (${Math.round(tong / 1e6)} MB)${LOC ? " · lọc " + LOC : ""}`);
  TD?.batDau("guong-clip-du-phong", "Đẩy clip sang máy chủ dự phòng");
  let ngan = TRAN_LUOT;
  for (const x of thieu) {
    if (daDay >= TOI_DA) break;
    if (x.co > TRAN_TEP) { boLon++; log("bỏ (quá 100 MB, hầm Cloudflare không chở được): " + x.rel + " " + Math.round(x.co / 1e6) + " MB"); continue; }
    if (x.co > ngan) continue;   // hết ngân sách lượt cho tệp lớn — tệp nhỏ hơn vẫn đi
    if (THU) { log("sẽ đẩy: " + x.rel + " (" + Math.round(x.co / 1e4) / 100 + " MB)"); daDay++; daMB += x.co / 1e6; ngan -= x.co; continue; }
    TD?.tienDo({ buoc: "Đẩy clip sang máy chủ dự phòng", i: daDay + 1, n: thieu.length, chiTiet: x.rel.slice(-60) });
    let kq = null;
    for (const cho of [0, 2000, 6000, 18000]) {
      if (cho) await ngu(cho);
      kq = await day(dich, x.rel, x.abs).catch((e) => ({ ma: 0, loi: e.message }));
      if (kq.ma === 200 || (kq.ma >= 400 && kq.ma < 500 && kq.ma !== 408 && kq.ma !== 429) || kq.ma === 507) break;   // lỗi do yêu cầu / hết chỗ → thử lại vô ích
    }
    if (kq.ma === 200) { daDay++; daMB += x.co / 1e6; ngan -= x.co; log("✓ " + x.rel + " (" + Math.round(x.co / 1e4) / 100 + " MB)"); continue; }
    hong++; log("✗ " + x.rel + " → " + kq.ma + " " + kq.loi);
    if (kq.ma === 401 || kq.ma === 507 || kq.ma === 503) { log("dừng lượt: " + (kq.ma === 401 ? "chữ ký bị từ chối (khoá 2 máy khác nhau / giờ lệch)" : kq.ma === 503 ? "bản dự phòng chưa có khoá" : "PC hết chỗ")); break; }
  }
  log(`${THU ? "THỬ — " : ""}xong: ${THU ? "sẽ đẩy" : "đã đẩy"} ${daDay} tệp (${Math.round(daMB)} MB) · hỏng ${hong} · bỏ vì quá 100 MB ${boLon}`);
} catch (e) { hong++; log("✗ lỗi lượt: " + e.message); }
await TD?.xong();
process.exit(hong ? 1 : 0);
