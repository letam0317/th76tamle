/**
 * qc-tem-tay.mjs — ĐỌC THẺ MẪU VIẾT TAY: đo xem tab còn nhận ra SKU không
 * ===========================================================================================
 *  Vì sao có file này: `qc-tem-vision.mjs` chỉ dựng tem IN (chữ máy). Thẻ mẫu của xưởng thì NHÃN
 *  được in sẵn còn GIÁ TRỊ do người viết tay — mà đúng cái giá trị đó mới định danh món hàng
 *  ("Mã sản phẩm", "Màu sắc", "Size"). Hai bài toán khác nhau.
 *
 *  ⚠ GIỚI HẠN PHẢI NÓI TRƯỚC: font viết tay KHÔNG PHẢI chữ viết tay. Font đều tay, đúng khoảng,
 *  không lệch dòng, không nhoè mực, không dính nét, không ai viết chữ "a" hai kiểu trong một dòng.
 *  Con số ở đây là **chặn TRÊN lạc quan**: nó trả lời được "đường ống có sập ở khúc nào không" và
 *  "lõi tự chữa được lỗi đọc nào", nhưng KHÔNG thay được việc chụp 5-10 tấm thẻ THẬT rồi đo lại.
 *
 *  node qc-tem-tay.mjs                 dựng ảnh + gọi AI (7 lượt) + chấm, rồi LƯU lại kết quả đọc
 *  node qc-tem-tay.mjs --phat-lai      chấm lại từ kho đệm, KHÔNG gọi AI, KHÔNG dựng ảnh
 *  node qc-tem-tay.mjs --phat-lai --rev <mốc git>   chấm kho đệm bằng LÕI CŨ (đo công bản vá)
 *    thêm --giu-anh (giữ ảnh đã dựng) · --chi-tiet (in raw_text)
 *    cần GEMINI_API_KEY trong hasaki/.env (chỉ khi KHÔNG dùng --phat-lai)
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const F_HTML = path.join(DIR, "..", "factory", "index.html");
const F_GS = path.join(DIR, "google-script.gs");
const F_DEM = path.join(DIR, ".exports", "qc-tay-dem.json");
const OUT = path.join(DIR, ".exports", "qc-tay");
const SHEET_ID = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const A = process.argv.slice(2);
const GIU = A.includes("--giu-anh");
const CHI_TIET = A.includes("--chi-tiet");
const PHAT_LAI = A.includes("--phat-lai");
const REV = A.includes("--rev") ? A[A.indexOf("--rev") + 1] : "";
const DAP = "422495218";                      // Mẫu thông chuyền/CWHO0006/…/Xanh Tro-Dusky Green/Size S

/* ---------- 1. Lõi đối soát (cây làm việc, hoặc một mốc git nếu có --rev) ---------- */
const catLoi = (html, ten) => {
  const i = html.indexOf("/*<NDS-ENGINE>*/"), j = html.indexOf("/*</NDS-ENGINE>*/");
  if (i < 0 || j < 0) { console.error("✗ Không thấy mốc NDS-ENGINE trong " + ten); process.exit(2); }
  return new Function(html.slice(i, j) + "\n return NDS_ENGINE;")();
};
const nguonLoi = REV
  ? execFileSync("git", ["show", REV + ":index.html"], { cwd: path.join(DIR, "..", "factory"), maxBuffer: 64 * 1024 * 1024, encoding: "utf8" })
  : fs.readFileSync(F_HTML, "utf8");
const E = catLoi(nguonLoi, REV || "cây làm việc");

/* ---------- 2. Danh mục LIVE (thẻ mẫu chỉ có trong bản live, bản dry 19/08 chưa có) ---------- */
const u = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json&sheet=SKU_MASTER&headers=1";
const t0 = await (await fetch(u)).text();
const jt = JSON.parse(t0.slice(t0.indexOf("{"), t0.lastIndexOf("}") + 1));
const ds = jt.table.rows.map((r) => {
  const v = (k) => (r.c[k] && r.c[k].v != null ? r.c[k].v : "");
  return { sku: String(v(0)).replace(/\.0$/, ""), pn: String(v(1)),
    type: String(v(2)).toUpperCase() === "COMBO" ? "COMBO" : "NORMAL",
    status: String(v(3)).toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE", qty: Number(v(4)) || 0 };
}).filter((r) => r.sku && r.pn);
if (!ds.some((r) => r.sku === DAP)) { console.error("✗ Danh mục live không có " + DAP + " — chạy sync-sku-master trước."); process.exit(2); }
const cm = E.dungChiMuc(ds);
console.log("✓ Lõi: " + (REV || "cây làm việc") + " · danh mục live " + ds.length + " SKU");

/* ---------- 3. Thẻ mẫu: NHÃN in sẵn, GIÁ TRỊ viết tay ---------- */
const TRUONG = [
  ["LOẠI MẪU", "Mẫu thông chuyền"],
  ["Mã sản phẩm", "CWHO0006"],
  ["Tên sản phẩm", "Women_Hoodie_Full-zip_Anti-UV_Regular"],
  ["Size", "S"],
  ["Thành phần vải", "Vải Single Mesh/S130413 UZM Sheico/88% Re-Polyester, 12%Spandex/170 Gsm, 152cm"],
  ["Màu sắc", "Xanh Tro-Dusky Green"],
  ["Phụ liệu", "Đầy đủ"],
];
/* Mỗi kiểu = một "bàn tay": font + độ jitter. `hoa` = ghi mã bằng IN HOA (thói quen thật của xưởng). */
const BAN_TAY = [
  { ma: "may",       ten: "Chữ MÁY (bản đối chứng)",                  font: "Arial",         jit: 0,   hoa: false, muc: "#111" },
  { ma: "tay-in",    ten: "Viết tay NÉT RỜI, mã IN HOA (Ink Free)",   font: "Ink Free",      jit: 0.6, hoa: true,  muc: "#1b2a6b" },
  { ma: "tay-comic", ten: "Viết tay dễ đọc (Comic Sans)",             font: "Comic Sans MS", jit: 0.8, hoa: false, muc: "#123" },
  { ma: "tay-noi",   ten: "Viết tay NÉT NỐI (Segoe Script)",          font: "Segoe Script",  jit: 1.0, hoa: false, muc: "#1b2a6b" },
  { ma: "tay-thu",   ten: "Viết tay THƯ PHÁP (Gabriola)",             font: "Gabriola",      jit: 1.2, hoa: false, muc: "#222" },
  { ma: "tay-nhanh", ten: "Viết NHANH (nghiêng nhiều, chữ dính)",     font: "Ink Free",      jit: 2.4, hoa: false, muc: "#1b2a6b" },
  { ma: "tay-kho",   ten: "Viết NHANH + chụp KHÓ (nghiêng, mờ, loá)", font: "Ink Free",      jit: 2.4, hoa: false, muc: "#1b2a6b", kho: true },
];
/* Số giả ngẫu nhiên CÓ HẠT GIỐNG: ảnh phải dựng lại y hệt giữa hai lượt chạy, không thì lượt này
   và lượt trước là hai bộ đề khác nhau — đúng bẫy đã ghi ở đầu qc-loi-cu-moi.mjs. */
function rng(hat) { let s = hat; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }

function theHtml(bt) {
  const r = rng(7);
  const dong = TRUONG.map(([nhan, gt]) => {
    const j = bt.jit;
    const xoay = ((r() - 0.5) * 2 * j).toFixed(2);
    const lech = ((r() - 0.5) * 2.2 * j).toFixed(1);
    const gian = ((r() - 0.5) * 0.5 * j).toFixed(2);
    const nghieng = (j > 1.5 ? -6 - r() * 4 : (j ? -1 - r() * 2 : 0)).toFixed(1);
    const chu = bt.hoa && nhan === "Mã sản phẩm" ? gt.toUpperCase() : gt;
    const co = gt.length > 40 ? 15 : 21;
    return `<tr>
      <td style="font:600 15px Arial;color:#111;white-space:nowrap;padding:7px 12px 7px 0;vertical-align:bottom">${nhan}:</td>
      <td style="border-bottom:1px solid #333;padding:2px 6px 3px">
        <span style="display:inline-block;font-family:'${bt.font}',cursive;font-size:${co}px;color:${bt.muc};
          transform:rotate(${xoay}deg) translateY(${lech}px) skewX(${nghieng}deg);letter-spacing:${gian}px">${chu}</span>
      </td></tr>`;
  }).join("");
  return `<div style="width:660px;background:#fdfdf6;border:2px solid #222;padding:0 0 18px">
    <div style="background:#555;color:#fff;font:800 26px Arial;letter-spacing:2px;text-align:center;padding:12px 0">THẺ THÔNG TIN MẪU</div>
    <table style="margin:14px 18px 0;border-collapse:collapse">${dong}</table>
  </div>`;
}
const KHO_CHUP = "filter:blur(1.05px) contrast(.93) brightness(1.05);transform:rotate(-6deg) skewY(1.2deg)";
const PHU_LOA = `<div style="position:absolute;inset:0;background:linear-gradient(112deg,rgba(255,255,255,.72) 3%,rgba(255,255,255,0) 24%,rgba(255,255,255,0) 64%,rgba(255,255,255,.5) 90%)"></div>
  <div style="position:absolute;left:26%;top:62%;width:80px;height:36px;background:rgba(120,110,90,.26);border-radius:50%;filter:blur(3px)"></div>`;
const trang = (bt) => `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#8f8f8f;display:flex;align-items:center;justify-content:center;height:820px">
  <div style="position:relative;padding:40px"><div style="${bt.kho ? KHO_CHUP : ""}">${theHtml(bt)}</div>${bt.kho ? PHU_LOA : ""}</div></body>`;

/* ---------- 4. Lấy kết quả đọc: từ kho đệm, hoặc dựng ảnh + gọi AI ---------- */
let doc = {};
if (PHAT_LAI) {
  if (!fs.existsSync(F_DEM)) { console.error("✗ Chưa có kho đệm " + F_DEM + " — chạy `node qc-tem-tay.mjs` (có AI) một lượt trước."); process.exit(2); }
  doc = JSON.parse(fs.readFileSync(F_DEM, "utf8"));
  console.log("✓ Phát lại " + Object.keys(doc).length + " lượt đọc trong kho đệm (0 lượt gọi AI)\n");
} else {
  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) { console.error("✗ Thiếu GEMINI_API_KEY trong hasaki/.env (hoặc dùng --phat-lai)"); process.exit(3); }
  const gs = fs.readFileSync(F_GS, "utf8");
  const i1 = gs.indexOf("var SV_TRAN_NGAY"), i2 = gs.indexOf("/** Cài khoá Gemini");
  if (i1 < 0 || i2 < 0) { console.error("✗ Không thấy khối sku_vision trong google-script.gs"); process.exit(2); }
  const { SV_PROMPT, SV_SCHEMA, SV_MODELS } = new Function(gs.slice(i1, i2) + "\n return {SV_PROMPT:SV_PROMPT, SV_SCHEMA:SV_SCHEMA, SV_MODELS:SV_MODELS};")();
  const puppeteer = (await import("puppeteer")).default;
  const { EDGE_PATH } = await import("./token-store.js");
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH, args: ["--force-device-scale-factor=1"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 820, height: 820, deviceScaleFactor: 1 });
  const anh = {};
  for (const bt of BAN_TAY) {
    await page.setContent(trang(bt), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const f = path.join(OUT, bt.ma + ".jpg");
    await page.screenshot({ path: f, type: "jpeg", quality: 82 });
    anh[bt.ma] = f;
  }
  await browser.close();
  console.log("✓ Dựng " + BAN_TAY.length + " ảnh thẻ (" + OUT + ")\n");

  async function docTem(file) {
    const b64 = fs.readFileSync(file).toString("base64");
    const body = JSON.stringify({
      contents: [{ role: "user", parts: [{ text: SV_PROMPT }, { inline_data: { mime_type: "image/jpeg", data: b64 } }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: SV_SCHEMA, maxOutputTokens: 2048, temperature: 0 },
    });
    let loi = "";
    for (const model of SV_MODELS) {
      const uu = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + KEY;
      const r = await fetch(uu, { method: "POST", headers: { "content-type": "application/json" }, body });
      if (r.status === 429 || r.status === 503) { loi = "HTTP " + r.status + " ở " + model; continue; }
      if (!r.ok) throw new Error("HTTP " + r.status + ": " + (await r.text()).slice(0, 200));
      const j = await r.json();
      const cand = (j.candidates || [])[0];
      return { model, kq: JSON.parse(((cand && cand.content && cand.content.parts) || []).map((p) => p.text || "").join("")) };
    }
    throw new Error("Hết quota mọi model (" + loi + ")");
  }
  for (const bt of BAN_TAY) {
    try { doc[bt.ma] = await docTem(anh[bt.ma]); }
    catch (e) { console.log("  ✗ " + bt.ten + " — AI lỗi: " + e.message); }
  }
  fs.mkdirSync(path.dirname(F_DEM), { recursive: true });
  fs.writeFileSync(F_DEM, JSON.stringify(doc, null, 1), "utf8");
  console.log("✓ Lưu kho đệm " + F_DEM + " (phát lại được, khỏi tốn hạn mức AI)\n");
  if (!GIU) { try { fs.rmSync(OUT, { recursive: true, force: true }); } catch { /* giữ lại cũng không sao */ } }
}

/* ---------- 5. Chấm: ghép hai nguồn y như dashboard (xem ndsNhanKetQua) ---------- */
const nhanGhep = (o) => {
  const a = E.tuAI(o, cm), b = E.tuVanBan(String((o && o.raw_text) || ""), cm);
  const ra = { code: [], spec: [], color: [], brand: [], maChu: b.maChu || [] };
  for (const v of ["code", "spec", "color", "brand"]) {
    for (const t of (a[v] || []).concat(b[v] || [])) if (!ra[v].includes(t)) ra[v].push(t);
  }
  return ra;
};
let dat = 0, top3 = 0;
const bang = [];
for (const bt of BAN_TAY) {
  const r = doc[bt.ma];
  if (!r) { bang.push([bt.ten, "AI LỖI", "—", "—", "—"]); continue; }
  const raw = String(r.kq.raw_text || "");
  const nhan = nhanGhep(r.kq);
  const top = E.timTop(nhan, cm, { soLuong: 3, chiActive: true });
  const ok = top.length && String(top[0].sku) === DAP;
  const t3 = top.some((x) => String(x.sku) === DAP);
  if (ok) dat++;
  if (t3) top3++;
  /* Mã chủ AI đọc THÔ (trước khi lõi chữa chính tả) so với mã lõi CHỐT — chỗ đáng nhìn nhất. */
  const thoMa = (raw.match(/CW[H4][0O]{1,5}\d?/i) || [])[0] || "";
  const chua = (nhan.maChu || []).join(",");
  console.log((ok ? "  ✓ " : (t3 ? "  ~ " : "  ✗ ")) + bt.ten + "  [" + r.model + " · AI tự đánh giá ảnh: " + r.kq.quality + "]");
  console.log("      mã AI đọc thô: " + (thoMa || "(không thấy)") + "   →  lõi chốt mã chủ: " + (chua || "(rỗng)"));
  if (CHI_TIET) console.log("      raw: " + raw.replace(/\s+/g, " ").slice(0, 300));
  top.forEach((x, i) => console.log("      #" + (i + 1) + " " + x.sku + " " + String(x.pct).padStart(3) + "%  " + x.pn.slice(0, 84)));
  bang.push([bt.ten, thoMa || "—", chua || "—", ok ? "ĐÚNG" : (t3 ? "Top3" : "SAI"), (top[0] ? top[0].sku + "/" + top[0].pct + "%" : "(rỗng)")]);
  console.log("");
}
console.log("════ TỔNG · lõi " + (REV || "cây làm việc") + " ════");
console.log("  " + "bàn tay".padEnd(44) + "AI đọc mã".padEnd(12) + "lõi chốt".padEnd(11) + "kết quả".padEnd(8) + "#1");
for (const b of bang) console.log("  " + b[0].padEnd(44) + b[1].padEnd(12) + b[2].padEnd(11) + b[3].padEnd(8) + b[4]);
console.log("\n  Hạng 1 đúng: " + dat + "/" + BAN_TAY.length + " · có trong Top 3: " + top3 + "/" + BAN_TAY.length);
console.log("  ⚠ Font viết tay KHÔNG phải chữ viết tay — đây là chặn TRÊN, cần ảnh thẻ THẬT để chốt.");
