/* Tạm 02/10: THAY file trên 1 trường của phiếu/bước WF (vd VID01 của phiếu cha, video02 của B1) — QC-01: xoá trắng rồi nạp bản mới, đọc lại.
 * node _thay-file-phieu.mjs <id phiếu hoặc bước> <KEY> <file...> [--lam]   (không --lam = diễn tập) */
import "dotenv/config"; import fs from "node:fs"; import path from "node:path"; import https from "node:https";
import { layTokenSongWork } from "./session-rules.js";
const V = "https://wshr.hasaki.vn/api";
const LAM = process.argv.includes("--lam"); const [id, KEY, ...files] = process.argv.slice(2).filter((x) => x !== "--lam");
const token = await layTokenSongWork(process.cwd(), () => {});
const H = { authorization: token, origin: "https://work.hasaki.vn", referer: "https://work.hasaki.vn/" };
const doc = async () => (await (await fetch(V + "/hr/projects/task-input/" + id, { headers: { ...H, accept: "application/json" } })).json()).data || {};
const mime = (f) => /\.jpe?g$/.test(f) ? "image/jpeg" : f.endsWith(".png") ? "image/png" : f.endsWith(".webm") ? "video/webm" : "video/mp4";
async function gui(cap, ds = []) {
  const fd = new FormData(); fd.set("id", String(id)); fd.set("field", "data");
  for (const [k, v] of Object.entries(cap)) fd.set(k, v);
  for (const f of ds) fd.append("value[configs][" + KEY + "][]", new Blob([fs.readFileSync(f)], { type: mime(f) }), path.basename(f));
  const rq = new Response(fd); const body = Buffer.from(await rq.arrayBuffer());
  return new Promise((ok, no) => { const q = https.request(V + "/hr/projects/mass-update-field-task-input", { method: "POST", headers: { ...H, "content-type": rq.headers.get("content-type"), "content-length": body.length } }, (s) => { let t = ""; s.on("data", (c) => (t += c)); s.on("end", () => ok({ http: s.statusCode, t: t.slice(0, 200) })); });
    q.setTimeout(1200000, () => q.destroy(new Error("hết 20 phút"))); q.on("error", no); q.end(body); });
}
const d = await doc(); const cf = (d.data && d.data.configs) || {};
console.log("phiếu", id, "st", d.status, "·", KEY, "cũ:", JSON.stringify(cf[KEY]));
for (const f of files) if (!fs.existsSync(f)) { console.log("✗ thiếu", f); process.exit(1); }
console.log("sẽ nạp:", files.map((f) => path.basename(f) + " " + (fs.statSync(f).size / 1048576).toFixed(1) + "MB").join(", "));
if (!LAM) { console.log("(diễn tập)"); process.exit(0); }
console.log("xoá trắng:", (await gui({ ["value[configs][" + KEY + "]"]: "" })).http);
console.log("nạp:", (await gui({}, files)).http);
const c2 = ((await doc()).data || {}).configs || {};
console.log("đọc lại", KEY + ":", JSON.stringify(c2[KEY]), Array.isArray(c2[KEY]) && c2[KEY].length === files.length ? "✓" : "✗");
