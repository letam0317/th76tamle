// CHỈ ĐỌC: liệt kê các job export gần nhất trên wshr (không queue job mới).
import path from "node:path"; import { fileURLToPath } from "node:url"; import "dotenv/config";
import { layTokenSongWork } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const API = "https://wshr.hasaki.vn/api/hr/excel-io";
const tk = await layTokenSongWork(DIR, (...a) => console.log(...a));
if (!tk) { console.log("✗ không có phiên sống"); process.exit(1); }
const r = await fetch(API + "?limit=50", { headers: { authorization: tk } });
const j = await r.json();
const rows = j.data?.rows || [];
console.log("HTTP " + r.status + " · tổng " + rows.length + " job");
for (const x of rows.slice(0, 25)) {
  console.log([x.created_at || x.updated_at || "?", "type=" + x.type, "status=" + x.status,
    (x.param?.from_date || "") + ".." + (x.param?.to_date || ""), "wfid=" + (x.param?.wfid || "-"),
    "by=" + (x.created_by || x.user_id || x.staff_name || "-"), (x.file_path || "").slice(-40)].join(" | "));
}
process.exit(0);
