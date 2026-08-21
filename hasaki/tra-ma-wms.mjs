/**
 * tra-ma-wms.mjs — TÌM MỘT MÃ (chuỗi con của tên hàng) TRÊN WMS, dùng token đang có
 * ===========================================================================================
 *  Vì sao cần: `SKU_MASTER` chỉ dựng từ `stock-inventories` của MẤY KHO đã chọn, nên một mã mới
 *  (hàng/mẫu vừa tạo, chưa có tồn ở kho đó) có thể CÓ trong WMS mà KHÔNG có trong danh mục. Muốn
 *  trả lời "mã này có trong WMS hay không" thì phải tra thẳng WMS.
 *
 *  ⚠ ENDPOINT KHÔNG LỌC ĐƯỢC THEO TỪ KHOÁ. Đã thử `keyword=` / `search=` / `sku=` — bị BỎ QUA y
 *  như đã ghi cho `category_name` (xem đầu sync-sku-master.mjs). Nên cách duy nhất là QUÉT rồi lọc
 *  tại chỗ. Vì vậy file này CHẠY TAY, và in rõ số lượt gọi đã tiêu.
 *
 *  KHÔNG BAO GIỜ TỰ ĐĂNG NHẬP: hết token thì thoát 75 (hoãn) như mọi bước khác của cụm.
 *
 *  node tra-ma-wms.mjs CWPT0019 [--kho 1441,1178] [--tat-ca] [--size 200]
 *    mặc định: mấy kho hay chứa hàng mẫu/thành phẩm của Mastige + Garment
 *    --tat-ca : quét MỌI kho đã biết (tốn nhiều lượt — in cảnh báo trước)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { layTokenSongWms, DEFER_EXIT, fetchThuLai } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const API = "https://wms-gw.inshasaki.com/api/v1/wms/report-management/stock-inventories";
const A = process.argv.slice(2);
const TU = (A.find((x) => !x.startsWith("--")) || "").trim();
if (!TU) { console.error("✗ Thiếu mã cần tìm. Ví dụ: node tra-ma-wms.mjs CWPT0019"); process.exit(2); }
const SIZE = Number((A.find((x) => x.startsWith("--size")) || "").split(/[= ]/)[1] || A[A.indexOf("--size") + 1] || 200) || 200;
const TAT_CA = A.includes("--tat-ca");
const KHO_TAY = A.includes("--kho") ? String(A[A.indexOf("--kho") + 1] || "") : "";

/* Kho theo công ty — lấy từ chính bảng đã dùng trong sync-sku-master (giữ một nguồn sự thật). */
const CUM = TAT_CA
  ? [{ ten: "Mastige (mọi kho đã biết)", company: "1002", warehouses: "1177,1458,1178,1151,1441,1179,1250,1307" },
     { ten: "Garment (mọi kho đã biết)", company: "1005", warehouses: "1339" }]
  : (KHO_TAY
      ? [{ ten: "kho chỉ định", company: "1002", warehouses: KHO_TAY }]
      : [{ ten: "Mastige · mẫu + bán thành phẩm + thành phẩm", company: "1002", warehouses: "1441,1178,1179" },
         { ten: "Mastige · nguyên liệu", company: "1002", warehouses: "1177,1458" },
         { ten: "Garment", company: "1005", warehouses: "1339" }]);

const token = await layTokenSongWms(DIR, (s) => console.log(s)).catch(() => null);
if (!token) { console.log("⏸ Chưa có token WMS sống — KHÔNG tự đăng nhập. Hoãn."); process.exit(DEFER_EXIT); }

const re = new RegExp(TU.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
let luot = 0, quet = 0;
const thay = [];
for (const c of CUM) {
  for (let page = 1; page <= 400; page++) {
    const u = API + "?company_ids=" + c.company + "&warehouse_ids=" + c.warehouses + "&page=" + page + "&size=" + SIZE;
    luot++;
    const r = await fetchThuLai(u, { headers: { authorization: token, "Company-Ids": c.company } }).catch(() => null);
    if (!r || !r.ok) { console.log("  ⚠ " + c.ten + " trang " + page + ": " + (r ? "HTTP " + r.status : "lỗi mạng") + " — dừng cụm này."); break; }
    const j = await r.json().catch(() => null);
    /* Khuôn phản hồi thật: { records: [...] } (hoặc data.records) — lấy y như sync-sku-master
       để hai chỗ không lệch nhau. Bản đầu tôi đoán j.data/j.items nên quét ra 0 dòng, im lặng. */
    const rows = (j && (j.records || (j.data && j.data.records))) || [];
    quet += rows.length;
    for (const x of rows) {
      const t = JSON.stringify(x);
      if (re.test(t)) thay.push({ kho: c.ten, sku: x.sku || x.product_sku || x.code, ten: x.product_name || x.name, tho: t.slice(0, 260) });
    }
    if (rows.length < SIZE) break;
  }
  console.log("  ✓ " + c.ten + ": đã quét " + quet + " dòng (luỹ kế) · " + luot + " lượt gọi");
}

console.log("\n════ TÌM \"" + TU + "\" ════");
console.log("Đã quét " + quet + " dòng bằng " + luot + " lượt gọi WMS.");
if (!thay.length) console.log("→ KHÔNG thấy dòng nào chứa \"" + TU + "\".");
else {
  console.log("→ Thấy " + thay.length + " dòng:");
  for (const x of thay.slice(0, 30)) console.log("   [" + x.kho + "] " + x.sku + "  " + String(x.ten || "").slice(0, 110));
}
