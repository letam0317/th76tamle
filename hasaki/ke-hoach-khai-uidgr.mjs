/**
 * ke-hoach-khai-uidgr.mjs — dựng THỨ TỰ khai Group UID trên app WMS cho từng bin.
 *
 * CƠ CHẾ APP (đo thật 21/08/2026, xem ghi chú cuối tệp): ô "Scan SKU/Barcode/RFID/Location"
 * KHÔNG nhận UID — app rút theo SKU + số lượng từ "Current picking shelf", ăn **UID mới nhất
 * trước (inventory_id giảm dần)**, thiếu thì CẮT UID kế tiếp và sinh UID mới.
 * ⇒ Muốn không cắt cuộn nào: khai theo đúng thứ tự inventory_id giảm dần, mỗi lượt gõ ĐÚNG
 *   cân của UID đang ở đầu hàng (kg 3 số thập phân + tích x1000).
 *
 *   node ke-hoach-khai-uidgr.mjs <tệp-doi-soat.csv> [--bin F0-KHO-503-06-04-01]
 */
import fs from "node:fs";
import { layTokenSongWms } from "./session-rules.js";

const F = process.argv[2] || "./.exports/doi-soat-po-uidgr.csv";
const chiBin = (() => { const i = process.argv.indexOf("--bin"); return i > 0 ? process.argv[i + 1] : null; })();
const GW = "https://wms-gw.inshasaki.com/api/v1";
const CTY = "1002", KHO = "1177";

/* bảng đối soát: roll ↔ group ↔ cân (kg) */
const csv = fs.readFileSync(F, "utf8").trim().split(/\r?\n/).map((l) => {
  const o = []; let cur = "", q = false;
  for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { o.push(cur); cur = ""; } else cur += ch; }
  o.push(cur); return o;
});
const H = csv[0].map((x) => x.trim());
const rows = csv.slice(1).map((r) => Object.fromEntries(H.map((h, i) => [h, r[i]])));
const cuonTheoBin = {};
for (const r of rows) {
  if (!r["Group Uid Code (de xuat)"]) continue;
  (cuonTheoBin[r["Vi tri"]] = cuonTheoBin[r["Vi tri"]] || []).push({
    group: r["Group Uid Code (de xuat)"], batch: r["Batch Code"].trim(), roll: r["Roll Code"].trim(),
    g: Math.round(Number(r["Received Qty (kg)"]) * 1000), sku: r.SKU,
  });
}

const token = await layTokenSongWms(process.cwd(), () => {});
if (!token) { console.log("✗ không có token WMS sống"); process.exit(75); }
const h = { authorization: token, "company-ids": CTY, "user-agent-type": "web", origin: "https://wms.inshasaki.com" };

for (const [bin, cuon] of Object.entries(cuonTheoBin).sort()) {
  if (chiBin && bin !== chiBin) continue;
  const sku = cuon[0].sku;
  const r = await fetch(GW + "/wms/report-management/report-inventories?page=1&size=500&location_description=" +
    bin + "&warehouse_ids=" + KHO + "&skus=" + sku, { headers: h });
  const j = await r.json();
  const pool = (j.records || []).filter((x) => x.status_id === 6 && String(x.group_uid) === "0")
    .sort((a, b) => b.inventory_id - a.inventory_id);   // đúng thứ tự app ăn
  const conCuon = cuon.map((c) => ({ ...c }));
  console.log("\n=== " + bin + " · SKU " + sku + " · " + pool.length + " UID chưa khai · " + conCuon.length + " cuộn cần khai");
  let cat = 0, stt = 0;
  const le = [];
  for (const u of pool) {
    const i = conCuon.findIndex((c) => !c.xong && Math.abs(c.g - u.qty) <= 1);
    if (i < 0) { le.push(u); continue; }
    conCuon[i].xong = true; stt++;
    console.log("  " + String(stt).padStart(2) + ". " + u.uid + " " + String(u.qty).padStart(6) + " g  →  gõ " +
      (u.qty / 1000).toFixed(3) + " kg (x1000) · group " + conCuon[i].group + " · " + conCuon[i].roll);
  }
  if (le.length) {
    cat = le.length;
    console.log("  ⚠ " + le.length + " UID KHÔNG khớp cuộn nào (khúc lẻ / đã bị cắt) — nên Transfer Bin về F0-A0 TRƯỚC khi khai:");
    le.forEach((u) => console.log("      " + u.uid + " " + u.qty + " g (inventory_id " + u.inventory_id + ")"));
  }
  const thieu = conCuon.filter((c) => !c.xong);
  if (thieu.length) {
    console.log("  ⚠ " + thieu.length + " cuộn không có UID khớp cân:");
    thieu.forEach((c) => console.log("      " + c.roll + " " + (c.g / 1000).toFixed(3) + " kg · group " + c.group));
  }
  console.log("  → khai sạch được " + stt + "/" + conCuon.length + " cuộn, " + (cat ? "sau khi dọn " + cat + " UID lẻ" : "không cần dọn gì"));
}

/* Ghi chú đo thật 21/08/2026 (bin F0-KHO-503-03-04-01):
 * · Khai 22,21 kg bằng SKU → app ăn VN00397575325 (19.450, inventory_id lớn nhất) rồi CẮT 2.760 g
 *   của VN00397575324 (19.010 → 16.250) và sinh UID mới VN00428712449 (2.760) ⇒ LIFO theo inventory_id.
 * · Nút "Edit" trên màn Group UID CHỈ hiện khi group ở trạng thái **Available**
 *   (New/Blocked không có) — Edit cho thêm/bỏ item + sửa batch/roll, kết bằng "Complete".
 * · Bỏ item trong Edit thì hàng bị ĐẨY về "Current picking shelf" (mặc định F0-A0-00-00-00-00),
 *   KHÔNG nhập lại vào UID gốc ⇒ trước khi bỏ phải đặt picking shelf = bin thật.
 * · Thêm item thì hàng CHUYỂN về vị trí của group ⇒ nạp ở F0-A0 rồi group tự kéo hàng về bin của nó.
 * · "Ungroup UID" = mode cancel ⇒ mã CHẾT vĩnh viễn, không dùng.
 * · Chuỗi dữ liệu gõ vào phải KHÔNG có khoảng trắng cuối (app quay vòng không nạp được).
 */
