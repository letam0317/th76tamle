import path from "node:path"; import { fileURLToPath } from "node:url"; import "dotenv/config";
import { layTokenSongWms, fetchThuLai } from "./session-rules.js";
const DIR=path.dirname(fileURLToPath(import.meta.url));
const token=await layTokenSongWms(DIR,()=>{}); if(!token) process.exit(75);
const INV="https://wms-gw.inshasaki.com/api/v1/wms/report-management/stock-inventories";
const BO=[["Mastige","1002","1458,1441,1307,1250,1179,1178,1177,1151"],["Garment","1005","1458,1441,1307,1250,1179,1178,1177,1151,1516,1341,1340,1339,1266"]];
for(const [ten,cty,ds] of BO){
  console.log("\n### "+ten+" (company "+cty+")");
  for(const id of ds.split(",")){
    const u=INV+"?company_ids="+cty+"&warehouse_ids="+id+"&page=1&size=1";
    const r=await fetchThuLai(u,{headers:{authorization:token,"Company-Ids":cty}}).catch(()=>null);
    if(!r||!r.ok){ console.log("  "+id+": "+(r?"HTTP "+r.status:"lỗi mạng")); continue; }
    const j=await r.json().catch(()=>null);
    const recs=(j&&(j.records||(j.data&&j.data.records)))||[];
    console.log("  "+id.padStart(5)+": "+String((j&&(j.count ?? j.total)) ?? "?").padStart(7)+" dòng  "+(recs[0]?recs[0].warehouse_name+"  [code "+recs[0].warehouse_code+"]":"(rỗng)"));
  }
}
process.exit(0);
