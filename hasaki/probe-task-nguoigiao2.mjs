import path from "node:path";
import { fileURLToPath } from "node:url";
import { layTokenSongWork, fetchThuLai } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const w = await layTokenSongWork(DIR, () => {});
for (const id of [13373859, 13371951]) {
  const j = await (await fetchThuLai(`https://wshr.hasaki.vn/api/hr/projects/task-input/${id}`, { headers: { authorization: w, accept: "application/json" } })).json();
  const d = j?.data || {};
  console.log(`\n#${id} ${d.name} · created_by=${d.created_by}`);
  console.log("  created_by_user:", JSON.stringify(d.created_by_user));
  console.log("  assign_to_user:", JSON.stringify(d.assign_to_user));
}
