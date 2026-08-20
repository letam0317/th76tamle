import path from "node:path";
import { fileURLToPath } from "node:url";
import { layTokenSongWms, fetchThuLai } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const tok = await layTokenSongWms(DIR, () => {});
const H = (cty) => ({ authorization: tok, "Company-Ids": String(cty), accept: "application/json" });
const RI = "https://wms-gw.inshasaki.com/api/v1/wms/report-management/report-inventories";
const thu = [
  "prefix_location_description=F0-A0-00-00-00-00",
  "location_description=F0-A0-00-00-00-00",
  "location_descriptions=F0-A0-00-00-00-00",
  "locations=F0-A0-00-00-00-00",
];
for (const p of thu) {
  const u = `${RI}?page=1&size=3&warehouse_ids=1339&${p}`;
  const r = await fetchThuLai(u, { headers: H("1005") }).catch((e) => ({ ok: false, status: String(e) }));
  const j = r.ok ? await r.json().catch(() => null) : null;
  const recs = j?.records || j?.data?.records || [];
  console.log(`${p.padEnd(48)} HTTP ${r.status} count=${j?.count ?? j?.total ?? "?"} loc=${recs.map(x=>x.location_description).join(",")}`);
}
