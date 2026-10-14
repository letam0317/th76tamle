/* 08/10/2026 — GEMINI ĐỌC LÔ KHUNG CAMERA cho camera-bao-cao.mjs --gemini (user: «2 mục này có dùng AI Gemini chạy được không, dạy cho Gemini chạy»).
 *  Thay mô hình COCO-SSD (_nguoi-trong-vung.mjs): Gemini nhìn từng lô 8 khung (1 khung/5 s, có khung VÀNG vùng kệ), trả cho TỪNG khung:
 *  người (bbox, quần áo, có ở trong/sát khung vàng, HÀNH ĐỘNG: ve-sinh · sap-xep-hang · chup-anh · dung-yen · di-lai · khong-ro) + mã người P1,P2… trong lô.
 *  Nối mã người giữa các lô bằng khoảng cách tâm bbox + chữ quần áo (tất định). KHÔNG nhận diện danh tính, không gửi tên NV cho Gemini.
 *
 *  node _gemini-nguoi-vung.mjs <cau-hinh.json>
 *   {khung:[{f, gio:"HH:MM:SS", ms}], vung:[x,y,w,h]|null, tu:"tủ 10 dãy 504", lo:8, ra:"kq.json"}
 *  Ra: {model, khung:[{ms, gio, f, nguoi:[{ma, k:[x,y,w,h] px 1280×720, quanAo, trong:boolean, hanhDong}]}], loi?:string}
 *  Quota bậc miễn phí: chuỗi model dự phòng (mỗi model quota riêng), nghỉ 4 s giữa lô, 429 phút → nghỉ 35 s, quota NGÀY → đổi model; hết chuỗi → ra {loi}.
 *  Mạng: hộp cát Claude Code chặn Google → chạy từ task/terminal thật (canh-b11 chạy ngoài hộp cát). */
import "dotenv/config"; import fs from "node:fs"; import sharp from "sharp";
const C = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const KEY = process.env.GEMINI_API_KEY; const LO = C.lo || 8;
const CHUOI = [...new Set([process.env.GEMINI_MODEL_CAMERA || "gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"])];
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
const ra = (o) => { fs.writeFileSync(C.ra, JSON.stringify(o)); return o; };
if (!KEY) { ra({ loi: "thiếu GEMINI_API_KEY" }); process.exit(0); }
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));

const svgVung = C.vung ? Buffer.from(`<svg width="1280" height="720"><rect x="${C.vung[0]}" y="${C.vung[1]}" width="${C.vung[2]}" height="${C.vung[3]}" fill="none" stroke="#ffd400" stroke-width="6"/></svg>`) : null;
async function anhGui(f) {   // 1280×720 + khung vàng → 1024×576 jpeg (sharp: resize chạy trước composite trong 1 chuỗi → tách 2 lệnh)
  let g = await sharp(f).resize(1280, 720, { fit: "fill" }).toBuffer();
  if (svgVung) g = await sharp(g).composite([{ input: svgVung, left: 0, top: 0 }]).toBuffer();
  return (await sharp(g).resize(1024, 576).jpeg({ quality: 78 }).toBuffer()).toString("base64");
}
const SCHEMA = { type: "object", properties: { khung: { type: "array", items: { type: "object", properties: { anh: { type: "integer" }, nguoi: { type: "array", items: { type: "object", properties: {
  ma_nguoi: { type: "string" }, bbox: { type: "array", items: { type: "integer" } }, quan_ao: { type: "string" }, trong_khung_vang: { type: "boolean" },
  hanh_dong: { type: "string", enum: ["ve-sinh", "sap-xep-hang", "chup-anh", "dung-yen", "di-lai", "khong-ro"] } }, required: ["ma_nguoi", "bbox", "quan_ao", "trong_khung_vang", "hanh_dong"] } } }, required: ["anh", "nguoi"] } },
  tin_cay: { type: "integer" } }, required: ["khung", "tin_cay"] };
const vungChu = C.vung ? "Khung VÀNG là vùng mặt kệ đang xét (cố định trên mọi ảnh)." : "Vị trí đang xét: " + (C.tu || "kệ") + " (đọc nhãn số tủ trên thanh ngang kệ); coi 'trong khung vàng' = đứng sát mặt kệ đó.";
const PROMPT = "Dãy ảnh từ CÙNG một camera kho hàng (1280×720), cách nhau 5 giây, theo thứ tự thời gian. " + vungChu +
  " Với TỪNG ảnh, liệt kê MỌI người nhìn thấy: bbox [ymin,xmin,ymax,xmax] thang 0–1000 của toàn ảnh (ôm sát thân người), quần áo (màu áo, áo phản quang, mũ…), có đứng trong/sát khung vàng không, và hành động: ve-sinh (lau/quét/phủi bụi mặt kệ hoặc hàng trên kệ, tay cầm khăn/chổi/cây lau), sap-xep-hang (xếp/lấy/đẩy thùng hàng, kéo xe), chup-anh (giơ điện thoại lên trước mặt kệ), dung-yen, di-lai, khong-ro." +
  " Cùng một người (quần áo giống, vị trí liên tục giữa 2 ảnh kề) → cùng mã ma_nguoi (P1, P2…) trong cả lô. Không nhận diện danh tính, không đoán tên. tin_cay 0–100.";

async function goi(parts, model) {
  for (let lan = 0; lan < 3; lan++) {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + KEY, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, maxOutputTokens: 8192, temperature: 0.1 } }), signal: AbortSignal.timeout(120000) });
    if (r.status === 429 || r.status === 503) { const t = await r.text(); if (/PerDay|daily|exceeded your current quota/i.test(t) && r.status === 429) { const e = new Error("quota ngày " + model); e.quota = true; throw e; }
      if (lan < 2) { log("   … HTTP " + r.status + " — nghỉ 35 s"); await ngu(35000); continue; } throw new Error("HTTP " + r.status + " sau 3 lần"); }
    if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 160));
    const j = await r.json(); const cand = (j.candidates || [])[0];
    if (!cand || /SAFETY|PROHIBITED/i.test(cand.finishReason || "")) throw new Error("Gemini từ chối (" + (cand && cand.finishReason) + ")");
    const txt = (cand.content.parts || []).map((p) => p.text || "").join(""); let k; try { k = JSON.parse(txt); } catch { throw new Error("JSON hỏng"); }
    return { k, token: (j.usageMetadata || {}).totalTokenCount || 0 };
  }
}

/* ---- chạy từng lô, nối mã người giữa lô ---- */
const out = []; let model = CHUOI[0], iModel = 0, tokens = 0, maKe = 0; const bang = {};   // bang[maToanCuc] = {quanAo, tam:[cx,cy], ms}
const tuMau = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
const giongAo = (a, b) => { const A = new Set(tuMau(a).split(" ")), B = tuMau(b).split(" "); return B.filter((w) => w.length > 2 && A.has(w)).length >= 2; };
const t0 = Date.now();
for (let i = 0; i < C.khung.length; i += LO) {
  const lo = C.khung.slice(i, i + LO);
  const parts = [{ text: PROMPT }];
  for (const [n, x] of lo.entries()) parts.push({ text: "Ảnh " + (n + 1) + " · " + x.gio }, { inlineData: { mimeType: "image/jpeg", data: await anhGui(x.f) } });
  let kq = null;
  while (!kq) {
    try { kq = await goi(parts, model); }
    catch (e) { if (e.quota && ++iModel < CHUOI.length) { model = CHUOI[iModel]; log("   hết quota → đổi model " + model); continue; }
      log("   ✗ " + e.message); ra({ model, khung: out, loi: e.message, tokens }); process.exit(0); }
  }
  tokens += kq.token;
  const cuc = {};   // mã trong lô → mã toàn cục
  for (const [n, x] of lo.entries()) {
    const kx = (kq.k.khung || []).find((y) => y.anh === n + 1) || { nguoi: [] };
    const nguoi = [];
    for (const p of kx.nguoi || []) {
      const [y0, x0, y1, x1] = (p.bbox || [0, 0, 0, 0]).map(Number); const k = [Math.round(x0 * 1.28), Math.round(y0 * 0.72), Math.round((x1 - x0) * 1.28), Math.round((y1 - y0) * 0.72)];
      if (k[2] < 15 || k[3] < 25) continue;
      const tam = [k[0] + k[2] / 2, k[1] + k[3] / 2];
      let ma = cuc[p.ma_nguoi];
      if (!ma) {   // người mới trong lô: tìm người toàn cục gần nhất (≤ 220 px, ≤ 60 s) cùng quần áo; không có → mã mới
        let best = null, dmin = 1e9;
        for (const [m, b] of Object.entries(bang)) { if (Object.values(cuc).includes(m)) continue; const d = Math.hypot(b.tam[0] - tam[0], b.tam[1] - tam[1]);
          if (d <= 220 && x.ms - b.ms <= 60e3 && giongAo(b.quanAo, p.quan_ao) && d < dmin) { dmin = d; best = m; } }
        ma = best || ("N" + (++maKe)); cuc[p.ma_nguoi] = ma;
      }
      bang[ma] = { quanAo: p.quan_ao, tam, ms: x.ms };
      nguoi.push({ ma, k, quanAo: p.quan_ao, trong: !!p.trong_khung_vang, hanhDong: p.hanh_dong || "khong-ro" });
    }
    out.push({ ms: x.ms, gio: x.gio, f: x.f, nguoi });
  }
  log("   lô " + (i / LO + 1) + "/" + Math.ceil(C.khung.length / LO) + " · " + model + " · " + lo[0].gio + "–" + lo[lo.length - 1].gio + " · người/khung " + lo.map((_, n) => ((kq.k.khung || []).find((y) => y.anh === n + 1) || { nguoi: [] }).nguoi.length).join("") + " · tin cậy " + kq.k.tin_cay);
  if (i + LO < C.khung.length) await ngu(4000);
}
ra({ model, khung: out, tokens, giay: Math.round((Date.now() - t0) / 1000) });
log("ok " + out.length + " khung · " + out.filter((x) => x.nguoi.some((p) => p.trong)).length + " khung có người tại kệ · " + tokens + " token · " + Math.round((Date.now() - t0) / 1000) + " s → " + C.ra);
