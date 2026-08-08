/**
 * probe-a8-trangthai-lich.mjs — READ-ONLY: trạng thái LỊCH GỐC toàn kho 863, so A8 với các khu khác.
 * Trả lời: có phải chỉ A8 bị đẩy khỏi trạng thái Approved không, và đẩy lúc nào.
 */
import "dotenv/config";
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms, fetchThuLai } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(...a);
const EXT = "https://wms-gw-external.hasaki.vn/api/v1";
const CTY = 1001, WH = 863;
const token = await layTokenSongWms(DIR, (...a) => log(...a));
if (!token) { log("✗ Không có token phiên sống — dừng."); process.exit(2); }
const HX = { authorization: token, "Company-Ids": String(CTY), accept: "application/json" };
const gj = async (u) => { try { const r = await fetchThuLai(u, { headers: HX }); const t = await r.text(); try { return { s: r.status, j: JSON.parse(t) }; } catch { return { s: r.status, j: null, t: t.slice(0, 300) }; } } catch (e) { return { s: "ERR " + e.message, j: null }; } };

/* 1) Mọi lịch đang sống của kho */
const schs = [];
for (let p = 1; p <= 20; p++) {
  const { j } = await gj(`${EXT}/planogram/schedule/location-schedules?page=${p}&size=100&company_ids=${CTY}&warehouse_ids=${WH}`);
  const r = j?.records || []; schs.push(...r);
  if (!r.length || schs.length >= (j?.count || 0)) break;
}
const khu = (l) => (String(l || "").match(/^F0-(A\d+)/i) || [, "?"])[1].toUpperCase();
const bang = {};
for (const s of schs) {
  const k = khu(s.location_description), st = s.loc_sched_status_id + " " + (s.loc_sched_status_id_name || "");
  bang[k] = bang[k] || {}; bang[k][st] = (bang[k][st] || 0) + 1;
}
log("\n═══ 1) Trạng thái lịch gốc đang sống theo KHU (kho 863) ═══");
for (const k of Object.keys(bang).sort()) log(`  ${k.padEnd(4)} ${JSON.stringify(bang[k])}`);

log("\n═══ 2) A8 — mốc updated_at của từng lịch ═══");
const a8 = schs.filter(s => khu(s.location_description) === "A8").sort((a, b) => String(a.updated_at).localeCompare(String(b.updated_at)));
const theoMoc = {};
for (const s of a8) { const k = String(s.updated_at || "").slice(0, 16); theoMoc[k] = (theoMoc[k] || 0) + 1; }
log("  " + JSON.stringify(theoMoc, null, 1).replace(/\s+/g, " "));

log("\n═══ 3) Các khu KHÁC bị sửa trong 2 ngày qua? ═══");
const gan = schs.filter(s => String(s.updated_at || "") >= "2026-08-06");
const nhom = {};
for (const s of gan) { const k = khu(s.location_description) + " → " + s.loc_sched_status_id + " " + s.loc_sched_status_id_name + " @" + String(s.updated_at).slice(0, 16); nhom[k] = (nhom[k] || 0) + 1; }
for (const k of Object.keys(nhom).sort()) log(`  ${k}  ×${nhom[k]}`);

log("\n═══ 4) Bản ghi thô: lịch ĐANG CHẾT (481530) vs lịch CÒN CHẠY (484980) ═══");
for (const id of [481530, 484980]) {
  const { j } = await gj(`${EXT}/planogram/schedule/location-schedules/detail/${id}?page=1&size=20&is_view_schedule=true`);
  const it = j?.item || {};
  const gon = { ...it }; delete gon.standard_image;
  log(`\n  #${id} (${it.location_description}):`);
  log("  " + JSON.stringify(gon, null, 1).replace(/\n\s*/g, " ").slice(0, 1800));
  log(`  ảnh: ${(it.standard_image || []).map(x => x.image_name + (String(x.image || "").trim() ? "✓" : "✗")).join(" | ")}`);
}

/* 5) Thử tìm endpoint lịch sử phê duyệt */
log("\n═══ 5) Dò endpoint lịch sử/duyệt (đoán URL, chỉ để biết có hay không) ═══");
for (const u of [
  `${EXT}/planogram/schedule/location-schedules/history/481530`,
  `${EXT}/planogram/schedule/location-schedules/histories?schedule_id=481530`,
  `${EXT}/planogram/schedule/location-schedules/log/481530`,
  `${EXT}/planogram/schedule/location-schedules/approve-history/481530`,
]) {
  const { s, j, t } = await gj(u);
  log(`  [${s}] ${u.replace(EXT, "")} ${j ? JSON.stringify(j).slice(0, 160) : (t || "").slice(0, 120)}`);
}
fs.writeFileSync(path.join(DIR, ".exports", "a8-trangthai-lich.json"), JSON.stringify({ at: new Date().toISOString(), bang, theoMoc }, null, 1));
process.exit(0);
