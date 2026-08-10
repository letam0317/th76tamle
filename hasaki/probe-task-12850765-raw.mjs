/** probe-task-12850765-raw.mjs — READ-ONLY: kéo cây task workflow 591 tháng 7/2026, bóc RAW
 *  task cha 12850765 + mọi bước con (nhất là B3.1 "Ghi nhận vi phạm vệ sinh kho tổng") để xem
 *  có dấu vết ĐÃ ĐẨY SANG HR (id bản ghi vi phạm / trạng thái trừ KPI) hay không.
 *  Chạy: node probe-task-12850765-raw.mjs [task_id] */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWork } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, ".exports");
const ID = Number(process.argv[2] || 12850765);
const work = await layTokenSongWork(DIR, () => { });
if (!work) { console.log("✗ thiếu token work"); process.exit(2); }
const H = { authorization: work, accept: "application/json" };
const V = "https://wshr.hasaki.vn/api";

const url = `${V}/hr/workflows/detail-workflow-task/591?from_date=2026-07-01&to_date=2026-07-31&search_type=boa`;
const r = await fetch(url, { headers: H });
console.log("detail-workflow-task:", r.status);
const j = await r.json().catch(() => null);
if (!j) { console.log("✗ không parse được JSON"); process.exit(3); }
const tasks = [];
(function walk(o) { if (Array.isArray(o)) return o.forEach(walk); if (o && typeof o === "object") { if (o.id && (o.code || o.name)) tasks.push(o); for (const k in o) walk(o[k]); } })(j);
console.log("tổng bản ghi:", tasks.length);
const cha = tasks.find(t => Number(t.id) === ID);
if (!cha) { console.log("✗ không thấy task", ID, "trong cây tháng 7"); process.exit(4); }
const ho = [cha, ...tasks.filter(t => Number(t.parent_id) === ID)];
fs.writeFileSync(path.join(OUT, `task-${ID}-raw.json`), JSON.stringify(ho, null, 1));
for (const t of ho) {
  console.log(`\n── #${t.id} ${t.code || ""} · ${t.name} · status=${t.status} · percent=${t.percent} · finished_at=${t.finished_at || t.updated_at}`);
  console.log("   khoá:", Object.keys(t).join(","));
  const c = (t.data && t.data.configs) || {};
  for (const k in c) { const v = JSON.stringify(c[k]); if (v && v !== "null" && v !== '""' && v !== "[]") console.log(`   cfg.${k} = ${v.slice(0, 220)}`); }
  const kpi = JSON.stringify(t).match(/"[^"]*(kpi|violat|skill|reason|penalt|punish)[^"]*":[^,}]{0,80}/gi) || [];
  if (kpi.length) console.log("   ⚑ trường liên quan: " + [...new Set(kpi)].slice(0, 20).join(" | "));
  const cm = await (await fetch(`${V}/v2/task/comment?obj_id=${t.id}`, { headers: H })).json().catch(() => null);
  const ds = cm?.data || [];
  console.log(`   bình luận: ${ds.length}` + (ds.length ? " → " + ds.map(x => `${x.created_at || ""} ${(x.staff && x.staff.full_name) || x.created_by || ""}: ${String(x.content || x.comment || "").replace(/<[^>]+>/g, "").slice(0, 120)}`).join(" | ") : ""));
}
