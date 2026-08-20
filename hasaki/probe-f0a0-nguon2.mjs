import path from "node:path";
import { fileURLToPath } from "node:url";
import { layTokenSongWms, fetchThuLai } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const tok = await layTokenSongWms(DIR, () => {});
const H = (cty) => ({ authorization: tok, "Company-Ids": String(cty), accept: "application/json" });
const RI = "https://wms-gw.inshasaki.com/api/v1/wms/report-management/report-inventories";
// 2 SKU thật đang treo F0-A0: 1 GARMENT (1005) + 1 MTG (1002)
for (const [cty, sku] of [["1005", "422423615"], ["1002", "422430683"], ["1002", "322200651"]]) {
  const u = `${RI}?page=1&size=5&skus=${sku}`;
  const r = await fetchThuLai(u, { headers: H(cty) }).catch((e) => ({ ok: false, status: String(e) }));
  const j = r.ok ? await r.json() : null;
  const recs = j?.records || j?.data?.records || [];
  console.log(`\n===== ${sku} (cty ${cty}) HTTP ${r.status} · count=${j?.count ?? j?.total} · rows=${recs.length}`);
  if (recs[0]) console.log("truong:", Object.keys(recs[0]).join(" | "));
  console.log(JSON.stringify(recs.slice(0, 2), null, 1));
}
