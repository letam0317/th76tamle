/**
 * phan-tich-vai-thun.mjs — SOÁT DANH MỤC "VẢI" + "THUN" ĐỂ TÍNH ĐƯỜNG kg → mm
 * ===========================================================================================
 *  Câu hỏi cần trả lời trước khi viết một dòng giao diện nào cho tab "Chuyển đổi cân":
 *    ① Có bao nhiêu SKU tên bắt đầu bằng "Vải" / "Thun"? ĐVT của chúng là gì (mm · m · kg · yard)?
 *    ② Tên hàng có sẵn THÔNG SỐ để quy khối lượng ra chiều dài không?
 *         vải khổ:  dài(m) = khối lượng(g) ÷ (định lượng g/m² × khổ m)   → cần CẢ gsm CẢ khổ
 *         dạng dải: dài(m) = khối lượng(g) ÷ định lượng dài (g/m)        → cần g/m
 *       Đếm xem bao nhiêu dòng có gsm, bao nhiêu có khổ, bao nhiêu có CẢ HAI.
 *    ③ Có cặp SKU CÙNG MẶT HÀNG mà khác ĐVT (kg ↔ mm) không? Đó là chỗ đối chứng miễn phí.
 *    ④ Tồn kho đang nằm ở ĐVT nào — quy đổi cho nhóm nào thì có ích thật.
 *
 *  Không gọi WMS. Đọc tab SKU_MASTER qua gviz (đúng đường dashboard vẫn đọc) rồi bóc bằng chính
 *  NDS_ENGINE trong factory/index.html — dùng lại lõi để không sinh một bản luật thứ hai.
 *
 *  node phan-tich-vai-thun.mjs            (tải mới, cất .sku-master-gviz.json)
 *  node phan-tich-vai-thun.mjs --cache    (dùng bản đã cất)
 *  node phan-tich-vai-thun.mjs --mau 40   (in thêm 40 tên hàng mẫu mỗi nhóm)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SHEET_ID = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const TAB = "SKU_MASTER";
const F_CACHE = path.join(DIR, ".sku-master-gviz.json");
const DUNG_CACHE = process.argv.includes("--cache");
const N_MAU = Number((process.argv.find((a) => a.startsWith("--mau")) || "").split(/[= ]/)[1]
  || (process.argv[process.argv.indexOf("--mau") + 1] || 0)) || 0;

/* ───────────────── 1. LẤY DANH MỤC ───────────────── */
async function taiSheet() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(TAB)}&headers=1&tqx=out:json`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("gviz HTTP " + r.status);
  const t = await r.text();
  const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
  const cols = (j.table.cols || []).map((c) => String(c.label || c.id || "").trim().toUpperCase());
  const iSku = 0, iPn = 1, iType = cols.indexOf("TYPE"), iSt = cols.indexOf("STATUS"),
    iQty = cols.indexOf("INVENTORY_QTY"), iUnit = cols.indexOf("UNIT");
  const rows = [];
  for (const row of j.table.rows || []) {
    const c = row.c || [], v = (k) => (k >= 0 && c[k] && c[k].v != null ? c[k].v : "");
    const sku = String(v(iSku)).replace(/\.0$/, "").trim();
    if (!sku) continue;
    rows.push({
      sku, pn: String(v(iPn)),
      type: String(v(iType)).toUpperCase() === "COMBO" ? "COMBO" : "NORMAL",
      status: String(v(iSt)).toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      qty: Number(v(iQty)) || 0,
      unit: String(v(iUnit) || "").trim(),
    });
  }
  return { at: Date.now(), cols, rows };
}
let data;
if (DUNG_CACHE && fs.existsSync(F_CACHE)) data = JSON.parse(fs.readFileSync(F_CACHE, "utf8"));
else { data = await taiSheet(); fs.writeFileSync(F_CACHE, JSON.stringify(data)); }
const rows = data.rows;
console.log(`Tab ${TAB}: ${rows.length} dòng · cột ${data.cols.join(" | ")} · bản ${new Date(data.at).toISOString().slice(0, 16).replace("T", " ")}\n`);

/* ───────────────── 2. LÕI BÓC TÊN (dùng lại của tab Nhận diện SKU) ───────────────── */
const html = fs.readFileSync(path.join(DIR, "..", "factory", "index.html"), "utf8");
const E = new Function(html.slice(html.indexOf("/*<NDS-ENGINE>*/"), html.indexOf("/*</NDS-ENGINE>*/")) + "\n return NDS_ENGINE;")();
const boDau = (s) => E.boDau(String(s || "")).toLowerCase();

/* ───────────────── 3. LỌC NHÓM ───────────────── */
const nhomCua = (pn) => {
  const p = boDau(pn).trim();
  if (/^vai\b/.test(p)) return "Vải";
  if (/^thun\b/.test(p)) return "Thun";
  return null;
};
const G = { "Vải": [], "Thun": [] };
for (const r of rows) { const g = nhomCua(r.pn); if (g) G[g].push(r); }

/* ───────────────── 4. BÓC THÔNG SỐ CẦN CHO kg → mm ───────────────── */
/* Khổ vải: "W150cm" · "K150" · "150cm" · "1m5" · "khổ 1,5m" — chỉ nhận trong dải 20-400cm cho khỏi
   nhặt bừa số đo khác (chiều dài cuộn 5000m, mã màu 4 chữ số…). */
/* SÁU cách ghi khổ đang có thật trong danh mục (đếm 23/08/2026):
     "150cm" · "W150cm" · "Width 165cm+3cm" · "58-59inch" · `57"` · "1m5"/"K150"
   Trả về {cm, nguon} — `nguon` để biết con số tin được tới đâu (inch phải nhân 2,54; khoảng
   58-59inch thì lấy giữa nên đã sai sẵn ~1cm). */
function bocKhoChiTiet(pn) {
  const p = boDau(pn).replace(/[“”]/g, '"');
  let m;
  m = p.match(/\b(\d{2,3})\s*[-–]\s*(\d{2,3})\s*(?:inch|in|")/);          // 58-59inch → lấy giữa
  if (m) return { cm: ((+m[1] + +m[2]) / 2) * 2.54, nguon: "inch-khoang" };
  m = p.match(/\b(\d{2,3}(?:[.,]\d+)?)\s*(?:inch|"|\bin\b)/);
  if (m) { const v = Number(m[1].replace(",", ".")) * 2.54; if (v >= 20 && v <= 400) return { cm: v, nguon: "inch" }; }
  m = p.match(/\b[wk](?:idth)?\s*[-: ]?\s*(\d{2,4}(?:[.,]\d+)?)\s*cm/) || p.match(/\bkho\s*[-: ]?\s*(\d{2,4}(?:[.,]\d+)?)\s*cm/);
  if (m) { let v = Number(m[1].replace(",", "."));
    /* "Width 1650cm (phủ bì)" — lỗi gõ thừa số 0: 1650cm = 16,5 mét thì không phải khổ vải nào cả */
    if (v > 400 && v <= 4000 && v / 10 >= 20 && v / 10 <= 400) return { cm: v / 10, nguon: "cm-sai-so-0" };
    if (v >= 20 && v <= 400) return { cm: v, nguon: "cm-co-nhan" }; }
  m = p.match(/\b(\d{2,3}(?:[.,]\d+)?)\s*cm\b/);
  if (m) { const v = Number(m[1].replace(",", ".")); if (v >= 20 && v <= 400) return { cm: v, nguon: "cm-tran" }; }
  m = p.match(/\b[wk](?:idth)?\s*[-: ]?\s*(\d(?:[.,]\d+)?)\s*m\b/);
  if (m) { const v = Number(m[1].replace(",", ".")) * 100; if (v >= 20 && v <= 400) return { cm: v, nguon: "m" }; }
  m = p.match(/\b(\d)m(\d)\b/);                                            // "1m5" = 1,5m
  if (m) { const v = (+m[1] + +m[2] / 10) * 100; if (v >= 20 && v <= 400) return { cm: v, nguon: "1m5" }; }
  m = p.match(/\bk\s*[-. ]?(\d{2,3})\b/);                                  // "K150"
  if (m) { const v = +m[1]; if (v >= 80 && v <= 250) return { cm: v, nguon: "K150" }; }
  return null;
}
const bocKho = (pn) => { const k = bocKhoChiTiet(pn); return k ? Math.round(k.cm * 10) / 10 : null; };
/* Định lượng: "170gsm" · "gsm 170" · "170 g/m2" · "weight 210" · "11oz" (oz/yd² → ×33,906) */
function bocGsmChiTiet(pn) {
  const p = boDau(pn);
  let m = p.match(/\b(\d{2,4})\s*gsm\b/) || p.match(/\bgsm\s*[-: ]?\s*(\d{2,4})\b/)
    || p.match(/\b(\d{2,4})\s*g\s*\/\s*m2?\b/);
  if (m) return { gsm: +m[1], nguon: "gsm" };
  m = p.match(/\b(\d{1,2}(?:[.,]\d+)?)\s*oz\b/);
  if (m) return { gsm: Math.round(Number(m[1].replace(",", ".")) * 33.906), nguon: "oz" };
  m = p.match(/\bweight\s*[-: ]?\s*(\d{2,4})\b/);
  if (m) return { gsm: +m[1], nguon: "weight" };
  return null;
}
const bocGsm = (pn) => { const g = bocGsmChiTiet(pn); return g ? g.gsm : null; };
/* Định lượng DÀI (cho dải/dây): "12g/m" · "3,5 g/met" */
function bocGm(pn) {
  const m = boDau(pn).match(/\b(\d+(?:[.,]\d+)?)\s*g\s*\/\s*(?:m|met)\b/);
  return m ? Number(m[1].replace(",", ".")) : null;
}
/* Bề rộng dải (dây thun/ruy băng): "20mm" · "1.5cm" — dải hẹp, dưới 20cm */
function bocRongDai(pn) {
  const p = boDau(pn);
  let m = p.match(/\b(\d{1,3}(?:[.,]\d+)?)\s*mm\b/);
  if (m) { const v = Number(m[1].replace(",", ".")); if (v >= 2 && v <= 200) return v; }
  m = p.match(/\b(\d{1,2}(?:[.,]\d+)?)\s*cm\b/);
  if (m) { const v = Number(m[1].replace(",", ".")) * 10; if (v >= 2 && v <= 200) return v; }
  return null;
}

const chuanDv = (r) => {
  const dv = E.donVi(r.pn);
  const u = boDau(r.unit || "");
  return { ma: dv.ma || "", raw: dv.raw || "", cotF: u };
};

/* ───────────────── 5. BÁO CÁO ───────────────── */
const bang = (tieuDe, dem, tong) => {
  console.log("  " + tieuDe);
  const ds = Object.entries(dem).sort((a, b) => b[1] - a[1]);
  for (const [k, v] of ds) {
    const pct = ((v / tong) * 100).toFixed(1).padStart(5);
    console.log("    " + String(k || "(trống)").padEnd(26) + String(v).padStart(5) + "  " + pct + "%  " + "█".repeat(Math.round((v / tong) * 40)));
  }
};
const gom = (arr, f) => arr.reduce((o, r) => { const k = f(r); o[k] = (o[k] || 0) + 1; return o; }, {});

const tomTat = {};
for (const [ten, ds] of Object.entries(G)) {
  console.log("═".repeat(96));
  console.log(`NHÓM "${ten}" — ${ds.length} SKU (${ds.filter((r) => r.status === "ACTIVE").length} ACTIVE · ` +
    `${ds.filter((r) => r.type === "COMBO").length} COMBO) · tồn > 0: ${ds.filter((r) => r.qty > 0).length}`);
  console.log("═".repeat(96));
  bang("ĐVT (cột UNIT của Sheet):", gom(ds, (r) => r.unit || "(trống)"), ds.length);
  bang("ĐVT bóc từ ĐUÔI TÊN HÀNG (lõi donVi):", gom(ds, (r) => chuanDv(r).raw || "(không có)"), ds.length);

  const coKho = ds.filter((r) => bocKho(r.pn) != null);
  const coGsm = ds.filter((r) => bocGsm(r.pn) != null);
  const coCa2 = ds.filter((r) => bocKho(r.pn) != null && bocGsm(r.pn) != null);
  const coGm = ds.filter((r) => bocGm(r.pn) != null);
  const coRongDai = ds.filter((r) => bocRongDai(r.pn) != null);
  console.log("\n  THÔNG SỐ CÓ SẴN TRONG TÊN HÀNG (điều kiện để quy kg → mm):");
  const d = (n) => String(n).padStart(5) + "  " + ((n / ds.length) * 100).toFixed(1).padStart(5) + "%";
  console.log("    có KHỔ (W…cm) ...................... " + d(coKho.length));
  console.log("    có ĐỊNH LƯỢNG (gsm) ................ " + d(coGsm.length));
  console.log("    có CẢ khổ + gsm  (quy được ngay) ... " + d(coCa2.length));
  console.log("    có g/m (định lượng dài) ............ " + d(coGm.length));
  console.log("    có bề rộng dải (mm/cm nhỏ) ......... " + d(coRongDai.length));

  /* Khổ nào phổ biến — nếu tập trung vào vài giá trị thì làm CHIP như chip Tex là đủ dùng */
  const demKho = gom(coKho, (r) => bocKho(r.pn) + "cm");
  if (coKho.length) bang("\n  Các KHỔ gặp trong danh mục:", demKho, coKho.length);
  const demGsm = gom(coGsm, (r) => bocGsm(r.pn) + "gsm");
  if (coGsm.length) bang("\n  Các ĐỊNH LƯỢNG gặp trong danh mục:", demGsm, coGsm.length);

  /* Cặp cùng mặt hàng khác ĐVT — chỗ đối chứng: cùng khoá hàng mà có cả kg và mm/m */
  const theoKhoa = {};
  for (const r of ds) { const k = E.khoaHang(r.pn); (theoKhoa[k] = theoKhoa[k] || []).push(r); }
  const capLech = Object.entries(theoKhoa).filter(([, v]) => new Set(v.map((r) => chuanDv(r).ma)).size > 1);
  console.log("\n  CẶP ĐỐI CHỨNG (cùng mặt hàng, khác ĐVT): " + capLech.length + " nhóm");
  for (const [k, v] of capLech.slice(0, 8)) {
    console.log("    · " + k.slice(0, 58));
    for (const r of v.slice(0, 4)) console.log("        " + r.sku + " · " + (chuanDv(r).raw || "—").padEnd(8) + " · tồn " + String(r.qty).padStart(9) + " · " + r.pn.slice(0, 74));
  }

  /* Tồn kho đang nằm ở ĐVT nào */
  const tonTheoDv = ds.reduce((o, r) => { const k = chuanDv(r).ma || "?"; o[k] = (o[k] || 0) + r.qty; return o; }, {});
  console.log("\n  TỒN KHO theo ĐVT (tổng qty của nhóm):");
  Object.entries(tonTheoDv).sort((a, b) => b[1] - a[1]).forEach(([k, v]) =>
    console.log("    " + k.padEnd(10) + v.toLocaleString("vi-VN").padStart(14)));

  if (N_MAU) {
    console.log("\n  MẪU TÊN HÀNG (" + Math.min(N_MAU, ds.length) + "):");
    ds.slice(0, N_MAU).forEach((r) => console.log("    " + r.sku + " │ " + (chuanDv(r).raw || "—").padEnd(7) +
      " │ khổ " + String(bocKho(r.pn) ?? "—").padStart(5) + " │ gsm " + String(bocGsm(r.pn) ?? "—").padStart(4) + " │ " + r.pn));
  }
  console.log("");
  tomTat[ten] = { tong: ds.length, active: ds.filter((r) => r.status === "ACTIVE").length,
    coKho: coKho.length, coGsm: coGsm.length, coCa2: coCa2.length, coGm: coGm.length, capLech: capLech.length };
}
/* ───────────── 6. KHOANH RIÊNG NHÓM QUẢN THEO KHỐI LƯỢNG — đây mới là việc của kg → mm ───────── */
const laKhoiLuong = (r) => /^(g|gram|gam|kg)$/.test(boDau(chuanDv(r).ma || chuanDv(r).raw));
const laDai = (r) => /^(mm|cm|m|met|mét|yard|yards)$/.test(boDau(chuanDv(r).ma || chuanDv(r).raw));
console.log("═".repeat(96));
console.log("NHÓM CẦN QUY ĐỔI (ĐVT là khối lượng) — đây là phạm vi thật của việc kg → mm");
console.log("═".repeat(96));
for (const [ten, ds] of Object.entries(G)) {
  const kl = ds.filter(laKhoiLuong), dai = ds.filter(laDai);
  const kl2 = kl.filter((r) => bocKho(r.pn) != null && bocGsm(r.pn) != null);
  const klKho = kl.filter((r) => bocKho(r.pn) != null), klGsm = kl.filter((r) => bocGsm(r.pn) != null);
  console.log(`\n  ${ten}: ${kl.length} SKU theo KHỐI LƯỢNG · ${dai.length} SKU theo CHIỀU DÀI` +
    `  (tồn khối lượng ${kl.reduce((s, r) => s + r.qty, 0).toLocaleString("vi-VN")} · còn tồn: ${kl.filter((r) => r.qty > 0).length} SKU)`);
  if (kl.length) {
    const pc = (n) => String(n).padStart(4) + " (" + ((n / kl.length) * 100).toFixed(0).padStart(3) + "%)";
    console.log("      trong đó có khổ ......... " + pc(klKho.length));
    console.log("      có gsm ................. " + pc(klGsm.length));
    console.log("      CÓ CẢ HAI → quy ngay ... " + pc(kl2.length));
    console.log("      thiếu ít nhất một ...... " + pc(kl.length - kl2.length));
    console.log("      Ví dụ QUY ĐƯỢC NGAY:");
    kl2.slice(0, 6).forEach((r) => {
      const kho = bocKho(r.pn), gsm = bocGsm(r.pn);
      const mmMoiKg = Math.round(1e6 / (gsm * kho / 100) * 1000) / 1000;   // 1kg = ? mm
      console.log(`        ${r.sku} · ${String(gsm).padStart(4)}gsm × ${String(kho).padStart(5)}cm ⇒ 1kg ≈ ${(mmMoiKg / 1000).toFixed(2)} m · tồn ${r.qty.toLocaleString("vi-VN")} ${chuanDv(r).raw}`);
      console.log(`            ${r.pn.slice(0, 96)}`);
    });
    const thieu = kl.filter((r) => !(bocKho(r.pn) != null && bocGsm(r.pn) != null));
    if (thieu.length) {
      console.log("      Ví dụ CÒN THIẾU thông số:");
      thieu.slice(0, 6).forEach((r) => console.log(`        ${r.sku} · khổ ${String(bocKho(r.pn) ?? "—").padStart(5)} · gsm ${String(bocGsm(r.pn) ?? "—").padStart(4)} · ${r.pn.slice(0, 90)}`));
    }
  }
}

/* ───────────── 6b. NHÓM PHẢI KHAI THEO CHIỀU DÀI — đối tượng CHÍNH của việc quy kg → mm ─────────
   Đây mới là chỗ cần công cụ: WMS bắt khai mm/m/yard, mà cuộn vải về kho chỉ có CÂN. Nhóm ĐVT là
   khối lượng thì khai thẳng số cân, không cần quy gì. */
console.log("═".repeat(96));
console.log("NHÓM PHẢI KHAI THEO CHIỀU DÀI (WMS đòi mm/m/yard) — cần quy từ CÂN sang");
console.log("═".repeat(96));
const nguonKho = {}, nguonGsm = {};
for (const [ten, ds] of Object.entries(G)) {
  const dai = ds.filter(laDai), ton = dai.filter((r) => r.qty > 0);
  const du = (r) => bocKho(r.pn) != null && bocGsm(r.pn) != null;
  console.log(`\n  ${ten}: ${dai.length} SKU khai theo chiều dài · ${ton.length} SKU còn tồn`);
  const pc = (n, t) => String(n).padStart(4) + " (" + ((n / (t || 1)) * 100).toFixed(0).padStart(3) + "%)";
  console.log("      có khổ ................. " + pc(dai.filter((r) => bocKho(r.pn) != null).length, dai.length));
  console.log("      có định lượng .......... " + pc(dai.filter((r) => bocGsm(r.pn) != null).length, dai.length));
  console.log("      quy được NGAY từ tên ... " + pc(dai.filter(du).length, dai.length) + "   · trong số CÒN TỒN: " + pc(ton.filter(du).length, ton.length));
  for (const r of dai) {
    const k = bocKhoChiTiet(r.pn), g = bocGsmChiTiet(r.pn);
    if (k) nguonKho[k.nguon] = (nguonKho[k.nguon] || 0) + 1;
    if (g) nguonGsm[g.nguon] = (nguonGsm[g.nguon] || 0) + 1;
  }
  const thieu = ton.filter((r) => !du(r));
  console.log("      Còn tồn mà CHƯA quy được (" + thieu.length + " SKU) — 6 ví dụ:");
  thieu.slice(0, 6).forEach((r) => console.log(`        ${r.sku} · khổ ${String(bocKho(r.pn) ?? "—").padStart(5)} · gsm ${String(bocGsm(r.pn) ?? "—").padStart(4)} · ${r.pn.slice(0, 88)}`));
}
console.log("\n  Cách ghi KHỔ gặp trong danh mục: " + JSON.stringify(nguonKho));
console.log("  Cách ghi ĐỊNH LƯỢNG gặp trong danh mục: " + JSON.stringify(nguonGsm));

/* ───────────── 7. TOÀN DANH MỤC: chỗ nào NGƯỜI TA ĐÃ TỰ GHI hệ số quy đổi vào tên ───────────── */
console.log("\n" + "═".repeat(96));
console.log("HỆ SỐ QUY ĐỔI ĐÃ CÓ SẴN TRONG TÊN HÀNG (người khai tự ghi) — mầm cho bảng tra");
console.log("═".repeat(96));
const RE_HE_SO = /(\d+(?:[.,]\d+)?)\s*(kg|g)\s*[-–~=]\s*(\d+(?:[.,]\d+)?)\s*(m|met|mét|mm|yard)\b/i;
const coHeSo = rows.filter((r) => RE_HE_SO.test(boDau(r.pn)));
console.log(coHeSo.length + " dòng trên TOÀN BỘ " + rows.length + " dòng danh mục:");
coHeSo.slice(0, 25).forEach((r) => {
  const m = boDau(r.pn).match(RE_HE_SO);
  const kl = Number(m[1].replace(",", ".")) * (m[2] === "kg" ? 1000 : 1);
  const d = Number(m[3].replace(",", ".")) * (m[4] === "mm" ? 0.001 : (/^y/.test(m[4]) ? 0.9144 : 1));
  console.log(`  ${r.sku} · ${m[0]}  ⇒ ${(kl / d).toFixed(2)} g/m · ${r.pn.slice(0, 84)}`);
});

console.log("\n" + "═".repeat(96));
console.log("TÓM TẮT: " + JSON.stringify(tomTat));
