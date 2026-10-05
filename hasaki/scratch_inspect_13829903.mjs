import path from "node:path";
import { fileURLToPath } from "node:url";
import { layTokenSongWork } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const V = "https://wshr.hasaki.vn/api";
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

(async () => {
  const token = await layTokenSongWork(DIR, log);
  if (!token) process.exit(1);

  const res = await fetch(`${V}/hr/projects/task-input/13829903`, { headers: { authorization: token } });
  const j = await res.json();
  const d = j.data;
  log("Task Code:", d.code);
  log("Task Title:", d.name);
  log("Data configs:", JSON.stringify(d.data && d.data.configs));
  log("Subtasks:");
  for (const s of (d.subtasks || [])) {
    log(`  - Subtask ID ${s.id} | Step ${s.workflow_step_id} | Name: ${s.name} | Status: ${s.status}`);
    log(`    Staff:`, (s.staff || []).map(x => x.info && x.info.staff_name).join(", "));
  }
})();
