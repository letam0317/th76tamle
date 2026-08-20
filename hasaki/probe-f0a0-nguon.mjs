/** probe-f0a0-nguon.mjs — soi F0-A0: bins/count/v3 trả gì, report-inventories trả gì (đủ trường). */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { layTokenSongWms, fetchThuLai } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const tok = await layTokenSongWms(DIR, console.log);
if (!tok) { console.error("khong co token wms"); process.exit(2); }
const H = (cty) => ({ authorization: tok, "Company-Ids": String(cty), accept: "application/json" });
const BIN = "https://wms-gw.inshasaki.com/api/v1/wms/report-management/stock-locations/bins/count/v3";
for (const cfg of [{ c: "1002", w: "1177", ten: "MTG" }, { c: "1005", w: "1339", ten: "GARMENT" }]) {
  const u = `${BIN}?company_ids=${cfg.c}&warehouse_ids=${cfg.w}&ignore_zero_total=1&prefix_location_description=F0-A0-00-00-00-00&page=1&size=200`;
  const r = await fetchThuLai(u, { headers: H(cfg.c) }).catch((e) => ({ ok: false, status: String(e) }));
  const j = r.ok ? await r.json() : null;
  const recs = j?.records || j?.data?.records || [];
  console.log(`\n===== BIN ${cfg.ten}: HTTP ${r.status} · count=${j?.count ?? j?.total} · records=${recs.length}`);
  if (recs[0]) console.log("truong:", Object.keys(recs[0]).join(" | "));
  console.log(JSON.stringify(recs.slice(0, 3), null, 1));
}
