import path from "node:path";
import { fileURLToPath } from "node:url";
import { layTokenSongWms, fetchThuLai } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const tok = await layTokenSongWms(DIR, () => {});
const H = (cty) => ({ authorization: tok, "Company-Ids": String(cty), accept: "application/json" });
const RI = "https://wms-gw.inshasaki.com/api/v1/wms/report-management/report-inventories";
const BIN = "https://wms-gw.inshasaki.com/api/v1/wms/report-management/stock-locations/bins/count/v3";
for (const cfg of [{ c: "1005", w: "1339", ten: "GARMENT" }, { c: "1002", w: "1177", ten: "MTG" }]) {
  const bu = `${BIN}?company_ids=${cfg.c}&warehouse_ids=${cfg.w}&ignore_zero_total=1&prefix_location_description=F0-A0-00-00-00-00&page=1&size=200`;
  const bj = await (await fetchThuLai(bu, { headers: H(cfg.c) })).json();
  const skus = (bj.records || []).map((x) => x.sku);
  const u = `${RI}?page=1&size=1000&location_description=F0-A0-00-00-00-00&warehouse_ids=${cfg.w}&skus=${skus.join(",")}`;
  const r = await fetchThuLai(u, { headers: H(cfg.c) }).catch((e) => ({ ok: false, status: String(e) }));
  const j = r.ok ? await r.json().catch(() => null) : null;
  const recs = j?.records || [];
  console.log(`\n===== ${cfg.ten}: ${skus.length} SKU o F0-A0 -> HTTP ${r.status} count=${j?.count} rows=${recs.length}`);
  const badLoc = recs.filter((x) => x.location_description !== "F0-A0-00-00-00-00").length;
  const badWh = recs.filter((x) => String(x.warehouse_id) !== cfg.w).length;
  console.log(`  sai location: ${badLoc} · sai kho: ${badWh} · trang thai: ${[...new Set(recs.map(x=>x.status_name))].join(",")}`);
  const kieu = {};
  for (const x of recs) kieu[x.inbound_shmt_type || "?"] = (kieu[x.inbound_shmt_type || "?"] || 0) + 1;
  console.log("  inbound_shmt_type:", JSON.stringify(kieu));
  console.log("  group_uid=0:", recs.filter(x=>String(x.group_uid)==="0").length, "/", recs.length);
  for (const x of recs.slice(0, 6)) console.log(`   · ${x.sku} uid=${x.uid} qty=${x.qty} type=${x.inbound_shmt_type} shmt=${x.inbound_shmt_number} po=${x.purchase_order_number} vendor=${x.vendor_name||"-"} originWh=${x.origin_warehouse_code} created=${x.created_at} by=${x.created_by}`);
}
