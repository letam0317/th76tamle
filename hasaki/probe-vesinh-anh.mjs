/**
 * probe-vesinh-anh.mjs — READ-ONLY: kiểm tra ẢNH BÁO CÁO VỆ SINH có kéo được không.
 * Mô phỏng đúng link operator đưa:
 *   planogram.hasaki.vn/asset-management/request-of-declaration/list
 *     ?company_ids=1001&warehouse_ids=863&location_description=F0-A1
 *     &status_ids=3&from_date=1784826000000&to_date=1784912399999  (24/07/2026)
 * Các bước:
 *   1. GET list schedule-requests với đúng bộ tham số trên.
 *   2. GET detail 3 request đầu → dump JSON, tìm URL ảnh (filesmanagement/…).
 *   3. Thử TẢI 1 ảnh: có Bearer + không Bearer → status/content-type/bytes.
 * Chỉ token phiên sống (bridge) — KHÔNG login, không đá ai. Chỉ GET.
 */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms } from "./session-rules.js";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const EXT = "https://wms-gw-external.hasaki.vn/api/v1";
const OUT = path.join(DIR, ".exports", "probe-vesinh-anh.json");

const token = await layTokenSongWms(DIR, log);
if (!token) { log("✗ Không có token phiên sống — chạy lại sau khi operator online."); process.exit(2); }
const HX = { authorization: token, "Company-Ids": "1001", accept: "application/json" };
const results = { at: new Date().toISOString(), list: null, details: [], images: [] };

// 1) LIST — đúng tham số link operator (24/07/2026, F0-A1, status 3)
const listUrl = `${EXT}/planogram/schedule-requests?company_ids=1001&warehouse_ids=863` +
  `&from_date=1784826000000&to_date=1784912399999&location_description=F0-A1&status_ids=3&page=1&size=100`;
const rl = await fetch(listUrl, { headers: HX });
const jl = await rl.json().catch(() => null);
log(`[${rl.status}] list count=${jl && jl.count} records=${jl && jl.records && jl.records.length}`);
results.list = { url: listUrl, status: rl.status, count: jl && jl.count,
  sample: jl && jl.records ? jl.records.slice(0, 3) : null };
if (!jl || !jl.records || !jl.records.length) {
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2)); log("✗ List rỗng — dừng."); process.exit(1);
}
// Field nào trong record LIST có chứa url/ảnh?
const listKeys = Object.keys(jl.records[0]);
log("Field record list:", listKeys.join(", "));

// 2) DETAIL 3 request đầu
const pick = jl.records.slice(0, 3);
const urlRe = /https?:\/\/[^"\\ ]+/g;
for (const it of pick) {
  const du = `${EXT}/planogram/schedule-requests/${it.request_id}?page=1&size=20&is_schedule_group=false`;
  const rd = await fetch(du, { headers: HX });
  const txt = await rd.text();
  let jd = null; try { jd = JSON.parse(txt); } catch {}
  const urls = [...new Set(txt.match(urlRe) || [])];
  const imgUrls = urls.filter(u => /filesmanagement|\.(png|jpe?g|webp|gif)/i.test(u));
  log(`[${rd.status}] detail #${it.request_id} loc=${it.location_description} exec=${it.executed_by_name || "-"} → ${imgUrls.length} url ảnh`);
  imgUrls.forEach(u => log("    ", u.slice(0, 150)));
  results.details.push({ request_id: it.request_id, loc: it.location_description, status: rd.status,
    image_urls: imgUrls, body: txt.slice(0, 20000) });
  await new Promise(r => setTimeout(r, 300));
}

// 3) TẢI THỬ 1 ảnh (ưu tiên ảnh KHÔNG phải /standard/ = ảnh báo cáo thật)
const allImgs = results.details.flatMap(d => d.image_urls);
const reportImg = allImgs.find(u => !/\/standard\//.test(u)) || allImgs[0];
if (reportImg) {
  for (const [ten, hd] of [["CÓ Bearer", { authorization: token }], ["KHÔNG Bearer", {}]]) {
    try {
      const r = await fetch(reportImg, { headers: hd });
      const buf = Buffer.from(await r.arrayBuffer());
      log(`Tải ảnh (${ten}): HTTP ${r.status} · ${r.headers.get("content-type")} · ${buf.length} bytes`);
      results.images.push({ ten, url: reportImg, status: r.status, type: r.headers.get("content-type"), bytes: buf.length });
      if (r.ok && buf.length > 1000 && ten === "CÓ Bearer")
        fs.writeFileSync(path.join(DIR, ".exports", "anh-vesinh-test" + (path.extname(new URL(reportImg).pathname) || ".jpg")), buf);
    } catch (e) { log(`Tải ảnh (${ten}) lỗi: ${e.message}`); results.images.push({ ten, url: reportImg, err: e.message }); }
  }
} else log("⚠ Không tìm thấy URL ảnh nào trong detail.");

fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
log("Đã lưu:", OUT); process.exit(0);
