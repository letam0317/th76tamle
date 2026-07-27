/** probe-join.mjs — READ-ONLY: kiem chung join email->{code,name} phu song executor F0-A1/F0-A8. */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const token = await layTokenSongWms(DIR, log);
if (!token) { log("✗"); process.exit(2); }
const dir = (await (await fetch("https://wshr.hasaki.vn/api/news/staff/search-for-dropdown?limit=10000&sort=staff_id", { headers: { authorization: token } })).json()).data || [];
log("Danh ba wshr:", dir.length, "NV. Field mau:", Object.keys(dir[0] || {}).slice(0, 14).join(","));
const byEmail = {};
for (const s of dir) if (s.staff_email) byEmail[String(s.staff_email).toLowerCase()] = { code: s.code, name: s.staff_name, staff_id: s.staff_id, user_id: s.user_id };
const probe = JSON.parse(fs.readFileSync(path.join(DIR, ".exports", "probe-phutrach.json"), "utf8"));
const emails = probe.emails || [];
let hit = 0, miss = [];
for (const e of emails) { const m = byEmail[String(e).toLowerCase()]; if (m) hit++; else miss.push(e); }
log(`Join executor: ${hit}/${emails.length} khop code+name.`);
if (miss.length) log("  Miss: " + miss.join(", "));
log("Vi du:");
emails.slice(0, 6).forEach(e => { const m = byEmail[e.toLowerCase()] || {}; log(`  ${e} -> code=${m.code||"?"} name=${m.name||"?"}`); });
process.exit(0);
