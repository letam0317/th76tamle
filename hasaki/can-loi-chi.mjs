/**
 * can-loi-chi.mjs — DANH SÁCH MẪU CUỘN CHỈ CẦN CÂN LÕI + tab nhập số cân
 * ============================================================================================
 *  Vì sao cần: quy đổi cân → mm (tab Chuyển đổi cân) phải TRỪ LÕI, nhưng không hãng nào công bố
 *  cân lõi (đã tra 22/08/2026: Coats/Phong Việt/nhà máy TQ chỉ công bố Tex + số mét). Cách duy
 *  nhất là cân lõi rỗng THẬT — mỗi cặp (nhãn + cỡ chỉ + quy cách cuộn) chỉ cần cân 1 lần vì mọi
 *  màu của cùng cặp dùng chung một loại lõi.
 *
 *  Làm gì:
 *    1) Đọc SKU_MASTER (gviz, sheet public) → lọc SKU chỉ (kể cả "(Combo) Chỉ …")
 *    2) Gom nhóm nhãn + cỡ + quy cách; SKU "/mm" không ghi số mét thì nhập vào nhóm quy cách
 *       PHỔ BIẾN NHẤT của cùng nhãn+cỡ (cùng một cuộn vật lý, chỉ khác đơn vị bán)
 *    3) Tra vị trí bin của SKU đại diện trong .exports/stocklocation-out.json (chạy
 *       `node sync-stocklocation.js --dry` trước nếu file cũ >1 ngày — KHÔNG tự gọi WMS ở đây)
 *    4) Ghi tab CAN-LOI-CHI lên Sheet factory: mỗi dòng 1 mẫu cần cân, kèm 4 cột NHẬP TAY
 *       (LÕI RỖNG g · CẢ CUỘN NGUYÊN g · GHI CHÚ · NGÀY CÂN) và cột "CHỈ TÍNH TỪ TEX (g)"
 *       để đối chứng ngay tại chỗ: cả cuộn nguyên − lõi ≈ số đó (±5%).
 *
 *  AN TOÀN: tab là nơi NGƯỜI nhập số → trước khi ghi có kiểm tra: nếu tab đã có số cân
 *  thì DỪNG, chỉ ghi đè khi có --ghi-de. `--dry` chỉ in danh sách, không ghi Sheet.
 *
 *  node can-loi-chi.mjs [--dry] [--ghi-de]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { gasPost } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SHEET_FACTORY = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const TAB = "CAN-LOI-CHI";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const DRY = process.argv.includes("--dry");
const GHI_DE = process.argv.includes("--ghi-de");
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

/* ---------- 1. SKU_MASTER ---------- */
async function docSkuMaster() {
  const u = "https://docs.google.com/spreadsheets/d/" + SHEET_FACTORY + "/gviz/tq?tqx=out:csv&sheet=SKU_MASTER";
  const t = await (await fetch(u)).text();
  const rows = phanTichCsv(t);
  if (!rows.length || rows[0][0] !== "SKU") throw new Error("SKU_MASTER: header lạ (bẫy gviz trả tab đầu?): " + rows[0]?.slice(0, 3).join(","));
  return rows.slice(1).filter((r) => r.length >= 5);
}
function phanTichCsv(t) {
  const rows = []; let row = [], cur = "", inQ = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQ) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c; }
    else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur.replace(/\r$/, "")); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/* ---------- 2. Gom nhóm ---------- */
// Tên đã bỏ tiền tố Combo/Hủy — SKU combo vẫn là cùng cuộn vật lý với bản thường
const goc = (name) => name.normalize("NFC").trim().replace(/^hủy\s*-\s*/i, "").replace(/^\(combo\)\s*/i, "").trim();
const laChi = (name) => /^chỉ[\s/0-9]/iu.test(goc(name));

// Nhãn: dòng cụ thể trước, hãng chung sau (THESEUS/APUS/EROS là tên khách của chỉ mẫu, không phải nhãn)
const NHAN = [
  ["Irisa", /irisa/i], ["Lenio", /lenio|leni\b/i], ["Filtex", /filtex/i], ["Poris", /poris/i],
  ["Phong Việt", /phong việt|phong viet/i],
  ["Astra (Coats)", /astra/i], ["Epic (Coats)", /\bepic\b/i], ["Gramax (Coats)", /gramax/i],
  ["Seamsoft (Coats)", /seamsoft/i], ["Coats", /coats/i],
  ["Cometa", /cometa/i], ["Roman", /\broman\b/i], ["A&E", /a&e|perma\b|\bane\b|aneflex/i], ["Lishin", /lishin/i],
  ["CHI0001", /CHI0001/], ["CHI0006 (tơ D300)", /CHI0006/], ["CHI0007 (tơ nhún)", /CHI0007/],
  ["Toàn Thịnh", /toàn thịnh|toan thinh/i], ["Khai Trinh", /khai trinh/i],
];
function bocNhan(name) { const h = NHAN.find(([, re]) => re.test(name)); return h ? h[0] : "(không nhãn)"; }

// Cỡ chỉ: ưu tiên Tex ghi thẳng; rồi chi số Ne x/y; rồi denier D300
function bocCo(name) {
  let m = name.match(/te?xt?\s*[:\-]?\s*(\d{2,3})\b/i); if (m) return { co: "Tex " + m[1], tex: +m[1] };
  m = name.match(/(?<![\d.])([2-6]0)\s*[-\/]\s*([239])\b/); if (m) { const tex = Math.round((590.5 / +m[1]) * +m[2] * 10) / 10; return { co: "Ne " + m[1] + "/" + m[2], tex }; }
  m = name.match(/\bD(\d{3})\b/i); if (m) return { co: "D" + m[1], tex: Math.round((+m[1] / 9) * 10) / 10 };
  return { co: "?", tex: null };
}

// Quy cách: số mét cuộn ghi trong tên/UNIT ("Cuộn 5000m", "8000m", "3000n"); tránh ăn nhầm D300
function bocMet(name, unit) {
  for (const s of [unit || "", name]) {
    const m = s.normalize("NFC").match(/(?<![a-z0-9.])(\d{3,6})\s*[mn]\b/i);
    if (m && +m[1] >= 100) return +m[1];
  }
  return null;
}

/* ---------- 3. Vị trí từ stocklocation-out.json ---------- */
function docViTri() {
  const f = path.join(DIR, ".exports", "stocklocation-out.json");
  if (!fs.existsSync(f)) { log("⚠ Thiếu .exports/stocklocation-out.json — chạy `node sync-stocklocation.js --dry` trước. Vị trí sẽ bỏ trống."); return { map: new Map(), tuoi: null }; }
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  const tuoiGio = (Date.now() - (j.apiAt || 0)) / 36e5;
  if (tuoiGio > 24) log("⚠ stocklocation-out.json đã " + tuoiGio.toFixed(0) + " giờ tuổi — nên chạy lại --dry cho tươi.");
  const map = new Map();   // sku -> [{bin, kho, tong}]
  for (const tab of Object.values(j.tabs || {}))
    for (const r of tab) {
      const sku = String(r[0]), bin = String(r[3] || ""), kho = String(r[6] || ""), tong = +String(r[12] || 0).replace(/,/g, "") || 0;
      if (!bin) continue;
      if (!map.has(sku)) map.set(sku, []);
      map.get(sku).push({ bin, kho, tong });
    }
  return { map, tuoi: j.apiAt };
}

/* ---------- Chạy ---------- */
const skuRows = await docSkuMaster();
const { map: viTri } = docViTri();

const chiSkus = [];
for (const r of skuRows) {
  const [sku, nameRaw, , status, qtyRaw, unit] = r;
  if (!nameRaw || !laChi(nameRaw)) continue;
  const name = nameRaw.normalize("NFC");
  const { co, tex } = bocCo(name);
  chiSkus.push({ sku, name, status, qty: +String(qtyRaw).replace(/,/g, "") || 0, unit: unit || "", nhan: bocNhan(name), co, tex, met: bocMet(name, unit) });
}
log("SKU chỉ: " + chiSkus.length);

// nhóm nhãn+cỡ → quy cách phổ biến nhất để hứng các SKU "/mm" không ghi số mét
const metPhoBien = new Map();
for (const s of chiSkus) {
  if (!s.met) continue;
  const k = s.nhan + "|" + s.co;
  if (!metPhoBien.has(k)) metPhoBien.set(k, new Map());
  const m = metPhoBien.get(k); m.set(s.met, (m.get(s.met) || 0) + 1);
}
const metChinh = (k) => { const m = metPhoBien.get(k); if (!m) return null; return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]; };

const nhom = new Map();
for (const s of chiSkus) {
  const met = s.met || metChinh(s.nhan + "|" + s.co);
  const k = s.nhan + "|" + s.co + "|" + (met || "?");
  if (!nhom.has(k)) nhom.set(k, { nhan: s.nhan, co: s.co, tex: s.tex, met, skus: [] });
  nhom.get(k).skus.push(s);
}

// mỗi nhóm: đại diện = có bin thật (khác F0-A0) tồn lớn nhất → có bin → ACTIVE tồn lớn nhất
const dsRows = [];
for (const g of nhom.values()) {
  g.skus.sort((a, b) => b.qty - a.qty);
  let daiDien = null, bins = [];
  const ungVien = g.skus.flatMap((s) => {
    const b = (viTri.get(String(s.sku)) || []).slice().sort((x, y) => y.tong - x.tong);
    return b.length ? [{ s, b }] : [];
  });
  const binThat = ungVien.find((u) => u.b.some((x) => !/^F0-A0-00/.test(x.bin)));
  if (binThat) { daiDien = binThat.s; bins = binThat.b.filter((x) => !/^F0-A0-00/.test(x.bin)).slice(0, 2); }
  else if (ungVien.length) { daiDien = ungVien[0].s; bins = ungVien[0].b.slice(0, 2); }
  else daiDien = g.skus.find((s) => s.status === "ACTIVE" && s.qty > 0) || g.skus[0];
  const tongTon = g.skus.reduce((t, s) => t + s.qty, 0);
  const netLyThuyet = g.tex && g.met ? Math.round(g.tex * (g.met / 1000)) : "";
  // slug bỏ dấu tiếng Việt trước, kẻo "Toàn Thịnh" thành "TO-N-TH-NH"
  const boDau = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d");
  dsRows.push({
    maNhom: boDau(g.nhan.replace(/\s*\(.*?\)\s*/g, "") + "-" + g.co + "-" + (g.met ? g.met + "m" : "?"))
      .toUpperCase().replace(/[^A-Z0-9/&]+/g, "-").replace(/^-|-$/g, ""),
    nhan: g.nhan, co: g.co, met: g.met ? g.met + "m" : "?", soSku: g.skus.length,
    sku: daiDien.sku, ten: daiDien.name.slice(0, 90),
    viTri: bins.map((b) => b.bin + " @ " + b.kho.replace(/ - MTG$| - GARMENT$/, "") + " (" + b.tong + ")").join(" · ") || "KHÔNG THẤY BIN",
    net: netLyThuyet, tonNhom: tongTon, coBin: bins.length > 0,
    // ưu tiên CAO: nhóm đông SKU (≥10) và có bin thật trong kho — cân trước là phủ đa số phép quy đổi
    uuTien: bins.length > 0 && g.skus.length >= 10 ? "CAO" : "thấp",
  });
}
dsRows.sort((a, b) => (b.coBin - a.coBin) || (b.soSku - a.soSku));

log("Nhóm cần cân: " + dsRows.length + " (có bin: " + dsRows.filter((r) => r.coBin).length + ")");
for (const r of dsRows) log("  " + String(r.soSku).padStart(4) + " SKU  " + r.maNhom.padEnd(34) + " " + r.viTri.slice(0, 80));

if (DRY) { log("(DRY) Không ghi Sheet."); process.exit(0); }
if (!APPSCRIPT_KEY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

/* ---------- 4. Chống ghi đè số người đã nhập ---------- */
const uGviz = "https://docs.google.com/spreadsheets/d/" + SHEET_FACTORY + "/gviz/tq?tqx=out:csv&sheet=" + TAB;
const cu = phanTichCsv(await (await fetch(uGviz)).text());
// tab chưa tồn tại → gviz trả TAB ĐẦU TIÊN (bẫy quen) → header khác hẳn → coi như trống, ghi được
const dungTab = cu.length && cu[0][0] === "MÃ NHÓM";
if (dungTab) {
  const daNhap = cu.slice(1).filter((r) => [10, 11, 12, 13].some((i) => (r[i] || "").trim())).length;
  if (daNhap && !GHI_DE) {
    console.error("✗ Tab " + TAB + " đã có " + daNhap + " dòng NGƯỜI NHẬP SỐ CÂN — không ghi đè. Muốn làm lại từ đầu: --ghi-de.");
    process.exit(4);
  }
}

const HEADER = ["MÃ NHÓM", "ƯU TIÊN", "NHÃN", "CỠ CHỈ", "QUY CÁCH", "SỐ SKU DÙNG CHUNG",
  "SKU ĐẠI DIỆN", "TÊN HÀNG", "VỊ TRÍ (bin @ kho)", "CHỈ TÍNH TỪ TEX (g)",
  "CÂN LÕI RỖNG (g) ← NHẬP", "CÂN CẢ CUỘN NGUYÊN (g) ← NHẬP", "GHI CHÚ ← NHẬP", "NGÀY CÂN ← NHẬP"];
const rows = dsRows.map((r) => [r.maNhom, r.uuTien, r.nhan, r.co, r.met, r.soSku, "'" + r.sku, r.ten, r.viTri, r.net, "", "", "", ""]);

const j = await gasPost(JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, tab: TAB, sheetId: SHEET_FACTORY, header: HEADER, rows }), log, TAB);
if (j.status !== "success") { console.error("✗ Ghi " + TAB + " lỗi: " + (j.message || "?")); process.exit(2); }
log("✓ Đã ghi " + rows.length + " dòng vào tab " + TAB + ".");
log("  Mở: https://docs.google.com/spreadsheets/d/" + SHEET_FACTORY + "/edit  → tab " + TAB);
