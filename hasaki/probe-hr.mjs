/** probe-hr.mjs — READ-ONLY: tim nguon email->{code,name,staff_id} cho join phu trach. */
import path from "node:path"; import { fileURLToPath } from "node:url";
import { layTokenSongWms } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const token = await layTokenSongWms(DIR, log);
if (!token) { log("✗ Khong token."); process.exit(2); }
const H = { authorization: token, accept: "application/json", "Company-Ids": "1001" };
const g = async (u) => { try { const r = await fetch(u, { headers: H }); const t = await r.text(); return { s: r.status, t }; } catch (e) { return { s: "ERR", t: e.message }; } };
const urls = [
  ["hsk", "https://wms-gw-external.hasaki.vn/api/v1/auth/user/hsk?page=1&size=3&keyword=duonglt"],
  ["hsk plain", "https://wms-gw-external.hasaki.vn/api/v1/auth/user/hsk?page=1&size=3"],
  ["ext hr search", "https://wms-gw-external.hasaki.vn/api/v1/hr/news/staff/search-for-dropdown?limit=3"],
  ["wshr dropdown (bridge tok)", "https://wshr.hasaki.vn/api/news/staff/search-for-dropdown?limit=3&sort=staff_id"],
  ["wms-gw internal dropdown", "https://wms-gw.inshasaki.com/api/v1/auth/user/hsk?page=1&size=3&keyword=duonglt"],
];
for (const [ten, u] of urls) {
  const { s, t } = await g(u);
  log(`[${s}] ${ten}`);
  if (s === 200) log("     " + t.slice(0, 400).replace(/\s+/g, " "));
}
process.exit(0);
