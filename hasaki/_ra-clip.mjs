import "dotenv/config";
import { layTokenSongWork } from "./session-rules.js";
const token = await layTokenSongWork(process.cwd(), ()=>{});
const V="https://wshr.hasaki.vn/api";
for (const id of ["13389950","13393072","13393074","13393784"]) {
  const d=(await (await fetch(V+"/hr/projects/task-input/"+id,{headers:{authorization:token,accept:"application/json"}})).json()).data;
  console.log("\n== "+id, "cha st", d.status, d.data?.configs?.BIN00);
  for (const s of d.subtasks||[]) { const c=s.data?.configs||{}; console.log("  ", s.id, "st", s.status, s.name, "| video02:", JSON.stringify(c.video02||"").slice(0,200), "| PIC02:", JSON.stringify(c.PIC02||"").slice(0,160)); }
  const cm=(await (await fetch(V+"/v2/task/comment?obj_id="+id,{headers:{authorization:token}})).json()).data||[];
  for (const x of cm) console.log("   CMT", x.id, x.created_at, String(x.comment).replace(/\s+/g," ").slice(0,140));
}
