/**
 * tra-uid-group.mjs — CHỈ ĐỌC: "UID này có (từng) được khai báo trong Group UID Code kia không?"
 *   node tra-uid-group.mjs <UID> <GROUP_UID_CODE>
 *   node tra-uid-group.mjs VN00397575376 1028260605000250
 *
 * Bốn tầng bằng chứng (WMS KHÔNG có endpoint lịch sử theo UID — xem ghi chú cuối tệp):
 *  ① bản ghi group   : /wms/group-uid-infos            → batch_code / roll_code / trạng thái / vị trí
 *  ② ruột group      : /wms/group-uid-infos/detail/uid → UID ĐANG nằm trong group
 *  ③ lịch sử group   : /wms/group-uid-info-histories   → Edit-Add / Edit-Remove / Block / Transfer
 *  ④ dấu vết trên tồn: report-inventories              → group_uid + batch_number của chính UID,
 *     kèm đối chiếu cân với packing list (/wms/inbound-packing-lists) để biết UID là cuộn nào.
 */
import { layTokenSongWms } from "./session-rules.js";

const UID = process.argv[2];
const GU = process.argv[3];
if (!UID || !GU) { console.log("Dùng: node tra-uid-group.mjs <UID> <GROUP_UID_CODE>"); process.exit(2); }
const GW = "https://wms-gw.inshasaki.com";
const CTYS = (process.env.UIDGR_CTY || "1002,1005,1001").split(",");

const token = await layTokenSongWms(process.cwd(), (s) => console.log("· " + s));
if (!token) { console.log("✗ Không có token WMS sống — mở WMS trên Edge (bridge) rồi chạy lại."); process.exit(75); }

async function goi(path, cty) {
  const r = await fetch(GW + path, { headers: {
    authorization: token, "company-ids": String(cty), "user-agent-type": "web",
    origin: "https://wms.inshasaki.com", referer: "https://wms.inshasaki.com/",
  } }).catch(() => null);
  if (!r) return { status: 0, j: null };
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* không phải JSON */ }
  return { status: r.status, j, t };
}
const recs = (k) => (k.j && (k.j.records || (k.j.record ? [k.j.record] : []))) || [];
const g2kg = (n) => (Number(n) / 1000).toFixed(2);

/* ① bản ghi group */
let cty = null, grp = null;
for (const c of CTYS) {
  const k = await goi("/api/v1/wms/group-uid-infos?page=1&size=1&group_uid_codes=" + GU, c);
  if (recs(k).length) { cty = c; grp = recs(k)[0]; break; }
}
if (!grp) { console.log("✗ Không thấy group " + GU + " ở công ty " + CTYS.join("/")); process.exit(1); }
console.log("\n① GROUP " + GU + " (công ty " + cty + ")");
console.log("   loại " + grp.group_uid_type_name + " · " + grp.status_name + " · " + grp.warehouse_name +
  " · vị trí " + grp.location_description);
console.log("   Batch Code " + grp.batch_code + " · Roll Code " + grp.roll_code +
  " · nguồn " + grp.processing_source_type + " " + grp.processing_source_code);
console.log("   tạo " + grp.created_at + " bởi " + grp.created_by_name +
  " · sửa " + grp.updated_at + " bởi " + grp.updated_by_name);

/* ② ruột group */
const ruot = await goi("/api/v1/wms/group-uid-infos/detail/uid?page=1&size=200&group_uid_code=" + GU, cty);
const trong = recs(ruot).map((x) => x.uid);
console.log("\n② UID ĐANG trong group: " + (trong.length ? trong.join(", ") : "0 (group RỖNG)"));
console.log("   → " + UID + (trong.includes(UID) ? " CÓ nằm trong group" : " KHÔNG nằm trong group"));

/* ③ lịch sử group */
const h = await goi("/api/v1/wms/group-uid-info-histories?page=1&size=100&group_uid_codes=" + GU, cty);
console.log("\n③ lịch sử group: " + recs(h).length + " dòng");
recs(h).forEach((r) => console.log("   " + String(r.action_name).padEnd(18) + r.created_at + " · " + r.created_by_name +
  (r.old_location_description ? " (" + r.old_location_description + " → " + r.location_description + ")" : "")));
if (!recs(h).some((r) => /Edit/.test(r.action_name))) {
  console.log("   (không có dòng Edit-Add/Remove — nhưng lượt GẮN UID LÚC NHẬP HÀNG không được ghi lịch sử,");
  console.log("    nên đây KHÔNG phải bằng chứng \"chưa từng gắn\"; bằng chứng nằm ở tầng ④)");
}

/* ④ dấu vết trên bản ghi tồn của chính UID */
let inv = null;
for (const c of [cty, ...CTYS.filter((x) => x !== cty)]) {
  const k = await goi("/api/v1/wms/report-management/report-inventories?page=1&size=5&uids=" + UID, c);
  if (recs(k).length) { inv = recs(k)[0]; break; }
}
console.log("\n④ UID " + UID + (inv ? "" : " → không thấy trên tồn kho"));
if (inv) {
  console.log("   SKU " + inv.sku + " · " + String(inv.product_name || "").slice(0, 70));
  console.log("   qty " + inv.qty + " (= " + g2kg(inv.qty) + " kg nếu đơn vị là gam) · " +
    inv.product_status_name + "/" + inv.status_name);
  console.log("   " + inv.warehouse_name + " · vị trí " + inv.location_description +
    " · PO " + inv.purchase_order_number + " · phiếu nhập " + inv.inbound_shmt_number);
  console.log("   group_uid = " + inv.group_uid + " · batch_number = " + (inv.batch_number || "(rỗng)"));

  /* dấu tay: UID đã từng vào group thì batch_number còn lại dù đã rời group */
  const all = [];
  for (let p = 1; p <= 6; p++) {
    const k = await goi("/api/v1/wms/report-management/report-inventories?page=" + p +
      "&size=500&purchase_order_numbers=" + inv.purchase_order_number, cty);
    if (!recs(k).length) break; all.push(...recs(k));
    if (all.length >= (k.j.count || 0)) break;
  }
  const dem = { "group≠0 + có batch": 0, "group≠0 + batch rỗng": 0, "group=0 + có batch": 0, "group=0 + batch rỗng": 0 };
  for (const r of all) {
    dem[(String(r.group_uid) !== "0" ? "group≠0" : "group=0") + " + " + (r.batch_number ? "có batch" : "batch rỗng")]++;
  }
  console.log("\n   dấu tay trên cả PO (" + all.length + " UID): " + JSON.stringify(dem));
  const chuaTung = String(inv.group_uid) === "0" && !inv.batch_number;
  console.log("   → " + (chuaTung
    ? "group=0 VÀ batch rỗng ⇒ UID này CHƯA TỪNG vào group nào (UID rời group vẫn giữ batch_number)"
    : "UID có dấu vết từng thuộc group (batch_number còn lại)"));

  /* UID là cuộn nào? khớp cân với packing list của PO */
  const pl = [];
  for (let p = 1; p <= 6; p++) {
    const k = await goi("/api/v1/wms/inbound-packing-lists?page=" + p + "&size=200&purchase_order_numbers=" +
      inv.purchase_order_number, cty);
    if (!recs(k).length) break; pl.push(...recs(k));
    if (pl.length >= (k.j.count || 0)) break;
  }
  const me = pl.filter((r) => String(r.batch_code) === String(grp.batch_code));
  console.log("\n   packing list mẻ " + grp.batch_code + ": " + me.length + " cuộn");
  const kg = g2kg(inv.qty);
  me.sort((a, b) => String(a.code).localeCompare(String(b.code))).forEach((r) => {
    const khop = Number(r.quantity_received).toFixed(2) === kg;
    console.log("     " + (khop ? "★ " : "  ") + r.code + "  nhận " + r.quantity_received + " kg" +
      (r.code === grp.roll_code ? "   ← cuộn của group này" : ""));
  });
  const khop = me.filter((r) => Number(r.quantity_received).toFixed(2) === kg);
  if (khop.length) {
    console.log("   → theo cân, UID khớp cuộn: " + khop.map((r) => r.code).join(" / ") +
      (khop.length === 1 && khop[0].code === grp.roll_code ? "  = ĐÚNG cuộn của group (khớp duy nhất)" : ""));
  } else {
    console.log("   → không cuộn nào trong mẻ khớp cân " + kg + " kg");
  }
}

/* Ghi chú đã đo 21/08/2026:
 * · Bundle SPA chỉ có 2 endpoint lịch sử: /wms/group-uid-info-histories và /wms/approval-list/histories.
 *   KHÔNG có lịch sử theo UID (đã thử inventory-histories / uid-histories / report-inventory-histories → 404).
 * · Lịch sử group KHÔNG ghi lượt gắn UID lúc nhập/putaway: group 1028260605000013 đang chứa
 *   VN00398302328 mà lịch sử chỉ có Block + Transfer. Chỉ lượt sửa tay mới sinh Edit-Add/Edit-Remove.
 * · Vì vậy bằng chứng "chưa từng" nằm ở dấu tay batch_number: đo PO 10012508091422 (470 UID) —
 *   382 UID có group đều CÓ batch_number · 0 UID có group mà batch rỗng · 7 UID batch còn mà group=0
 *   (cả 7 đều "Adjustment - shipped" = đã xuất nên rời group) · 81 UID group=0 + batch rỗng.
 * · api@hasaki.vn (user 1001) đổi trạng thái group KHÔNG ghi lịch sử: 10 group của mẻ N03-488/9/25DT
 *   cùng về New lúc 21/08/2026 10:45:39 dù trước đó bị tuanlq5@ Block ngày 24/06.
 * · Bẫy tham số: report-inventories bỏ qua IM LẶNG tên lọc sai (batch_numbers không tồn tại →
 *   trả nguyên bảng); survey-responses/sku-po chỉ nhận purchase_order_number (số ít).
 */
