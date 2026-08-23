/**
 * do-toc-do-tem.mjs — ĐO THẬT rồi MÔ PHỎNG: ép thời gian đọc tem xuống dưới 20 giây
 * ==============================================================================================
 *  Vì sao có file này (21/08/2026, thủ kho lại báo "nhận diện quá lâu"):
 *  §5b.5 của NHAN-DIEN-SKU.md đã đo được TRUNG BÌNH (5,1–7,6s) và đã ghi ĐỘ TẢN (4,8 · 6,7 · 17,9s,
 *  xấu nhất 28,5s). Cái làm người dùng nói "quá lâu" KHÔNG phải trung bình — là cái ĐUÔI. Muốn hứa
 *  "dưới 20 giây" thì phải đo được PHÂN PHỐI của từng chặng, rồi mô phỏng các chiến lược trên chính
 *  phân phối đó. Đo 3 lượt rồi chọn là cách chắc chắn chọn sai.
 *
 *  4 pha, mỗi pha ghi số ra `.exports/do-tem-*.json` để pha mô phỏng chạy lại KHÔNG tốn lượt gọi:
 *
 *    node do-toc-do-tem.mjs --chang [--n 24]
 *        Pha A · PHÍ 2 CHẶNG Apps Script — MIỄN PHÍ, không ảnh, không tốn hạn mức AI lẫn OCR
 *        (dùng cửa `sku_ocr` + `chuanDoan=1`). Đo cả 3 nhịp: liên tiếp (nóng) · cách 30s · cách 90s
 *        ⇒ trả lời "hâm nóng có tác dụng thật không" và "đuôi nằm ở chặng Google hay ở model".
 *
 *    node do-toc-do-tem.mjs --song-song [--n 4]
 *        Pha A2 · bắn 2 POST CÙNG LÚC (nonce khác nhau) — điều kiện SỐNG của chiến lược "đua lượt
 *        gọi": nếu Apps Script xếp hàng tuần tự theo người dùng thì đua vô nghĩa.
 *
 *    node do-toc-do-tem.mjs --model [--lan 4]
 *        Pha B · chặng GEMINI, gọi TRỰC TIẾP từ máy này bằng GEMINI_API_KEY trong .env (không qua
 *        GAS nên tách được đúng phần của model). 4 ảnh (2 tem IN + 2 thẻ VIẾT TAY) × các biến thể:
 *          day    = prompt/schema ĐANG CHẠY (5 mảng vai + raw_text)
 *          tho    = CHỈ raw_text (bớt ~nửa số token ra — lõi vẫn xếp vai bằng tuVanBan)
 *          nghi0  = thêm thinkingConfig.thinkingBudget = 0
 *          nho    = ảnh 1000px thay vì 1400px
 *        Mỗi lượt chấm luôn ĐỘ CHÍNH XÁC (mã trên tem có đọc ra không · Top-1 của lõi có đúng SKU
 *        không) — nhanh mà sai thì không phải giải pháp.
 *
 *    node do-toc-do-tem.mjs --mo-phong
 *        Pha D · Monte Carlo trên số đo của A + B: p50/p90/p99/max và số lượt gọi/1 tem cho từng
 *        chiến lược (một lượt · đua ở giây T · đua + OCR đỡ · hâm nóng trước).
 *
 *    node do-toc-do-tem.mjs --live [--n 6] [--dua 5.5]
 *        Pha C · ĐẦU-CUỐI qua cổng production: baseline vs "đua ở giây T". TỐN hạn mức AI thật
 *        (mỗi lượt đua tốn 1–2 lượt) — chỉ chạy khi đã chốt chiến lược ở pha D.
 *
 *  Ghi chú thiết kế:
 *   · Ảnh dựng lại theo đúng 2 bộ đề đã dùng trong dự án (`qc-tem-vision.mjs` tem IN,
 *     `qc-tem-tay.mjs` thẻ mẫu viết tay) để số đo so được với các lần đo trước.
 *   · Prompt/schema/model CẮT THẲNG từ `google-script.gs` — không chép, để đo đúng cái đang phục vụ.
 *   · Lõi đối soát cắt thẳng từ `factory/index.html` (mốc NDS-ENGINE).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const F_HTML = path.join(DIR, "..", "factory", "index.html");
const F_GS = path.join(DIR, "google-script.gs");
const OUT = path.join(DIR, ".exports");
const F_CHANG = path.join(OUT, "do-tem-chang.json");
const F_SS = path.join(OUT, "do-tem-songsong.json");
const F_MODEL = path.join(OUT, "do-tem-model.json");
const F_DM = path.join(OUT, "do-tem-danhmuc.json");
const F_LIVE = path.join(OUT, "do-tem-live.json");
const DIR_ANH = path.join(OUT, "do-tem-anh");
const SHEET_ID = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const URL_GAS = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";

const A = process.argv.slice(2);
const co = (t) => A.includes(t);
const so = (t, m) => (co(t) ? Number(A[A.indexOf(t) + 1]) || m : m);
const MAIL = "may-dotocdo@hasaki.vn";
fs.mkdirSync(OUT, { recursive: true });

const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
const f1 = (x) => (x == null ? "—" : (Math.round(x) / 1000).toFixed(1).replace(".", ",") + "s");
const pct = (a, q) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((q / 100) * (s.length - 1))))];
};
const tb = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const bang = (ten, a) =>
  `${ten.padEnd(26)} n=${String(a.length).padStart(3)}  tb ${f1(tb(a)).padStart(6)}  p50 ${f1(pct(a, 50)).padStart(6)}  p90 ${f1(pct(a, 90)).padStart(6)}  p99 ${f1(pct(a, 99)).padStart(6)}  max ${f1(Math.max(...a)).padStart(6)}`;

/* ══════════════════════════════ Pha A — phí 2 chặng Apps Script ══════════════════════════════ */
async function pingGas(extra) {
  const t0 = Date.now();
  const body = { action: "sku_ocr", email: MAIL, chuanDoan: 1, nonce: "do-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8), ...extra };
  let ok = false, ghi = "";
  try {
    const r = await fetch(URL_GAS, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
    const t = (await r.text()).trim();
    ok = t.charAt(0) === "{";
    if (!ok) ghi = /^<!DOCTYPE|^<html/i.test(t) ? "HTML chặng 2" : "lạ: " + t.slice(0, 40);
  } catch (e) { ghi = String(e.message || e).slice(0, 60); }
  return { ms: Date.now() - t0, ok, ghi };
}
async function phaChang() {
  const N = so("--n", 24);
  const nhom = [
    { ma: "nong", ten: "liên tiếp (nóng)", cho: 0, n: Math.ceil(N * 0.42) },
    { ma: "c30", ten: "cách 30s", cho: 30000, n: Math.ceil(N * 0.33) },
    { ma: "c90", ten: "cách 90s (nguội)", cho: 90000, n: Math.max(1, N - Math.ceil(N * 0.42) - Math.ceil(N * 0.33)) },
  ];
  const kq = fs.existsSync(F_CHANG) ? JSON.parse(fs.readFileSync(F_CHANG, "utf8")) : { at: "", mau: [] };
  console.log("Pha A — phí 2 chặng Apps Script (không ảnh, không tốn hạn mức nào)\n");
  for (const g of nhom) {
    for (let i = 0; i < g.n; i++) {
      if (g.cho && i) await nghi(g.cho);
      const r = await pingGas();
      kq.mau.push({ nhom: g.ma, ms: r.ms, ok: r.ok, ghi: r.ghi });
      console.log(`  ${g.ma.padEnd(5)} #${String(i + 1).padStart(2)}  ${f1(r.ms).padStart(6)}  ${r.ok ? "" : "✗ " + r.ghi}`);
    }
  }
  kq.at = new Date().toISOString();
  fs.writeFileSync(F_CHANG, JSON.stringify(kq, null, 1));
  console.log("");
  for (const g of nhom) console.log("  " + bang(g.ten, kq.mau.filter((m) => m.nhom === g.ma && m.ok).map((m) => m.ms)));
  console.log("  " + bang("TẤT CẢ", kq.mau.filter((m) => m.ok).map((m) => m.ms)));
  const loi = kq.mau.filter((m) => !m.ok).length;
  console.log(`\n  Lượt trả HTML/lỗi ở chặng 2: ${loi}/${kq.mau.length}`);
  console.log(`  → đã ghi ${F_CHANG} (${kq.mau.length} mẫu tích luỹ)`);
}

/* ══════════════════════════ Pha A2 — Apps Script có chạy song song? ══════════════════════════ */
async function phaSongSong() {
  const N = so("--n", 4);
  console.log("Pha A2 — bắn 2 POST cùng lúc (điều kiện sống của chiến lược ĐUA)\n");
  const mau = [];
  for (let i = 0; i < N; i++) {
    if (i) await nghi(20000);
    const t0 = Date.now();
    const [a, b] = await Promise.all([pingGas(), pingGas()]);
    const nhanh = Math.min(a.ms, b.ms), cham = Math.max(a.ms, b.ms);
    mau.push({ a: a.ms, b: b.ms, nhanh, cham, tong: Date.now() - t0 });
    console.log(`  vòng ${i + 1}: ${f1(a.ms)} · ${f1(b.ms)}  → nhanh ${f1(nhanh)} · chậm ${f1(cham)}  ${cham > nhanh * 1.8 && nhanh > 900 ? "(dấu hiệu XẾP HÀNG)" : "(chạy song song)"}`);
  }
  fs.writeFileSync(F_SS, JSON.stringify({ at: new Date().toISOString(), mau }, null, 1));
  const th = mau.map((m) => m.cham - m.nhanh);
  console.log("\n  " + bang("chênh chậm-nhanh", th));
  console.log("  Kết luận: " + (tb(th) < 900 ? "GAS phục vụ 2 lượt SONG SONG ⇒ đua được." : "hai lượt lệch nhau nhiều ⇒ nghi xếp hàng, xem lại trước khi đua."));
}

/* ══════════════════════════════ Ảnh mẫu (2 tem IN + 2 thẻ TAY) ══════════════════════════════ */
/* Tem IN: đúng 2 quy cách của `qc-tem-vision.mjs`. Thẻ TAY: đúng bộ của `qc-tem-tay.mjs`. */
const TEM_ZIP = `<div style="width:640px;background:#fdfdf8;color:#111;border:2px solid #333;padding:16px 22px;font-family:Arial">
  <div style="display:flex;align-items:baseline;gap:18px;border-bottom:2px solid #111;padding-bottom:6px">
    <div style="font-size:36px;font-weight:900;letter-spacing:3px">YKK</div>
    <div style="font-size:26px;font-weight:800">8846295</div>
    <div style="font-size:20px;color:#333">CMOR-36</div></div>
  <div style="font-size:22px;font-weight:700;margin-top:12px">Chiều dài: 38.0 CM &nbsp;&nbsp; Màu: 345</div>
  <div style="font-size:15px;color:#333;margin-top:8px">100 PCS &nbsp;·&nbsp; VIETNAM</div></div>`;
const TEM_CHI = `<div style="width:430px;height:430px;border-radius:50%;background:#fffdf4;border:3px solid #2b2b2b;
  display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Arial;text-align:center;gap:6px">
  <div style="font-size:27px;font-weight:900;letter-spacing:1px">THESEUS IRISA</div>
  <div style="font-size:20px;font-weight:700">Tkt 120 &nbsp;·&nbsp; Tex 27 &nbsp;·&nbsp; 60/3</div>
  <div style="font-size:24px;font-weight:800">F9-5284</div>
  <div style="font-size:20px">Màu: Hồng tro</div>
  <div style="font-size:15px;color:#444">5000m/cuộn · MADE IN VIETNAM</div></div>`;
const TRUONG = [
  ["LOẠI MẪU", "Mẫu thông chuyền"],
  ["Mã sản phẩm", "CWHO0006"],
  ["Tên sản phẩm", "Women_Hoodie_Full-zip_Anti-UV_Regular"],
  ["Size", "S"],
  ["Thành phần vải", "Vải Single Mesh/S130413 UZM Sheico/88% Re-Polyester, 12%Spandex/170 Gsm, 152cm"],
  ["Màu sắc", "Xanh Tro-Dusky Green"],
  ["Phụ liệu", "Đầy đủ"],
];
function rng(hat) { let s = hat; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
function theTay(font, jit, hoa) {
  const r = rng(7);
  const dong = TRUONG.map(([nhan, gt]) => {
    const xoay = ((r() - 0.5) * 2 * jit).toFixed(2), lech = ((r() - 0.5) * 2.2 * jit).toFixed(1);
    const gian = ((r() - 0.5) * 0.5 * jit).toFixed(2), ngh = (jit > 1.5 ? -6 - r() * 4 : -1 - r() * 2).toFixed(1);
    const chu = hoa && nhan === "Mã sản phẩm" ? gt.toUpperCase() : gt;
    return `<tr><td style="font:600 15px Arial;color:#111;white-space:nowrap;padding:7px 12px 7px 0;vertical-align:bottom">${nhan}:</td>
      <td style="border-bottom:1px solid #333;padding:2px 6px 3px"><span style="display:inline-block;font-family:'${font}',cursive;
        font-size:${gt.length > 40 ? 15 : 21}px;color:#1b2a6b;transform:rotate(${xoay}deg) translateY(${lech}px) skewX(${ngh}deg);
        letter-spacing:${gian}px">${chu}</span></td></tr>`;
  }).join("");
  return `<div style="width:660px;background:#fdfdf6;border:2px solid #222;padding:0 0 18px">
    <div style="background:#555;color:#fff;font:800 26px Arial;letter-spacing:2px;text-align:center;padding:12px 0">THẺ THÔNG TIN MẪU</div>
    <table style="margin:14px 18px 0;border-collapse:collapse">${dong}</table></div>`;
}
const KHO = "filter:blur(1.05px) contrast(.93) brightness(1.05);transform:rotate(-6deg) skewY(1.2deg)";
const LOA = `<div style="position:absolute;inset:0;background:linear-gradient(112deg,rgba(255,255,255,.72) 3%,rgba(255,255,255,0) 24%,rgba(255,255,255,0) 64%,rgba(255,255,255,.5) 90%)"></div>
  <div style="position:absolute;left:26%;top:62%;width:80px;height:36px;background:rgba(120,110,90,.26);border-radius:50%;filter:blur(3px)"></div>`;
const trang = (noi, kho, cao) => `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#8f8f8f;display:flex;align-items:center;justify-content:center;height:${cao}px">
  <div style="position:relative;padding:40px"><div style="${kho ? KHO : ""}">${noi}</div>${kho ? LOA : ""}</div></body>`;

const DE = [
  { ma: "in-zip", ten: "tem IN dây kéo (sạch)", html: TEM_ZIP, cao: 360, kho: false, ky: ["8846295", "38.0", "345"], sku: "" },
  { ma: "in-chi", ten: "tem IN cuộn chỉ (khó: nghiêng+mờ+loá)", html: TEM_CHI, cao: 620, kho: true, ky: ["F9-5284", "120", "27"], sku: "" },
  { ma: "tay-thuong", ten: "thẻ VIẾT TAY (nét rời, mã in hoa)", html: theTay("Ink Free", 0.6, true), cao: 820, kho: false, ky: ["CWHO0006"], sku: "422495218" },
  { ma: "tay-kho", ten: "thẻ VIẾT TAY (viết nhanh + chụp khó)", html: theTay("Ink Free", 2.4, false), cao: 820, kho: true, ky: ["CWHO0006"], sku: "422495218" },
];

async function dungAnh(cacCanh) {
  fs.mkdirSync(DIR_ANH, { recursive: true });
  const thieu = DE.some((d) => cacCanh.some((c) => !fs.existsSync(path.join(DIR_ANH, `${d.ma}-${c}.jpg`))));
  if (!thieu) { console.log("✓ Dùng lại ảnh mẫu trong " + DIR_ANH); return; }
  const puppeteer = (await import("puppeteer")).default;
  const { EDGE_PATH } = await import("./token-store.js");
  const br = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH, args: ["--force-device-scale-factor=1"] });
  const pg = await br.newPage();
  for (const d of DE) {
    await pg.setViewport({ width: 820, height: d.cao, deviceScaleFactor: 2 });
    await pg.setContent(trang(d.html, d.kho, d.cao), { waitUntil: "load" });
    await pg.evaluate(() => document.fonts.ready);
    const goc = await pg.screenshot({ type: "png" });
    /* Thu nhỏ về đúng cạnh dài mà dashboard gửi (NDS_MAX_CANH=1400) + nén theo ngân sách byte —
       làm y hệt ndsNenAnh() để byte gửi lên bằng với máy thật. */
    for (const canh of cacCanh) {
      const pg2 = await br.newPage();
      await pg2.setContent(`<!doctype html><body style="margin:0"><img id="i" src="data:image/png;base64,${Buffer.from(goc).toString("base64")}"></body>`);
      const b64 = await pg2.evaluate(async (canh) => {
        const im = document.getElementById("i");
        await im.decode();
        const ti = Math.min(1, canh / Math.max(im.naturalWidth, im.naturalHeight));
        const cv = document.createElement("canvas");
        cv.width = Math.round(im.naturalWidth * ti); cv.height = Math.round(im.naturalHeight * ti);
        const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height);
        cx.drawImage(im, 0, 0, cv.width, cv.height);
        let u = "";
        for (const q of [0.72, 0.6, 0.5]) { u = cv.toDataURL("image/jpeg", q); if (u.length - 23 <= 430000) break; }
        return u.slice(u.indexOf(",") + 1);
      }, canh);
      await pg2.close();
      fs.writeFileSync(path.join(DIR_ANH, `${d.ma}-${canh}.jpg`), Buffer.from(b64, "base64"));
      console.log(`  ✓ ${d.ma}-${canh}.jpg  ${Math.round(b64.length / 1024)} KB base64`);
    }
  }
  await br.close();
}

/* ══════════════════════════════════ Lõi + danh mục (để chấm) ══════════════════════════════════ */
function layLoi() {
  const html = fs.readFileSync(F_HTML, "utf8");
  const i = html.indexOf("/*<NDS-ENGINE>*/"), j = html.indexOf("/*</NDS-ENGINE>*/");
  if (i < 0 || j < 0) { console.error("✗ Không thấy mốc NDS-ENGINE trong factory/index.html"); process.exit(2); }
  return new Function(html.slice(i, j) + "\n return NDS_ENGINE;")();
}
async function layDanhMuc() {
  if (fs.existsSync(F_DM) && Date.now() - fs.statSync(F_DM).mtimeMs < 12 * 3600e3) return JSON.parse(fs.readFileSync(F_DM, "utf8"));
  const u = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=SKU_MASTER&headers=1`;
  const t = await (await fetch(u)).text();
  const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
  const ds = j.table.rows.map((r) => {
    const v = (k) => (r.c[k] && r.c[k].v != null ? r.c[k].v : "");
    return { sku: String(v(0)).replace(/\.0$/, ""), pn: String(v(1)),
      type: String(v(2)).toUpperCase() === "COMBO" ? "COMBO" : "NORMAL",
      status: String(v(3)).toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE", qty: Number(v(4)) || 0 };
  }).filter((r) => r.sku && r.pn);
  fs.writeFileSync(F_DM, JSON.stringify(ds));
  return ds;
}
function layPrompt() {
  const gs = fs.readFileSync(F_GS, "utf8");
  const i1 = gs.indexOf("var SV_TRAN_NGAY"), i2 = gs.indexOf("/** Cài khoá Gemini");
  if (i1 < 0 || i2 < 0) { console.error("✗ Không thấy khối sku_vision trong google-script.gs"); process.exit(2); }
  return new Function(gs.slice(i1, i2) + "\n return {SV_PROMPT:SV_PROMPT, SV_SCHEMA:SV_SCHEMA, SV_MODELS:SV_MODELS};")();
}

/* ══════════════════════════════════ Pha B — chặng Gemini ══════════════════════════════════ */
const PROMPT_THO =
  "Bạn đang đọc ảnh MỘT TEM NHÃN / THẺ THÔNG TIN của nhà cung cấp trong kho nguyên liệu may.\n" +
  "Tem có thể in bằng máy hoặc VIẾT TAY, có thể cong, nhăn, bọc nylon loá sáng, chụp nghiêng hoặc ngược.\n" +
  "NHIỆM VỤ DUY NHẤT: chép lại TOÀN BỘ chữ đọc được, KHÔNG suy diễn, KHÔNG dịch, KHÔNG sửa chính tả.\n" +
  "GIỮ NGUYÊN cặp \"nhãn: giá trị\" của biểu mẫu (ví dụ \"Mã sản phẩm: CWHO0006\") và giữ thứ tự dòng,\n" +
  "mỗi dòng cách nhau bằng \" | \". Chữ nào không chắc thì vẫn ghi nguyên như thấy.";
const SCHEMA_THO = { type: "OBJECT", required: ["raw_text"], properties: { raw_text: { type: "STRING" } } };

/* Ghép vai AI + tuVanBan y như `ndsNhanKetQua` của dashboard (xem qc-tem-tay.mjs) */
function nhanGhep(E, o, cm) {
  const a = E.tuAI(o || {}, cm), b = E.tuVanBan(String((o && o.raw_text) || ""), cm);
  const ra = { code: [], spec: [], color: [], brand: [], maChu: b.maChu || [] };
  for (const v of ["code", "spec", "color", "brand"]) {
    for (const t of (a[v] || []).concat(b[v] || [])) if (!ra[v].includes(t)) ra[v].push(t);
  }
  return ra;
}
function nhanTho(E, chu, cm) {
  const b = E.tuVanBan(String(chu || ""), cm);
  return { code: b.code || [], spec: b.spec || [], color: b.color || [], brand: b.brand || [], maChu: b.maChu || [] };
}

async function goiGemini(model, key, b64, bien, SV) {
  const day = bien.schema === "day";
  const payload = {
    contents: [{ role: "user", parts: [{ text: day ? SV.SV_PROMPT : PROMPT_THO }, { inline_data: { mime_type: "image/jpeg", data: b64 } }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: day ? SV.SV_SCHEMA : SCHEMA_THO, maxOutputTokens: 2048, temperature: 0 },
  };
  if (bien.nghiThap) payload.generationConfig.thinkingConfig = { thinkingLevel: "low" };
  const t0 = Date.now();
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    { method: "post", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const ms = Date.now() - t0;
  const txt = await r.text();
  if (r.status !== 200) return { ms, loi: "HTTP " + r.status + " " + txt.slice(0, 120) };
  let j; try { j = JSON.parse(txt); } catch { return { ms, loi: "phản hồi không phải JSON" }; }
  const c = (j.candidates || [])[0];
  let chu = ""; ((c && c.content && c.content.parts) || []).forEach((x) => { chu += x.text || ""; });
  let o; try { o = JSON.parse(chu); } catch { return { ms, loi: "JSON sai khuôn" }; }
  const um = j.usageMetadata || {};
  return { ms, text: String(o.raw_text || ""), tokens: o, ra: um.candidatesTokenCount || 0, nghiToken: um.thoughtsTokenCount || 0, vao: um.promptTokenCount || 0 };
}

async function phaModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { console.error("✗ Thiếu GEMINI_API_KEY trong hasaki/.env"); process.exit(3); }
  const LAN = so("--lan", 4);
  const SV = layPrompt();
  const model = co("--model-ten") ? A[A.indexOf("--model-ten") + 1] : SV.SV_MODELS[0];
  /* `thinkingBudget:0` bị API trả 400 INVALID_ARGUMENT (đo 21/08/2026) — KHÔNG tắt nghĩ được bằng
     đường đó. Bản `lite` vốn đã nghĩ 0 token nên không cần; chỉ mấy model flash thường mới nghĩ
     800-2000 token (và trả sau 6-24 giây), với chúng thì `thinkingConfig.thinkingLevel:'low'` được
     API nhận (503 chứ không 400) — để dành cho biến thể `nghi-thap`. */
  const BIEN = [
    { ma: "day", ten: "prompt+schema ĐANG CHẠY", schema: "day", canh: 1400 },
    { ma: "tho", ten: "chỉ raw_text", schema: "tho", canh: 1400 },
    { ma: "tho-nho", ten: "chỉ raw_text + ảnh 1000px", schema: "tho", canh: 1000 },
    { ma: "nghi-thap", ten: "chỉ raw_text + thinkingLevel=low", schema: "tho", nghiThap: true, canh: 1400 },
  ].filter((b) => !co("--chi") || A[A.indexOf("--chi") + 1].split(",").includes(b.ma));
  const canhCan = [...new Set(BIEN.map((b) => b.canh))];
  await dungAnh(canhCan);
  const E = layLoi(), ds = await layDanhMuc(), cm = E.dungChiMuc(ds);
  console.log(`✓ Lõi + danh mục ${ds.length} SKU · model ${model} · ${LAN} lượt/biến thể/đề\n`);

  const kq = fs.existsSync(F_MODEL) ? JSON.parse(fs.readFileSync(F_MODEL, "utf8")) : { at: "", mau: [] };
  for (const b of BIEN) {
    for (const d of DE) {
      const b64 = fs.readFileSync(path.join(DIR_ANH, `${d.ma}-${b.canh}.jpg`)).toString("base64");
      for (let i = 0; i < LAN; i++) {
        let r = await goiGemini(model, key, b64, b, SV);
        /* 429 ở ĐÂY là trần PHÚT của bộ đo (bắn liên tục), không phải chuyện của production —
           chờ rồi thử lại, đừng để một lỗ hổng nhịp làm mất cả biến thể. */
        for (let th = 0; th < 2 && r.loi && /HTTP 429/.test(r.loi); th++) { await nghi(25000); r = await goiGemini(model, key, b64, b, SV); }
        let doc = 0, top1 = null, dungTop1 = null, coNhan = null;
        if (!r.loi) {
          const chu = r.text || "";
          doc = d.ky.filter((k) => chu.toUpperCase().replace(/\s+/g, "").includes(k.toUpperCase().replace(/\s+/g, ""))).length / d.ky.length;
          /* Chấm y như dashboard: biến thể "day" ghép vai AI + tuVanBan (ndsNhanKetQua), biến thể
             "tho" chỉ có chữ thô nên đi đúng đường tuVanBan. */
          const nhan = b.schema === "day" ? nhanGhep(E, r.tokens, cm) : nhanTho(E, chu, cm);
          const top = E.timTop(nhan, cm, { soLuong: 3, chiActive: true });
          top1 = top.length ? String(top[0].sku) : null;
          if (d.sku) dungTop1 = top1 === d.sku;
          coNhan = /Mã sản phẩm/i.test(chu);
        }
        kq.mau.push({ bien: b.ma, de: d.ma, model, ms: r.ms, loi: r.loi || "", doc, top1, dungTop1, nhan: coNhan, ra: r.ra, nghiToken: r.nghiToken, kb: Math.round(b64.length / 1024) });
        kq.at = new Date().toISOString();
        fs.writeFileSync(F_MODEL, JSON.stringify(kq, null, 1));    // ghi NGAY từng mẫu: job bị ngắt vẫn còn số
        console.log(`  ${b.ma.padEnd(14)} ${d.ma.padEnd(11)} #${i + 1}  ${f1(r.ms).padStart(6)}  ` +
          (r.loi ? "✗ " + r.loi : `chữ ${Math.round(doc * 100)}%${d.sku ? " · Top1 " + (dungTop1 ? "ĐÚNG" : String(top1)) : ""} · ra ${r.ra}${r.nghiToken ? "+nghĩ " + r.nghiToken : ""} token`));
        await nghi(so("--cho", 1500));
      }
    }
  }
  kq.at = new Date().toISOString();
  fs.writeFileSync(F_MODEL, JSON.stringify(kq, null, 1));
  console.log("");
  inBangModel(kq.mau, BIEN.map((b) => b.ma));
  console.log(`\n  → đã ghi ${F_MODEL} (${kq.mau.length} mẫu tích luỹ)`);
}
function inBangModel(mau, dsBien) {
  const bienDS = dsBien || [...new Set(mau.map((m) => m.bien))];
  console.log("  biến thể            n   p50     p90     max    chữ đúng  Top-1 thẻ mẫu  token ra");
  for (const b of bienDS) {
    const m = mau.filter((x) => x.bien === b && !x.loi);
    if (!m.length) continue;
    const ms = m.map((x) => x.ms), thẻ = m.filter((x) => x.dungTop1 != null);
    console.log(`  ${b.padEnd(18)} ${String(m.length).padStart(2)}  ${f1(pct(ms, 50)).padStart(6)}  ${f1(pct(ms, 90)).padStart(6)}  ${f1(Math.max(...ms)).padStart(6)}   ` +
      `${(Math.round((tb(m.map((x) => x.doc)) || 0) * 100) + "%").padStart(6)}    ${(thẻ.length ? Math.round((thẻ.filter((x) => x.dungTop1).length / thẻ.length) * 100) + "%" : "—").padStart(8)}      ${Math.round(tb(m.map((x) => x.ra)) || 0)}`);
  }
}

/* ══════════════════════════════ Pha D — mô phỏng chiến lược ══════════════════════════════ */
/* Ghép 3 phân phối ĐO THẬT (phí 2 chặng Apps Script · chặng model · đường OCR đầu-cuối) rồi thử
   từng chiến lược trên cùng một bộ số. Cột "quá 20s" là câu trả lời cho yêu cầu của thủ kho.
   `q` = tỉ lệ lượt mà hai model lite đầu chuỗi đã hết hạn mức trong ngày ⇒ lượt đọc rơi xuống model
   sau. Không đo được từ ngoài (nó phụ thuộc số tem đã quét trong ngày) nên để thành tham số và in
   luôn độ nhạy: --q 0,05 / 0,15 / 0,30. */
function phaMoPhong() {
  if (!fs.existsSync(F_CHANG) || !fs.existsSync(F_MODEL)) { console.error("✗ Cần chạy --chang và --model trước."); process.exit(2); }
  const cJ = JSON.parse(fs.readFileSync(F_CHANG, "utf8")).mau.filter((m) => m.ok);
  const chang = cJ.map((m) => m.ms), changNong = cJ.filter((m) => m.nhom === "nong").map((m) => m.ms);
  const mm = JSON.parse(fs.readFileSync(F_MODEL, "utf8")).mau.filter((m) => !m.loi);
  const F_OCR = path.join(OUT, "do-tem-ocr.json");
  const ocrTong = fs.existsSync(F_OCR) ? JSON.parse(fs.readFileSync(F_OCR, "utf8")).mau.filter((m) => m.okOcr).map((m) => m.msOcr) : [];
  const mDay = mm.filter((m) => m.bien === "day").map((m) => m.ms);
  const mTho = mm.filter((m) => m.bien === "tho").map((m) => m.ms);
  if (!mDay.length || !mTho.length) { console.error("✗ Thiếu mẫu model cho biến thể day/tho."); process.exit(2); }
  const N = so("--n", 40000), UP = so("--up", 1700), q = so("--q", 0.12);
  const T_OCR = so("--t-ocr", 2500), T_DUA = so("--t-dua", 6000), T_UU = so("--t-uu", 11000), T_CHOT = so("--t-chot", 17000);
  const boc = (a) => a[Math.floor(Math.random() * a.length)];

  /* MỘT lượt gọi AI: đẩy ảnh + 2 chặng Apps Script + chặng model. `cu` = chuỗi model CŨ (rơi xuống
     gemini-flash-latest 24,5s khi lite hết hạn mức) · `moi` = chuỗi đã sửa (chốt cuối 3,5-flash ép
     nghĩ thấp 3,1s, cộng ~0,2s cho 2 round-trip 429). */
  /* TREO BẤT THƯỜNG: 34 lượt đo phí 2 chặng KHÔNG bắt được lượt treo nào (max 3,1s), nhưng 5b.5 đã
     ghi 2 lượt live 17,9s và 28,5s — loại đó phải chờ đủ lâu mới gặp. Nên nó là THAM SỐ, không phải
     số đo: `--r` = tỉ lệ lượt bị treo, `--treo`/`--treo2` = khoảng treo. Đây là chỗ duy nhất mà đua
     + mốc chốt tỏ tác dụng, nên đọc bảng phải đọc kèm r. Treo là chuyện của MỘT lượt gọi (cold
     start / xếp hàng phía Google) nên mỗi lượt rút thăm riêng — chính vì thế lượt đua mới cứu được. */
  const R = so("--r", 0.05), TREO = so("--treo", 12000), TREO2 = so("--treo2", 28000);
  const treo = () => TREO + Math.random() * (TREO2 - TREO);
  const motAI = (cu, nong) => {
    const c = boc(nong ? changNong : chang);
    if (Math.random() < R) return UP + treo();
    if (Math.random() < q) return UP + c + (cu ? 24500 : 200 + 3100);
    return UP + c + boc(cu ? mDay : mTho);
  };
  const motOCR = () => (Math.random() < R ? UP + treo() : UP + boc(ocrTong.length ? ocrTong : [7500]));

  const CL = [
    ["① ĐANG CHẠY (1 lượt AI, chuỗi model cũ)", () => ({ t: motAI(true, false), goi: 1 })],
    ["② + chuỗi model đã sửa", () => ({ t: motAI(false, false), goi: 1 })],
    ["③ + hâm nóng Apps Script", () => ({ t: motAI(false, true), goi: 1 })],
    ["④ + đua lượt AI ở giây 6", () => {
      const t1 = motAI(false, true);
      if (t1 <= T_DUA) return { t: t1, goi: 1 };
      return { t: Math.min(t1, T_DUA + motAI(false, true)), goi: 2 };
    }],
    ["⑤ + OCR song song (bậc thang MỚI)", () => {
      const t1 = motAI(false, true);
      const tAI = t1 <= T_DUA ? t1 : Math.min(t1, T_DUA + motAI(false, true));
      const goi = t1 <= T_DUA ? 1 : 2;
      const tOCR = T_OCR + motOCR();
      /* OCR chỉ được cầm cờ khi AI còn im tới mốc nhường (T_UU) — thứ tự tin cậy không đổi. */
      return { t: Math.min(tAI, Math.max(tOCR, T_UU) >= tAI ? tAI : Math.max(tOCR, T_UU)), goi };
    }],
    ["⑥ + mốc chốt 17s (người dùng thấy)", () => {
      const t1 = motAI(false, true);
      const tAI = t1 <= T_DUA ? t1 : Math.min(t1, T_DUA + motAI(false, true));
      const goi = t1 <= T_DUA ? 1 : 2;
      const tOCR = T_OCR + motOCR();
      const t = Math.min(tAI, Math.max(tOCR, T_UU) >= tAI ? tAI : Math.max(tOCR, T_UU));
      return { t: Math.min(t, T_CHOT), goi, chot: t > T_CHOT };
    }],
  ];
  console.log(`Pha D — mô phỏng ${N} lượt trên SỐ ĐO THẬT`);
  console.log(`  phí 2 chặng Apps Script: ${chang.length} mẫu (p50 ${f1(pct(chang, 50))} · p99 ${f1(pct(chang, 99))})`);
  console.log(`  chặng model: ${mDay.length} mẫu khuôn cũ (p50 ${f1(pct(mDay, 50))}) · ${mTho.length} mẫu khuôn chữ-thô (p50 ${f1(pct(mTho, 50))})`);
  console.log(`  đường OCR đầu-cuối: ${ocrTong.length} mẫu (p50 ${f1(pct(ocrTong, 50))})`);
  console.log(`  cộng ${UP}ms đẩy ảnh (4G yếu) · q = ${Math.round(q * 100)}% lượt rơi xuống model sau · r = ${Math.round(R * 100)}% lượt treo ${TREO / 1000}-${TREO2 / 1000}s\n`);
  console.log("  chiến lược                                 p50     p90     p99     max    quá 20s   lượt AI/tem");
  for (const [ten, f] of CL) {
    const a = [], g = [];
    let chot = 0;
    for (let i = 0; i < N; i++) { const r = f(); a.push(r.t); g.push(r.goi); if (r.chot) chot++; }
    const qua = a.filter((x) => x > 20000).length / a.length;
    console.log(`  ${ten.padEnd(41)} ${f1(pct(a, 50)).padStart(6)}  ${f1(pct(a, 90)).padStart(6)}  ${f1(pct(a, 99)).padStart(6)}  ${f1(Math.max(...a)).padStart(6)}  ${(Math.round(qua * 1000) / 10 + "%").padStart(7)}   ${(Math.round(tb(g) * 100) / 100).toFixed(2)}` +
      (chot ? `   (${(Math.round((chot / N) * 1000) / 10)}% lượt phải dùng mốc chốt)` : ""));
  }
}

/* ══════════════════════════════ Pha C — đầu-cuối qua cổng thật ══════════════════════════════ */
async function goiVision(b64, nonce, dua) {
  const t0 = Date.now();
  const body = { action: "sku_vision", email: MAIL, mime: "image/jpeg", anh: b64, nonce, ...(dua ? { dua: 1 } : {}) };
  try {
    const r = await fetch(URL_GAS, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
    const t = (await r.text()).trim();
    const j = t.charAt(0) === "{" ? JSON.parse(t) : { status: "error", message: /^<!DOCTYPE|^<html/i.test(t) ? "HTML chặng 2" : t.slice(0, 60) };
    return { ms: Date.now() - t0, j };
  } catch (e) { return { ms: Date.now() - t0, j: { status: "error", message: String(e.message || e).slice(0, 60) } }; }
}
async function phaLive() {
  const N = so("--n", 6), TDUA = so("--dua", 5.5) * 1000;
  await dungAnh([1400]);
  const kq = fs.existsSync(F_LIVE) ? JSON.parse(fs.readFileSync(F_LIVE, "utf8")) : { at: "", mau: [] };
  console.log(`Pha C — đầu-cuối qua cổng production (TỐN hạn mức AI thật). Đua ở giây ${TDUA / 1000}\n`);
  for (let i = 0; i < N; i++) {
    const d = DE[i % DE.length];
    const b64 = fs.readFileSync(path.join(DIR_ANH, `${d.ma}-1400.jpg`)).toString("base64");
    const nonce = "dotd-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const t0 = Date.now();
    let xong = null, nDua = 1;
    const p1 = goiVision(b64, nonce, false).then((r) => ({ ...r, ai: 1 }));
    const p2 = new Promise((res) => setTimeout(res, TDUA)).then(() => {
      if (xong) return null;
      nDua = 2;
      return goiVision(b64, nonce, true).then((r) => ({ ...r, ai: 2 }));
    });
    const r = await Promise.race([p1, p2.then((x) => x || new Promise(() => {}))]);
    xong = true;
    const tong = Date.now() - t0;
    /* Vẫn chờ lượt còn lại để biết nó về lúc nào (chỉ để đo, dashboard sẽ abort). */
    const ca = await Promise.allSettled([p1, p2]);
    const dsMs = ca.map((c) => (c.value ? c.value.ms : null));
    kq.mau.push({ de: d.ma, tong, nDua, thangCua: r.ai, ok: r.j.status === "success", model: r.j.model || "", msGas: r.j.ms || 0, ms1: dsMs[0], ms2: dsMs[1] });
    console.log(`  #${i + 1} ${d.ma.padEnd(11)} xong sau ${f1(tong).padStart(6)} (lượt ${r.ai} thắng) · lượt1 ${f1(dsMs[0])} · lượt2 ${dsMs[1] ? f1(dsMs[1]) : "không bắn"} · ${r.j.status === "success" ? "model " + r.j.model + " · script " + f1(r.j.ms) : "✗ " + r.j.message}`);
    if (i < N - 1) await nghi(4000);
  }
  kq.at = new Date().toISOString();
  fs.writeFileSync(F_LIVE, JSON.stringify(kq, null, 1));
  const t = kq.mau.map((m) => m.tong);
  console.log("\n  " + bang("đầu-cuối (có đua)", t));
  console.log(`  Số lượt gọi AI trung bình: ${(Math.round(tb(kq.mau.map((m) => m.nDua)) * 100) / 100).toFixed(2)}/tem`);
}

/* ══════════════════════════ Pha C2 — đường OCR + ĐUA AI‖OCR (gần như miễn phí) ══════════════════════════ */
async function goiOcr(b64, nonce) {
  const t0 = Date.now();
  const body = { action: "sku_ocr", email: MAIL, mime: "image/jpeg", anh: b64, lang: "vi", nonce };
  try {
    const r = await fetch(URL_GAS, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
    const t = (await r.text()).trim();
    const j = t.charAt(0) === "{" ? JSON.parse(t) : { status: "error", message: /^<!DOCTYPE|^<html/i.test(t) ? "HTML chặng 2" : t.slice(0, 60) };
    return { ms: Date.now() - t0, j };
  } catch (e) { return { ms: Date.now() - t0, j: { status: "error", message: String(e.message || e).slice(0, 60) } }; }
}
async function phaOcr() {
  const N = so("--n", 6), DUA = co("--dua-ai");
  await dungAnh([1400]);
  const E = layLoi(), ds = await layDanhMuc(), cm = E.dungChiMuc(ds);
  const kq = fs.existsSync(path.join(OUT, "do-tem-ocr.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "do-tem-ocr.json"), "utf8")) : { at: "", mau: [] };
  console.log(`Pha C2 — đường OCR của Google${DUA ? " + ĐUA song song với AI (tốn hạn mức AI)" : " (miễn phí, trần 2.000/ngày)"}\n`);
  for (let i = 0; i < N; i++) {
    const d = DE[i % DE.length];
    const b64 = fs.readFileSync(path.join(DIR_ANH, `${d.ma}-1400.jpg`)).toString("base64");
    const nonce = "docr-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const t0 = Date.now();
    const pOcr = goiOcr(b64, nonce + "-o");
    const pAi = DUA ? goiVision(b64, nonce + "-a", false) : null;
    const [o, ai] = await Promise.all([pOcr, pAi || Promise.resolve(null)]);
    let coMa = null, top1 = null;
    if (o.j.status === "success" && o.j.text) {
      const nhan = nhanTho(E, o.j.text, cm);
      const top = E.timTop(nhan, cm, { soLuong: 3, chiActive: true });
      coMa = !!(nhan.code || []).length; top1 = top.length ? String(top[0].sku) : null;
    }
    kq.mau.push({ de: d.ma, msOcr: o.ms, okOcr: o.j.status === "success", msUp: o.j.msUp || 0, msExport: o.j.msExport || 0,
      msAi: ai ? ai.ms : null, okAi: ai ? ai.j.status === "success" : null, coMa, top1, dungTop1: d.sku ? top1 === d.sku : null, tong: Date.now() - t0 });
    console.log(`  #${i + 1} ${d.ma.padEnd(11)} OCR ${f1(o.ms).padStart(6)} ${o.j.status === "success" ? `(nạp ${f1(o.j.msUp)} · lấy chữ ${f1(o.j.msExport)}) · mã ${coMa ? "CÓ" : "không"}${d.sku ? " · Top1 " + (top1 === d.sku ? "ĐÚNG" : String(top1)) : ""}` : "✗ " + o.j.message}` +
      (ai ? `   | AI ${f1(ai.ms)} ${ai.j.status === "success" ? "ok" : "✗ " + ai.j.message} → ĐUA thắng ${Math.min(o.ms, ai.ms) === ai.ms ? "AI" : "OCR"} ở ${f1(Math.min(o.ms, ai.ms))}` : ""));
    if (i < N - 1) await nghi(3000);
  }
  kq.at = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, "do-tem-ocr.json"), JSON.stringify(kq, null, 1));
  const ms = kq.mau.filter((m) => m.okOcr).map((m) => m.msOcr);
  console.log("\n  " + bang("OCR đầu-cuối", ms));
  const cm2 = kq.mau.filter((m) => m.okOcr);
  console.log(`  Lập được MÃ: ${cm2.filter((m) => m.coMa).length}/${cm2.length} · trong đó thẻ viết tay: ${cm2.filter((m) => m.de.startsWith("tay") && m.coMa).length}/${cm2.filter((m) => m.de.startsWith("tay")).length}`);
  const dua = kq.mau.filter((m) => m.msAi != null);
  if (dua.length) {
    console.log("  " + bang("ĐUA min(AI,OCR)", dua.map((m) => Math.min(m.msAi, m.msOcr))));
    console.log("  " + bang("chỉ AI", dua.map((m) => m.msAi)));
  }
}

/* ═══════════════════ Pha E — ĐO TRÊN TRANG THẬT (điện thoại giả lập, mạng 4G yếu) ═══════════════════ */
/* Đây là con số DUY NHẤT mà thủ kho cảm nhận: từ lúc có ảnh tới lúc Top 3 hiện ra, đi qua đúng bậc
   thang đang chạy (mã vạch → sổ tay → AI có đua → OCR song song → mốc chốt). Chạy trên bản LIVE ở
   github.io, không phải file cục bộ: bậc thang gọi Apps Script thật nên phải là origin thật.
   `--mang 4g` bóp băng thông bằng CDP (1,6/0,75 Mbps · 300ms) — đúng cấu hình đã dùng ở 5b.5b. */
async function phaTrang() {
  const N = so("--n", 4), MANG = co("--mang") ? A[A.indexOf("--mang") + 1] : "4g";
  const URL_TRANG = co("--trang-url") ? A[A.indexOf("--trang-url") + 1] : "https://letam0317.github.io/stocklocationfactory/";
  await dungAnh([1400]);
  const puppeteer = (await import("puppeteer")).default;
  const { EDGE_PATH } = await import("./token-store.js");
  const br = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH });
  const kq = { at: new Date().toISOString(), mau: [] };
  console.log(`Pha E — đo trên TRANG THẬT ${URL_TRANG} · mạng ${MANG} · ${N} lượt (TỐN hạn mức AI thật)\n`);
  for (let i = 0; i < N; i++) {
    const d = DE[i % DE.length];
    const pg = await br.newPage();
    await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    if (MANG === "4g") {
      const cdp = await pg.createCDPSession();
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 300, downloadThroughput: 1.6e6 / 8, uploadThroughput: 0.75e6 / 8 });
    }
    const loi = [];
    pg.on("pageerror", (e) => loi.push(String(e.message || e).slice(0, 90)));
    await pg.goto(URL_TRANG, { waitUntil: "networkidle2", timeout: 120000 });
    await pg.evaluate(() => { const b = document.getElementById("ttSku"); if (b) b.click(); });
    await pg.waitForFunction(() => typeof NDS !== "undefined" && NDS.ds && NDS.ds.length > 100, { timeout: 120000 });
    /* Đặt ảnh bằng ndsDatAnh (đúng đường mà nút "Chụp"/"Chọn ảnh" đi qua) rồi bấm đồng hồ. */
    const b64 = fs.readFileSync(path.join(DIR_ANH, `${d.ma}-1400.jpg`)).toString("base64");
    const r = await pg.evaluate(async (b64) => {
      const t0 = Date.now();
      window.__moc = { t0 };
      ndsDatAnh("data:image/jpeg;base64," + b64);
      /* Chờ tới khi có thẻ gợi ý, hoặc tới 25s (quá mốc chốt 17s để thấy cả ca xấu). */
      while (Date.now() - t0 < 25000) {
        if (document.querySelectorAll("#ndsCards .nds-card").length) break;
        await new Promise((r) => setTimeout(r, 80));
      }
      const the = [...document.querySelectorAll("#ndsCards .nds-card")].slice(0, 3).map((e) => {
        const s = e.querySelector(".nds-sku"), p = e.querySelector(".nds-pct");
        return (s ? s.textContent.trim() : "?") + (p ? " " + p.textContent.trim() : "");
      });
      return { ms: Date.now() - t0, the: the, nDua: NDS.nDua || 0,
        nguon: (NDS.tokens || []).map((t) => t.nguon).filter((v, k, a) => a.indexOf(v) === k).join(","),
        /* 23/08/2026: hộp "đang đọc" bỏ đồng hồ giây trên màn (nay là vòng chạy), giây còn ở data-giay */
        dongHo: (document.getElementById("ndsBusyBox") || { getAttribute: () => "" }).getAttribute("data-giay") || "",
        tokens: (NDS.tokens || []).length };
    }, b64);
    kq.mau.push({ de: d.ma, ...r, loi: loi.slice(0, 2) });
    console.log(`  #${i + 1} ${d.ma.padEnd(11)} ${f1(r.ms).padStart(6)} · ${r.tokens} từ khoá (${r.nguon || "—"})` +
      ` · đua ${r.nDua} · ${r.the.length ? "Top: " + r.the.join(" | ") : "KHÔNG ra thẻ"}${loi.length ? " · lỗi JS: " + loi[0] : ""}`);
    await pg.close();
  }
  await br.close();
  fs.writeFileSync(path.join(OUT, "do-tem-trang.json"), JSON.stringify(kq, null, 1));
  const ms = kq.mau.map((m) => m.ms);
  console.log("\n  " + bang("đầu-cuối trên trang", ms));
  console.log(`  Quá 20 giây: ${ms.filter((x) => x > 20000).length}/${ms.length} · lượt đua trung bình ${(Math.round(tb(kq.mau.map((m) => m.nDua)) * 100) / 100).toFixed(2)}/tem`);
}

/* ═════════════════════════════════════════ điều phối ═════════════════════════════════════════ */
if (co("--chang")) await phaChang();
else if (co("--song-song")) await phaSongSong();
else if (co("--model")) await phaModel();
else if (co("--mo-phong")) phaMoPhong();
else if (co("--live")) await phaLive();
else if (co("--ocr")) await phaOcr();
else if (co("--trang")) await phaTrang();
else {
  console.log(`do-toc-do-tem.mjs — đo rồi mô phỏng để ép thời gian đọc tem < 20s

  --chang [--n 24]        pha A  · phí 2 chặng Apps Script (MIỄN PHÍ)
  --song-song [--n 4]     pha A2 · GAS có phục vụ 2 POST song song không
  --model [--lan 4]       pha B  · chặng Gemini + độ chính xác (tốn lượt Gemini của .env)
        [--chi day,tho]   chỉ chạy vài biến thể · [--model-ten <model>]
  --mo-phong [--bien day] pha D  · Monte Carlo trên số đo đã lưu (miễn phí)
  --live [--n 6]          pha C  · đầu-cuối qua cổng production (TỐN hạn mức AI thật)
  --ocr [--n 6] [--dua-ai]  pha C2 · đường OCR Google (miễn phí) và phép ĐUA AI‖OCR
  --trang [--n 4] [--mang 4g]  pha E  · đo trên TRANG THẬT (github.io) bằng điện thoại giả lập`);
}
