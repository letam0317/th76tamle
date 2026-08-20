/**
 * probe-uidgr-huy.mjs — CHỈ ĐỌC (GET): soi một Group UID code và cả mẻ vải của nó trên WMS.
 * Dựng 20/08/2026 để trả lời câu hỏi "mã UID group đang Canceled có chuyển sang Blocked
 * và nạp lại Sku/Qty/Batch/Roll vào đó được không".
 *
 *  KẾT LUẬN ĐÃ ĐO (xem chi tiết ở cuối tệp):
 *   · Trạng thái group UID (enum SPA): 1 New · 2 Available · 3 Editing · 4 Picklisted ·
 *     5 Processing · 6 Transferred · 7 Closed · 8 Blocked · 9 Canceled.
 *   · API đổi trạng thái DUY NHẤT: PUT /api/v1/wms/group-uid-infos/{mode}
 *       body {ids:[id], mode:"block"|"unblock"|"cancel", group_uid_note}
 *     Web CHỈ hiện nút: block khi đang Available · unblock khi đang Blocked ·
 *     cancel (rã nhóm) khi đang New/Available ⇒ dòng Canceled KHÔNG có nút nào.
 *   · Sku/Product Name/Qty KHÔNG phải trường của group — chúng suy ra từ UID đang gắn trong
 *     group (detail/sku, detail/uid). batch_code/roll_code có sẵn trên bản ghi group nhưng
 *     web không có form sửa. Tạo mới (POST /group-uid-infos) chỉ nhận
 *     {warehouse_id, group_uid_type, quantity} — mã do máy chủ tự sinh, không chọn được.
 *
 *  Dùng:  node probe-uidgr-huy.mjs <GROUP_UID_CODE> [BATCH_CODE] [PO]
 */
import { layTokenSongWms } from "./session-rules.js";

const GU = process.argv[2] || "1028260605000370";
const BATCH = process.argv[3] || "N03-441/11/25DT";
const PO = process.argv[4] || "10012508091422";
const GW = "https://wms-gw.inshasaki.com";
const CTY = process.env.UIDGR_CTY || "1002";

const token = await layTokenSongWms(process.cwd(), (s) => console.log(s));
if (!token) { console.log("✗ Không có token WMS sống — mở WMS trên Edge (bridge) rồi chạy lại."); process.exit(75); }

async function goi(path) {
  const r = await fetch(GW + path, {
    headers: {
      authorization: token, "company-ids": CTY, "user-agent-type": "web",
      origin: "https://wms.inshasaki.com", referer: "https://wms.inshasaki.com/",
    },
  }).catch(() => null);
  if (!r) return { status: 0, j: null, t: "lỗi mạng" };
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* không phải JSON */ }
  return { status: r.status, j, t };
}
const recs = (kq) => (kq.j && (kq.j.records || (kq.j.record ? [kq.j.record] : []))) || [];

/* ① bản ghi group + nội dung bên trong */
const det = await goi("/api/v1/wms/group-uid-infos?page=1&size=1&group_uid_codes=" + GU);
console.log("\n### group " + GU + " (HTTP " + det.status + ")");
for (const r of recs(det)) console.log("   " + JSON.stringify(r));
for (const ep of ["sku", "uid"]) {
  const d = await goi("/api/v1/wms/group-uid-infos/detail/" + ep + "?page=1&size=20&group_uid_code=" + GU);
  const n = d.j && d.j.count != null ? d.j.count : recs(d).length;
  console.log("   detail/" + ep + " → " + n + " dòng" + (n ? ": " + JSON.stringify(recs(d)) : " (group RỖNG)"));
}

/* ② lịch sử (actions: 1 Create · 2 Edit-Remove · 3 Edit-Add · 4 Transfer location · 5 Block · 6 Unblock · 7 Delete) */
const h = await goi("/api/v1/wms/group-uid-info-histories?page=1&size=50&group_uid_codes=" + GU);
console.log("\n### lịch sử: " + recs(h).length + " dòng");
recs(h).reverse().forEach((r) => console.log("   " + r.action_name + " @" + r.created_at + " bởi " + r.created_by_name +
  (r.old_location_description ? " (" + r.old_location_description + " → " + r.location_description + ")" : "")));

/* ③ cả mẻ vải: mỗi cuộn 1 group — xem trạng thái đồng loạt hay riêng lẻ */
const me = await goi("/api/v1/wms/group-uid-infos?page=1&size=200&batch_codes=" + encodeURIComponent(BATCH));
const dem = {};
for (const r of recs(me)) dem[r.status_name] = (dem[r.status_name] || 0) + 1;
console.log("\n### mẻ " + BATCH + ": " + recs(me).length + " group · " + JSON.stringify(dem));
recs(me).slice(0, 5).forEach((r) => console.log("   " + r.group_uid_code + " roll=" + r.roll_code + " " + r.status_name +
  " · cập nhật " + r.updated_at + " bởi " + r.updated_by_name));

/* ④ UID mức tồn kho của PO — mẻ này còn cuộn nào trong bin không */
const all = [];
for (let page = 1; page <= 3; page++) {
  const k = await goi("/api/v1/wms/report-management/report-inventories?page=" + page + "&size=500&purchase_order_numbers=" + PO);
  if (!recs(k).length) break;
  all.push(...recs(k));
  if (all.length >= (k.j.count || 0)) break;
}
const cua = all.filter((r) => String(r.batch_number || "") === BATCH);
console.log("\n### tồn kho PO " + PO + ": " + all.length + " UID · thuộc mẻ này: " + cua.length);
cua.slice(0, 30).forEach((r) => console.log("   " + r.uid + " qty=" + r.qty + " group=" + r.group_uid + " sku=" + r.sku +
  " " + r.product_status_name + "/" + r.status_name + " vt=" + r.location_description));

/* ⑤ độ phổ biến từng trạng thái (kho nguyên liệu MTG, loại Fabric Roll) */
const TEN = { 1: "New", 2: "Available", 8: "Blocked", 9: "Canceled" };
const line = [];
for (const s of [1, 2, 8, 9]) {
  const k = await goi("/api/v1/wms/group-uid-infos?page=1&size=1&warehouse_ids=1177&group_uid_types=2&status_ids=" + s);
  line.push(TEN[s] + "=" + (k.j ? k.j.count : k.status));
}
console.log("\n### kho 1177 · Fabric Roll: " + line.join(" · "));

/* ================== ĐO THẬT 20/08/2026 (mã 1028260605000370, mẻ N03-441/11/25DT) ==================
 * · group rỗng: detail/sku = 0, detail/uid = 0 ⇒ không còn UID nào gắn vào mã này.
 * · lịch sử 3 dòng: Transfer location ×2 (09+11/06) → Block 24/06 14:15:47 (tuanlq5@hasaki.vn).
 *   KHÔNG có dòng nào cho lượt chuyển sang Canceled.
 * · cả 24 cuộn của mẻ: Blocked hàng loạt 24/06, rồi 20/07 13:10:26 CÙNG LÚC thành Canceled do
 *   `api@hasaki.vn` (user 1001) — tức đường API/hệ thống, KHÔNG ghi lịch sử và KHÔNG theo cổng
 *   của web (web chỉ cho cancel từ New/Available, đây là Blocked → Canceled).
 * · tồn kho PO 10012508091422: 470 UID, thuộc mẻ này chỉ còn 1 UID VN00397575271 (19.590 g,
 *   group_uid=0, Damaged / "Adjustment - shipped") ⇒ hàng của mẻ đã ra khỏi bin.
 * · quyền tài khoản đang dùng CÓ: wms-group-uid-web-block-update / -web-update / -web-create /
 *   -web-cancel-update (+ bộ -app-*) ⇒ vướng là ở luật trạng thái, không phải ở quyền.
 */
