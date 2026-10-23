// dong-bo-xm.mjs — ĐỒNG BỘ DỮ LIỆU XÁC MINH giữa laptop và máy trạm qua kho Drive (GAS xm_*), 14/10/2026.
// Vì sao: 4 cò xác minh đọc/ghi .exports/* (gitignore) — PC không có ⇒ chạy là lỗi. Kho Drive = nơi chung. Máy nào chạy cò
//   KÉO bản mới nhất trước khi chạy, ĐẨY phần đã đổi sau khi chạy (chay-xm.mjs lo, trong KHOÁ CHUNG xm_khoa).
//   Laptop (máy sinh dữ liệu + bảng Xác minh) chạy «dinh-ky» mỗi 5': đẩy «vao», kéo «chung» + «ra» (kéo «ra» xong xoá khỏi kho).
//
//   node dong-bo-xm.mjs keo  [--nhom=vao,chung]   kéo tệp kho MỚI hơn bản máy
//   node dong-bo-xm.mjs day  [--nhom=chung] [--tu=<ms>]   đẩy tệp máy MỚI hơn bản kho (--tu: chỉ tệp sửa sau mốc — cho «ra»)
//   node dong-bo-xm.mjs dinh-ky                    (laptop) đẩy vao+chung · kéo chung · kéo ra rồi xoá khỏi kho
//   node dong-bo-xm.mjs khoa <viec> [--ttl=3600] · tra <viec> · xem
// Cấu hình nhóm: cai-pc/dong-bo-xm.json. «@BC/…» = thư mục bằng chứng (cha của BAIXE_DIR; laptop mặc định Videos/5S-bang-chung).
// Bản mới hơn thắng theo GIỜ SỬA TỆP; kéo về đặt mtime = giờ bản kho ⇒ lượt sau không đẩy ngược. GAS từ chối bản cũ hơn bản kho.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { ghiJson } from "./so-ghi.mjs";   // 20/10 ghi sổ JSON an toàn (ghi tạm → đổi tên) + nhật ký ai ghi

const DIR = path.dirname(fileURLToPath(import.meta.url));
const MAY = os.hostname();
const BC = process.env.BAIXE_DIR ? path.dirname(process.env.BAIXE_DIR) : "C:/Users/lechitam/Videos/5S-bang-chung";
const LA_PC = String(process.env.RUNNER_VAI || "").toLowerCase() === "pc";
export const DS = JSON.parse(fs.readFileSync(path.join(DIR, "cai-pc", "dong-bo-xm.json"), "utf8"));
export const log = (...a) => { const d = new Date().toTimeString().slice(0, 8) + " " + a.join(" "); console.log(d); try { fs.appendFileSync(path.join(DIR, "dong-bo-xm.log"), d + "\n"); } catch { /* */ } };

const bam = (buf) => crypto.createHash("sha256").update(buf).digest("hex").slice(0, 32);
const reMau = (mau) => new RegExp("^" + mau.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*") + "$");
const khop = (mau, ten) => reMau(mau).test(ten);
export const tuyetDoi = (ten) => ten.startsWith("@BC/") ? path.join(BC, ten.slice(4)) : path.join(DIR, ten);
/* 14/10 LỖI ĐÃ GẶP: mẫu «ra» (xm-tu-dong/**, kenh-luc-chup/**) trùm tệp «chung» (BAO-CAO.md, kenh-luc-chup/*.json) → «kéo ra rồi xoá kho»
   xoá nhầm tệp chung trên kho. ⇒ MỖI TỆP THUỘC ĐÚNG 1 NHÓM, xét theo thứ tự vao → chung → ra (nhóm đầu tiên khớp). */
export const nhomCua = (ten) => ["vao", "chung", "ra"].find((n) => (DS[n] || []).some((m) => khop(m, ten))) || null;
const trongNhom = (nhom, ten) => nhom.includes(nhomCua(ten));

// Tệp trên máy thuộc các nhóm → [{ten, abs, luc, co, n}] (đi từ thư mục gốc cố định của mẫu, đệ quy, lọc theo mẫu)
export function tepMay(nhom, tu = 0) {
  const ra = new Map();
  for (const n of nhom) for (const mau of DS[n] || []) {
    const phan = mau.split("/"), iSao = phan.findIndex((p) => p.includes("*"));
    const goc = iSao < 0 ? mau : phan.slice(0, iSao).join("/");
    const di = (rel) => {
      const abs = tuyetDoi(rel); let st; try { st = fs.statSync(abs); } catch { return; }
      if (st.isDirectory()) { if (iSao < 0) return; for (const c of fs.readdirSync(abs)) di(rel + "/" + c); return; }
      if (ra.has(rel) || !khop(mau, rel) || nhomCua(rel) !== n || /\.dbxm-tam$|\.lock$/.test(rel)) return;
      if (st.mtimeMs < tu) return;
      if (st.size > 40e6) { log("bỏ (quá 40 MB):", rel); return; }
      ra.set(rel, { ten: rel, abs, luc: Math.round(st.mtimeMs), co: st.size, n });
    };
    di(goc);
  }
  return [...ra.values()];
}

let gasPost;
export async function goi(body, ten) {
  gasPost ||= (await import("./session-rules.js")).gasPost;
  const j = await gasPost({ ...body, key: process.env.APPSCRIPT_KEY }, () => {}, ten);
  if (!j || j.status !== "success") throw new Error((j && j.message) || "GAS không trả (" + ten + ")");
  return j;
}
async function khoMucLuc() { const j = await goi({ action: "xm_ds" }, "xm_ds"); return new Map(j.ds.map((x) => [x.ten, x])); }

/* 19/10 user «chuẩn bị clip/camera cho phiếu nghi ngờ — việc nặng, chia việc để không quá tải máy»: cò soi camera chạy SONG SONG trên 2 máy
   (mỗi máy 1 phần phiếu, không giữ khoá chung). Tệp «gop» (JSON khoá theo phiếu/ngày) nhiều máy cùng ghi → ĐẨY KIỂU CŨ (cả tệp, bản mới
   thắng) làm mất kết quả máy kia. Nay gộp 3 chiều: GỐC = bản lần cuối kéo/đẩy (.exports/.dbxm-goc/), TA = bản máy, HỌ = bản kho.
   Khoá chỉ ta đổi → lấy ta · chỉ họ đổi → lấy họ · cả hai đổi: object → gộp sâu, số → họ + (ta − gốc) (đếm lượt Gemini), còn lại → ta.
   Họ thiếu khoá ta có → GIỮ (không coi là xoá: đua ghi cùng giây tự lành ở lượt sau). Ta xoá khoá mà họ không đổi → xoá. */
const laGop = (ten) => (DS.gop || []).includes(ten);
const fGoc = (ten) => path.join(DIR, ".exports", ".dbxm-goc", ten.replace(/[\/@]/g, "__"));
const ghiGoc = (ten, buf) => { try { fs.mkdirSync(path.dirname(fGoc(ten)), { recursive: true }); fs.writeFileSync(fGoc(ten), buf); } catch { /* lượt sau gộp với gốc rỗng */ } };
const docJson = (buf) => { try { return JSON.parse(String(buf)); } catch { return undefined; } };
const giong = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const laObj = (x) => x && typeof x === "object" && !Array.isArray(x);
export function gop3(goc, ta, ho) {
  if (laObj(ta) && laObj(ho)) {
    const g = laObj(goc) ? goc : {}, ra = {};
    for (const k of new Set([...Object.keys(ho), ...Object.keys(ta)])) {
      const coTa = k in ta, coHo = k in ho, coGoc = k in g;
      if (!coTa) { if (coHo && !(coGoc && giong(ho[k], g[k]))) ra[k] = ho[k]; continue; }   // ta xoá: chỉ xoá khi họ không đổi
      if (!coHo) { if (!(coGoc && giong(ta[k], g[k]))) ra[k] = ta[k]; continue; }   // họ xoá: chỉ xoá khi ta không đổi (23/10: trước giữ lại ⇒ phiếu phần kia gỡ khỏi hàng chờ «sống lại»)
      const taDoi = !coGoc || !giong(ta[k], g[k]), hoDoi = !coGoc || !giong(ho[k], g[k]);
      ra[k] = !taDoi ? ho[k] : !hoDoi ? ta[k] : gop3(coGoc ? g[k] : undefined, ta[k], ho[k]);
    }
    return ra;
  }
  if (typeof ta === "number" && typeof ho === "number") return typeof goc === "number" ? ho + (ta - goc) : Math.max(ta, ho);
  return ta;
}

export async function keo(nhom, { xoaSauKeo = false } = {}) {
  const kho = await khoMucLuc();
  const can = [...kho.values()].filter((k) => trongNhom(nhom, k.ten)).filter((k) => {
    let st; try { st = fs.statSync(tuyetDoi(k.ten)); } catch { return true; }
    if (laGop(k.ten)) { let g = null; try { g = bam(fs.readFileSync(fGoc(k.ten))); } catch { /* */ } return k.h !== g && bam(fs.readFileSync(tuyetDoi(k.ten))) !== k.h; }   // gộp: theo nội dung, không theo giờ máy
    if (k.luc <= Math.round(st.mtimeMs)) return false;                // máy có bản mới hơn / bằng → giữ
    return bam(fs.readFileSync(tuyetDoi(k.ten))) !== k.h;
  });
  let n = 0; const daKeo = [];
  for (let i = 0; i < can.length;) {
    const lo = []; let co = 0;
    // 14/10: ≤ 25 tệp và ≤ 8 MB/lượt — lượt 20 MB (~150 tệp, GAS đọc Drive từng tệp) quá giờ chờ 6 phút
    while (i < can.length && (!lo.length || (co + (can[i].co || 0) < 8e6 && lo.length < 25))) { co += can[i].co || 0; lo.push(can[i++].ten); }
    const j = await goi({ action: "xm_tai", ten: lo }, "xm_tai");
    for (const t of j.tep) {
      if (t.thieu || t.b64 == null) continue;   // 14/10: tệp RỖNG (b64 "") vẫn phải tạo — trước bỏ qua → kéo mãi «0/1» mỗi 5 phút
      const abs = tuyetDoi(t.ten); fs.mkdirSync(path.dirname(abs), { recursive: true });
      const tam = abs + ".dbxm-tam", bo = Buffer.from(t.b64, "base64");
      if (laGop(t.ten) && fs.existsSync(abs)) {   // máy còn phần chưa đẩy (lượt trước đẩy hỏng) → gộp, không đè; lượt đẩy sau gửi bản gộp
        let gocBuf = null; try { gocBuf = fs.readFileSync(fGoc(t.ten)); } catch { /* */ }
        const taBuf = fs.readFileSync(abs), ta = docJson(taBuf), ho = docJson(bo);
        if (gocBuf && bam(gocBuf) !== bam(taBuf) && ta !== undefined && ho !== undefined) {   // chưa có gốc (lần đầu sau 19/10) → kéo đè như cũ
          ghiJson(tam, gop3(gocBuf ? docJson(gocBuf) : undefined, ta, ho), { thut: 1 }); fs.renameSync(tam, abs);
          ghiGoc(t.ten, bo); n++; daKeo.push(t.ten); log("gộp 3 chiều khi kéo " + t.ten); continue;
        }
      }
      fs.writeFileSync(tam, bo); fs.renameSync(tam, abs);
      fs.utimesSync(abs, new Date(), new Date(t.luc)); n++; daKeo.push(t.ten);
      if (laGop(t.ten)) ghiGoc(t.ten, bo);
    }
    const nhan = j.tep.length; if (nhan < lo.length) i -= lo.length - nhan;   // kho cắt bớt (quá 25 MB) → lấy tiếp
  }
  if (xoaSauKeo) {   // «ra» đã về laptop → xoá khỏi kho cho nhẹ Drive (cả tệp đã có sẵn, giống hệt)
    const xoa = [...kho.values()].filter((k) => trongNhom(nhom, k.ten)).map((k) => k.ten).filter((t) => fs.existsSync(tuyetDoi(t)));
    for (let i = 0; i < xoa.length; i += 100) await goi({ action: "xm_xoa", ten: xoa.slice(i, i + 100) }, "xm_xoa");
    if (xoa.length) log(`xoá ${xoa.length} tệp «ra» khỏi kho (đã về máy)`);
  }
  if (can.length) log(`kéo: ${n}/${can.length} tệp mới hơn từ kho (nhóm ${nhom.join(",")})`);
  return daKeo;
}

export async function day(nhom, { tu = 0 } = {}) {
  const kho = await khoMucLuc(); let n = 0, cu = 0, lo = [], co = 0;
  const gui = async () => {   // gửi gộp nhiều tệp/lượt (≤ 12 MB thô) — 1 lượt/tệp quá chậm
    if (!lo.length) return;
    const j = await goi({ action: "xm_gui", tep: lo, may: MAY }, "xm_gui x" + lo.length);
    for (const x of j.kqs || []) {
      if (x.kq === "ghi") n++; else if (x.kq === "cu") cu++; else if (x.loi) log("lỗi gửi " + x.ten + ": " + x.loi);
      if ((x.kq === "ghi" || x.kq === "giong") && laGop(x.ten)) { const d = daGui.find((g) => g.ten === x.ten); if (d) ghiGoc(x.ten, d.buf); }
    }
    lo = []; co = 0;
  };
  const daGui = [];
  for (const m of tepMay(nhom, tu)) {
    const k = kho.get(m.ten);
    let buf = fs.readFileSync(m.abs), h = bam(buf);
    if (laGop(m.ten)) {   // tệp gộp: xét theo NỘI DUNG so với gốc, không theo giờ sửa (máy kia đẩy sau vẫn phải gộp phần của ta)
      let gocBuf = null; try { gocBuf = fs.readFileSync(fGoc(m.ten)); } catch { /* chưa có gốc */ }
      if (k && k.h === h) { if (!gocBuf || bam(gocBuf) !== h) ghiGoc(m.ten, buf); continue; }
      if (!gocBuf) { if (k && k.luc >= m.luc) continue; }            // chưa có gốc (lần đầu sau 19/10) → xét giờ sửa như cũ, không gộp
      else if (bam(gocBuf) === h) continue;                     // ta không đổi gì từ lần cuối → để lượt kéo lấy bản họ
      if (k && gocBuf && bam(gocBuf) !== k.h) {                    // họ cũng đã đổi → kéo bản kho, gộp 3 chiều
        const t = ((await goi({ action: "xm_tai", ten: [m.ten] }, "xm_tai gop")).tep || [])[0];
        const ho = t && t.b64 != null ? docJson(Buffer.from(t.b64, "base64")) : undefined, ta = docJson(buf);
        if (ho !== undefined && ta !== undefined) {
          const ra = Buffer.from(JSON.stringify(gop3(gocBuf ? docJson(gocBuf) : undefined, ta, ho), null, 1));
          const tam = m.abs + ".dbxm-tam"; fs.writeFileSync(tam, ra); fs.renameSync(tam, m.abs);
          buf = ra; h = bam(ra); log("gộp 3 chiều " + m.ten + " (máy này + bản kho của " + (k.may || "?") + ")");
        }
      }
      if (k && k.h === h) { ghiGoc(m.ten, buf); continue; }
      m.luc = Math.max(Date.now(), (k ? k.luc : 0) + 1); fs.utimesSync(m.abs, new Date(), new Date(m.luc));
    } else {
      if (k && k.luc >= m.luc) continue;
      if (k && k.h === h) continue;
    }
    daGui.push({ ten: m.ten, buf });
    if (co + buf.length > 12e6 || lo.length >= 25) await gui();   // ≤ 12 MB và ≤ 25 tệp/lượt (mỗi tệp ~1 s ghi Drive)
    lo.push({ ten: m.ten, b64: buf.toString("base64"), luc: m.luc, h }); co += buf.length;
  }
  await gui();
  if (n || cu) log(`đẩy: ${n} tệp lên kho${cu ? ` · ${cu} tệp kho có bản mới hơn (không đè)` : ""} (nhóm ${nhom.join(",")})`);
  return n;
}

export const khoa = (viec, ttl = 3600) => goi({ action: "xm_khoa", may: MAY, viec, ttl }, "xm_khoa");
export const tra = (viec) => goi({ action: "xm_khoa", may: MAY, viec, tra: true }, "xm_khoa tra");

// LAPTOP mỗi 5': đẩy dữ liệu laptop sinh + phần chung laptop sửa (web), kéo kết quả máy trạm về; ketqua B1 mới → cập nhật Sheet B1 treo
export async function dinhKy() {
  await day(["vao", "chung"]);
  const ve = await keo(["chung"]);
  await keo(["ra"], { xoaSauKeo: true });
  if (ve.includes(".exports/canh-b1-ketqua.json")) {   // máy trạm vừa soát B1 → Sheet B1 treo + bảng (bước này cần đăng nhập Google của laptop)
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync("python", ["sheet-b1-treo.py", "--lam"], { cwd: DIR, encoding: "utf8", timeout: 10 * 60e3, windowsHide: true });
    log("ketqua B1 mới từ máy trạm → sheet-b1-treo --lam: mã " + r.status);
  }
}

if (process.argv[1] && path.basename(process.argv[1]) === "dong-bo-xm.mjs") {   // so đúng tên (qc-dong-bo-xm.mjs cũng kết thúc bằng tên này)
  const A = process.argv.slice(2), LENH = A[0] || "xem";
  const opt = Object.fromEntries(A.filter((x) => x.startsWith("--")).map((x) => { const [k, v] = x.slice(2).split("="); return [k, v ?? true]; }));
  const nhom = (mac) => String(opt.nhom || mac).split(",");
  try {
    if (LENH === "keo") await keo(nhom("vao,chung"));
    else if (LENH === "day") await day(nhom(LA_PC ? "chung" : "vao,chung"), { tu: Number(opt.tu) || 0 });
    else if (LENH === "dinh-ky") await dinhKy();
    else if (LENH === "khoa") { const j = await khoa(A[1] || "?", Number(opt.ttl) || 3600); log("khoá:", j.kq, j.may ? "(" + j.may + " · " + j.viec + ")" : ""); process.exit(j.kq === "giu" ? 0 : 75); }
    else if (LENH === "tra") { await tra(A[1] || ""); log("nhả khoá", A[1] || ""); }
    else {   // xem: so máy ↔ kho, không đổi gì
      const kho = await khoMucLuc(), may = tepMay(nhom("vao,chung"));
      for (const m of may) { const k = kho.get(m.ten); console.log((k ? (k.luc > m.luc ? "kho mới hơn" : k.luc < m.luc ? "máy mới hơn" : "bằng nhau") : "chưa lên kho").padEnd(13), m.n.padEnd(6), m.ten); }
      console.log(`— ${may.length} tệp trên máy · ${kho.size} tệp trong kho`);
    }
  } catch (e) { log("LỖI:", e.message); process.exit(1); }
}
