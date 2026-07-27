/**
 * sync-vesinh-all.js — BỘ ĐỒNG BỘ VỆ SINH GỘP (SHOP - 170 QUOC LO 1A)
 * ============================================================================
 *  THAY THẾ 2 bộ cũ (sync-phutrach-quayke.js + sync-chamcong-vesinh.js) để
 *  TỐI ƯU TẢI HỆ THỐNG WMS/HR: chỉ QUÉT PLANOGRAM 1 LẦN + GỌI DANH BẠ 1 LẦN
 *  + TIMESHEET 1 LẦN, rồi sinh CẢ HAI tập dữ liệu.
 *  (Trước đây 2 bộ quét planogram 2 lần + gọi danh bạ 2 lần mỗi lượt cụm.)
 *
 *  Sinh 4 tab trên Google Sheet 5S (vẫn CHỈ 1 lượt quét planogram + 1 danh bạ + 1 timesheet):
 *   • PHU-TRACH-QUAY-KE : Location | Executed By | Code | Name
 *       - mọi vị trí F0-A1 (quầy kệ) + F0-A8 (không gian làm việc) + người phụ trách gần nhất.
 *   • CHAMCONG-VESINH   : Code | Name | Email | Major | Giờ vào | Giờ ra | Đã vệ sinh hôm nay | Vị trí gần nhất | Trạng thái
 *       - đội vệ sinh × chấm công hôm nay × đã vệ sinh hôm nay ("đi làm nhưng chưa vệ sinh").
 *   • VESINH-YEUCAU     : từng YÊU CẦU vệ sinh HÔM NAY (request planogram) — trạng thái thật
 *       (New/Waiting For Approve/Approved…), người thực hiện + giờ, phụ trách dự kiến (executor
 *       gần nhất 45 ngày) × chấm công, và ẢNH BÁO CÁO (request_image — URL công khai, dashboard
 *       hotlink thẳng không cần token). Nguồn tile "Tổng yêu cầu / Đã VS / Chưa VS / Không có ca".
 *   • VESINH-NHATKY     : nhật ký NV × NGÀY × khu vực → danh sách vị trí đã vệ sinh (45 ngày) —
 *       nguồn pop-up "tra cứu 1 nhân viên làm ở đâu theo ngày" (F0-A8 đổi theo ngày, F0-A1 theo tuần).
 *
 *  AN TOÀN PHIÊN: chỉ token phiên SỐNG (layTokenSongWms) — không login mới, không đá phiên.
 *  Không có token sống → HOÃN (exit 75) để sync-guard chạy lại (cụm 8h40, sau các bộ đã nạp token).
 *
 *  node sync-vesinh-all.js [--dry]
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenSongWms, DeferError, thoatTheoLoi, fetchThuLai, ghiMocBuoc, boQuaNeuDaTuoi, hashTab, tabKhongDoi, luuHashTab, chamMocTabs } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const SHEET_HASAKI = "1FWffWi75aATbokfqIcqjByEPzkJLQBngTXp5aPOIbLM";   // Sheet 5S (dashboard đọc)
const TAB_PT = "PHU-TRACH-QUAY-KE";
const TAB_CC = "CHAMCONG-VESINH";
const TAB_YC = "VESINH-YEUCAU";
const TAB_NK = "VESINH-NHATKY";
const EXT = "https://wms-gw-external.hasaki.vn/api/v1";
const WSHR_DIR = "https://wshr.hasaki.vn/api/news/staff/search-for-dropdown?limit=10000&sort=staff_id";
const TIMESHEET = "https://wshr.hasaki.vn/api/hr/timesheet";
const WAREHOUSE_ID = process.env.PHUTRACH_WH || "863";      // SHOP - 170 QUOC LO 1A
const HR_LOCATION = process.env.VS_HR_LOC || "398";
const HR_DEPT = process.env.VS_HR_DEPT || "121";
const COMPANY_IDS = "1001";
const AREA_RE = /^F0-A1|^F0-A8/i;
const WINDOW_DAYS = Number(process.env.PHUTRACH_DAYS || 45);
const YC_DAYS = Number(process.env.VS_YC_DAYS || 7);        // VESINH-YEUCAU giữ N ngày (xem lại lịch sử trên sơ đồ)
const YC_ANH_NGAY = Number(process.env.VS_ANH_NGAY || 3);   // chỉ đính URL ảnh cho N ngày gần nhất (giảm payload)
const SIZE = 500, MAX_PAGE = 300;
const DRY = process.argv.includes("--dry");
const HEADER_PT = ["Location", "Executed By", "Code", "Name", "Executed At"];
const HEADER_CC = ["Code", "Name", "Email", "Major", "Giờ vào", "Giờ ra", "Đã vệ sinh hôm nay", "Vị trí gần nhất", "Trạng thái"];
const HEADER_YC = ["Request ID", "Ngày", "Location", "Khu vực", "Status ID", "Trạng thái", "Executed By", "Executed At", "Phụ trách", "PT Code", "PT Name", "PT đi làm", "PT giờ vào", "Ảnh", "PT lần cuối"];
const HEADER_NK = ["Ngày", "Email", "Code", "Name", "Khu vực", "Số vị trí", "Vị trí"];

const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
if (!APPSCRIPT_KEY && !DRY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

function hhmm(ts){ if (!ts) return ""; return new Date(ts * 1000).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }); }
function todayVN(){ return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }); }   // YYYY-MM-DD

/** CHỐT AN TOÀN PII: tab mới (email NV) chỉ được ghi khi GAS ĐÃ deploy whitelist mới —
 *  GAS cũ sẽ ghi nhầm vào SHEET PUBLIC. Probe action=readTab: GAS mới trả success/empty,
 *  GAS cũ trả "Tab không được phục vụ". Lỗi mạng → coi như CHƯA sẵn sàng (an toàn). */
async function gasPhucVuTab(tab){
  try {
    const r = await fetchThuLai(APPSCRIPT_URL + "?action=readTab&tab=" + encodeURIComponent(tab) + "&callback=cb");
    return !/không được phục vụ/i.test(await r.text());
  } catch { return false; }
}
async function ghiTab(tab, header, rows){
  if (DRY){ fs.mkdirSync(path.join(DIR, ".exports"), { recursive: true }); fs.writeFileSync(path.join(DIR, ".exports", tab + "-out.json"), JSON.stringify({ header, rows }, null, 2)); log("  (DRY) " + tab + ": " + rows.length + " dòng → .exports/" + tab + "-out.json"); return; }
  if (!rows.length){ log("  ⚠ " + tab + ": 0 dòng — BỎ QUA (giữ dữ liệu cũ)."); return; }
  // Nhịp poller 15': dữ liệu thường KHÔNG đổi giữa 2 lượt — so hash với lần ghi trước, giống thì khỏi ghi.
  const hash = hashTab(header, rows);
  if (tabKhongDoi(DIR, tab, hash)) {
    log("  = " + tab + ": không đổi — bỏ qua ghi (" + rows.length + " dòng).");
    await chamMocTabs([tab], Date.now(), log);   // chip giờ dashboard vẫn chạy theo giờ quét planogram thật
    return;
  }
  // KHÔNG truyền sheetId → GAS tự định tuyến 2 tab whitelist (SERVE_PRIVATE_TABS) sang SHEET PRIVATE bí mật.
  const body = JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, tab, header, rows, apiAt: Date.now() });
  const j = await (await fetchThuLai(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body })).json();
  if (j.status !== "success") throw new Error("Ghi " + tab + " lỗi: " + (j.message || "?"));
  luuHashTab(DIR, tab, hash);
  log("  ✓ " + tab + ": ghi " + (j.written || rows.length) + " dòng.");
}

(async () => {
  // Lượt guard chạy VÁ bước khác mà vesinh hôm nay đã xong → thoát sớm (mốc .sync-ok-vesinh).
  if (!DRY && boQuaNeuDaTuoi(DIR, "vesinh", log)) process.exit(0);
  const token = await layTokenSongWms(DIR, log);
  if (!token) throw new DeferError("Chưa có token phiên sống — hoãn, sync-guard sẽ chạy lại.");
  const H = { authorization: token };
  const HX = { authorization: token, "Company-Ids": COMPANY_IDS };
  const today = todayVN();

  // 1) DANH BẠ wshr → email -> { code, name, major }. CACHE 12h (.cache-danhba.json — có PII,
  // đã gitignore): nhịp poller 15' mà tải lại 5.6k NV mỗi lượt là dội wshr vô ích; danh bạ đổi theo ngày.
  const CACHE_DB = path.join(DIR, ".cache-danhba.json");
  const byEmail = {};
  let dsNV = null;
  try { const c = JSON.parse(fs.readFileSync(CACHE_DB, "utf8")); if (Date.now() - c.at < 12 * 3600 * 1000 && Array.isArray(c.data) && c.data.length) dsNV = c.data; } catch { /* chưa có cache */ }
  if (dsNV) log("✓ Danh bạ wshr: dùng cache <12h (" + dsNV.length + " NV, khỏi gọi lại).");
  else {
    try {
      dsNV = (await (await fetch(WSHR_DIR, { headers: H })).json()).data || [];
      try { fs.writeFileSync(CACHE_DB, JSON.stringify({ at: Date.now(), data: dsNV })); } catch { /* cache best-effort */ }
      log("✓ Danh bạ wshr (tải mới): " + dsNV.length + " NV.");
    } catch (e) {
      try { dsNV = JSON.parse(fs.readFileSync(CACHE_DB, "utf8")).data || []; log("  ⚠ Danh bạ wshr lỗi (" + e.message + ") — dùng cache cũ " + dsNV.length + " NV."); }
      catch { dsNV = []; log("  ⚠ Danh bạ wshr lỗi (" + e.message + ") — vẫn ghi email, để trống Code/Name."); }
    }
  }
  for (const s of dsNV) if (s.staff_email) byEmail[String(s.staff_email).toLowerCase()] = { code: String(s.code || ""), name: s.staff_name || "", major: s.staff_major || "" };

  // 2) QUÉT PLANOGRAM (1 LẦN) → gom đồng thời: (a) phụ trách theo vị trí; (b) đội vệ sinh + đã vệ sinh hôm nay
  const DAY = 24 * 3600 * 1000, now = Date.now();
  const to = now, from = now - WINDOW_DAYS * DAY;
  const isoNgay = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  const mocYc = isoNgay(now - (YC_DAYS - 1) * DAY), mocAnh = isoNgay(now - (YC_ANH_NGAY - 1) * DAY);
  const base = `${EXT}/planogram/schedule-requests?company_ids=${COMPANY_IDS}&warehouse_ids=${WAREHOUSE_ID}&from_date=${from}&to_date=${to}`;
  const loc = {};    // location -> { at, email }              (PHU-TRACH)
  const team = {};   // emailLower -> { email, lastAt, todayCount, todayLoc }   (CHAMCONG)
  const reqToday = [];  // yêu cầu cửa sổ YC_DAYS ngày           (VESINH-YEUCAU)
  const nhatky = {};    // "ngày|email|khu" -> { locs:[] }      (VESINH-NHATKY)
  const khuOf = (L) => /^F0-A8/i.test(L) ? "Không gian làm việc (F0-A8)" : "Quầy kệ (F0-A1)";
  let scanned = 0, total = null, pages = 0;
  for (let page = 1; page <= MAX_PAGE; page++) {
    const r = await fetchThuLai(base + "&page=" + page + "&size=" + SIZE, { headers: HX });
    if (r.status === 401 || r.status === 403) throw new DeferError("Token hết hạn giữa chừng (HTTP " + r.status + ").");
    if (!r.ok) { log("  ⚠ planogram trang " + page + " HTTP " + r.status); break; }
    const j = await r.json().catch(() => null); if (!j || !j.records || !j.records.length) { if (total === null) total = j && j.count; break; }
    if (total === null) total = j.count ?? null;
    scanned += j.records.length; pages = page;
    for (const it of j.records) {
      const L = String(it.location_description || ""); if (!AREA_RE.test(L)) continue;
      const email = String(it.executed_by_name || "").trim();
      const at = it.executed_at || "";
      // (a) phụ trách theo vị trí: giữ MỌI vị trí; gắn executor gần nhất
      const cl = loc[L] || (loc[L] = { at: "", email: "" });
      if (email && at > cl.at) { cl.at = at; cl.email = email; }
      // (b) đội vệ sinh: chỉ dòng có executor
      if (email) {
        const k = email.toLowerCase();
        const t = team[k] || (team[k] = { email: email, lastAt: "", todayCount: 0, todayLoc: "" });
        if (at > t.lastAt) t.lastAt = at;
        if (at.slice(0, 10) === today) { t.todayCount++; if (L > t.todayLoc) t.todayLoc = L; }
        // (d) nhật ký NV × ngày × khu vực (nguồn "tra cứu NV làm ở đâu theo ngày")
        const nk = nhatky[at.slice(0, 10) + "|" + k + "|" + khuOf(L)] || (nhatky[at.slice(0, 10) + "|" + k + "|" + khuOf(L)] = { locs: [] });
        if (!nk.locs.includes(L)) nk.locs.push(L);
      }
      // (c) yêu cầu trong CỬA SỔ YC_DAYS ngày (mọi trạng thái) + ảnh báo cáo (chỉ YC_ANH_NGAY ngày gần)
      const ngayYC = String(it.request_time || "").slice(0, 10);
      if (ngayYC >= mocYc) {
        reqToday.push({
          id: it.request_id, ngay: ngayYC, loc: L, khu: khuOf(L),
          stId: it.status_id, stName: it.status_name || "",
          email: email, at: at,
          anh: ngayYC >= mocAnh ? (it.request_image || []).map((x) => x && x.image).filter(Boolean).join(" | ") : ""
        });
      }
    }
    if (j.records.length < SIZE) break;
    await nghi(250);
  }
  log("✓ Quét planogram (1 lần, " + pages + " trang): " + scanned + " request (count=" + total + "). Vị trí: " + Object.keys(loc).length + " · đội vệ sinh: " + Object.keys(team).length + ".");

  // 3) TIMESHEET hôm nay (1 LẦN) → att theo mã NV
  const att = {}; let tsRows = 0;
  for (let off = 0; off < 20000; off += 2000) {
    const u = `${TIMESHEET}?location_id=${HR_LOCATION}&department_id=${HR_DEPT}&from_date=${today}&to_date=${today}&limit=2000&offset=${off}`;
    const r = await fetchThuLai(u, { headers: H });
    if (!r.ok) { log("  ⚠ timesheet HTTP " + r.status); break; }
    const j = await r.json().catch(() => null); const rr = (j && j.data && j.data.rows) || [];
    if (!rr.length) break; tsRows += rr.length;
    for (const row of rr) {
      const code = String((row.staff && row.staff.code) || row.staff_code || ""); if (!code) continue;
      const a = att[code] || (att[code] = { ci: null, co: null });
      if (row.check_in && (!a.ci || row.check_in < a.ci)) a.ci = row.check_in;
      if (row.check_out && (!a.co || row.check_out > a.co)) a.co = row.check_out;
    }
    if (rr.length < 2000) break;
  }
  log("✓ Timesheet hôm nay (1 lần, loc " + HR_LOCATION + "/dept " + HR_DEPT + "): " + tsRows + " dòng.");

  // 4a) Bảng PHU-TRACH-QUAY-KE
  const rowsPT = Object.keys(loc).sort().map((L) => {
    const e = loc[L].email, m = e ? (byEmail[e.toLowerCase()] || {}) : {};
    return [L, e, m.code || "", m.name || "", loc[L].at || ""];
  });
  const coNguoi = rowsPT.filter(r => r[1]).length;
  log("→ PHU-TRACH: " + rowsPT.length + " vị trí (" + coNguoi + " có người, " + (rowsPT.length - coNguoi) + " chưa báo cáo).");

  // 4b) Bảng CHAMCONG-VESINH (gộp đội theo mã NV)
  const byCode = {};
  for (const k in team) {
    const t = team[k], m = byEmail[k] || {};
    const idk = m.code || k;
    const e = byCode[idk] || (byCode[idk] = { code: m.code || "", name: m.name || "", email: t.email, major: m.major || "", todayCount: 0, todayLoc: "", lastAt: "" });
    e.todayCount += t.todayCount;
    if (t.todayLoc > e.todayLoc) e.todayLoc = t.todayLoc;
    if (t.lastAt > e.lastAt) e.lastAt = t.lastAt;
  }
  const rowsCC = Object.values(byCode).map((e) => {
    const a = (e.code && att[e.code]) || {};
    const ci = hhmm(a.ci), co = hhmm(a.co);
    const diLam = !!(a.ci || a.co), daVS = e.todayCount > 0;
    const tt = !diLam ? "Nghỉ / không chấm công" : (daVS ? "Đi làm - đã vệ sinh" : "Đi làm - chưa vệ sinh");
    return [e.code, e.name, e.email, e.major, ci, co, e.todayCount, e.todayLoc, tt];
  });
  const uu = (tt) => tt === "Đi làm - chưa vệ sinh" ? 0 : tt === "Đi làm - đã vệ sinh" ? 1 : 2;
  rowsCC.sort((a, b) => uu(a[8]) - uu(b[8]) || String(a[1]).localeCompare(String(b[1]), "vi"));
  const nDiLam = rowsCC.filter(r => r[8] !== "Nghỉ / không chấm công").length;
  const nChua = rowsCC.filter(r => r[8] === "Đi làm - chưa vệ sinh").length;
  log("→ CHAMCONG: đội " + rowsCC.length + " NV — đi làm " + nDiLam + " (đã vs " + (nDiLam - nChua) + ", CHƯA vs " + nChua + "), nghỉ " + (rowsCC.length - nDiLam) + ".");

  // 4c) Bảng VESINH-YEUCAU — từng yêu cầu (YC_DAYS ngày): trạng thái + executor + phụ trách dự kiến × chấm công + ảnh
  const rowsYC = reqToday
    .sort((a, b) => String(b.ngay).localeCompare(String(a.ngay)) || String(a.loc).localeCompare(String(b.loc)))
    .map((r) => {
      const ptEmail = (loc[r.loc] || {}).email || "";
      const pt = ptEmail ? (byEmail[ptEmail.toLowerCase()] || {}) : {};
      const a = (pt.code && att[pt.code]) || {};
      const ptDiLam = (a.ci || a.co) ? 1 : 0;   // chấm công CHỈ của hôm nay — dashboard chỉ dùng cho ngày hôm nay
      // "PT lần cuối" = NGÀY của bằng chứng phụ trách (executed_at gần nhất 45n) — dashboard đo TUỔI
      // bằng chứng để hạ mức "chưa chắc" khi quá cũ (tránh réo nhầm người đã đổi vị trí/nghỉ việc).
      return [r.id, r.ngay, r.loc, r.khu, r.stId, r.stName, r.email, r.at, ptEmail, pt.code || "", pt.name || "", ptDiLam, hhmm(a.ci), r.anh, String((loc[r.loc] || {}).at || "").slice(0, 10)];
    });
  const nDa = rowsYC.filter((r) => r[4] === 3 || r[4] === 4).length;
  log("→ YEUCAU: " + rowsYC.length + " yêu cầu (" + YC_DAYS + " ngày, " + nDa + " đã vệ sinh).");

  // 4d) Bảng VESINH-NHATKY — NV × ngày × khu vực (45 ngày)
  const rowsNK = Object.keys(nhatky).map((key) => {
    const [ngay, em, khu] = key.split("|");
    const m = byEmail[em] || {};
    const locs = nhatky[key].locs.sort();
    return [ngay, em, m.code || "", m.name || "", khu, locs.length, locs.join(", ")];
  }).sort((a, b) => String(b[0]).localeCompare(String(a[0])) || String(a[3]).localeCompare(String(b[3]), "vi"));
  log("→ NHATKY: " + rowsNK.length + " dòng (NV × ngày × khu, " + WINDOW_DAYS + " ngày).");

  // 5) Ghi 4 tab (2 tab mới có chốt an toàn PII — chỉ ghi khi GAS đã deploy whitelist mới)
  await ghiTab(TAB_PT, HEADER_PT, rowsPT);
  await ghiTab(TAB_CC, HEADER_CC, rowsCC);
  if (DRY || await gasPhucVuTab(TAB_YC)) {
    await ghiTab(TAB_YC, HEADER_YC, rowsYC);
    await ghiTab(TAB_NK, HEADER_NK, rowsNK);
  } else {
    log("  ⚠ GAS chưa deploy whitelist " + TAB_YC + "/" + TAB_NK + " — BỎ QUA 2 tab mới (tránh ghi email NV vào sheet public). Dán google-script.gs mới vào Apps Script rồi deploy.");
  }
  if (!DRY) ghiMocBuoc(DIR, "vesinh");   // mốc thành công cho sync-guard
  log("✓ HOÀN TẤT (1 lượt quét, cả 4 tab).");
  process.exit(0);
})().catch((e) => { thoatTheoLoi(e, log, 2); });
