import path from "node:path";
import { fileURLToPath } from "node:url";
import { layTokenSongWork, fetchThuLai } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const w = await layTokenSongWork(DIR, () => {});
for (const id of [13373859, 13371951, 13373905]) {
  const j = await (await fetchThuLai(`https://wshr.hasaki.vn/api/hr/projects/task-input/${id}`, { headers: { authorization: w, accept: "application/json" } })).json();
  const d = j?.data || {};
  console.log(`\n#${id} ${d.name}`);
  console.log("  keys:", Object.keys(d).join(" | "));
  for (const k of Object.keys(d)) if (/name|by|creat|assign|owner|manager|leader/i.test(k) && typeof d[k] !== "object") console.log(`   ${k} = ${JSON.stringify(d[k])}`);
}
