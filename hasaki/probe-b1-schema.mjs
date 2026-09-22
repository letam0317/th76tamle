import path from "node:path";
import { fileURLToPath } from "node:url";
import { layTokenSongWork } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(...a);

async function probeSchema() {
  const token = await layTokenSongWork(DIR, log);
  if (!token) return;

  const H = { authorization: token, accept: "application/json" };
  
  const res = await fetch("https://wshr.hasaki.vn/api/hr/workflows/591", { headers: H });
  const j = await res.json();
  const wf = j?.data?.workflow || {};

  const configs = wf.configs || [];
  console.log("Total configs:", configs.length);

  const b1Configs = configs.filter(c => String(c.workflow_step_id) === "7379");
  console.log("B1 (7379) Configs:", JSON.stringify(b1Configs, null, 2));
}

probeSchema();
