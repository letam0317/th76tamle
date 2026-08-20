/**
 * ============================================================================
 *  THỐNG KÊ VỊ TRÍ 2 KHO NGUYÊN PHỤ LIỆU → 3 cột: Kho / Vị trí / Loại lưu trữ
 * ============================================================================
 *  YÊU CẦU: liệt kê các location đang có tồn ở "WH - MATERIAL - MTG" và
 *  "WH - MATERIAL - GARMENT", mỗi vị trí gắn nhãn:
 *    - "Nguyên liệu": vị trí chỉ chứa VẢI (và sợi — xem GHI CHÚ dưới)
 *    - "Phụ liệu"   : vị trí chứa mã KHÁC vải (nút, chỉ, thun, thẻ bài, nhãn,
 *                     dây kéo, keo dựng, decal, bao bì...)
 *    - "Nguyên liệu + Phụ liệu": vị trí trộn cả hai (báo thẳng, KHÔNG tự chọn
 *                     bên nào — để người đọc quyết định)
 *
 *  NGUỒN DỮ LIỆU: Sheet stocklocationfactory (tab "mastige" + "garment") do
 *  sync-stocklocation.js nạp từ API WMS stock-locations/bins/count/v3 mỗi sáng.
 *  Đọc qua gviz nên KHÔNG cần token WMS, không đá phiên đăng nhập của ai.
 *  Tab Metadata!B1 = mốc đồng bộ cuối → script in ra để biết dữ liệu tươi hay cũ.
 *
 *  VÌ SAO PHÂN LOẠI THEO TÊN SẢN PHẨM, KHÔNG THEO CategoryName:
 *  CategoryName của WMS bị khai sai rải rác — có "Vải Chính" nằm trong "Thời Trang
 *  (Phụ Liệu)", "Chỉ Lenio" nằm trong "Thời Trang (NVL)", vải gia công nằm trong
 *  "Nguyên liệu nhận Gia công" và cả "Khác". Tên sản phẩm (ProductName) mở đầu
 *  bằng loại hàng thật ("Vải ...", "Chỉ ...", "Nút ...") nên bám vào đó chắc hơn.
 *
 *  GHI CHÚ SỢI: mã sợi ("Sợi 40'S", "40's", "30's") được tính là Nguyên liệu vì
 *  nó là nguyên liệu dệt, dù đề bài chỉ nói "vải". Số lượng rất nhỏ (1 vị trí
 *  thuần sợi) — muốn đổi thì sửa laSoi() bên dưới.
 *
 *  Chạy:  node thongke-location-material.mjs
 *         → in bảng tổng hợp + ghi .exports/location-material.csv (mở bằng Excel)
 *
 *         node thongke-location-material.mjs --push
 *         → ghi thêm 3 cột đó sang tab "Vị trí 2 kho MATERIAL" của file
 *           "Triển khai quản lý Location ở kho tổng" (biến PUSH bên dưới).
 *           Ghi qua Apps Script vì file đó do người khác làm chủ nhưng tài khoản
 *           chạy GAS có quyền sửa; GAS tự tạo tab nếu chưa có, ghi lại thì XOÁ
 *           SẠCH tab đó rồi ghi mới — KHÔNG chạm các tab khác trong file.
 * ============================================================================
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { gasPost } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PUSH = process.argv.includes("--push");
const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
/** File đích + tab đích khi chạy --push (tab riêng, không đụng "Tiêu chuẩn quầy kệ _FACTORY") */
const DICH = { sheetId: "10Zj9LwGOnkC3UbVCex0xoKZcc0tIWWoMK4vUsuye-sc", tab: "Vị trí 2 kho MATERIAL" };
const SHEET = process.env.STOCKLOC_SHEET_ID || "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const TAB = ["mastige", "garment"];
const KHO = ["WH - MATERIAL - MTG", "WH - MATERIAL - GARMENT"];

const chuan = (s) => String(s || "").replace(/\s+/g, " ").trim().toUpperCase();
const GIU = new Set(KHO.map(chuan));

async function gviz(tab) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tab)}`;
  const t = await (await fetch(url)).text();
  const m = t.match(/setResponse\(([\s\S]*)\);?\s*$/);
  if (!m) throw new Error(`Không đọc được tab "${tab}" (Sheet đổi quyền chia sẻ?): ${t.slice(0, 160)}`);
  const j = JSON.parse(m[1]);
  const cols = j.table.cols.map((c) => c.label || c.id);
  return j.table.rows.map((r) => Object.fromEntries(cols.map((c, i) => [c, r.c[i] ? r.c[i].v : null])));
}

/* --- Phân loại 1 mã theo TÊN SẢN PHẨM (đoạn trước dấu "/" là loại hàng) --- */
const laVai = (ten) => /^(vải|vai)\b/i.test(String(ten || "").trim());
const laSoi = (ten) => /^(sợi|soi)\b/i.test(String(ten || "").trim()) || /^\d{2}'?s\b/i.test(String(ten || "").trim());
/** Vị trí ảo "chưa lên kệ"/điều chỉnh — không phải ô kệ thật */
const laAo = (loc) => /^F0-(A0|AJ)-/i.test(String(loc || "").trim());

const csvO = (v) => {
  const s = String(v ?? "");
  return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

(async () => {
  const tho = (await Promise.all(TAB.map(gviz))).flat();
  const rows = tho.filter((r) => GIU.has(chuan(r.Warehouse)));
  if (!rows.length) throw new Error("0 dòng thuộc 2 kho MATERIAL — kiểm tra lại tab nguồn / tên kho.");

  // Gom theo (kho, vị trí)
  const map = new Map();
  for (const r of rows) {
    const key = chuan(r.Warehouse) + "§" + String(r.LocationDescription || "").trim();
    if (!map.has(key)) map.set(key, { kho: String(r.Warehouse).trim(), loc: String(r.LocationDescription || "").trim(), vai: 0, soi: 0, khac: 0, sku: new Set(), loai: new Set() });
    const o = map.get(key);
    const ten = String(r.ProductName || "").split("/")[0].trim();
    if (laVai(ten)) o.vai++; else if (laSoi(ten)) o.soi++; else o.khac++;
    o.sku.add(r.SKU);
    o.loai.add(ten);
  }

  const nhan = (o) => {
    const nl = o.vai + o.soi > 0, pl = o.khac > 0;
    return nl && pl ? "Nguyên liệu + Phụ liệu" : nl ? "Nguyên liệu" : "Phụ liệu";
  };
  const ds = [...map.values()].map((o) => ({ ...o, type: nhan(o) }))
    .sort((a, b) => a.kho.localeCompare(b.kho) || a.loc.localeCompare(b.loc, "vi", { numeric: true }));

  // --- CSV 3 cột (BOM để Excel không vỡ tiếng Việt) ---
  const head = ["Stock Name", "Location", "Type Storage"];
  const bang = ds.map((o) => [o.kho, o.loc, o.type]);
  const csv = "﻿" + [head, ...bang].map((r) => r.map(csvO).join(",")).join("\r\n") + "\r\n";
  fs.mkdirSync(path.join(DIR, ".exports"), { recursive: true });
  const out = path.join(DIR, ".exports", "location-material.csv");
  fs.writeFileSync(out, csv);

  // --- Bảng tóm tắt ra màn hình ---
  const dem = (kho, type) => ds.filter((o) => (!kho || o.kho === kho) && (!type || o.type === type)).length;
  console.log("\nNGUỒN: Sheet stocklocationfactory (tab mastige + garment) — " + rows.length + " dòng tồn thuộc 2 kho MATERIAL.");
  console.log("TỔNG: " + ds.length + " vị trí có tồn.\n");
  console.log("Kho".padEnd(26) + "Vị trí".padStart(8) + "Nguyên liệu".padStart(14) + "Phụ liệu".padStart(12) + "Trộn cả 2".padStart(12));
  for (const k of KHO) console.log(k.padEnd(26) + String(dem(k)).padStart(8) + String(dem(k, "Nguyên liệu")).padStart(14) + String(dem(k, "Phụ liệu")).padStart(12) + String(dem(k, "Nguyên liệu + Phụ liệu")).padStart(12));
  console.log("TỔNG".padEnd(26) + String(ds.length).padStart(8) + String(dem(null, "Nguyên liệu")).padStart(14) + String(dem(null, "Phụ liệu")).padStart(12) + String(dem(null, "Nguyên liệu + Phụ liệu")).padStart(12));

  const tron = ds.filter((o) => o.type === "Nguyên liệu + Phụ liệu");
  if (tron.length) {
    console.log("\n" + tron.length + " vị trí TRỘN cả hai (cần người xác nhận xếp về đâu):");
    for (const o of tron) console.log("  " + o.kho.replace("WH - MATERIAL - ", "") + " | " + o.loc + "  → vải/sợi " + (o.vai + o.soi) + " mã, khác " + o.khac + " mã: " + [...o.loai].slice(0, 5).join(" ; "));
  }
  const ao = ds.filter((o) => laAo(o.loc));
  if (ao.length) console.log("\n" + ao.length + " vị trí ẢO (chưa lên kệ / điều chỉnh, không phải ô kệ): " + ao.map((o) => o.loc).join(", "));

  // --- Đẩy sang Sheet đích (tab riêng) khi có --push ---
  if (PUSH) {
    if (!APPSCRIPT_KEY) throw new Error("Thiếu APPSCRIPT_KEY trong .env — không ghi Sheet được.");
    const body = JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, sheetId: DICH.sheetId, tab: DICH.tab, header: head, rows: bang, apiAt: Date.now() });
    const j = await gasPost(body, console.log, DICH.tab);
    if (j.status !== "success") throw new Error("Apps Script từ chối ghi: " + (j.message || "?"));
    console.log("\n✓ Đã ghi " + j.written + " dòng sang tab \"" + DICH.tab + "\" (lúc " + j.at + ").");
    console.log("  File: https://docs.google.com/spreadsheets/d/" + DICH.sheetId + "/edit");
  }

  // Mốc đồng bộ để biết dữ liệu tươi hay cũ
  try {
    const t = await (await fetch(`https://docs.google.com/spreadsheets/d/${SHEET}/gviz/tq?tqx=out:json&sheet=Metadata`)).text();
    const c = JSON.parse(t.match(/setResponse\(([\s\S]*)\);?\s*$/)[1]).table.rows[0]?.c;
    if (c?.[0]) console.log("\nMốc đồng bộ WMS cuối: " + (c[0].f || c[0].v));
  } catch { /* mốc chỉ để tham khảo */ }
  console.log("→ CSV 3 cột: " + out + "\n");
})().catch((e) => { console.error("✗ " + e.message); process.exit(2); });
