import path from "node:path";
import { fileURLToPath } from "node:url";
import { layTokenSongWms, fetchThuLai } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const tok = await layTokenSongWms(DIR, () => {});
const H = (c) => ({ authorization: tok, "Company-Ids": String(c), accept: "application/json" });
const RI = "https://wms-gw.inshasaki.com/api/v1/wms/report-management/report-inventories";
const BIN = "https://wms-gw.inshasaki.com/api/v1/wms/report-management/stock-locations/bins/count/v3";
const cfg = { c: "1002", w: "1177" };
const bj = await (await fetchThuLai(`${BIN}?company_ids=${cfg.c}&warehouse_ids=${cfg.w}&ignore_zero_total=1&prefix_location_description=F0-A0-00-00-00-00&page=1&size=200`, { headers: H(cfg.c) })).json();
const bins = new Map((bj.records || []).map((x) => [x.sku, x]));
const j = await (await fetchThuLai(`${RI}?page=1&size=1000&location_description=F0-A0-00-00-00-00&warehouse_ids=${cfg.w}&skus=${[...bins.keys()].join(",")}`, { headers: H(cfg.c) })).json();
const recs = j.records || [];
const st = {}; for (const x of recs) st[`${x.status_id} ${x.status_name}`] = (st[`${x.status_id} ${x.status_name}`] || 0) + 1;
console.log("status:", JSON.stringify(st, null, 1));
for (const [sku, b] of bins) {
  const all = recs.filter((x) => x.sku === sku);
  const inbin = all.filter((x) => x.status_id === 6);
  const s = (l) => l.reduce((a, x) => a + Number(x.qty || 0), 0);
  const dau = s(inbin) === Number(b.quantity) ? "OK " : "LECH";
  console.log(`${dau} ${sku} bins.qty=${b.quantity} inbin(${inbin.length})=${s(inbin)} all(${all.length})=${s(all)}`);
}
