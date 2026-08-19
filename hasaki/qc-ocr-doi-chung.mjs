/**
 * qc-ocr-doi-chung.mjs — ĐO XEM ĐỌC TEM BẰNG GÌ THÌ RA SKU ĐÚNG NHIỀU HƠN
 * ===========================================================================================
 *  Vì sao có file này: 19/08/2026 thủ kho báo "nhận diện toàn sai hoặc không ra kết quả nào".
 *  Trước khi đổi giải pháp thì phải ĐO, không đoán. File này chạy CÙNG một bộ ảnh tem qua 5 đường
 *  rồi đếm Top-1 / Top-3:
 *
 *    A. AI-vai            Gemini trả 5 nhóm (item_codes/specs/colors/brands) → tuAI()   ← ĐANG CHẠY
 *    B. AI-vai + bằng chứng  như A nhưng tuAI(o, cm): mảnh ra dáng mã mà CÓ THẬT trong danh mục thì
 *                            vào vai MÃ, bất kể AI xếp nó ở đâu
 *    C. AI-chữ thô        lấy raw_text của Gemini → tuVanBan()  (bỏ hẳn vai do AI gán)
 *    D. OCR Google        Drive OCR (miễn phí, không tốn hạn mức AI) → tuVanBan()
 *    E. OCR không lọc     như D nhưng KHÔNG lọc mảnh theo danh mục — để biết bước lọc đáng giá bao nhiêu
 *
 *  Nhãn trên tem KHÔNG bịa: cắt thẳng các phần tử của PRODUCTNAME một SKU thật trong danh mục
 *  (mã · màu · thông số), rồi trộn thêm CHỮ GIẤY TỜ đúng kiểu tem thật (địa chỉ NCC, số PO, số lô,
 *  ngày, số lượng, cân nặng) — chính mấy dòng đó là thứ làm nhiễu mà bản cũ không lọc.
 *  Đáp án đúng = SKU nào cùng "mặt hàng" (khoaHang) với SKU đã lấy nhãn.
 *
 *  node qc-ocr-doi-chung.mjs [--so 8] [--duong ABCDE] [--chi-tiet] [--giu-anh]
 *    cần GEMINI_API_KEY trong hasaki/.env  (đường A/B/C) và ~/.clasprc.json (đường D/E)
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import "dotenv/config";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const F_HTML = path.join(DIR, "..", "factory", "index.html");
const F_GS = path.join(DIR, "google-script.gs");
const OUT = path.join(DIR, ".exports", "qc-ocr");
const CHI_TIET = process.argv.includes("--chi-tiet");
const GIU = process.argv.includes("--giu-anh");
const SO = Number(process.argv.includes("--so") ? process.argv[process.argv.indexOf("--so") + 1] : 8) || 8;
const DUONG = String(process.argv.includes("--duong") ? process.argv[process.argv.indexOf("--duong") + 1] : "ABCDE").toUpperCase();
const canAI = /[ABCFG]/.test(DUONG), canOCR = /[DEFG]/.test(DUONG);
/* KHO ĐỆM: mỗi lượt đọc tem tốn thời gian (AI) và hạn mức. Thử các cách GHÉP từ khoá thì chỉ cần
   chữ đã đọc được, không cần gọi lại — nên lưu lại kết quả 2 người đọc rồi chạy lại offline.
   Khoá đệm gồm cả tên file ảnh (đã mang bậc khó) để không lẫn giữa 2 bộ đề. */
const F_DEM = path.join(DIR, ".exports", "qc-ocr-dem.json");
const DUNG_DEM = process.argv.includes("--dung-dem");
let DEM = {};
if (fs.existsSync(F_DEM)) { try { DEM = JSON.parse(fs.readFileSync(F_DEM, "utf8")); } catch { DEM = {}; } }

/* ---------- 1. Lõi đối soát + prompt: cắt từ CHÍNH mã đang phục vụ ---------- */
const html = fs.readFileSync(F_HTML, "utf8");
const E = new Function(html.slice(html.indexOf("/*<NDS-ENGINE>*/"), html.indexOf("/*</NDS-ENGINE>*/")) + "\n return NDS_ENGINE;")();
const gs = fs.readFileSync(F_GS, "utf8");
const { SV_PROMPT, SV_SCHEMA, SV_MODELS } = new Function(
  gs.slice(gs.indexOf("var SV_TRAN_NGAY"), gs.indexOf("/** Cài khoá Gemini")) +
  "\n return {SV_PROMPT:SV_PROMPT, SV_SCHEMA:SV_SCHEMA, SV_MODELS:SV_MODELS};")();

const dsFile = path.join(DIR, ".sku-master-dry.json");
if (!fs.existsSync(dsFile)) { console.error("✗ Chưa có .sku-master-dry.json — chạy `node sync-sku-master.mjs --dry` trước."); process.exit(2); }
const ds = JSON.parse(fs.readFileSync(dsFile, "utf8")).rows.map((r) => ({ sku: String(r[0]), pn: r[1], type: r[2], status: r[3], qty: Number(r[4]) || 0 }));
const cm = E.dungChiMuc(ds);
console.log("✓ Lõi đối soát + danh mục " + ds.length + " SKU");

/* ---------- 2. Khoá truy cập ---------- */
const KEY = process.env.GEMINI_API_KEY;
if (canAI && !KEY) { console.error("✗ Thiếu GEMINI_API_KEY trong hasaki/.env"); process.exit(3); }
let AUTH = "";
if (canOCR) {
  const rc = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".clasprc.json"), "utf8"));
  const t = rc.tokens ? rc.tokens.default : rc.token;
  const tk = await (await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: t.client_id, client_secret: t.client_secret, refresh_token: t.refresh_token, grant_type: "refresh_token" }),
  })).json();
  if (!tk.access_token) { console.error("✗ Không làm tươi được token clasp: " + JSON.stringify(tk).slice(0, 200)); process.exit(3); }
  AUTH = "Bearer " + tk.access_token;
  console.log("✓ Token Drive (chính chủ GAS) OK");
}

/* ---------- 3. Chọn SKU mẫu + dựng tem ---------- *
 * Lấy SKU ACTIVE/NORMAL có đủ phần tử (≥5 đoạn) và có MÃ đọc được, rải đều khắp danh mục để không
 * chỉ toàn chỉ may hoặc toàn dây kéo. Không dùng Math.random: lần chạy nào cũng phải ra ĐÚNG bộ ảnh
 * đó, không thì so hai lần chạy với nhau là so hai bộ đề khác nhau. */
/* CHỌN BỘ ĐỀ KHÔNG QUA LÕI: trước đây lọc bằng E.bocTen(...).code.length, tức là sửa lõi thì BỘ ĐỀ
   cũng đổi ⇒ hai lần chạy không so được với nhau (đo 19/08/2026 tưởng lõi tụt từ 75% xuống 17%,
   thật ra là đổi đề). Nay chỉ dùng phép cắt chuỗi thuần: tên có ≥5 đoạn và đoạn mã có cả chữ lẫn số. */
const coMaThuan = (pn) => {
  const dg = String(pn).split("/");
  const dm = dg.find((x) => /_/.test(x)) || dg[1] || "";
  const ma = dm.split("_")[0].trim();
  return ma.length >= 4 && /[A-Za-z]/.test(ma) && /[0-9]/.test(ma);
};
const hopLe = ds.filter((r) => r.status === "ACTIVE" && r.type !== "COMBO" && String(r.pn).split("/").length >= 5 && coMaThuan(r.pn));
const buoc = Math.max(1, Math.floor(hopLe.length / SO));
const mau = [];
for (let i = 0; mau.length < SO && i * buoc < hopLe.length; i++) mau.push(hopLe[i * buoc]);
console.log("✓ " + mau.length + " tem mẫu, nhãn cắt từ PRODUCTNAME thật\n");

/* Chữ GIẤY TỜ trên tem thật — không liên quan tới việc định danh hàng, nhưng OCR/AI nào cũng đọc ra */
const RAC = (n) => [
  "ADD: LOT 24, TAN THOI HIEP IP, DIST 12, HCMC",
  "P/O NO: 45002198" + (70 + n) + "   LOT: 25/08-1" + (10 + n),
  "QTY: " + (30 + n * 7) + " CONE   NET: 1" + (2 + (n % 7)) + ".5 KG   GROSS: 13.8 KG",
  "DATE: " + (10 + (n % 18)) + "/08/2026   INSPECTOR: NG.T.H",
  "MADE IN VIETNAM   8935217004" + (500 + n),
];

/** PRODUCTNAME → mấy dòng CHỮ đúng như tem NCC in (mã · màu · thông số), bỏ đoạn đơn vị. */
function nhanTuPn(pn) {
  const dg = String(pn).split("/").map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
  const dv = dg.length > 1 ? dg[dg.length - 1] : "";
  const than = dg.filter((d) => d !== dv);
  const maDoan = than.find((d) => /_/.test(d)) || than[1] || "";
  const ma = maDoan.split("_")[0].trim();
  const ncc = (maDoan.split("_")[1] || "").trim();
  const conLai = than.filter((d) => d !== maDoan && d !== than[0]).filter((d) => !/^none$|^non$|^null$/i.test(d.trim()));
  return { loai: than[0] || "", ma, ncc, doan: conLai.slice(0, 3) };
}

const KIEU = [
  /* tem BẢNG — kiểu hay gặp nhất */
  (n, t) => `<div style="width:540px;background:#fdfdf8;color:#111;border:2px solid #333;padding:16px 20px;font-family:Arial;font-size:15px;line-height:1.5">
    <div style="font-size:24px;font-weight:900;letter-spacing:1px;border-bottom:2px solid #111;padding-bottom:5px">${esc(t.ncc || "SUPPLIER")}</div>
    <div style="margin-top:10px;font-size:13px;color:#333">${esc(RAC(n)[0])}</div>
    <table style="margin-top:8px;font-size:16px;line-height:1.6">
      <tr><td style="color:#555;padding-right:12px">ART</td><td style="font-weight:800;font-size:19px">${esc(t.ma)}</td></tr>
      ${t.doan.map((d, i) => `<tr><td style="color:#555">${["DESC", "COLOR", "SPEC"][i] || "INFO"}</td><td style="font-weight:700">${esc(d)}</td></tr>`).join("")}
    </table>
    <div style="margin-top:9px;font-size:12px;color:#444">${esc(RAC(n)[1])}<br>${esc(RAC(n)[2])}<br>${esc(RAC(n)[3])}</div></div>`,
  /* tem TRÒN dán lõi cuộn */
  (n, t) => `<div style="width:430px;height:430px;border-radius:50%;background:#fdfdf8;color:#111;border:3px solid #222;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Arial;text-align:center;gap:4px;padding:34px">
    <div style="font-size:25px;font-weight:900;letter-spacing:2px">${esc(t.ncc || "SUPPLIER")}</div>
    <div style="font-size:22px;font-weight:800;border:2px solid #111;padding:2px 12px">${esc(t.ma)}</div>
    ${t.doan.map((d) => `<div style="font-size:15px;font-weight:700">${esc(d)}</div>`).join("")}
    <div style="font-size:11px;color:#444;margin-top:4px">${esc(RAC(n)[2])}</div>
    <div style="font-size:11px;color:#444">${esc(RAC(n)[4])}</div></div>`,
  /* tem DÀI dán cuộn — chữ nhỏ, nhiều dòng giấy tờ */
  (n, t) => `<div style="width:660px;background:#fdfdf8;color:#111;border:1px solid #444;padding:12px 16px;font-family:Arial;font-size:13px;line-height:1.45">
    <div style="display:flex;align-items:baseline;gap:16px;border-bottom:1px solid #111;padding-bottom:4px">
      <div style="font-size:26px;font-weight:900">${esc(t.ncc || "SUPPLIER")}</div>
      <div style="font-size:20px;font-weight:800">${esc(t.ma)}</div></div>
    <div style="margin-top:7px;font-size:15px;font-weight:700">${t.doan.map(esc).join(" &nbsp;·&nbsp; ")}</div>
    <div style="margin-top:7px;color:#333">${RAC(n).slice(0, 4).map(esc).join("<br>")}</div></div>`,
];
function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

fs.mkdirSync(OUT, { recursive: true });
/* BA BẬC KHÓ — đúng thứ gặp khi chụp trong kho, và là chỗ hai người đọc mới tách ra được nhau.
   Bậc 0 tem sạch · bậc 1 nghiêng + mờ + loá nylon · bậc 2 CHỮ NHỎ (thu 0,62) + nhoè + nghiêng nhiều
   + loá mạnh + vết bẩn — tem nhỏ dán lõi cuộn chụp bằng điện thoại một tay trông đúng như bậc 2. */
const BAC = [
  { ten: "sạch", css: "", phu: "" },
  { ten: "KHÓ", css: "filter:blur(1.05px) contrast(.93) brightness(1.05);transform:rotate(-6deg) skewY(1.2deg)",
    phu: `<div style="position:absolute;inset:0;background:linear-gradient(112deg,rgba(255,255,255,.72) 5%,rgba(255,255,255,0) 27%,rgba(255,255,255,0) 63%,rgba(255,255,255,.5) 89%)"></div>` },
  { ten: "RẤT KHÓ", css: "filter:blur(1.5px) contrast(.86) brightness(1.1) saturate(.9);transform:rotate(-13deg) skewY(2.5deg) scale(.62)",
    phu: `<div style="position:absolute;inset:0;background:linear-gradient(100deg,rgba(255,255,255,.9) 3%,rgba(255,255,255,.1) 22%,rgba(255,255,255,0) 55%,rgba(255,255,255,.78) 86%)"></div>
      <div style="position:absolute;left:18%;top:52%;width:120px;height:52px;background:rgba(110,100,80,.34);border-radius:50%;filter:blur(5px)"></div>
      <div style="position:absolute;left:58%;top:22%;width:70px;height:30px;background:rgba(255,255,255,.55);border-radius:50%;filter:blur(4px)"></div>` },
];
const br = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH, args: ["--force-device-scale-factor=1"] });
const pg = await br.newPage();
await pg.setViewport({ width: 980, height: 820, deviceScaleFactor: 1 });
const tem = [];
for (let n = 0; n < mau.length; n++) {
  const r = mau[n], t = nhanTuPn(r.pn), bac = BAC[n % BAC.length];
  await pg.setContent(`<!doctype html><meta charset=utf-8><body style="margin:0;background:#8d8d8d;display:flex;align-items:center;justify-content:center;height:820px">
    <div style="position:relative;padding:52px"><div style="${bac.css}">${KIEU[n % KIEU.length](n, t)}</div>${bac.phu}</div></body>`, { waitUntil: "load" });
  const f = path.join(OUT, "tem" + String(n + 1).padStart(2, "0") + "-" + (n % BAC.length) + ".jpg");
  await pg.screenshot({ path: f, type: "jpeg", quality: 78 });
  tem.push({ n, r, t, kho: bac.ten, f, khoa: E.khoaHang(r.pn) });
}
await br.close();
console.log("✓ Dựng " + tem.length + " ảnh tem (" + OUT + ")\n");

/* ---------- 4. Ba người đọc ---------- */
async function docBangAI(file) {
  const b64 = fs.readFileSync(file).toString("base64");
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: SV_PROMPT }, { inline_data: { mime_type: "image/jpeg", data: b64 } }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: SV_SCHEMA, maxOutputTokens: 2048, temperature: 0 },
  });
  let loi = "";
  for (const model of SV_MODELS) {
    const t0 = Date.now();
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + KEY,
      { method: "POST", headers: { "content-type": "application/json" }, body });
    if (r.status === 429 || r.status === 503) { loi = "HTTP " + r.status + " ở " + model; continue; }
    if (!r.ok) return { loi: "HTTP " + r.status + ": " + (await r.text()).slice(0, 160) };
    const j = await r.json();
    const chu = (((j.candidates || [])[0]?.content?.parts) || []).map((p) => p.text || "").join("");
    try { return { model, ms: Date.now() - t0, kq: JSON.parse(chu) }; }
    catch { return { loi: "JSON sai khuôn" }; }
  }
  return { loi: "hết quota mọi model (" + loi + ")" };
}
/** OCR của Google (Drive convert ảnh → Google Doc) — miễn phí, không tốn hạn mức AI. */
async function docBangOcr(file, lang = "vi") {
  const t0 = Date.now();
  const img = fs.readFileSync(file);
  const B = "==nds" + t0.toString(36) + Math.floor(Math.random() * 1e6).toString(36) + "==";
  const meta = JSON.stringify({ name: "nds-ocr-tam", mimeType: "application/vnd.google-apps.document" });
  const body = Buffer.concat([
    Buffer.from(`--${B}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${B}\r\nContent-Type: image/jpeg\r\n\r\n`, "utf8"),
    img, Buffer.from(`\r\n--${B}--`, "utf8"),
  ]);
  const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&ocrLanguage=" + lang + "&fields=id",
    { method: "POST", headers: { authorization: AUTH, "content-type": "multipart/related; boundary=" + B }, body });
  const j = await r.json();
  if (!j.id) return { loi: "upload " + r.status + " " + JSON.stringify(j).slice(0, 200) };
  const e = await fetch("https://www.googleapis.com/drive/v3/files/" + j.id + "/export?mimeType=text/plain", { headers: { authorization: AUTH } });
  const txt = e.ok ? await e.text() : "";
  const loi = e.ok ? "" : "export " + e.status;
  fetch("https://www.googleapis.com/drive/v3/files/" + j.id, { method: "DELETE", headers: { authorization: AUTH } }).catch(() => { });
  return { ms: Date.now() - t0, txt: String(txt).replace(/﻿/g, "").replace(/^[_\s]+/, "").trim(), loi };
}

/* ---------- 5. Chấm ---------- */
const DS_DUONG = "ABCDEFG".split("");
const diem = {}, diem3 = {}, coMa = {};
DS_DUONG.forEach((k) => { diem[k] = 0; diem3[k] = 0; coMa[k] = 0; });
const msAI = [], msOcr = [];
let nAI = 0, nOcr = 0;

/** Ghép nhiều bộ từ khoá lại thành một (giữ nguyên vai, bỏ trùng). */
function ghep(ds) {
  const ra = { code: [], spec: [], color: [], brand: [] };
  for (const n of ds) for (const v of ["code", "spec", "color", "brand"]) for (const t of (n[v] || [])) if (!ra[v].includes(t)) ra[v].push(t);
  return ra;
}
function chay(nhan, t) {
  const top = E.timTop(nhan, cm, { soLuong: 3, chiActive: true });
  const khoa = top.map((x) => E.khoaHang(x.pn));
  return { top, dung1: khoa[0] === t.khoa, dung3: khoa.indexOf(t.khoa) >= 0, coMa: !!top.coMaKhop };
}
const ten = { A: "A · AI-vai (đang chạy)", B: "B · AI-vai + bằng chứng", C: "C · AI chữ thô → tuVanBan",
  D: "D · OCR Google → tuVanBan", E: "E · OCR không lọc", F: "F · AI chữ thô + vai (ghép)", G: "G · OCR + AI (ghép cả 2)" };

for (const t of tem) {
  console.log("── tem " + (t.n + 1) + " [" + t.kho + "]  đáp án " + t.r.sku + "  mã tem “" + t.t.ma + "”");
  if (CHI_TIET) console.log("   tên WMS: " + t.r.pn.slice(0, 110));
  /* Khoá đệm phải gồm SKU của tem: bộ SKU mẫu được chọn bằng bocTen(), nên hễ sửa lõi là bộ đề đổi.
     Khoá theo tên file (tem03-0.jpg) thì lượt sau lấy CHỮ CỦA TEM CŨ ghép với ĐÁP ÁN MỚI — đo 19/08
     ra 17% và tưởng là lõi vỡ, trong khi lõi vẫn 54/54 ca. Bẫy này đắt, đừng để tái phát. */
  const kAi = "ai:" + t.r.sku + ":" + t.n % 3, kOcr = "ocr:" + t.r.sku + ":" + t.n % 3;
  let ai = null, ocr = null;
  if (canAI) {
    ai = (DUNG_DEM && DEM[kAi]) ? DEM[kAi] : await docBangAI(t.f);
    if (ai.loi) console.log("   ✗ AI: " + ai.loi); else { nAI++; if (ai.ms) msAI.push(ai.ms); DEM[kAi] = ai; }
  }
  if (canOCR) {
    ocr = (DUNG_DEM && DEM[kOcr]) ? DEM[kOcr] : await docBangOcr(t.f);
    if (ocr.loi) console.log("   ✗ OCR: " + ocr.loi); else { nOcr++; if (ocr.ms) msOcr.push(ocr.ms); DEM[kOcr] = ocr; }
  }
  const duong = {};
  if (ai && ai.kq) {
    if (DUONG.includes("A")) duong.A = E.tuAI(ai.kq);
    if (DUONG.includes("B")) duong.B = E.tuAI(ai.kq, cm);
    if (DUONG.includes("C")) duong.C = E.tuVanBan(String(ai.kq.raw_text || ""), cm);
  }
  if (ocr && ocr.txt) {
    if (DUONG.includes("D")) duong.D = E.tuVanBan(ocr.txt, cm);
    if (DUONG.includes("E")) duong.E = E.tuVanBan(ocr.txt, cm, { giuHet: true });
  }
  /* F = chữ thô của AI GHÉP với vai do AI gán (đã lọc bằng danh mục) — hai nguồn bù nhau:
     chữ thô giữ được mã dài, còn vai của AI giữ được mẩu chữ mà bocTen bóc không ra. */
  if (DUONG.includes("F") && ai && ai.kq) duong.F = ghep([E.tuVanBan(String(ai.kq.raw_text || ""), cm), E.tuAI(ai.kq, cm)]);
  /* G = OCR Google GHÉP với AI — dùng khi đã trả tiền cả hai lượt (đo cận trên của việc ghép) */
  if (DUONG.includes("G") && ai && ai.kq && ocr && ocr.txt) duong.G = ghep([E.tuVanBan(ocr.txt, cm), E.tuVanBan(String(ai.kq.raw_text || ""), cm), E.tuAI(ai.kq, cm)]);
  if (CHI_TIET && ocr && ocr.txt) console.log("   OCR: " + ocr.txt.split(/\n+/).map((x) => x.trim()).filter(Boolean).join(" | ").slice(0, 240));
  if (CHI_TIET && ai && ai.kq) console.log("   AI mã=" + JSON.stringify(ai.kq.item_codes || []) + " màu=" + JSON.stringify(ai.kq.colors || []));
  for (const k of Object.keys(duong)) {
    const kq = chay(duong[k], t);
    if (kq.dung1) diem[k]++;
    if (kq.dung3) diem3[k]++;
    if (kq.coMa) coMa[k]++;
    const r1 = kq.top[0];
    console.log("   " + (kq.dung1 ? "✓" : (kq.dung3 ? "~" : "✗")) + " " + ten[k].padEnd(26) +
      (r1 ? (String(r1.sku) + " " + String(r1.pct).padStart(3) + "%  " + r1.pn.slice(0, 52)) : "(không có gợi ý nào)") +
      (kq.coMa ? "" : "  [chưa khớp mã]"));
  }
}

/* ---------- 6. Bảng tổng ---------- */
const tb = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
console.log("\n════ KẾT QUẢ trên " + tem.length + " tem ════");
console.log("  đường                        Top-1      Top-3      khớp được mã");
for (const k of DS_DUONG) {
  if (!DUONG.includes(k)) continue;
  const pc = (v) => String(Math.round((v / tem.length) * 100)).padStart(3) + "%";
  console.log("  " + ten[k].padEnd(28) + pc(diem[k]) + " (" + diem[k] + "/" + tem.length + ")  " +
    pc(diem3[k]) + " (" + diem3[k] + "/" + tem.length + ")  " + pc(coMa[k]));
}
if (nAI) console.log("\n  AI  : " + nAI + " lượt đọc được, trung bình " + tb(msAI) + " ms");
if (nOcr) console.log("  OCR : " + nOcr + " lượt đọc được, trung bình " + tb(msOcr) + " ms  (miễn phí, không tốn hạn mức AI)");
try { fs.writeFileSync(F_DEM, JSON.stringify(DEM)); console.log("  (chữ đã đọc lưu ở " + path.basename(F_DEM) + " — chạy lại với --dung-dem để thử cách ghép khác, 0 lượt gọi)"); } catch { /* không lưu được cũng không sao */ }
if (!GIU) { try { fs.rmSync(OUT, { recursive: true, force: true }); } catch { /* giữ lại cũng không sao */ } }
else console.log("\n  (ảnh giữ tại " + OUT + ")");
