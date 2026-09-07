/** probe-dieu-huong.mjs — READ-ONLY: soi task "[Manual] Giải trình & ghi nhận vi phạm Kho Tổng"
 *  để tìm (1) bước hiện tại + log ĐIỀU HƯỚNG (lý do "không có sku để check.") nằm ở trường nào,
 *  (2) endpoint điều hướng bước trong swagger nội bộ /api/doc.json.
 *  Chạy: node probe-dieu-huong.mjs [task_id]        (mặc định 13522322)
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWork } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, ".exports");
const ID = Number(process.argv[2] || 13522322);
const V = "https://wshr.hasaki.vn/api";

const work = await layTokenSongWork(DIR, console.log);
if (!work) { console.log("✗ thiếu token work — chạy node login-hasaki.js"); process.exit(2); }
const H = { authorization: work, accept: "application/json" };
const getJ = async (u) => {
  const r = await fetch(u, { headers: H, signal: AbortSignal.timeout(30000) });
  const t = await r.text();
  console.log("GET", u.replace(V, ""), "→", r.status, "(" + t.length + "B)");
  try { return JSON.parse(t); } catch { return { _raw: t.slice(0, 300) }; }
};

fs.mkdirSync(OUT, { recursive: true });

/* 1) Chi tiết task theo 2 đường đã biết */
const inp = await getJ(`${V}/hr/projects/task-input/${ID}`);
fs.writeFileSync(path.join(OUT, `dieu-huong-task-${ID}-input.json`), JSON.stringify(inp, null, 1));
const cmt = await getJ(`${V}/v2/task/comment?obj_id=${ID}`);
fs.writeFileSync(path.join(OUT, `dieu-huong-task-${ID}-cmt.json`), JSON.stringify(cmt, null, 1));

/* Tóm tắt task */
const d = inp && (inp.data || inp);
if (d && (d.name || d.code)) {
  console.log("\n── TASK #" + ID + " · " + (d.code || "") + " · " + (d.name || ""));
  console.log("   status=" + d.status + " · workflow_id=" + (d.workflow_id || (d.workflow && d.workflow.id) || "?") +
    " · parent_id=" + (d.parent_id || "") + " · current_step=" + JSON.stringify(d.current_step && { id: d.current_step.id, name: d.current_step.name }));
  console.log("   khoá cấp 1:", Object.keys(d).join(","));
}

/* 2) Lùng chuỗi lý do + dấu vết điều hướng trong toàn bộ JSON */
const bai = JSON.stringify(inp) + "\n" + JSON.stringify(cmt);
for (const tu of ["không có sku", "khong co sku", "điều hướng", "dieu huong", "redirect", "tamlc"]) {
  const i = bai.toLowerCase().indexOf(tu.toLowerCase());
  console.log((i >= 0 ? "  ⚑ THẤY" : "  · không thấy") + " «" + tu + "»" + (i >= 0 ? " … " + bai.slice(Math.max(0, i - 160), i + 160).replace(/\s+/g, " ") : ""));
}

/* 3) Swagger: tìm endpoint điều hướng/chuyển bước */
const doc = await getJ(`${V}/doc.json`);
const paths = (doc && doc.paths) || {};
const KEY = /(redirect|navigat|step|flow|transfer|move|forward|return|back|reassign|assign|log|history|activity)/i;
const hits = [];
for (const [p, methods] of Object.entries(paths)) {
  if (!KEY.test(p)) continue;
  for (const [m, spec] of Object.entries(methods)) {
    hits.push(m.toUpperCase().padEnd(6) + p + "  — " + ((spec && (spec.summary || spec.description)) || "").slice(0, 90));
  }
}
console.log("\n── SWAGGER: " + hits.length + " endpoint dính từ khoá:");
hits.forEach((h) => console.log("   " + h));
fs.writeFileSync(path.join(OUT, "dieu-huong-swagger-hits.txt"), hits.join("\n"));
console.log("\nĐã lưu raw vào .exports/dieu-huong-task-" + ID + "-*.json");
