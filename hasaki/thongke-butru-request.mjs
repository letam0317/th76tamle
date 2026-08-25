/**
 * thongke-butru-request.mjs — THỐNG KÊ BÙ TRỪ THEO ĐỢT KIỂM (request) từ tab kiemke-qtycount
 * =============================================================================================
 *  Quy tắc user chốt 25/08/2026: bù trừ CHỈ trong CÙNG Request code — SKU thiếu bin này thừa
 *  bin kia trong cùng đợt là "nằm nhầm bin" (net 0, KHÔNG lệch); net ≠ 0 mới là lệch thật.
 *  SL đếm null trên phiếu ĐÃ kiểm = đếm 0 (cùng luật qtcCnt của dashboard).
 *
 *  Nguồn: tab kiemke-qtycount (mọi dòng SKU × vị trí của phiếu Full location - Factory) — đọc
 *  gviz public, 0 call WMS. Mỗi vị trí lấy PHIẾU ĐẠI DIỆN trong request (hợp lệ thắng
 *  REJECTED/CANCELED, mới nhất thắng — cùng luật kkLatestOf). Kèm cột UIDgr lệch từ kiemke-uidgr.
 *
 *  Chạy: node thongke-butru-request.mjs <SHEET_ID_ĐÍCH> [request=252161]
 *  (SHEET_ID_ĐÍCH tạo trước bằng: node tao-sheet-moi.mjs "Tên file")
 *  Ghi 3 tab: TONG-QUAN · BU-TRU-CO-LECH · BU-TRU-VE-0
 */
import "dotenv/config";
import { gasPost } from "./session-rules.js";

const DS_SHEET = process.argv[2];
const REQ = String(process.argv[3] || "252161");
const SHEET_NGUON = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const KEY = process.env.APPSCRIPT_KEY;
const log = (...a) => console.log(...a);
if (!DS_SHEET) { console.error("Cách dùng: node thongke-butru-request.mjs <SHEET_ID_ĐÍCH> [request]"); process.exit(1); }
if (!KEY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env"); process.exit(1); }

async function gviz(tab, tq) {
  const u = "https://docs.google.com/spreadsheets/d/" + SHEET_NGUON + "/gviz/tq?tqx=out:json;responseHandler:x&sheet=" +
    encodeURIComponent(tab) + "&headers=1&tq=" + encodeURIComponent(tq);
  const t = await (await fetch(u)).text();
  const j = JSON.parse(t.match(/x\(([\s\S]*)\)\s*;?\s*$/)[1]);
  const H = (j.table.cols || []).map((c) => String(c.label || "").replace(/\s+/g, " ").trim().toLowerCase());
  const rows = (j.table.rows || []).map((r) => (r.c || []).map((c) => {
    if (!c || c.v == null) return "";
    if (typeof c.v === "string" && /^Date\(/.test(c.v) && c.f) return c.f;   // ô ngày: lấy bản đã định dạng
    return c.v;
  }));
  return { H, rows };
}
const ix = (H, name) => H.indexOf(name.toLowerCase());
const nf = (n) => Number(n).toLocaleString("en-US");

// ===== 1) Dòng SKU × vị trí của request =====
const qc = await gviz("kiemke-qtycount", "select * where C = " + REQ);
if (ix(qc.H, "sku") < 0 || ix(qc.H, "quantity count") < 0) { console.error("✗ Tab kiemke-qtycount không đúng hợp đồng cột."); process.exit(2); }
const C = { cid: ix(qc.H, "checklist id"), wh: ix(qc.H, "warehouse"), loc: ix(qc.H, "location"), sku: ix(qc.H, "sku"), pn: ix(qc.H, "product name"), cnt: ix(qc.H, "quantity count"), inv: ix(qc.H, "inventory"), st: ix(qc.H, "checklist status"), cd: ix(qc.H, "counted date") };
const dong = qc.rows.map((r) => ({
  cid: String(r[C.cid]), wh: String(r[C.wh]), loc: String(r[C.loc]), sku: String(r[C.sku]).replace(/\.0$/, ""),
  pn: String(r[C.pn]), cnt: r[C.cnt] === "" ? null : Number(r[C.cnt]) || 0, inv: r[C.inv] === "" ? null : Number(r[C.inv]) || 0,
  st: String(r[C.st]).toUpperCase(), cd: String(r[C.cd]),
}));
log("Request " + REQ + ": " + dong.length + " dòng SKU × vị trí (kiemke-qtycount).");
if (!dong.length) { console.error("✗ Không có dòng nào cho request " + REQ + "."); process.exit(2); }

// ===== 2) Phiếu ĐẠI DIỆN cho mỗi vị trí (hợp lệ thắng REJECTED/CANCELED, mới nhất thắng) =====
const phieu = new Map();   // cid -> {wh,loc,st,cd}
for (const d of dong) if (!phieu.has(d.cid)) phieu.set(d.cid, { wh: d.wh, loc: d.loc, st: d.st, cd: d.cd });
const rep = new Map();     // wh|loc -> cid
for (const [cid, p] of phieu) {
  const k = p.wh + "|" + p.loc, bad = /REJECTED|CANCELED/.test(p.st);
  const cur = rep.get(k);
  if (!cur) { rep.set(k, { cid, bad, cd: p.cd }); continue; }
  if (cur.bad !== bad) { if (!bad) rep.set(k, { cid, bad, cd: p.cd }); continue; }
  if (String(p.cd) >= String(cur.cd)) rep.set(k, { cid, bad, cd: p.cd });
}
const repCid = new Set([...rep.values()].map((x) => x.cid));
log("Phiếu: " + phieu.size + " · vị trí: " + rep.size + " (mỗi vị trí 1 phiếu đại diện).");

// ===== 3) Gộp theo SKU: SL đếm null trên phiếu đã kiểm = 0 (luật user 25/08) =====
const CHUA_DEM = /PENDING|NOT COUNT|PROCESSING/;
const sku = new Map();   // sku -> {pn, dem, ton, nViTri, lech:[{loc,cnt,inv,d}]}
let boChuaDem = 0;
for (const d of dong) {
  if (!repCid.has(d.cid)) continue;
  let cnt = d.cnt;
  if (cnt == null) { if (CHUA_DEM.test(d.st)) { boChuaDem++; continue; } cnt = 0; }
  const inv = d.inv == null ? 0 : d.inv;
  const o = sku.get(d.sku) || { pn: d.pn, dem: 0, ton: 0, nViTri: 0, lech: [] };
  if (!o.pn && d.pn) o.pn = d.pn;
  o.dem += cnt; o.ton += inv; o.nViTri++;
  const df = cnt - inv;
  if (df !== 0) o.lech.push({ loc: d.loc, cnt, inv, d: df });
  sku.set(d.sku, o);
}
if (boChuaDem) log("(bỏ " + boChuaDem + " dòng thuộc phiếu chưa đếm — không tính 0)");

// ===== 4) UIDgr lệch theo SKU (kind=loc, cùng request) để đính kèm cột chi tiết =====
const ug = await gviz("kiemke-uidgr", "select I, H, O, P, Q, R where B = 'loc' and E = " + REQ + " and O is not null");
const U = { sku: 0, loc: 1, uid: 2, gst: 3, qu: 4, qs: 5 };
const ugMap = new Map();
for (const r of ug.rows) {
  const s = String(r[U.sku]).replace(/\.0$/, ""), uid = String(r[U.uid]).trim();
  if (!uid) continue;
  const qu = r[U.qu] === "" ? 0 : Number(r[U.qu]) || 0, qs = r[U.qs] === "" ? 0 : Number(r[U.qs]) || 0;
  (ugMap.get(s) || ugMap.set(s, []).get(s)).push(uid + " @" + r[U.loc] + ": " + nf(qs) + "→" + nf(qu) + " (" + (qu - qs > 0 ? "+" : "") + nf(qu - qs) + ") " + r[U.gst]);
}
log("UIDgr lệch: " + ug.rows.length + " dòng nhóm (kèm vào cột chi tiết).");

// ===== 5) Phân nhóm =====
const ghepLech = (ls, cap) => {
  const s = ls.map((x) => x.loc + ": " + nf(x.cnt) + "/" + nf(x.inv) + " (" + (x.d > 0 ? "+" : "") + nf(x.d) + ")");
  return (s.length > cap ? s.slice(0, cap).join(" · ") + " · …(+" + (s.length - cap) + ")" : s.join(" · "));
};
const coLech = [], ve0 = []; let khop = 0;
for (const [s, o] of sku) {
  const net = o.dem - o.ton;
  if (net !== 0) coLech.push({ s, o, net });
  else if (o.lech.length) ve0.push({ s, o });
  else khop++;
}
coLech.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
ve0.sort((a, b) => b.o.lech.length - a.o.lech.length);
const tongDuong = coLech.filter((x) => x.net > 0).reduce((t, x) => t + x.net, 0);
const tongAm = coLech.filter((x) => x.net < 0).reduce((t, x) => t + x.net, 0);
log("SKU: " + sku.size + " · khớp hẳn: " + khop + " · bù trừ về 0 (nằm nhầm bin): " + ve0.length + " · CÓ LỆCH: " + coLech.length +
  " (dương +" + nf(tongDuong) + " · âm " + nf(tongAm) + ")");

// ===== 6) Ghi 3 tab vào sheet đích =====
const apiAt = Date.now();
async function ghi(tab, header, rows) {
  for (let i = 0; i < rows.length; i += 3000) {
    const body = JSON.stringify({ action: "syncTasks", key: KEY, tab, sheetId: DS_SHEET, header, rows: rows.slice(i, i + 3000), append: i > 0, apiAt });
    let j;
    for (let lan = 1; lan <= 6; lan++) {   // LockService của GAS là khóa TOÀN script — cụm sync đang ghi sheet chính cũng chặn mình
      j = await gasPost(body, log, tab);
      if (j.status === "success" || !/đang bận|dang ban/i.test(String(j.message || ""))) break;
      log("  … Sheet đang bận (cụm sync đang ghi) — chờ 20s thử lại (" + lan + "/6).");
      await new Promise((r) => setTimeout(r, 20000));
    }
    if (j.status !== "success") throw new Error(tab + ": " + (j.message || "?"));
  }
  log("  ✓ " + tab + ": " + rows.length + " dòng.");
}
const gio = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
await ghi("TONG-QUAN", ["Mục", "Giá trị"], [
  ["Request (đợt kiểm)", "'" + REQ], ["Loại phiếu", "Full location - Factory (tab kiemke-qtycount)"],
  ["Quy tắc", "Bù trừ CHỈ trong cùng Request; SL đếm trống trên phiếu đã kiểm = 0; mỗi vị trí lấy phiếu đại diện mới nhất (hợp lệ thắng REJECTED)"],
  ["Số phiếu / vị trí", phieu.size + " / " + rep.size],
  ["Số dòng SKU × vị trí", dong.length],
  ["Số SKU", sku.size],
  ["— Khớp hoàn toàn (mọi dòng đếm = tồn)", khop],
  ["— Bù trừ VỀ 0 (nằm nhầm bin, KHÔNG lệch tổng)", ve0.length],
  ["— Bù trừ CÓ LỆCH (net ≠ 0)", coLech.length],
  ["Tổng lệch dương / âm", "+" + nf(tongDuong) + " / " + nf(tongAm)],
  ["Thời điểm thống kê", gio],
]);
await ghi("BU-TRU-CO-LECH",
  ["No.", "SKU", "Tên hàng", "Lệch NET (đếm − tồn)", "Tổng SL đếm", "Tổng tồn HT", "Số vị trí", "Số dòng lệch", "Vị trí lệch (đếm/tồn (chênh))", "UIDgr lệch (nhóm @vị trí: HT→đếm)"],
  coLech.map((x, i) => [i + 1, "'" + x.s, x.o.pn, x.net, x.o.dem, x.o.ton, x.o.nViTri, x.o.lech.length,
    ghepLech(x.o.lech, 12), (ugMap.get(x.s) || []).slice(0, 12).join(" · ")]));
await ghi("BU-TRU-VE-0",
  ["No.", "SKU", "Tên hàng", "Tổng SL đếm = Tồn HT", "Số vị trí", "Số dòng lệch (tự bù nhau)", "Cặp vị trí bù trừ (đếm/tồn (chênh))", "UIDgr lệch (nhóm @vị trí: HT→đếm)"],
  ve0.map((x, i) => [i + 1, "'" + x.s, x.o.pn, x.o.dem, x.o.nViTri, x.o.lech.length,
    ghepLech(x.o.lech, 12), (ugMap.get(x.s) || []).slice(0, 12).join(" · ")]));

// Đối chứng ca đã biết: 422336829 phải nằm ở nhóm VỀ 0
const kt = ve0.find((x) => x.s === "422336829");
log(kt ? "✓ Đối chứng: 422336829 nằm ở BU-TRU-VE-0 (" + ghepLech(kt.o.lech, 4) + ")" : "⚠ Đối chứng: 422336829 KHÔNG ở nhóm về-0 — soát lại!");
log("✓ XONG — https://docs.google.com/spreadsheets/d/" + DS_SHEET + "/edit");
