/**
 * guong-clip-du-phong.mjs — GƯƠNG MÃ HOÁ sang máy chủ Xác minh DỰ PHÒNG (chạy trên LAPTOP).
 *
 *  22/10 user: «cải tiến để laptop tắt vẫn xem được các clip ở theo tác vụ/theo máy/vi phạm» → gương clip (bản rõ).
 *  22/10 (cùng ngày) user: «máy gương clip dự phòng phải để CẢ ADMIN của máy đó cũng KHÔNG xem được clip lẫn dữ liệu Xác minh, mà clip
 *  vẫn phát nhanh, tua được» → từ nay laptop CHỈ đẩy BẢN MÃ (guong-ma-hoa.mjs, khoá XM_MA_KHOA trong .env laptop), tên ẩn; máy dự phòng
 *  không có khoá. KHÔNG BAO GIỜ lùi về đẩy bản rõ: thiếu khoá / PC chưa nâng cấp (ping không có maHoa) → bỏ lượt, ghi log.
 *
 *  Mỗi lượt (task 15'):
 *   1) hỏi Apps Script pcBang 1 lần → máy có xmHam mà /api/ping trả duPhong + maHoa ⇒ địa chỉ hầm (nhiều máy → máy nhiều chỗ trống nhất);
 *   2) BẢN CHỤP dữ liệu trang Xác minh cần khi xem (GET 8591 nội bộ): /api/du-lieu?go=1 (bản ĐÃ GỠ người gửi — khoá giải cấp cho mọi
 *      tài khoản có quyền Xác minh), /api/quy-dinh, /api/ghi-chu (cả sổ; trang tự lọc ?id=). KHÔNG chụp được: /api/nv?q= (tìm NV theo chữ gõ,
 *      vô hạn — chỉ dùng trong pop-up quyết định, mà bản dự phòng vốn không cho ghi) ⇒ trang trả rỗng;
 *   3) TỆP mà dữ liệu đang tham chiếu: /bc/… (Theo tác vụ), /anh/… + /video/<id>/<i|gN> (Theo máy), /cs/… (ảnh soi camera giờ nộp báo cáo)
 *      + ẢNH NHỎ 320px (/thu của 8591 nội bộ) cho mọi ảnh .jpg cục bộ — bảng danh sách dùng ảnh nhỏ, thiếu thì trang tự lùi về ảnh gốc;
 *   4) hỏi bản dự phòng GET /api/guong-ma/co (tên ẩn → cỡ) → đẩy cái THIẾU / ĐỔI (tệp: cỡ + giờ sửa; bản chụp/ảnh nhỏ: sha256 bản rõ)
 *      bằng PUT /api/guong-ma?ten=<tên ẩn>: mã hoá LUỒNG từng đoạn 1 MiB (2 lượt cùng salt: lượt 1 băm để ký, lượt 2 gửi — không nạp cả
 *      tệp 100 MB vào RAM). Thứ tự: bản chụp → tệp phiếu → ảnh nhỏ → lượt camera, trong nhóm MỚI NHẤT trước; trần lượt 600 MB;
 *      bản mã > 100 MB bỏ (trần Cloudflare); thử lại 2 → 6 → 18 s;
 *   5) PUT /api/guong-ma/dung = danh sách tên ẩn còn dùng (PC dọn tên không còn dùng trước khi vượt trần).
 *  Xác thực: chữ ký HMAC dẫn từ APPSCRIPT_KEY (guong-clip-chung.mjs) — không gửi khoá gốc; khoá mã hoá K không bao giờ rời laptop.
 *  Sổ laptop: .exports/guong-ma-da-day.json { tên ẩn: { k: khoá rõ, sha|mt, co } } (chỉ trên laptop).
 *  Tải: 0 lượt work/wms/hr/planogram — chỉ 8591 nội bộ (+ gviz QUY-DINH do 8591 đệm 1 giờ), GAS pcBang 1 lần/lượt, hầm của PC.
 *
 *  node guong-clip-du-phong.mjs [--thu] [--lien-tuc] [--tran-mb=600] [--toi-da=<số tệp>] [--loc=<regex trên khoá>] [--dich=<url bản dự phòng>] [--nguon=<url 8591>]
 *    --lien-tuc : lượt đầu — không trần 600 MB, chạy tới khi đủ (Ctrl+C dừng an toàn).
 *    --thu : chỉ liệt kê sẽ đẩy gì, không đẩy.   Log: guong-clip-du-phong.log
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { kyGuong, timTepLuot } from "./guong-clip-chung.mjs";
import { docKhoa, tenAn, khoaDuong, khoaApi, maHoaLuong, bamBanMa, coMa, loaiTheoDuoi, LOAI } from "./guong-ma-hoa.mjs";
import { ghiJson, docJson } from "./so-ghi.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EXP = path.join(DIR, ".exports");
const GOC = process.env.BAIXE_DIR || "C:/Users/lechitam/Videos/5S-bang-chung/bai-xe";   // cùng cách tính với bang-591.mjs
const BC = path.dirname(GOC);
const A = Object.fromEntries(process.argv.slice(2).map((x) => { const [k, ...v] = x.replace(/^--/, "").split("="); return [k, v.length ? v.join("=") : true]; }));
const THU = !!A.thu, TRAN_LUOT = Number(A["tran-mb"] || 600) * 1024 * 1024, TOI_DA = Number(A["toi-da"] || Infinity);
const LOC = A.loc ? new RegExp(String(A.loc)) : null;
const NGUON = String(A.nguon || "http://127.0.0.1:8591").replace(/\/$/, "");
const LOG = path.join(DIR, "guong-clip-du-phong.log");
const SO_F = process.env.GUONG_MA_SO || path.join(EXP, "guong-ma-da-day.json");
const TRAN_MA = 100 * 1024 * 1024 + 8192;   // trần thân yêu cầu Cloudflare (bản mã)
const log = (...a) => { const d = new Date().toLocaleString("vi-VN", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }) + " " + a.join(" "); console.log(d); try { fs.appendFileSync(LOG, d + "\n"); } catch { /* */ } };
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const KHOA_KY = process.env.APPSCRIPT_KEY || "";
const K = docKhoa(process.env.XM_MA_KHOA);

if (String(process.env.RUNNER_VAI || "").toLowerCase() === "pc") { log("PC không đẩy gương (chỉ laptop có tệp gốc) — bỏ qua"); process.exit(0); }
if (!KHOA_KY) { log("✗ thiếu APPSCRIPT_KEY trong .env — không ký được"); process.exit(1); }
if (!K) { log("✗ thiếu/hỏng XM_MA_KHOA (32 byte base64) trong .env — KHÔNG đẩy (không bao giờ đẩy bản rõ). Sinh khoá: node tao-khoa-ma-xm.mjs"); process.exit(1); }

// 1 bản chạy 1 lúc (task IgnoreNew + chạy tay)
const PID_F = path.join(DIR, ".guong-clip.pid");
try { const cu = Number(fs.readFileSync(PID_F, "utf8")); if (cu && cu !== process.pid) { try { process.kill(cu, 0); log("lượt trước (pid " + cu + ") còn chạy — bỏ qua"); process.exit(0); } catch { /* đã chết */ } } } catch { /* */ }
fs.writeFileSync(PID_F, String(process.pid));
process.on("exit", () => { try { if (Number(fs.readFileSync(PID_F, "utf8")) === process.pid) fs.unlinkSync(PID_F); } catch { /* */ } });

const kyHeader = (pt, rel, co, sha) => { const luc = Date.now(); return { "x-guong-luc": String(luc), "x-guong-ky": kyGuong(KHOA_KY, { pt, rel, luc, co, sha }) }; };

// ---- 1) địa chỉ bản dự phòng ----
async function timDich() {
  if (A.dich) return String(A.dich).replace(/\/$/, "");
  const { gasPost } = await import("./session-rules.js");
  const j = await gasPost({ action: "pcBang", key: KHOA_KY }, () => {}, "pcBang (gương mã hoá)");
  if (!j || j.status !== "success") throw new Error((j && j.message) || "Apps Script không trả bảng máy trạm");
  const ds = (j.may || []).filter((m) => /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(String(m.xmHam || ""))).sort((a, b) => Date.parse(b.luc || 0) - Date.parse(a.luc || 0));
  /* 22/10 user «ưu tiên BANGCHUYEN-2 (ổ D 931 GB) làm máy gương»: nhiều bản dự phòng mã hoá cùng sống → máy báo diaGB LỚN nhất */
  let cu = "", tot = null;
  for (const m of ds) {
    const pj = await fetch(m.xmHam + "/api/ping", { signal: AbortSignal.timeout(10000) }).then((r) => (r.ok ? r.json() : null), () => null);
    if (pj && pj.duPhong && pj.maHoa) { if (!tot || (pj.diaGB || 0) > tot.dia) tot = { may: m.may, url: m.xmHam, dia: pj.diaGB || 0 }; }
    else if (pj && pj.duPhong) cu = m.may;
  }
  if (tot) { log("bản dự phòng mã hoá: " + tot.may + " · " + tot.url + " · ổ trống " + tot.dia + " GB"); return tot.url; }
  if (cu) log("⚠ " + cu + " đang chạy bản dự phòng CHƯA MÃ HOÁ — không đẩy bản rõ; chờ PC tự cập nhật (5'/lần khi có commit mới)");
  return "";
}

// ---- 2+3) thứ cần có trên bản dự phòng: Map khoá → { nhom, loai, abs?, buf?, mt? } ----
const layNoiBo = async (duong, tg = 60000) => { const r = await fetch(NGUON + duong, { signal: AbortSignal.timeout(tg) }); if (!r.ok) throw new Error("8591 nội bộ " + duong + " trả " + r.status); return Buffer.from(await r.arrayBuffer()); };
function timLuot(id) {   // cùng bang-591 timLuot (đọc thẳng đĩa laptop)
  const m = /^(\d{4}-\d{2}-\d{2})_/.exec(String(id || "")); if (!m) return null;
  return (docJson(path.join(GOC, m[1], "ket-qua.json"), {}).luot || []).find((l) => l.id === id) || null;
}
async function thuCanCo() {
  const ra = new Map();
  const them = (khoa, x) => { if (!ra.has(khoa) && (!LOC || LOC.test(khoa))) ra.set(khoa, x); };
  // bản chụp API (nhóm 0 — trang không mở được gì nếu thiếu)
  const bDl = await layNoiBo("/api/du-lieu?go=1"), d = JSON.parse(bDl.toString("utf8"));
  /* 8591 laptop chưa khởi động lại sau bản 22/10 thì không hiểu ?go=1 → trả bản CÓ người gửi 5S ⇒ không chụp, báo rõ */
  if ((d.phieu || []).some((p) => p.nguoiGui) || ((d.tacGia || {}).ds || []).some((x) => x.nguoi)) throw new Error("8591 laptop còn bản cũ (trả cả người gửi 5S) — khởi động lại 8591 rồi chạy lại");
  them(khoaApi("/api/du-lieu"), { nhom: 0, loai: LOAI.json, buf: bDl });
  for (const p of ["/api/quy-dinh", "/api/ghi-chu"]) { try { them(khoaApi(p), { nhom: 0, loai: LOAI.json, buf: await layNoiBo(p) }); } catch (e) { log("⚠ không chụp được " + p + ": " + e.message); } }
  // tệp
  const t = JSON.stringify(d), anhCuc = new Set();
  const tep = (url, abs, nhom) => { if (!abs || !fs.existsSync(abs)) return; const st = fs.statSync(abs); them("tep:" + khoaDuong(url), { nhom, loai: loaiTheoDuoi(abs), abs, mt: Math.round(st.mtimeMs), coRo: st.size }); if (/\.jpe?g$/i.test(abs)) anhCuc.add(url); };
  const trong = (goc, rel) => { const a = path.resolve(goc, rel); return a.startsWith(path.resolve(goc) + path.sep) ? a : null; };
  for (const m of t.matchAll(/"(\/bc\/[^"?]+)/g)) tep(m[1], trong(BC, khoaDuong(m[1]).slice(4)), 2);
  for (const m of t.matchAll(/"(\/cs\/[^"?]+)/g)) tep(m[1], trong(path.join(EXP, "cam-baocao"), khoaDuong(m[1]).slice(4)), 2);
  for (const m of t.matchAll(/"(\/anh\/[^"?]+)/g)) tep(m[1], trong(GOC, khoaDuong(m[1]).slice(5)), 3);
  for (const l of d.luot || []) {   // /video/<id>/<i> và /video/<id>/g<j> — tra tệp đúng như bang-591 /video/
    const k = timLuot(l.id); if (!k) continue;
    for (const v of l.video || []) { const i = Number(String(v.url).split("/")[3]); tep(v.url, timTepLuot((k.nguon || [])[i]?.file, BC, EXP), 3); }
    const phu = (k.gocPhu || []).filter((g) => timTepLuot(g.file, BC, EXP));
    for (const g of l.gocPhu || []) { const j = Number(String(g.url).split("/g")[1]); tep(g.url, timTepLuot(phu[j]?.file, BC, EXP), 3); }
  }
  // ảnh nhỏ (nhóm 1 — bảng danh sách hiện đủ hình sớm) — đúng tham số trang gửi /thu (thu_: đường như trong dữ liệu)
  for (const url of anhCuc) them("thu:" + khoaDuong(url), { nhom: 1, loai: LOAI.jpeg, thu: url });
  return ra;
}

// ---- 4) đẩy 1 bản mã: lượt 1 băm (ký), lượt 2 gửi luồng với Content-Length ----
function putLuong(dich, duong, headers, luong, tg) {
  return new Promise((ok, hong) => {
    const u = new URL(dich + duong), mod = u.protocol === "https:" ? https : http;
    const rq = mod.request(u, { method: "PUT", headers, timeout: tg }, (r) => { const ch = []; r.on("data", (c) => ch.push(c)); r.on("end", () => { let j = {}; try { j = JSON.parse(Buffer.concat(ch).toString("utf8")); } catch { /* */ } ok({ ma: r.statusCode, loi: j.loi || "" }); }); });
    rq.on("timeout", () => rq.destroy(new Error("quá giờ"))); rq.on("error", hong);
    (async () => { for await (const x of luong) { if (!rq.write(x)) await new Promise((r) => rq.once("drain", r)); } rq.end(); })().catch((e) => rq.destroy(e));
  });
}
async function dayMot(dich, ten, x) {
  const nguon = x.buf || x.abs, o = { khoa: x.khoa, loai: x.loai, salt: crypto.randomBytes(16) };
  const { sha, co } = await bamBanMa(K, nguon, o);
  if (co > TRAN_MA) return { ma: 413, loi: "bản mã quá 100 MB" };
  return putLuong(dich, "/api/guong-ma?ten=" + ten, { "content-type": "application/octet-stream", "content-length": co, "x-guong-sha256": sha, ...kyHeader("PUT", "ma:" + ten, co, sha) },
    maHoaLuong(K, nguon, o), Math.round(Math.min(600e3, 60e3 + co / 200)));
}
async function dayDung(dich, ds) {
  const b = Buffer.from(JSON.stringify({ ds })), sha = crypto.createHash("sha256").update(b).digest("hex");
  const r = await fetch(dich + "/api/guong-ma/dung", { method: "PUT", body: b, signal: AbortSignal.timeout(60000), headers: { "content-type": "application/json", "x-guong-sha256": sha, ...kyHeader("PUT", "dung", b.length, sha) } });
  return r.status;
}

const TD = THU || A.dich ? null : await import("./tien-do.mjs");   // --dich = chạy thử → không báo tab Máy trạm
/* 22/10 «lượt đầu nhanh» (--lien-tuc): không trần 600 MB, chạy lượt này nối lượt kia tới khi đủ (mỗi lượt đọc lại dữ liệu mới nhất);
   vẫn tuần tự từng tệp, thứ tự bản chụp /api → ảnh nhỏ → tệp phiếu đang mở → lượt camera. Ctrl+C: gửi nốt tệp đang dở, lưu sổ rồi thoát
   (bấm lần 2 = thoát ngay). Bản dự phòng mất liên lạc giữa chừng (đường hầm đổi địa chỉ) → hỏi lại Apps Script, có địa chỉ mới thì chạy tiếp. */
const LIEN_TUC = !!A["lien-tuc"];
let DUNG = false;
process.on("SIGINT", () => { if (DUNG) process.exit(130); DUNG = true; log("Ctrl+C — dừng sau tệp đang gửi (bấm lần nữa để thoát ngay)"); });
let daDay = 0, daMB = 0, hong = 0, boLon = 0;
const songKhong = (u) => fetch(u + "/api/ping", { signal: AbortSignal.timeout(10000) }).then((r) => r.ok, () => false);
async function motLuot(dich) {   // → { day, conThieu, doiDich }
  const can = await thuCanCo();
  const co = await fetch(dich + "/api/guong-ma/co", { headers: kyHeader("GET", "", 0, ""), signal: AbortSignal.timeout(60000) }).then(async (r) => ({ ma: r.status, j: await r.json().catch(() => ({})) }));
  if (co.ma !== 200) throw new Error("bản dự phòng từ chối liệt kê (" + co.ma + " " + (co.j.loi || "") + ")");
  const daCo = co.j.tep || {}, so = docJson(SO_F, {});
  const ds = [];
  for (const [khoa, x] of can) {
    const ten = tenAn(K, khoa), cu = so[ten] || {};
    if (x.thu) { try { x.buf = await layNoiBo("/thu?u=" + encodeURIComponent(x.thu), 30000); } catch { continue; } }   // ảnh nhỏ: 8591 nội bộ (sharp, đệm .thu-cache)
    const coRo = x.buf ? x.buf.length : x.coRo, coM = coMa(coRo);
    let doi;
    if (x.buf) { x.sha = crypto.createHash("sha256").update(x.buf).digest("hex"); doi = daCo[ten] !== coM || cu.sha !== x.sha; }
    else doi = daCo[ten] !== coM || (cu.mt != null && cu.mt !== x.mt);
    if (!doi && !cu.k) so[ten] = { k: khoa, ...(x.sha ? { sha: x.sha } : { mt: x.mt }), co: coM };   // PC có đúng cỡ mà sổ laptop mất → ghi nhận, khỏi đẩy lại cả kho
    ds.push({ ten, khoa, ...x, coM, doi });
  }
  const thieu = ds.filter((x) => x.doi).sort((a, b) => a.nhom - b.nhom || (b.mt || 0) - (a.mt || 0));
  const tong = thieu.reduce((s, x) => s + x.coM, 0);
  log(`cần ${ds.length} mục (bản chụp ${ds.filter((x) => x.khoa.startsWith("api:")).length} · ảnh nhỏ ${ds.filter((x) => x.khoa.startsWith("thu:")).length}) · bản dự phòng có ${Object.keys(daCo).length} · thiếu/đổi ${thieu.length} (${Math.round(tong / 1e6)} MB)${LOC ? " · lọc " + LOC : ""}${LIEN_TUC ? " · liên tục" : ""}`);
  TD?.batDau("guong-clip-du-phong", "Đẩy bản mã hoá sang máy chủ dự phòng");
  let ngan = LIEN_TUC ? Infinity : TRAN_LUOT, day = 0, boQua = 0, doiDich = false;
  const luuSo = () => { if (THU) return; for (const t of Object.keys(so)) if (!ds.some((x) => x.ten === t)) delete so[t]; ghiJson(SO_F, so, { thut: 0 }); };
  for (const x of thieu) {
    if (DUNG || daDay >= TOI_DA) break;
    if (x.coM > TRAN_MA) { boLon++; boQua++; log("bỏ (quá 100 MB, hầm Cloudflare không chở được): " + x.khoa + " " + Math.round(x.coM / 1e6) + " MB"); continue; }
    if (x.coM > ngan) { boQua++; continue; }   // hết ngân sách lượt cho tệp lớn — tệp nhỏ hơn vẫn đi
    if (THU) { log("sẽ đẩy: " + x.khoa + " (" + Math.round(x.coM / 1e4) / 100 + " MB)"); daDay++; day++; daMB += x.coM / 1e6; ngan -= x.coM; continue; }
    TD?.tienDo({ buoc: "Đẩy bản mã hoá sang máy chủ dự phòng", i: day + 1, n: thieu.length, chiTiet: x.khoa.slice(-60) });
    let kq = null;
    for (const cho of [0, 2000, 6000, 18000]) {
      if (cho) await ngu(cho);
      kq = await dayMot(dich, x.ten, x).catch((e) => ({ ma: 0, loi: e.message }));
      if (kq.ma === 200 || (kq.ma >= 400 && kq.ma < 500 && kq.ma !== 408 && kq.ma !== 429) || kq.ma === 507) break;   // lỗi do yêu cầu / hết chỗ → thử lại vô ích
    }
    if (kq.ma === 200) { daDay++; day++; daMB += x.coM / 1e6; ngan -= x.coM; so[x.ten] = { k: x.khoa, ...(x.sha ? { sha: x.sha } : { mt: x.mt }), co: x.coM }; log("✓ " + x.khoa + " (" + Math.round(x.coM / 1e4) / 100 + " MB)");
      if (day % 20 === 0) luuSo(); continue; }
    hong++; log("✗ " + x.khoa + " → " + kq.ma + " " + kq.loi);
    if (kq.ma === 401 || kq.ma === 507 || kq.ma === 503) { log("dừng lượt: " + (kq.ma === 401 ? "chữ ký bị từ chối (khoá 2 máy khác nhau / giờ lệch)" : kq.ma === 503 ? "bản dự phòng chưa có khoá" : "PC hết chỗ")); DUNG = true; break; }
    if (kq.ma === 0 && !(await songKhong(dich))) { log("bản dự phòng không trả lời (" + dich + ") — tìm lại địa chỉ"); doiDich = true; break; }
  }
  luuSo();
  if (!THU && !doiDich) { const m = await dayDung(dich, ds.map((x) => x.ten)).catch(() => 0); if (m !== 200) log("⚠ không gửi được danh sách còn dùng (" + m + ") — PC dọn theo tuổi khi vượt trần"); }
  return { day, conThieu: thieu.length - day - boQua, doiDich };
}
try {
  let dich = await timDich();
  if (!dich) { log("không thấy bản dự phòng MÃ HOÁ (máy có xmHam + ping duPhong/maHoa) — thôi lượt này"); process.exit(0); }
  for (let vong = 1; ; vong++) {
    const r = await motLuot(dich);
    if (DUNG || THU) break;
    if (r.doiDich) { const moi = A.dich ? "" : await timDich().catch(() => ""); if (!moi) { log("không còn bản dự phòng nào trả lời — dừng"); break; } dich = moi; continue; }
    if (!LIEN_TUC || r.day === 0 || r.conThieu <= 0) break;
    log("liên tục: hết vòng " + vong + " — còn " + r.conThieu + " mục, chạy vòng tiếp");
  }
  log(`${THU ? "THỬ — " : ""}xong: ${THU ? "sẽ đẩy" : "đã đẩy"} ${daDay} mục (${Math.round(daMB)} MB) · hỏng ${hong} · bỏ vì quá 100 MB ${boLon}${DUNG ? " · dừng giữa chừng" : ""}`);
} catch (e) { hong++; log("✗ lỗi lượt: " + e.message); }
await TD?.xong();
process.exit(hong ? 1 : 0);
