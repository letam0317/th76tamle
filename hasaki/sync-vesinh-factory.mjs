/**
 * sync-vesinh-factory.mjs — VỆ SINH PLANOGRAM cho KHO NGUYÊN LIỆU (F0-KHO-*) → Sheet factory.
 *
 * Nhân đúng LUỒNG của bộ vệ sinh Audit Hasaki (sync-vesinh-all.js): token phiên sống → GET
 * planogram → chuẩn hoá → POST Apps Script ghi tab. Khác 3 điểm:
 *   1. Kho: 1339 WH-MATERIAL-GARMENT (cty 1005) + 1177 WH-MATERIAL-MTG (cty 1002) — nơi mã
 *      F0-KHO thực sự nằm (đối chiếu .pc-cache: 356 + 57 dòng kiểm kê).
 *   2. Sheet đích: Sheet factory (stocklocationfactory), không phải Sheet 5S.
 *   3. Danh mục ô đến từ BẢN VẼ (mtg-danhmuc.mjs) chứ không từ dữ liệu yêu cầu — xem lý do ở đó.
 *
 * ⚠ HIỆN TRẠNG 07/08/2026: cả 2 kho có **0 yêu cầu vệ sinh** và **0 lịch gốc** cho F0-KHO
 * (đã dò cty 1001/1002/1005 × kho 1177/1178/1179/1151/1250/1458/1339/1340/1341/1516). Planogram
 * mới chỉ bật cho SHOP (863 F0-A1/A8, 1147 F0-A2, 1266 F01-SE1). Nên tab DANHMUC hôm nay ghi đủ
 * 161 ô ở trạng thái "chưa khai báo lịch" — sơ đồ vẽ được ngay, và tự có dữ liệu khi bộ phận
 * khai báo + DUYỆT lịch trên planogram, không phải sửa code.
 *
 * 2 tab trên Sheet factory:
 *   VESINH-KHO-DANHMUC — 1 dòng / ô mặt bằng (LUÔN đủ 161 dòng, không bao giờ rỗng)
 *   VESINH-KHO-YEUCAU  — 1 dòng / yêu cầu trong cửa sổ ngày (chỉ ghi khi CÓ; GAS chặn ghi rỗng)
 *
 *   node sync-vesinh-factory.mjs            → ghi Sheet
 *   node sync-vesinh-factory.mjs --dry      → chỉ in, không ghi
 */
import "dotenv/config";
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { layTokenSongWms, fetchThuLai, hashTab, tabKhongDoi, luuHashTab, ghiMocBuoc, gasPost } from "./session-rules.js";
import { DAY, danhSachO, khoaO, TONG_O } from "./mtg-danhmuc.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes("--dry");
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const EXT = "https://wms-gw-external.hasaki.vn/api/v1";
const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const SHEET_ID = process.env.STOCK_SHEET_ID || "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const TAB_DM = "VESINH-KHO-DANHMUC";
const TAB_YC = "VESINH-KHO-YEUCAU";
const NGAY = Number(process.env.VSKHO_NGAY || 45);   // cửa sổ yêu cầu (khớp bộ Hasaki)

/* Kho chứa mã F0-KHO. Quét CẢ HAI công ty vì mã nằm ở 2 kho khác pháp nhân — bỏ 1 bên là
   mất lặng lẽ một nửa mặt bằng khi planogram được bật. */
const BO = [
  { cty: "1005", kho: "1339", ten: "WH - MATERIAL - GARMENT" },
  { cty: "1002", kho: "1177", ten: "WH - MATERIAL - MTG" },
];

if (!APPSCRIPT_KEY && !DRY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

const token = await layTokenSongWms(DIR, log);
if (!token) { log("✗ Không có token phiên sống — chạy lại khi operator online."); process.exit(2); }

const p2 = (n) => (n < 10 ? "0" : "") + n;
const isoNgay = (d) => d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
const hnay = new Date();
const tu = new Date(hnay.getTime() - NGAY * 86400000);
const mocMs = (d, cuoi) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), cuoi ? 23 : 0, cuoi ? 59 : 0, cuoi ? 59 : 0).getTime() + (cuoi ? 999 : 0);

/* ---------- 1) Yêu cầu vệ sinh + lịch gốc của 2 kho ---------- */
const yc = [], lich = [];
for (const b of BO) {
  const HX = { authorization: token, "Company-Ids": b.cty, accept: "application/json" };
  const base = `${EXT}/planogram/schedule-requests?company_ids=${b.cty}&warehouse_ids=${b.kho}` +
    `&from_date=${mocMs(tu)}&to_date=${mocMs(hnay, 1)}`;
  for (let p = 1; p <= 100; p++) {
    const j = await (await fetchThuLai(`${base}&page=${p}&size=100`, { headers: HX })).json();
    const rec = j.records || [];
    yc.push(...rec.filter((r) => /^F0-KHO/i.test(r.location_description || "")));
    if (!rec.length || (j.count != null && p * 100 >= j.count)) break;
  }
  for (let p = 1; p <= 20; p++) {
    const j = await (await fetchThuLai(`${EXT}/planogram/schedule/location-schedules?company_ids=${b.cty}&warehouse_ids=${b.kho}&page=${p}&size=100`, { headers: HX })).json();
    const rec = j.records || [];
    lich.push(...rec.filter((s) => /^F0-KHO/i.test(s.location_description || "")));
    if (!rec.length || (j.count != null && p * 100 >= j.count)) break;
  }
  log(`  ${b.ten} (cty ${b.cty}/kho ${b.kho}): ${yc.length} yêu cầu · ${lich.length} lịch gốc (cộng dồn)`);
}
const apiAt = Date.now();
log(`✓ Tổng: ${yc.length} yêu cầu F0-KHO trong ${NGAY} ngày · ${lich.length} lịch gốc.`);
if (!yc.length) log("  ⚠ KHÔNG có yêu cầu vệ sinh nào — planogram chưa bật cho kho nguyên liệu. Sơ đồ sẽ hiện toàn ô 'chưa khai báo lịch' (đúng thực tế, không phải lỗi).");

/* ---------- 2) Gom theo Ô mặt bằng ---------- */
const ST_TEN = { 1: "New", 3: "Waiting For Approve", 4: "Approved", 7: "Not Performed" };
const daVS = (r) => r.status_id === 3 || r.status_id === 4;
const byO = {}, lichO = {};
yc.forEach((r) => { const k = khoaO(r.location_description); (byO[k] = byO[k] || []).push(r); });
lich.forEach((s) => {
  const k = khoaO(s.location_description), cu = lichO[k];
  if (!cu || s.schedule_id > cu.schedule_id) lichO[k] = s;
});

const HD_DM = ["Location", "Dãy", "Cột", "Có lịch vệ sinh", "Schedule ID", "Trạng thái lịch", "Ảnh tiêu chuẩn",
  "Số yêu cầu " + NGAY + " ngày", "Đã vệ sinh", "Yêu cầu gần nhất", "Trạng thái yêu cầu",
  "Vệ sinh gần nhất", "Người vệ sinh", "Ghi chú"];
const nAnh = (a) => (a || []).filter((x) => String(x.image || "").trim()).length;
const rowsDM = danhSachO().map((o) => {
  const list = (byO[o.loc] || []).slice().sort((a, b) => String(b.request_time).localeCompare(String(a.request_time)));
  const l = lichO[o.loc] || null;
  const xong = list.filter(daVS).sort((a, b) => String(b.executed_at || "").localeCompare(String(a.executed_at || "")));
  const gan = xong[0] || null;
  const ghi = !l ? "Chưa khai báo lịch vệ sinh cho vị trí này"
    : (l.loc_sched_status_id === 3 ? "" : "Lịch chưa được duyệt (" + (l.loc_sched_status_id_name || "?") + ") — không sinh yêu cầu");
  return [o.loc, o.day, o.cot, l ? "Có" : "Không", l ? l.schedule_id : "",
    l ? (l.loc_sched_status_id + " " + (l.loc_sched_status_id_name || "")) : "",
    l ? nAnh(l.standard_image) + "/" + (l.standard_image || []).length : "",
    list.length, xong.length,
    list[0] ? String(list[0].request_time).slice(0, 10) : "",
    list[0] ? (list[0].status_id + " " + (list[0].status_name || ST_TEN[list[0].status_id] || "")) : "",
    gan ? String(gan.executed_at || "").slice(0, 16) : "",
    gan ? (gan.executed_by_name || "") : "", ghi];
});

const HD_YC = ["Request ID", "Schedule request code", "Ngày", "Location", "Dãy", "Cột", "Status ID", "Trạng thái",
  "Executed By", "Executed At", "Schedule ID", "Ảnh"];
const rowsYC = yc.slice().sort((a, b) => String(b.request_time).localeCompare(String(a.request_time))).map((r) => {
  const k = khoaO(r.location_description), p = k.split("-");
  return [r.request_id, r.schedule_request_code || "", String(r.request_time).slice(0, 10), r.location_description,
    p[2] || "", p[3] || "", r.status_id, r.status_name || ST_TEN[r.status_id] || "",
    r.executed_by_name || "", String(r.executed_at || "").slice(0, 16), r.schedule_id,
    (r.request_image || []).map((x) => x.image).filter(Boolean).join(" | ")];
});

/* ---------- 3) Tổng kết ---------- */
const coLich = rowsDM.filter((r) => r[3] === "Có").length;
const daLam = rowsDM.filter((r) => Number(r[8]) > 0).length;
log("");
log(`── Mặt bằng kho nguyên liệu: ${TONG_O} ô / ${DAY.length} dãy`);
log(`   có lịch vệ sinh : ${coLich}/${TONG_O}`);
log(`   từng được vệ sinh trong ${NGAY} ngày: ${daLam}/${TONG_O}`);
DAY.forEach((d) => {
  const rs = rowsDM.filter((r) => r[1] === d.d);
  log(`   ${("F0-KHO-" + d.d).padEnd(12)} ${String(rs.length).padStart(2)} ô · có lịch ${rs.filter((r) => r[3] === "Có").length} · đã vệ sinh ${rs.filter((r) => Number(r[8]) > 0).length}`);
});

fs.mkdirSync(path.join(DIR, ".exports"), { recursive: true });
fs.writeFileSync(path.join(DIR, ".exports", "vesinh-kho-factory.json"),
  JSON.stringify({ at: new Date().toISOString(), apiAt, ngay: NGAY, danhmuc: { header: HD_DM, rows: rowsDM }, yeucau: { header: HD_YC, rows: rowsYC } }, null, 2));

if (DRY) { log(""); log("(--dry) Không ghi Sheet."); process.exit(0); }

/* ---------- 4) Ghi Sheet factory ---------- */
async function ghi(tab, header, rows) {
  if (!rows.length) { log(`  = ${tab}: 0 dòng — BỎ QUA (GAS chặn ghi rỗng để khỏi xoá trắng tab).`); return; }
  const h = hashTab(header, rows);
  if (tabKhongDoi(DIR, tab, h)) { log(`  = ${tab}: dữ liệu không đổi — bỏ qua ghi (${rows.length} dòng).`); return; }
  for (let i = 0; i < rows.length; i += 4000) {
    const body = JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, tab, sheetId: SHEET_ID,
      header, rows: rows.slice(i, i + 4000), append: i > 0, apiAt });
    const j = await gasPost(body, log, tab + " gói " + (i / 4000 + 1));   // nonce chặn ghi trùng khi thử lại
    if (j.status !== "success") throw new Error("Apps Script từ chối (" + tab + "): " + (j.message || "?"));
  }
  luuHashTab(DIR, tab, h);
  log(`  ✓ ${tab}: đã ghi ${rows.length} dòng × ${header.length} cột.`);
}
log("");
await ghi(TAB_DM, HD_DM, rowsDM);
await ghi(TAB_YC, HD_YC, rowsYC);
ghiMocBuoc(DIR, "vesinh-kho");
log(`  https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`);
process.exit(0);
