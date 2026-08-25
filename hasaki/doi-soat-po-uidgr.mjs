/**
 * doi-soat-po-uidgr.mjs — CHỈ ĐỌC: đối soát tệp khai báo Group UID theo PO (xuất từ WMS)
 * với danh sách "UID sai vị trí" của tab **Tồn kho bất thường** (tab Sheet `ton-vitri`).
 *
 *   node doi-soat-po-uidgr.mjs <tệp.xlsx> [--csv <ton-vitri.csv>] [--ra <ra.csv>] [--khong-wms]
 *   node doi-soat-po-uidgr.mjs "C:/Users/lechitam/OneDrive/Desktop/PO_10012508091422_1.xlsx"
 *
 * Tệp xlsx là bảng WMS xuất theo PO, 6 cột: Sku · Product Name · Group Uid Code ·
 * Received Qty (KG) · Batch Code · Roll Code — tức "cuộn nào đã được cấp mã group nào".
 *
 * KHOÁ GHÉP là CÂN: `Received Qty × 1000` (kg → gam) khớp `Qty` của UID, sai số ±2 g
 * (WMS làm tròn 2 số). Ghép theo TỪNG VỊ TRÍ vì mỗi mẻ nằm trọn một bin (đo thật).
 * Xem thêm [[ton-tai-vi-tri]] và ghi chú cuối tệp.
 */
import XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const F_XLSX = args.find((a) => !a.startsWith("--"));
const lay = (ten) => { const i = args.indexOf(ten); return i >= 0 ? args[i + 1] : null; };
const F_CSV = lay("--csv");
const F_RA = lay("--ra") || "./.exports/doi-soat-po-uidgr.csv";
const KHONG_WMS = args.includes("--khong-wms");
const SHEET_FACTORY = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const TAB = "ton-vitri";
const SAI_SO = 2;   // gam

if (!F_XLSX) { console.log("Dùng: node doi-soat-po-uidgr.mjs <tệp.xlsx> [--csv <ton-vitri.csv>] [--ra <ra.csv>] [--khong-wms]"); process.exit(2); }

/* ① tệp khai báo group theo PO */
const wb = XLSX.readFile(F_XLSX);
const kb = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: "" })
  .map((r) => ({ sku: String(r.Sku), ten: r["Product Name"], grp: String(r["Group Uid Code"]),
    kg: Number(r["Received Qty"]), g: Math.round(Number(r["Received Qty"]) * 1000),
    batch: r["Batch Code"], roll: r["Roll Code"] }));
const meOf = {};
for (const r of kb) (meOf[r.batch] = meOf[r.batch] || []).push(r);
console.log("① " + path.basename(F_XLSX) + " (tab " + wb.SheetNames[0] + "): " + kb.length +
  " group khai báo · SKU " + [...new Set(kb.map((r) => r.sku))].join(",") +
  "\n   mẻ: " + Object.entries(meOf).map(([m, v]) => m + "×" + v.length).join(" · "));

/* ② danh sách UID sai vị trí — đọc tab ton-vitri (gviz, không cần token) hoặc từ tệp CSV */
function tachCsv(txt) {
  return txt.trim().split(/\r?\n/).map((l) => {
    const o = []; let cur = "", q = false;
    for (const ch of l) {
      if (ch === '"') q = !q; else if (ch === "," && !q) { o.push(cur); cur = ""; } else cur += ch;
    }
    o.push(cur); return o;
  });
}
const txt = F_CSV ? fs.readFileSync(F_CSV, "utf8")
  : await (await fetch("https://docs.google.com/spreadsheets/d/" + SHEET_FACTORY +
      "/gviz/tq?tqx=out:csv&sheet=" + TAB)).text();
const csv = tachCsv(txt);
const head = csv[0].map((x) => x.trim());
const iOf = (n) => head.indexOf(n);
const tv = csv.slice(1).filter((r) => r[iOf("UID")]).map((r) => ({
  uid: r[iOf("UID")], sku: r[iOf("SKU")], kho: r[iOf("Warehouse Name")], vt: r[iOf("Location")],
  g: Number(r[iOf("Qty")]), st: r[iOf("Status")], grp: r[iOf("Group UID")], sua: r[iOf("Updated At")],
}));
console.log("\n② tab " + TAB + ": " + tv.length + " UID sai vị trí" + (F_CSV ? " (từ " + F_CSV + ")" : " (gviz)"));

/* ③ chia 2 phần: cùng SKU với tệp / không liên quan */
const skuTep = new Set(kb.map((r) => r.sku));
const cung = tv.filter((r) => skuTep.has(r.sku));
const khac = tv.filter((r) => !skuTep.has(r.sku));
console.log("   cùng SKU với tệp: " + cung.length + " · không liên quan: " + khac.length);
if (khac.length) {
  const nhom = {};
  khac.forEach((r) => { const k = r.st + " @ " + r.vt; nhom[k] = (nhom[k] || 0) + 1; });
  Object.entries(nhom).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log("      · " + k + " × " + v));
}

/* ④ ghép mẻ ↔ vị trí rồi ghép cuộn ↔ UID theo cân, 1-1 trong từng vị trí */
const binOf = {};
cung.forEach((r) => (binOf[r.vt] = binOf[r.vt] || []).push(r));
const dungRoi = new Set(); const cap = []; const uidThua = []; const cuonThua = [];
for (const [bin, us] of Object.entries(binOf).sort()) {
  let best = null;
  for (const [m, rs] of Object.entries(meOf)) {
    if (dungRoi.has(m)) continue;
    const con = rs.map((x) => x.g); let n = 0;
    for (const u of us) { const i = con.findIndex((g) => Math.abs(g - u.g) <= SAI_SO); if (i >= 0) { con.splice(i, 1); n++; } }
    if (!best || n > best.n) best = { m, n };
  }
  if (!best) continue;
  dungRoi.add(best.m);
  const con = meOf[best.m].map((x) => ({ ...x }));
  const dem = {}; meOf[best.m].forEach((x) => { dem[x.g] = (dem[x.g] || 0) + 1; });
  let ok = 0;
  for (const u of [...us].sort((a, b) => a.g - b.g)) {
    const i = con.findIndex((x) => Math.abs(x.g - u.g) <= SAI_SO);
    if (i < 0) { uidThua.push({ ...u, me: best.m }); continue; }
    const cu = con.splice(i, 1)[0];
    cap.push({ ...u, ...cu, chac: (dem[cu.g] || 0) === 1 }); ok++;
  }
  cuonThua.push(...con.map((x) => ({ ...x, bin })));
  console.log("\n   " + bin + "  " + us.length + " UID  ↔  mẻ " + best.m + " (" + meOf[best.m].length +
    " cuộn)  → ghép 1-1: " + ok + " · UID không cuộn: " + us.filter((u) => !cap.find((c) => c.uid === u.uid)).length +
    " · cuộn không UID: " + con.length);
  if (con.length) console.log("      cuộn thừa: " + con.map((x) => x.roll + " (" + x.g + "g, group " + x.grp + ")").join(", "));
}
const chac = cap.filter((c) => c.chac).length;
console.log("\n④ Ghép được " + cap.length + "/" + cung.length + " UID" +
  " · trong đó cân DUY NHẤT trong mẻ (chỉ đích danh được cuộn): " + chac +
  " · cân trùng trong mẻ (đúng bộ, không đúng đích danh): " + (cap.length - chac));
if (uidThua.length) console.log("   UID không cuộn nào khớp: " + uidThua.map((x) => x.uid + " (" + x.g + "g)").join(", "));
if (cuonThua.length) console.log("   cuộn khai báo không UID nào trong bin: " +
  cuonThua.map((x) => x.roll + " (" + x.g + "g)").join(", "));

/* ⑤ (mặc định) hỏi WMS: PO / batch_number / group_uid thật của từng UID — 1 lượt/150 mã */
if (!KHONG_WMS) {
  const { layTokenSongWms } = await import("./session-rules.js");
  const token = await layTokenSongWms(process.cwd(), () => {});
  if (!token) { console.log("\n⑤ (bỏ qua — không có token WMS sống)"); }
  else {
    const inv = new Map();
    for (const cty of ["1002", "1005"]) {
      const con = tv.map((r) => r.uid).filter((u) => !inv.has(u));
      for (let i = 0; i < con.length; i += 150) {
        const r = await fetch("https://wms-gw.inshasaki.com/api/v1/wms/report-management/report-inventories" +
          "?page=1&size=500&uids=" + con.slice(i, i + 150).join(","),
          { headers: { authorization: token, "company-ids": cty, "user-agent-type": "web", origin: "https://wms.inshasaki.com" } });
        const j = await r.json().catch(() => ({}));
        (j.records || []).forEach((x) => inv.set(x.uid, x));
      }
    }
    const dPo = {}; let coBatch = 0, coGrp = 0;
    for (const r of tv) {
      const x = inv.get(r.uid); const k = x ? x.purchase_order_number : "(không thấy)";
      dPo[k] = (dPo[k] || 0) + 1;
      if (x && x.batch_number) coBatch++;
      if (x && String(x.group_uid) !== "0") coGrp++;
    }
    console.log("\n⑤ WMS (" + inv.size + "/" + tv.length + " UID) · PO: " +
      Object.entries(dPo).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + "×" + v).join(" · "));
    console.log("   còn batch_number: " + coBatch + " · đã có group_uid≠0: " + coGrp +
      "  (group≠0 ⇒ đã khai báo rồi, lẽ ra không nằm trong danh sách)");
    cap.forEach((c) => { const x = inv.get(c.uid); if (x) { c.po = x.purchase_order_number; c.batch_wms = x.batch_number || ""; } });
  }
}

/* ⑥ xuất CSV đề xuất khai báo */
fs.mkdirSync(path.dirname(F_RA), { recursive: true });
const dong = [["UID", "SKU", "Vi tri", "Trang thai", "Qty (g)", "Group Uid Code (de xuat)", "Batch Code", "Roll Code",
  "Received Qty (kg)", "Chac chan", "PO"]];
cap.forEach((c) => dong.push([c.uid, c.sku, c.vt, c.st, c.g, c.grp, c.batch, c.roll, c.kg,
  c.chac ? "dinh danh duy nhat" : "trung can trong me", c.po || ""]));
uidThua.forEach((c) => dong.push([c.uid, c.sku, c.vt, c.st, c.g, "", "", "(khong khop cuon nao)", "", "", ""]));
fs.writeFileSync(F_RA, dong.map((r) => r.map((x) => '"' + String(x).replace(/"/g, '""') + '"').join(",")).join("\n"), "utf8");
console.log("\n⑥ đã ghi " + (dong.length - 1) + " dòng → " + F_RA);

/* Ghi chú đã đo 21/08/2026 (PO 10012508091422, tệp PO_10012508091422_1.xlsx):
 * · 82 group khai báo (5 mẻ) đều RỖNG — không group nào có UID bên trong; 81/95 dòng "UID sai vị trí"
 *   là đúng SKU 422304497 + PO đó, tất cả group_uid=0 + batch_number rỗng ⇒ hai nửa của cùng lô hàng
 *   chưa bao giờ được nối. Mỗi mẻ nằm trọn 1 bin: 503-03↔N03-440 · 503-06↔N03-488 · 503-08↔N03-286 ·
 *   503-09↔N03-441 ⇒ ghép theo bin thì hết nhập nhằng giữa các mẻ.
 * · 4 cuộn khai báo KHÔNG còn UID trong bin (441-016 · 286-009 · 488-010 · 162-003) đúng bằng 4 UID
 *   duy nhất còn `batch_number` và đang `Adjustment - shipped` ⇒ chỉ những cuộn ĐÃ XUẤT là từng được
 *   gắn UID vào group; xuất xong rời group nhưng giữ nhãn batch.
 * · 3 UID không khớp cuộn nào (1 g · 300 g · 18.400 g) là đầu cây/khúc cắt được cấp UID sau (09–11/06),
 *   không có trên packing list.
 * · 14 dòng còn lại của tab là SKU/PO khác (F0-VR trả NCC, F0-TF/F0-NG removed) — không liên quan tệp.
 */
