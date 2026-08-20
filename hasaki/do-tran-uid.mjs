/**
 * do-tran-uid.mjs — vòng 2: chốt CHÍNH XÁC mép 414 (giữa 400 và 600 UID) rồi thu 500 UID THẬT
 * làm bộ mẫu để đo tốc độ bản nâng cấp. node do-tran-uid.mjs
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const GW = "https://wms-gw.inshasaki.com/api/v1/wms/report-management/report-inventories";
const token = await layTokenSongWms(DIR, (...a) => console.log(...a));
if (!token) { console.error("✗ không có token sống"); process.exit(2); }
const H = { authorization: token, "Company-Ids": "1002", "user-agent-type": "web" };
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

async function goi(params) {
  const u = new URL(GW);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const t0 = Date.now();
  const r = await fetch(u, { headers: H });
  const body = await r.text();
  let j = null; try { j = JSON.parse(body); } catch { /* html 414 */ }
  return { status: r.status, ms: Date.now() - t0, urlLen: u.toString().length, j, bytes: body.length };
}

/* --- (1) mép 414: nhị phân giữa 400 (OK) và 600 (414) bằng UID giả --- */
console.log("\n=== Mép 414 (UID giả) ===");
const gia = (n) => Array.from({ length: n }, (_, i) => "VN9" + String(i).padStart(10, "0")).join(",");
for (const n of [450, 500, 520, 550]) {
  const k = await goi({ page: 1, size: 1, uids: gia(n) });
  console.log("uids×" + String(n).padEnd(5) + " urlLen=" + String(k.urlLen).padEnd(6) + " → " + k.status + " (" + k.ms + "ms)");
  await nghi(250);
}

/* --- (2) thu 500 UID THẬT làm bộ mẫu đo (1 lượt, có lọc kho cho nhanh) --- */
console.log("\n=== Thu 500 UID thật (kho MATERIAL 1177) ===");
const t0 = Date.now();
const k = await goi({ page: 1, size: 500, warehouse_ids: 1177 });
const recs = (k.j && k.j.records) || [];
console.log("→ " + k.status + " " + recs.length + " bản ghi, " + Math.round(k.bytes / 1024) + " KB, " + (Date.now() - t0) + " ms (count kho=" + (k.j && k.j.count) + ")");
if (recs.length) {
  fs.writeFileSync(path.join(DIR, "mau-500-uid.txt"), recs.map((x) => x.uid).join("\n"));
  console.log("→ đã ghi mau-500-uid.txt");
}
