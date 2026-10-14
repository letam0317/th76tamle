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

export async function keo(nhom, { xoaSauKeo = false } = {}) {
  const kho = await khoMucLuc();
  const can = [...kho.values()].filter((k) => trongNhom(nhom, k.ten)).filter((k) => {
    let st; try { st = fs.statSync(tuyetDoi(k.ten)); } catch { return true; }
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
      if (t.thieu || !t.b64) continue;
      const abs = tuyetDoi(t.ten); fs.mkdirSync(path.dirname(abs), { recursive: true });
      const tam = abs + ".dbxm-tam"; fs.writeFileSync(tam, Buffer.from(t.b64, "base64")); fs.renameSync(tam, abs);
      fs.utimesSync(abs, new Date(), new Date(t.luc)); n++; daKeo.push(t.ten);
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
    for (const x of j.kqs || []) { if (x.kq === "ghi") n++; else if (x.kq === "cu") cu++; else if (x.loi) log("lỗi gửi " + x.ten + ": " + x.loi); }
    lo = []; co = 0;
  };
  for (const m of tepMay(nhom, tu)) {
    const k = kho.get(m.ten); if (k && k.luc >= m.luc) continue;
    const buf = fs.readFileSync(m.abs), h = bam(buf); if (k && k.h === h) continue;
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
