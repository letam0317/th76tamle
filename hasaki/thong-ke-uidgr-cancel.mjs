/**
 * thong-ke-uidgr-cancel.mjs — CHỈ ĐỌC (GET): thống kê Group UID (UIDgr code) đã CANCELED của các SKU
 * vải đang có UID In-BIN ngoài bãi chờ F0-A0 mà không có UIDgr code (mục "Tồn tại vị trí").
 *
 *  Vì sao phải đi vòng: lọc `sku_or_barcodes` trên /wms/group-uid-infos chỉ khớp group CÒN UID
 *  (SKU suy từ UID gắn trong) → group Canceled (rỗng) không bao giờ hiện. Đo 28/08/2026:
 *  `processing_source_code=<PO>` (SỐ ÍT) lọc được mọi group của PO bất kể trạng thái.
 *
 *  Đường đi (mỗi lượt chạy ≈ số SKU + 2 × số PO lượt GET, một lần, không có lịch):
 *   ① SKU → report-inventories?skus= → UID (mọi trạng thái) → PO + batch_number + cân + group_uid
 *   ② PO  → group-uid-infos?processing_source_code= (mọi trạng thái) + inbound-packing-lists (cuộn/kg)
 *   ③ Quy group về SKU: products[].sku (group còn UID) → batch_code ∈ batch của UID SKU → roll_code
 *      khớp packing list rồi so TÊN HÀNG chuẩn hoá (packing list dùng SKU đơn vị kg/(Combo), UID dùng SKU gam)
 *   ④ Group Canceled → tìm UID cùng SKU, group=0, còn In-BIN có cân khớp packing list (±2 g)
 *
 *  Dùng:
 *   node thong-ke-uidgr-cancel.mjs                         # SKU = toàn bộ tab ton-vitri (sheet factory)
 *   node thong-ke-uidgr-cancel.mjs --sku=422304497,422286351
 *   node thong-ke-uidgr-cancel.mjs --sheet="UIDgr Canceled 28-08" --public   # xuất Google Sheet MỚI
 *   node thong-ke-uidgr-cancel.mjs --sheet-id=<id>                          # ghi lại vào sheet đã có
 *   node thong-ke-uidgr-cancel.mjs --tu-json --sheet-id=<id>                # chỉ ghi lại Sheet từ JSON lần trước (0 lượt WMS)
 *   Kết quả luôn ghi .exports/uidgr-cancel-*.csv + .exports/uidgr-cancel.json
 *   Cột mã (Group UID Code, PO, SKU, lô, cuộn) lên Sheet dạng CHỮ — tránh "1,02825E+15" (sửa 28/08 chiều).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { layTokenSongWms, gasPost } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, ".exports");
const JSON_FILE = path.join(OUT, "uidgr-cancel.json");
const GW = "https://wms-gw.inshasaki.com/api/v1";
const CTY = "1002,1005";                 // Mastige + Garment (2 kho nguyên liệu 1177 + 1339)
const WH = "1177,1339";
const SHEET_FACTORY = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const TVT_TAB = "ton-vitri";
const BAI_CHO = "F0-A0";
const BO_QUA_VT = /^F0-(A0|AJ|KHO-HM)/i;   // cùng luật miễn trừ với mục "Tồn tại vị trí" (ton-vitri.mjs VT_BO_QUA)
const DOT_TU = process.env.UIDGR_DOT_TU || "2026-08-24";   // mốc đầu đợt api@hasaki.vn huỷ hàng loạt (đo 28/08/2026: 24→28/08, đỉnh 27/08 14:36–14:45)
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const TT = { 1: "New", 2: "Available", 3: "Editing", 4: "Picklisted", 5: "Processing", 6: "Transferred", 7: "Closed", 8: "Blocked", 9: "Canceled" };

const arg = (k) => { const m = process.argv.find((a) => a.startsWith("--" + k + "=")); return m ? m.slice(k.length + 3) : ""; };
const co = (k) => process.argv.includes("--" + k);
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const n0 = (v) => Number(v) || 0;
const tenChuan = (s) => String(s || "").replace(/^\(combo\)\s*/i, "").replace(/\/(kg|g|gram|gr)\s*$/i, "").replace(/\s+/g, " ").trim().toLowerCase();
const taiKhoan = (s) => String(s || "").split("@")[0];   // không đẩy email đầy đủ lên sheet public

/* ---------- ① danh sách SKU: tab ton-vitri (gviz public, 0 lượt WMS) ∪ --sku ---------- */
function parseCsv(t) {
  const out = []; let row = [], c = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === ",") { row.push(c); c = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; row.push(c); out.push(row); row = []; c = ""; }
    else c += ch;
  }
  if (c.length || row.length) { row.push(c); out.push(row); }
  return out.filter((r) => r.length > 1 || (r[0] || "").trim());
}
async function docTonViTri() {
  const u = `https://docs.google.com/spreadsheets/d/${SHEET_FACTORY}/gviz/tq?tqx=out:csv&sheet=${TVT_TAB}`;
  const r = await fetch(u, { signal: AbortSignal.timeout(45000) });
  if (!r.ok) throw new Error("gviz " + TVT_TAB + " HTTP " + r.status);
  const rows = parseCsv(await r.text());
  const H = rows[0].map((h) => h.trim());
  const ix = (name) => H.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const I = { cty: ix("Company"), wh: ix("Warehouse Name"), loc: ix("Location"), uid: ix("UID"), sku: ix("SKU"), ten: ix("Product Name"), qty: ix("Qty"), st: ix("Status"), grp: ix("Group UID"), at: ix("Updated At") };
  if (I.sku < 0 || I.uid < 0) throw new Error("tab " + TVT_TAB + " thiếu cột SKU/UID: " + H.join("|"));
  return rows.slice(1).map((r) => ({ cty: r[I.cty], wh: r[I.wh], loc: r[I.loc], uid: r[I.uid], sku: String(r[I.sku] || "").trim(), ten: r[I.ten], qty: n0(r[I.qty]), st: r[I.st], grp: r[I.grp], at: r[I.at] }))
    .filter((r) => r.sku);
}

/* ---------- WMS ---------- */
let token = null;
async function goi(pathq, lan = 3) {
  for (let i = 0; i < lan; i++) {
    try {
      const r = await fetch(GW + pathq, { signal: AbortSignal.timeout(60000), headers: { authorization: token, "company-ids": CTY, "user-agent-type": "web", origin: "https://wms.inshasaki.com", referer: "https://wms.inshasaki.com/" } });
      const t = await r.text();
      if (r.status === 401) throw new Error("401 token chết");
      if (!r.ok) { if (i < lan - 1) { await new Promise((z) => setTimeout(z, 2000 * (i + 1))); continue; } throw new Error("HTTP " + r.status + " " + t.slice(0, 120)); }
      return JSON.parse(t);
    } catch (e) { if (i === lan - 1 || /401/.test(String(e))) throw e; await new Promise((z) => setTimeout(z, 2000 * (i + 1))); }
  }
}
let soGoi = 0;
async function keoHet(base, size) {
  const all = [];
  for (let page = 1; page <= 40; page++) {
    soGoi++;
    const j = await goi(base + `&page=${page}&size=${size}`);
    const recs = j.records || [];
    all.push(...recs);
    if (!recs.length || all.length >= n0(j.count) || recs.length < size) break;
  }
  return all;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const tvt = await docTonViTri();
  log(`tab ${TVT_TAB}: ${tvt.length} dòng · ${new Set(tvt.map((r) => r.sku)).size} SKU`);
  const skuTay = arg("sku").split(",").map((s) => s.trim()).filter(Boolean);
  const skus = skuTay.length ? skuTay : [...new Set(tvt.map((r) => r.sku))];
  const tvtTheoSku = new Map(); for (const r of tvt) { if (!tvtTheoSku.has(r.sku)) tvtTheoSku.set(r.sku, []); tvtTheoSku.get(r.sku).push(r); }

  token = await layTokenSongWms(DIR, (s) => log(s));
  if (!token) { log("✗ Không có token WMS sống — mở WMS trên Edge (bridge) rồi chạy lại."); process.exit(75); }

  /* ① UID tồn theo SKU */
  const invTheoSku = new Map();
  for (const sku of skus) {
    const recs = await keoHet(`/wms/report-management/report-inventories?warehouse_ids=${WH}&skus=${sku}`, 1000);
    invTheoSku.set(sku, recs.filter((r) => String(r.sku) === sku));
    log(`  SKU ${sku}: ${invTheoSku.get(sku).length} UID trên tồn · PO: ${[...new Set(recs.map((r) => r.purchase_order_number).filter(Boolean))].join(", ") || "(không)"}`);
  }
  const poSet = new Set(); for (const recs of invTheoSku.values()) for (const r of recs) if (r.purchase_order_number) poSet.add(String(r.purchase_order_number));

  /* ② group + packing list theo PO (bối cảnh New/Available/Blocked + kg từng cuộn) */
  const groupTheoPo = new Map(), plTheoPo = new Map();
  for (const po of poSet) {
    const gs = await keoHet(`/wms/group-uid-infos?processing_source_code=${po}`, 500);
    const pl = await keoHet(`/wms/inbound-packing-lists?purchase_order_numbers=${po}`, 500);
    groupTheoPo.set(po, gs); plTheoPo.set(po, pl);
    const dem = {}; for (const g of gs) dem[TT[g.status_id] || g.status_name] = (dem[TT[g.status_id] || g.status_name] || 0) + 1;
    log(`  PO ${po}: ${gs.length} group ${JSON.stringify(dem)} · packing list ${pl.length} cuộn`);
  }
  const plTheoRoll = new Map(); for (const [po, pl] of plTheoPo) for (const r of pl) plTheoRoll.set(po + "|" + String(r.code || "").trim().toUpperCase(), r);
  /* ②b TOÀN BỘ group Canceled của 2 kho (≈4 trang) — group tạo bằng app KHÔNG có processing_source_code
   *     nên đường theo PO bỏ sót; quy về SKU bằng lô / PO / vị trí bin bên dưới. */
  const cancelToanKho = await keoHet(`/wms/group-uid-infos?warehouse_ids=${WH}&status_ids=9`, 500);
  log(`  Canceled toàn 2 kho: ${cancelToanKho.length} group`);

  /* ③ quy group về SKU */
  const KHU_CHUNG = /^F0-(A0|AJ|VR|TF|NG|BAIXE|CAT|KHO-HM)/i;   // khu nhiều SKU dùng chung → không quy theo vị trí
  const tenTheoSku = new Map(); for (const [sku, recs] of invTheoSku) tenTheoSku.set(sku, tenChuan((recs[0] || {}).product_name || (tvtTheoSku.get(sku) || [{}])[0].ten));
  const batchTheoSku = new Map(); for (const [sku, recs] of invTheoSku) batchTheoSku.set(sku, new Set(recs.map((r) => String(r.batch_number || "").trim().toUpperCase()).filter(Boolean)));
  const poTheoSku = new Map(); for (const [sku, recs] of invTheoSku) poTheoSku.set(sku, new Set(recs.map((r) => String(r.purchase_order_number || "")).filter(Boolean)));
  const skuTheoBin = new Map();   // bin F0-KHO-* → Set SKU đích đang có UID In-BIN ở đó
  for (const [sku, recs] of invTheoSku) for (const r of recs) { const l = String(r.location_description || ""); if (!/in-bin/i.test(r.status_name || "") || KHU_CHUNG.test(l)) continue; if (!skuTheoBin.has(l)) skuTheoBin.set(l, new Set()); skuTheoBin.get(l).add(sku); }
  const timPl = (g) => {
    const po = String(g.processing_source_code || ""); const roll = String(g.roll_code || "").trim().toUpperCase(); const batch = String(g.batch_code || "").trim().toUpperCase();
    if (!roll) return null;
    return plTheoRoll.get(po + "|" + roll) || plTheoRoll.get(po + "|" + batch + "-" + roll) || plTheoRoll.get(po + "|" + batch + "-" + roll.replace(/^.*-/, "")) || null;
  };
  const quyVe = (g) => {
    const p = (g.products || [])[0]; if (p && skus.includes(String(p.sku))) return { sku: String(p.sku), cach: "UID trong group" };
    const batch = String(g.batch_code || "").trim().toUpperCase();
    if (batch) { const ung = skus.filter((s) => batchTheoSku.get(s).has(batch)); if (ung.length === 1) return { sku: ung[0], cach: "lô khớp batch_number UID" }; }
    const pl = timPl(g);
    if (pl) { const t = tenChuan(pl.product_name); const ung = skus.filter((s) => tenTheoSku.get(s) === t); if (ung.length === 1) return { sku: ung[0], cach: "cuộn packing list · tên hàng" }; }
    const po = String(g.processing_source_code || "");
    if (po) { const ung = skus.filter((s) => poTheoSku.get(s).has(po)); if (ung.length === 1) return { sku: ung[0], cach: "PO chỉ có 1 SKU đích" }; }
    const l = String(g.location_description || ""); const oBin = skuTheoBin.get(l);
    if (oBin && oBin.size === 1) return { sku: [...oBin][0], cach: "cùng bin với UID của SKU" };
    return null;
  };
  const dongGroup = (g, q) => {
    const pl = timPl(g);
    // packing list ghi theo ĐƠN VỊ của SKU trên PL: tên đuôi "/kg" → kg, đuôi "/g" → gam (PO 10012507058624 ghi 17.460 g/cuộn) → quy hết về kg
    const dv = pl ? (/\/kg\s*$/i.test(pl.product_name || "") ? "kg" : /\/(g|gram|gr)\s*$/i.test(pl.product_name || "") ? "g" : "") : "";
    const kg = (v) => (dv === "g" ? n0(v) / 1000 : n0(v));
    return { po: String(g.processing_source_code || ""), sku: q ? q.sku : "", cach: q ? q.cach : "", code: String(g.group_uid_code), status: TT[g.status_id] || g.status_name, status_id: g.status_id,
      batch: g.batch_code || "", roll: g.roll_code || "", kgPL: pl ? +kg(pl.quantity_received).toFixed(3) : null, kgDat: pl ? +kg(pl.quantity).toFixed(3) : null, plDonVi: dv, plSku: pl ? String(pl.sku) : "", plTen: pl ? pl.product_name : "",
      loc: g.location_description || "", wh: g.warehouse_name || "", uidTrong: n0(g.uid_quantity), tao: g.created_at, taoBoi: taiKhoan(g.created_by_name), sua: g.updated_at, suaBoi: taiKhoan(g.updated_by_name), loai: g.group_uid_type_name };
  };

  const chiTiet = [];   // mọi group quy về được SKU (mọi trạng thái) — để tính Canceled + bối cảnh
  const khongQuy = [];
  const daCo = new Set();
  for (const gs of groupTheoPo.values()) for (const g of gs) {
    const q = quyVe(g); const row = dongGroup(g, q); daCo.add(row.code);
    if (q) chiTiet.push(row); else khongQuy.push(row);
  }
  let themTuToanKho = 0;
  for (const g of cancelToanKho) {   // group Canceled không thuộc PO nào của SKU đích (tạo bằng app / PO khác) nhưng quy được về SKU
    if (daCo.has(String(g.group_uid_code))) continue;
    const q = quyVe(g); if (!q) continue;
    chiTiet.push(dongGroup(g, q)); themTuToanKho++;
  }
  log(`  quy về SKU: ${chiTiet.length} group (thêm ${themTuToanKho} group Canceled ngoài đường PO) · không quy được: ${khongQuy.length}`);

  /* ④ Canceled ↔ UID In-BIN group=0 khớp cân */
  const daDung = new Set();
  const cancel = chiTiet.filter((r) => r.status_id === 9).sort((a, b) => a.sku.localeCompare(b.sku) || a.batch.localeCompare(b.batch) || a.roll.localeCompare(b.roll));
  for (const r of cancel) {
    r.uidKhop = ""; r.uidKhopKieu = ""; r.uidLoc = "";
    if (r.kgPL == null) continue;
    const g = Math.round(r.kgPL * 1000);
    const ung = (invTheoSku.get(r.sku) || []).filter((u) => !n0(u.group_uid) && /in-bin/i.test(u.status_name || "") && Math.abs(n0(u.qty) - g) <= 2 && !daDung.has(u.uid));
    const cungBatch = ung.filter((u) => String(u.batch_number || "").trim().toUpperCase() === r.batch.trim().toUpperCase());
    const chon = cungBatch.length ? cungBatch : ung;
    if (chon.length === 1) { r.uidKhop = chon[0].uid; r.uidKhopKieu = (cungBatch.length ? "cùng lô + " : "") + "khớp cân duy nhất"; r.uidLoc = chon[0].location_description; daDung.add(chon[0].uid); }
    else if (chon.length > 1) { r.uidKhop = chon.map((u) => u.uid).join(" / "); r.uidKhopKieu = chon.length + " UID trùng cân"; r.uidLoc = [...new Set(chon.map((u) => u.location_description))].join(" / "); }
  }

  /* ⑤ tổng hợp theo SKU */
  const tong = [];
  for (const sku of skus) {
    const inv = invTheoSku.get(sku) || []; const tv = tvtTheoSku.get(sku) || [];
    const gsSku = chiTiet.filter((r) => r.sku === sku); const cs = gsSku.filter((r) => r.status_id === 9);
    const dem = (st) => gsSku.filter((r) => r.status_id === st).length;
    const uidKG = inv.filter((u) => !n0(u.group_uid) && /in-bin/i.test(u.status_name || "") && !BO_QUA_VT.test(String(u.location_description || "")));
    const uidBaiCho = inv.filter((u) => !n0(u.group_uid) && /in-bin/i.test(u.status_name || "") && String(u.location_description || "").startsWith(BAI_CHO));
    const uidCoGr = inv.filter((u) => n0(u.group_uid) && /in-bin/i.test(u.status_name || ""));
    const coBatch = uidKG.filter((u) => String(u.batch_number || "").trim());
    const ngay = cs.map((r) => String(r.sua || "").slice(0, 10)).filter(Boolean).sort();
    tong.push({
      sku, ten: (inv[0] || {}).product_name || (tv[0] || {}).ten || "", wh: [...new Set(inv.map((u) => u.warehouse_name))].join(" / "),
      po: [...new Set(inv.map((u) => u.purchase_order_number).filter(Boolean))].join(", "),
      uidTon: inv.length, uidCoGr: uidCoGr.length, uidBaiCho: uidBaiCho.length, uidKhac: inv.length - uidCoGr.length - uidBaiCho.length - uidKG.length,
      uidKhongGr: uidKG.length, uidKhongGrKg: +(uidKG.reduce((s, u) => s + n0(u.qty), 0) / 1000).toFixed(2), uidCoBatch: coBatch.length,
      viTri: [...new Set(uidKG.map((u) => u.location_description))].sort().join(", "),
      grCancel: cs.length, loCancel: new Set(cs.map((r) => r.batch).filter(Boolean)).size, cuonCancel: new Set(cs.map((r) => r.roll).filter(Boolean)).size,
      grCancelDot: cs.filter((r) => r.suaBoi === "api" && String(r.sua) >= DOT_TU).length,   // đợt api@ huỷ hàng loạt 24–28/08/2026
      grCancelCu: cs.filter((r) => !(r.suaBoi === "api" && String(r.sua) >= DOT_TU)).length,
      binCancel: [...new Set(cs.map((r) => r.loc).filter(Boolean))].sort().join(", "),
      kgCancel: +cs.reduce((s, r) => s + n0(r.kgPL), 0).toFixed(2), cuonCoKg: cs.filter((r) => r.kgPL != null).length,
      cuonKhopUid: cs.filter((r) => /duy nhất/.test(r.uidKhopKieu)).length,
      ngayCancel: ngay.length ? (ngay[0] === ngay[ngay.length - 1] ? ngay[0] : ngay[0] + " → " + ngay[ngay.length - 1]) : "",
      nguoiCancel: [...new Set(cs.map((r) => r.suaBoi).filter(Boolean))].join(", "),
      grNew: dem(1), grAvailable: dem(2), grBlocked: dem(8), grKhac: gsSku.length - cs.length - dem(1) - dem(2) - dem(8), grTong: gsSku.length,
    });
  }
  tong.sort((a, b) => b.grCancel - a.grCancel || b.uidKhongGr - a.uidKhongGr);

  /* ---------- in màn hình ---------- */
  console.log("\n=== TỔNG HỢP theo SKU (Group UID Canceled · UID In-BIN ngoài F0-A0 chưa có group) ===");
  console.log("SKU        | Gr Canceled | Lô | Cuộn | kg PL   | UID ko gr | kg      | New/Avail/Block | Ngày huỷ                | Người huỷ");
  for (const t of tong) console.log(`${t.sku} | ${String(t.grCancel).padStart(11)} | ${String(t.loCancel).padStart(2)} | ${String(t.cuonCancel).padStart(4)} | ${String(t.kgCancel).padStart(7)} | ${String(t.uidKhongGr).padStart(9)} | ${String(t.uidKhongGrKg).padStart(7)} | ${String(t.grNew + "/" + t.grAvailable + "/" + t.grBlocked).padStart(15)} | ${t.ngayCancel.padEnd(23)} | ${t.nguoiCancel}`);
  const khongQuyCancel = khongQuy.filter((r) => r.status_id === 9);
  console.log(`\nTổng: ${tong.reduce((s, t) => s + t.grCancel, 0)} group Canceled · ${cancel.filter((r) => r.uidKhop).length} có UID khớp cân · ${khongQuy.length} group của các PO không quy được về SKU đích (${khongQuyCancel.length} Canceled) · ${soGoi} lượt GET WMS`);

  /* ---------- CSV + JSON ---------- */
  const H_TONG = ["SKU", "Tên hàng", "Kho", "PO", "UID trên tồn", "UID In-BIN có group", "UID In-BIN ở F0-A0 chưa group", "UID In-BIN ngoài F0-A0 chưa có group", "kg (UID chưa group)", "UID còn batch_number (từng vào group)", "UID trạng thái khác", "Vị trí", "Group Canceled", "— trong đó đợt api từ " + DOT_TU, "— huỷ trước đó (tay)", "Bin của group Canceled", "Số lô (batch)", "Số cuộn (roll)", "kg theo packing list", "Cuộn có kg PL", "Cuộn khớp UID duy nhất", "Ngày huỷ", "Người huỷ", "Group New", "Group Available", "Group Blocked", "Group khác", "Tổng group của SKU"];
  const R_TONG = tong.map((t) => [t.sku, t.ten, t.wh, t.po, t.uidTon, t.uidCoGr, t.uidBaiCho, t.uidKhongGr, t.uidKhongGrKg, t.uidCoBatch, t.uidKhac, t.viTri, t.grCancel, t.grCancelDot, t.grCancelCu, t.binCancel, t.loCancel, t.cuonCancel, t.kgCancel, t.cuonCoKg, t.cuonKhopUid, t.ngayCancel, t.nguoiCancel, t.grNew, t.grAvailable, t.grBlocked, t.grKhac, t.grTong]);
  const H_CANCEL = ["SKU", "Group UID Code", "Batch (lô)", "Roll (cuộn)", "kg nhận (PL)", "kg đặt (PL)", "SKU packing list", "PO", "Kho", "Vị trí group", "Ngày huỷ", "Người huỷ", "Ngày tạo", "Người tạo", "Cách quy về SKU", "UID khớp cân (In-BIN, chưa group)", "Kiểu khớp", "Vị trí UID"];
  const R_CANCEL = cancel.map((r) => [r.sku, r.code, r.batch, r.roll, r.kgPL ?? "", r.kgDat ?? "", r.plSku, r.po, r.wh, r.loc, r.sua, r.suaBoi, r.tao, r.taoBoi, r.cach, r.uidKhop, r.uidKhopKieu, r.uidLoc]);
  const H_UID = ["SKU", "UID", "Qty (g)", "Batch number", "Trạng thái", "Vị trí", "Kho", "PO", "Cập nhật", "Khớp group Canceled"];
  const khopNguoc = new Map(); for (const r of cancel) if (r.uidKhop && !/trùng/.test(r.uidKhopKieu)) khopNguoc.set(r.uidKhop, r.code);
  const R_UID = [];
  for (const sku of skus) for (const u of (invTheoSku.get(sku) || [])) if (!n0(u.group_uid) && /in-bin/i.test(u.status_name || "") && !BO_QUA_VT.test(String(u.location_description || "")))
    R_UID.push([sku, u.uid, n0(u.qty), u.batch_number || "", u.status_name, u.location_description, u.warehouse_name, u.purchase_order_number || "", u.updated_at, khopNguoc.get(u.uid) || ""]);
  const H_KQ = ["PO", "Group UID Code", "Trạng thái", "Batch", "Roll", "kg nhận (PL)", "SKU packing list", "Tên hàng packing list", "Vị trí", "Ngày sửa", "Người sửa"];
  const R_KQ = khongQuyCancel.map((r) => [r.po, r.code, r.status, r.batch, r.roll, r.kgPL ?? "", r.plSku, r.plTen, r.loc, r.sua, r.suaBoi]);

  const csv = (H, R) => [H, ...R].map((r) => r.map((v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(",")).join("\r\n");
  fs.writeFileSync(path.join(OUT, "uidgr-cancel-tong-hop.csv"), "\ufeff" + csv(H_TONG, R_TONG));
  fs.writeFileSync(path.join(OUT, "uidgr-cancel-chi-tiet.csv"), "\ufeff" + csv(H_CANCEL, R_CANCEL));
  fs.writeFileSync(path.join(OUT, "uidgr-cancel-uid-chua-group.csv"), "\ufeff" + csv(H_UID, R_UID));
  const bang = [["TONG-HOP-SKU", H_TONG, R_TONG], ["UIDGR-CANCELED", H_CANCEL, R_CANCEL], ["UID-CHUA-GROUP", H_UID, R_UID], ["GROUP-KHONG-QUY", H_KQ, R_KQ]];
  fs.writeFileSync(JSON_FILE, JSON.stringify({ at: new Date().toISOString(), skus, tong, cancel, khongQuy, soGoi, bang }, null, 1));
  log("đã ghi .exports/uidgr-cancel-*.csv + uidgr-cancel.json");
  await ghiSheet(bang);
}

/* ---------- Google Sheet: tạo mới (--sheet="Tên" [--public]) hoặc ghi lại vào sheet đã có (--sheet-id=<id>) ----------
 * Cột MÃ (Group UID Code 16 chữ số, PO, SKU, lô, cuộn…) phải ghi dạng CHỮ: Sheets coi 1028260520000007 là số → hiện
 * "1,02825E+15" và làm tròn mất chữ số cuối (chỉ giữ 15 chữ số có nghĩa). GAS ghi bằng setValues nên chèn dấu nháy đơn
 * đầu chuỗi (như gõ tay) → ô lưu là text, không hiện dấu nháy. CSV cục bộ KHÔNG chèn nháy. */
const COT_CHU = new Set(["SKU", "Group UID Code", "PO", "Batch (lô)", "Roll (cuộn)", "SKU packing list", "Khớp group Canceled", "Batch number", "Batch", "Roll", "UID", "UID khớp cân (In-BIN, chưa group)"]);
const chuHoa = (header, rows) => {
  const ix = header.map((h, i) => (COT_CHU.has(h) ? i : -1)).filter((i) => i >= 0);
  return rows.map((r) => { const o = r.slice(); for (const i of ix) { const v = o[i]; if (v !== "" && v != null && /^\d/.test(String(v))) o[i] = "'" + String(v); } return o; });
};
async function ghiSheet(bang) {
  const tenSheet = arg("sheet"); let sheetId = arg("sheet-id");
  if (!tenSheet && !sheetId) return;
  if (!APPSCRIPT_KEY) { log("✗ thiếu APPSCRIPT_KEY trong .env — không ghi được Sheet"); process.exit(2); }
  if (!sheetId) {
    const args = [path.join(DIR, "tao-sheet-moi.mjs"), tenSheet]; if (co("public")) args.push("--public");
    const p = spawnSync(process.execPath, args, { encoding: "utf8" });
    process.stdout.write(p.stdout || ""); if (p.stderr) process.stderr.write(p.stderr);
    const m = /SHEET_ID=(\S+)/.exec(p.stdout || "");
    if (!m) { log("✗ không tạo được sheet mới"); process.exit(2); }
    sheetId = m[1];
  }
  const apiAt = Date.now();
  for (const [tab, header, rows] of bang) {
    if (!rows.length) continue;   // GAS từ chối rows rỗng (chặn xoá trắng) — tab không có dữ liệu thì bỏ qua
    const CHUNK = 2000, rc = chuHoa(header, rows);
    for (let i = 0; i < rc.length; i += CHUNK) {
      const j = await gasPost({ action: "syncTasks", key: APPSCRIPT_KEY, tab, sheetId, header, rows: rc.slice(i, i + CHUNK), append: i > 0, apiAt }, log, tab + " gói " + (i / CHUNK + 1));
      if (!j || j.ok === false || j.error || j.status === "error") throw new Error(tab + ": GAS trả " + JSON.stringify(j).slice(0, 200));
    }
    log(`  ✓ tab ${tab}: ${rows.length} dòng`);
  }
  console.log("URL=https://docs.google.com/spreadsheets/d/" + sheetId + "/edit");
}

if (co("tu-json")) {   // chỉ ghi lại Sheet từ kết quả lần chạy trước — 0 lượt gọi WMS
  const j = JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));
  let bang = j.bang;
  if (!bang) {   // JSON đời đầu (18:18 28/08) chưa lưu bảng → dựng lại từ 3 CSV cùng lượt + khongQuy trong JSON
    const docCsv = (ten) => {   // CSV toàn chuỗi → cột SỐ (kg, số đếm) trả về số để Sheet cộng được; cột mã giữ chuỗi (chuHoa sẽ thêm nháy)
      const r = parseCsv(fs.readFileSync(path.join(OUT, ten), "utf8").replace(/^﻿/, ""));
      const soCot = r[0].map((h) => !COT_CHU.has(h));
      return [r[0], r.slice(1).map((row) => row.map((v, i) => (soCot[i] && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v)))];
    };
    const [hT, rT] = docCsv("uidgr-cancel-tong-hop.csv"), [hC, rC] = docCsv("uidgr-cancel-chi-tiet.csv"), [hU, rU] = docCsv("uidgr-cancel-uid-chua-group.csv");
    const hK = ["PO", "Group UID Code", "Trạng thái", "Batch", "Roll", "kg nhận (PL)", "SKU packing list", "Tên hàng packing list", "Vị trí", "Ngày sửa", "Người sửa"];
    const rK = (j.khongQuy || []).filter((r) => r.status_id === 9).map((r) => [r.po, r.code, r.status, r.batch, r.roll, r.kgPL ?? "", r.plSku, r.plTen || "", r.loc, r.sua, r.suaBoi]);
    bang = [["TONG-HOP-SKU", hT, rT], ["UIDGR-CANCELED", hC, rC], ["UID-CHUA-GROUP", hU, rU], ["GROUP-KHONG-QUY", hK, rK]];
    log("JSON chưa có bảng → dựng từ CSV: " + bang.map((b) => b[0] + "=" + b[2].length).join(" · "));
  }
  log("dùng kết quả " + j.at + " (" + j.soGoi + " lượt GET lần đó), không gọi WMS");
  ghiSheet(bang).catch((e) => { log("✗ " + (e && e.message || e)); process.exit(1); });
} else {
  main().catch((e) => { log("✗ " + (e && e.message || e)); process.exit(1); });
}
