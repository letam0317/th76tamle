/**
 * qc-tem-vision.mjs — KIỂM THỬ ĐẦU-CUỐI tab "Nhận diện SKU": ẢNH TEM → Vision LLM → SKU gợi ý.
 *
 *  Vì sao cần: `qc-nhan-dien-sku.mjs` chỉ kiểm phần đối soát (giả lập từ khoá). File này kiểm nốt
 *  khúc khó nhất — AI có đọc nổi tem hay không — bằng 3 quy cách tem THẬT của kho:
 *    1. tem TRÒN dán lõi cuộn chỉ  (THESEUS IRISA · Tkt120 · Tex 27 · 60/3 · F9-5284 · Hồng tro)
 *    2. tem BẢNG dán túi nút       (Item JC01262 · #006 matt silver · Des 27L shank button · MORITO)
 *    3. tem DÀI dán cuộn dây kéo   (8846295 · CMOR-36 · Chiều dài 38.0 CM · Màu 345 · YKK)
 *  Mỗi mẫu dựng 2 bản: bản SẠCH và bản KHÓ (nghiêng + mờ + loá nylon + vết bẩn) để đo đúng cái
 *  điều kiện chụp trong kho.
 *
 *  KHÔNG chép prompt/schema: cắt thẳng SV_PROMPT/SV_SCHEMA/SV_MODELS ra khỏi `google-script.gs`,
 *  và cắt lõi đối soát ra khỏi `factory/index.html` — test luôn chạy đúng mã đang phục vụ.
 *
 *  node qc-tem-vision.mjs [--chi-tiet] [--giu-anh]
 *    cần GEMINI_API_KEY trong hasaki/.env (khoá miễn phí aistudio.google.com/apikey)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import "dotenv/config";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const F_HTML = path.join(DIR, "..", "factory", "index.html");
const F_GS = path.join(DIR, "google-script.gs");
const OUT = path.join(DIR, ".exports", "qc-tem");
const CHI_TIET = process.argv.includes("--chi-tiet");
const GIU = process.argv.includes("--giu-anh");
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error("✗ Thiếu GEMINI_API_KEY trong hasaki/.env — lấy khoá miễn phí ở aistudio.google.com/apikey."); process.exit(3); }
fs.mkdirSync(OUT, { recursive: true });

/* ---------- 1. Lấy prompt + schema TỪ CHÍNH mã Apps Script ---------- */
const gs = fs.readFileSync(F_GS, "utf8");
const i1 = gs.indexOf("var SV_TRAN_NGAY"), i2 = gs.indexOf("/** Cài khoá Gemini");
if (i1 < 0 || i2 < 0) { console.error("✗ Không thấy khối sku_vision trong google-script.gs"); process.exit(2); }
const SV_ = new Function(gs.slice(i1, i2) + "\n return {SV_PROMPT:SV_PROMPT, SV_SCHEMA:SV_SCHEMA, SV_MODELS:SV_MODELS, SV_CHI_CHU:(typeof SV_CHI_CHU!=='undefined'&&SV_CHI_CHU), SV_PROMPT_CHU:(typeof SV_PROMPT_CHU!=='undefined'?SV_PROMPT_CHU:''), SV_SCHEMA_CHU:(typeof SV_SCHEMA_CHU!=='undefined'?SV_SCHEMA_CHU:null)};")();
/* CHẾ ĐỘ CỦA CỔNG QUYẾT ĐỊNH KHUÔN GỬI (21/08/2026): `SV_CHI_CHU` bật thì production chỉ xin
   `raw_text` (đo được: 97 token ra thay vì 256, p50 1,4s thay vì 1,8s). Bộ đo phải gửi ĐÚNG khuôn
   đang phục vụ — gửi khuôn cũ thì con số đo được là của một cấu hình không ai dùng. */
const SV_MODELS = SV_.SV_MODELS;
const SV_PROMPT = SV_.SV_CHI_CHU ? SV_.SV_PROMPT_CHU : SV_.SV_PROMPT;
const SV_SCHEMA = SV_.SV_CHI_CHU ? SV_.SV_SCHEMA_CHU : SV_.SV_SCHEMA;
console.log("✓ Prompt + schema lấy từ google-script.gs (" + SV_PROMPT.length + " ký tự prompt, model đầu: " + SV_MODELS[0] + ")");

/* ---------- 2. Lấy lõi đối soát TỪ CHÍNH dashboard ---------- */
const html = fs.readFileSync(F_HTML, "utf8");
const j1 = html.indexOf("/*<NDS-ENGINE>*/"), j2 = html.indexOf("/*</NDS-ENGINE>*/");
const E = new Function(html.slice(j1, j2) + "\n return NDS_ENGINE;")();
const dsFile = path.join(DIR, ".sku-master-dry.json");
if (!fs.existsSync(dsFile)) { console.error("✗ Chưa có .sku-master-dry.json — chạy `node sync-sku-master.mjs --dry` trước."); process.exit(2); }
const ds = JSON.parse(fs.readFileSync(dsFile, "utf8")).rows.map((r) => ({ sku: String(r[0]), pn: r[1], type: r[2], status: r[3], qty: Number(r[4]) || 0 }));
const cm = E.dungChiMuc(ds);
console.log("✓ Lõi đối soát + danh mục " + ds.length + " SKU\n");

/* ---------- 3. Dựng ảnh tem mẫu (SVG/HTML → PNG bằng Edge headless) ---------- */
const NEN_GIAY = "background:#fdfdf8;color:#111";
const TEM = [
  /* 3 SKU cùng là "Chỉ Irisa F9-5284 Hồng tro Tex 27-60-3 Tkt 120", CHỈ khác ĐƠN VỊ ĐÓNG GÓI
     (mm · Cuộn 5000m · Combo cuộn 5000m). Tem in "5000m" nên AI đọc được chữ đó và engine đẩy 2 bản
     "Cuộn 5000m" lên trước — ĐÚNG chứ không sai. Không tem nào phân biệt nổi 3 bản này, nên hợp đồng
     của tính năng là: cả 3 phải nằm trong Top 3 để thủ kho chọn, không phải "máy tự chốt 1 bản". */
  { ma: "tron-chi", ten: "Tem TRÒN lõi cuộn chỉ", mong: "422377978",
    chapNhan: ["422377978", "422394022", "422286239"],
    html: `<div style="width:420px;height:420px;border-radius:50%;${NEN_GIAY};border:3px solid #222;
      display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Arial;text-align:center;gap:5px">
      <div style="font-size:27px;font-weight:800;letter-spacing:1px">THESEUS</div>
      <div style="font-size:34px;font-weight:900;letter-spacing:3px">IRISA</div>
      <div style="font-size:19px;font-weight:700">Tkt120 &nbsp; Tex 27</div>
      <div style="font-size:19px;font-weight:700">60/3</div>
      <div style="font-size:23px;font-weight:800;border:2px solid #111;padding:2px 12px;border-radius:4px">F9-5284</div>
      <div style="font-size:16px">Hồng tro</div>
      <div style="font-size:13px;color:#444">PHONG VIET CO.,LTD &nbsp;·&nbsp; 5000m</div>
    </div>` },
  { ma: "bang-nut", ten: "Tem BẢNG túi nút", mong: ["422440680", "422440681"],
    html: `<div style="width:520px;height:330px;${NEN_GIAY};border:2px solid #333;padding:20px 24px;font-family:Arial">
      <div style="font-size:30px;font-weight:900;letter-spacing:2px;border-bottom:2px solid #111;padding-bottom:6px">MORITO</div>
      <table style="font-size:20px;margin-top:14px;line-height:1.65">
        <tr><td style="color:#555;padding-right:14px">Item</td><td style="font-weight:800">JC01262</td></tr>
        <tr><td style="color:#555">Color</td><td style="font-weight:700">#006 matt silver</td></tr>
        <tr><td style="color:#555">Des</td><td style="font-weight:700">27L shank button 17mm</td></tr>
        <tr><td style="color:#555">Q'ty</td><td>1,000 pcs</td></tr>
      </table>
      <div style="margin-top:10px;font-size:13px;color:#444">MADE IN JAPAN &nbsp;·&nbsp; LOT 2508-11</div>
    </div>` },
  { ma: "dai-daykeo", ten: "Tem DÀI cuộn dây kéo", mong: "422322192",
    html: `<div style="width:640px;height:200px;${NEN_GIAY};border:2px solid #333;padding:16px 22px;font-family:Arial">
      <div style="display:flex;align-items:baseline;gap:18px;border-bottom:2px solid #111;padding-bottom:6px">
        <div style="font-size:36px;font-weight:900;letter-spacing:3px">YKK</div>
        <div style="font-size:26px;font-weight:800">8846295</div>
        <div style="font-size:20px;color:#333">CMOR-36</div>
      </div>
      <div style="font-size:22px;font-weight:700;margin-top:12px">Chiều dài: 38.0 CM &nbsp;&nbsp; Màu: 345</div>
      <div style="font-size:16px;color:#333;margin-top:8px">CFC-56 DA E &nbsp;·&nbsp; 100 PCS &nbsp;·&nbsp; VIETNAM</div>
    </div>` },
];
/* Bản KHÓ: nghiêng, mờ nhẹ, phủ vệt loá (nylon) + đốm bẩn — đúng thứ gặp khi chụp trong kho */
const KHO_CHUP = `filter:blur(1.1px) contrast(.92) brightness(1.06);transform:rotate(-7deg) skewY(1.5deg)`;
const PHU_LOA = `<div style="position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.78) 4%,rgba(255,255,255,0) 26%,rgba(255,255,255,0) 62%,rgba(255,255,255,.55) 88%)"></div>
  <div style="position:absolute;left:22%;top:58%;width:70px;height:34px;background:rgba(120,110,90,.28);border-radius:50%;filter:blur(3px)"></div>`;

function trang(t, kho) {
  return `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#8d8d8d;display:flex;align-items:center;justify-content:center;height:760px">
    <div style="position:relative;padding:60px">
      <div style="${kho ? KHO_CHUP : ""}">${t.html}</div>
      ${kho ? PHU_LOA : ""}
    </div></body>`;
}
const browser = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH, args: ["--force-device-scale-factor=1"] });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 760, deviceScaleFactor: 1 });
const anh = [];
for (const t of TEM) {
  for (const kho of [false, true]) {
    await page.setContent(trang(t, kho), { waitUntil: "load" });
    const f = path.join(OUT, t.ma + (kho ? "-kho" : "-sach") + ".jpg");
    await page.screenshot({ path: f, type: "jpeg", quality: 78 });
    anh.push({ ...t, kho, f });
  }
}
await browser.close();
console.log("✓ Dựng " + anh.length + " ảnh tem mẫu (" + OUT + ")\n");

/* ---------- 4. Gọi Gemini y như Apps Script sẽ gọi ---------- */
async function docTem(file) {
  const b64 = fs.readFileSync(file).toString("base64");
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: SV_PROMPT }, { inline_data: { mime_type: "image/jpeg", data: b64 } }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: SV_SCHEMA, maxOutputTokens: 2048, temperature: 0 },
  });
  let loi = "";
  for (const model of SV_MODELS) {
    const u = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + KEY;
    const r = await fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body });
    if (r.status === 429 || r.status === 503) { loi = "HTTP " + r.status + " ở " + model; continue; }
    if (!r.ok) throw new Error("HTTP " + r.status + ": " + (await r.text()).slice(0, 200));
    const j = await r.json();
    const cand = (j.candidates || [])[0];
    const chu = ((cand && cand.content && cand.content.parts) || []).map((p) => p.text || "").join("");
    return { model, kq: JSON.parse(chu) };
  }
  throw new Error("Hết quota mọi model (" + loi + ")");
}

/* ---------- 5. Từ khoá AI → vai: gọi CHÍNH hàm của dashboard ----------
 * Từ 19/08/2026 dashboard GHÉP hai nguồn của cùng một lượt gọi AI (xem ndsNhanKetQua):
 *   ① vai do AI gán, đã đối chiếu danh mục để nâng mảnh "ra dáng mã" lên vai MÃ  → tuAI(o, cm)
 *   ② chữ thô raw_text, tự xếp vai bằng hình dạng + lọc theo danh mục            → tuVanBan(raw, cm)
 * Test phải ghép y như vậy, không thì nó đang kiểm một đường mà người dùng không đi.
 * (Đo 19/08: đường ② một mình lập được MÃ trong 92% lượt, đường ① chỉ 75% — AI hay cắt cụt mã khi
 *  phải tự phân loại, vd trả "255LK3557-2" thay cho cả chuỗi "…SAB-255LK3557-2".) */
const nhanTheoVai = (o) => {
  const a = E.tuAI(o, cm), b = E.tuVanBan(String((o && o.raw_text) || ""), cm);
  const ra = { code: [], spec: [], color: [], brand: [] };
  for (const v of ["code", "spec", "color", "brand"]) {
    for (const t of (a[v] || []).concat(b[v] || [])) if (!ra[v].includes(t)) ra[v].push(t);
  }
  return ra;
};

let dat = 0, truot = 0;
for (const a of anh) {
  const nhan = ["Tem " + a.ten, a.kho ? "[bản KHÓ: nghiêng + mờ + loá nylon]" : "[bản sạch]"].join(" ");
  let r;
  try { r = await docTem(a.f); }
  catch (e) { console.log("  ✗ " + nhan + " — AI lỗi: " + e.message); truot++; continue; }
  const nhanVai = nhanTheoVai(r.kq);
  const top = E.timTop(nhanVai, cm, { soLuong: 3, chiActive: true });
  const mong = Array.isArray(a.mong) ? a.mong : [a.mong];
  const chapNhan = a.chapNhan || mong;                    // được phép đứng #1
  const top3 = top.map((x) => String(x.sku));
  const ok = top.length && chapNhan.indexOf(top3[0]) >= 0 && mong.every((m) => top3.indexOf(m) >= 0);
  console.log((ok ? "  ✓ " : "  ✗ ") + nhan + "  [" + r.model + (SV_.SV_CHI_CHU ? " · khuôn CHỈ CHỮ THÔ" : " · chất lượng ảnh AI tự đánh giá: " + r.kq.quality) + "]");
  /* Chế độ chỉ-chữ-thô thì 5 mảng vai rỗng là ĐÚNG (lõi tự xếp vai bằng tuVanBan) — in chữ thô ra
     thay vì in "undefined" bốn lần, không thì đọc log tưởng AI hỏng. */
  if (SV_.SV_CHI_CHU) console.log("      AI đọc (chữ thô): " + String(r.kq.raw_text || "").replace(/\s+/g, " ").slice(0, 150));
  else console.log("      AI đọc: mã=" + JSON.stringify(r.kq.item_codes) + " thông số=" + JSON.stringify(r.kq.specs) +
    " màu=" + JSON.stringify(r.kq.colors) + " hiệu=" + JSON.stringify(r.kq.brands));
  if (CHI_TIET) console.log("      raw: " + String(r.kq.raw_text || "").slice(0, 260));
  top.forEach((x, i) => console.log("      #" + (i + 1) + " " + x.sku + " " + String(x.pct).padStart(3) + "%  " +
    (x.xungDot.length ? "[lệch " + x.xungDot.join(",") + "] " : "") + x.pn.slice(0, 86)));
  if (!ok) console.log("      → #1 phải thuộc [" + chapNhan.join(", ") + "] và Top 3 phải có [" + mong.join(", ") + "]");
  ok ? dat++ : truot++;
}
if (!GIU) { try { fs.rmSync(OUT, { recursive: true, force: true }); } catch { /* giữ lại cũng không sao */ } }
console.log("\n" + (truot ? "✗ " : "✓ ") + dat + "/" + anh.length + " ảnh ra đúng SKU" + (truot ? " — " + truot + " ảnh TRƯỢT" : "") +
  (GIU ? "\n  (ảnh mẫu giữ tại " + OUT + ")" : ""));
process.exit(truot ? 1 : 0);
