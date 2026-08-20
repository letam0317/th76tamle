/**
 * probe-sku-master.mjs — Thăm dò NGUỒN DỮ LIỆU cho tab SKU_MASTER (Nhận diện SKU).
 * Cần trả lời 3 câu:
 *   1. stock-inventories có trường nào cho TYPE (Combo/Normal) và STATUS (Active/Inactive)?
 *   2. Bỏ lọc Normal thì có thật sự thấy dòng Combo?
 *   3. report-inventories?skus= trả thêm trường gì (product master) không?
 * KHÔNG mở Edge, KHÔNG đăng nhập mới — chỉ dùng token đang sống (khỏi đá phiên ai).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenSongWms, fetchThuLai } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(...a);
const INV = "https://wms-gw.inshasaki.com/api/v1/wms/report-management/stock-inventories";
const RPT = "https://wms-gw.inshasaki.com/api/v1/wms/report-management/report-inventories";

const token = await layTokenSongWms(DIR, log);
if (!token) { log("✗ Không có token sống — dừng (không đăng nhập mới)."); process.exit(75); }

async function goi(u, cty) {
  const r = await fetchThuLai(u, { headers: { authorization: token, "Company-Ids": cty } }).catch((e) => ({ ok: false, status: e.message }));
  if (!r.ok) return { err: "HTTP " + r.status };
  const j = await r.json().catch(() => null);
  return { j, recs: (j && (j.records || (j.data && j.data.records))) || [] };
}

log("\n=== 1) stock-inventories (company 1002, kho 1177) ===");
let a = await goi(INV + "?company_ids=1002&warehouse_ids=1177&page=1&size=3", "1002");
log("  count =", a.j && (a.j.count ?? a.j.total));
if (a.recs[0]) {
  log("  KEYS:", Object.keys(a.recs[0]).join(", "));
  log("  MẪU:", JSON.stringify(a.recs[0], null, 1).slice(0, 1600));
}

log("\n=== 2) Các giá trị product_type gặp trong 500 dòng đầu ===");
let b = await goi(INV + "?company_ids=1002&warehouse_ids=1177&page=1&size=500", "1002");
const dem = {};
for (const it of b.recs) {
  for (const k of ["product_type_name", "product_type", "classify_name", "type_name", "status", "status_name", "is_active", "active"]) {
    if (it[k] != null && it[k] !== "") { dem[k + " = " + it[k]] = (dem[k + " = " + it[k]] || 0) + 1; }
  }
}
log("  " + (Object.keys(dem).length ? Object.entries(dem).sort((x, y) => y[1] - x[1]).slice(0, 25).map(([k, v]) => k + " (" + v + ")").join("\n  ") : "(không có trường nào trong danh sách)"));

log("\n=== 3) report-inventories?skus= (lấy 2 sku từ bước 1) ===");
const skus = b.recs.slice(0, 2).map((x) => x.sku || x.product_sku).filter(Boolean);
if (skus.length) {
  let c = await goi(RPT + "?page=1&size=50&skus=" + encodeURIComponent(skus.join(",")), "1002");
  log("  skus:", skus.join(","), "→", c.err || (c.recs.length + " dòng"));
  if (c.recs[0]) log("  KEYS:", Object.keys(c.recs[0]).join(", "));
  if (c.recs[0]) log("  MẪU:", JSON.stringify(c.recs[0], null, 1).slice(0, 1200));
}
process.exit(0);
