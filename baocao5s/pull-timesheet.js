/**
 * ============================================================================
 *  DANH BẠ NHÂN SỰ + CHẤM CÔNG HÔM NAY  →  tab NHAN-SU trên Google Sheet
 * ============================================================================
 *  Phạm vi: 2 nghiệp vụ PTCH — Phát triển cửa hàng (71) + Đóng gói (26),
 *           kho location 398, department 121.
 *
 *  NGUỒN DANH SÁCH = mọi NV từng đi làm từ 1/4 (workflow chạy) → nay
 *  (rà lịch sử chấm công), CỘNG với NV hiện có trong danh bạ. Tích luỹ vào
 *  kho .exports/nhansu-cache.json — KHÔNG BAO GIỜ XOÁ (giữ NV đã nghỉ).
 *
 *  TRẠNG THÁI:  "Còn làm"  = còn trong danh bạ WMS + staff_status = 1.
 *               "Đã nghỉ" = bị xoá khỏi danh bạ, HOẶC staff_status ≠ 1 (3/4).
 *
 *  CHẤM CÔNG chỉ lấy NGÀY HÔM NAY; ai có thì điền Giờ vào / Giờ ra.
 *
 *  Chạy:  node pull-timesheet.js               (7h20 sáng / nút PIN)
 *         node pull-timesheet.js --dry         (không ghi Sheet)
 *         FULL_SEED=1 node pull-timesheet.js   (rà lại toàn bộ từ 1/4)
 * ============================================================================
 */
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { layTokenTuPhucHoi } from "./auto-login.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const EDGE_PATH = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PROFILE_DIR = process.env.EDGE_PROFILE_DIR || "C:/Users/lechitam/New folder/baocao5s/.wms-session/edge-profile";
const TAB = "NHAN-SU";
const SHEET_ID = process.env.SHEET_ID || "1FWffWi75aATbokfqIcqjByEPzkJLQBngTXp5aPOIbLM";
const CACHE_FILE = path.join(DIR, ".exports", "nhansu-cache.json");
const DEPARTMENT_ID = 121, LOCATION_ID = 398;
const SEED_FROM = process.env.SEED_FROM || "2026-04-01";     // workflow bắt đầu đầu tháng 4
const MAJOR_NAME = { 71: "Phát triển cửa hàng", 26: "Đóng gói" };
const MAJOR_IDS = Object.keys(MAJOR_NAME).map(Number);
const DRY = process.argv.includes("--dry");
const FULL_SEED = process.env.FULL_SEED === "1";

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
if (!APPSCRIPT_KEY && !DRY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

const pad2 = (n) => String(n).padStart(2, "0");
const homNay = () => { const d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); };
const gio = (ts) => ts ? new Date(ts * 1000).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }) : "";

async function getToken() {
  const browser = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH, userDataDir: PROFILE_DIR, args: ["--disable-blink-features=AutomationControlled"] });
  try {
    const page = (await browser.pages())[0] || (await browser.newPage());
    let token = null;
    page.on("request", (req) => { const a = req.headers()["authorization"]; if (a && /wshr\.hasaki\.vn/.test(req.url()) && !token) token = a; });
    await page.goto("https://hr.hasaki.vn/auth/login", { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
    if (/auth\/login/.test(page.url())) {
      await page.evaluate(() => { const el = [...document.querySelectorAll("a,button")].find(e => /Hasaki SSO|Đăng nhập với/i.test(e.textContent)); el && el.click(); }).catch(() => {});
      await page.waitForFunction(() => !/auth\/(login|callback)/.test(location.href), { timeout: 25000 }).catch(() => {});
    }
    await page.goto("https://hr.hasaki.vn/", { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
    for (let i = 0; i < 15 && !token; i++) await new Promise((r) => setTimeout(r, 1000));
    if (/auth\/(login|callback)/.test(page.url()) || !token) throw new Error("Phiên hr.hasaki.vn đã hết hạn.");
    return token;
  } finally { await browser.close().catch(() => {}); }
}
const getJson = async (url, token) => (await (await fetch(url, { headers: { authorization: token } })).json());

// Kéo timesheet 1 nghiệp vụ trong 1 khoảng (phân trang). Trả mảng rows.
async function keoTimesheet(token, majorId, from, to) {
  const out = []; let off = 0;
  for (let pg = 0; pg < 60; pg++) {
    const rows = ((await getJson("https://wshr.hasaki.vn/api/hr/timesheet?department_id=" + DEPARTMENT_ID + "&location_id=" + LOCATION_ID + "&major_id=" + majorId + "&from_date=" + from + "&to_date=" + to + "&limit=2000&offset=" + off, token)).data?.rows) || [];
    if (!rows.length) break; out.push(...rows); if (rows.length < 2000) break; off += 2000;
  }
  return out;
}

(async () => {
  if (!DRY) {
    const caps = await fetch(APPSCRIPT_URL + "?action=caps&key=" + encodeURIComponent(APPSCRIPT_KEY)).then(r => r.json()).catch(() => null);
    if (!caps || caps.timesheet !== true) { log("✗ Apps Script chưa redeploy (chưa hỗ trợ ghi tab). BỎ QUA."); process.exit(3); }
  }
  const token = await layTokenTuPhucHoi(getToken, DIR, log, "hr").catch(e => { log("✗ " + e.message); process.exit(2); });
  const today = homNay();
  log("✓ Token hr.hasaki.vn. Ngày chấm công: " + today);

  // 1) Địa điểm id→tên
  const locMap = {};
  try { ((await getJson("https://wshr.hasaki.vn/api/hr/location?limit=10000", token)).data?.rows || []).forEach(l => { locMap[String(l.id)] = l.name; }); } catch {}
  const tenLoc = (id) => locMap[String(id)] || (id != null && id !== "" ? String(id) : "");

  // 2) Danh bạ WMS (TOÀN BỘ) → tra trạng thái + thông tin. statusByCode: mã/staff_id → staff_status
  const dir = (await getJson("https://wshr.hasaki.vn/api/news/staff/search-for-dropdown?limit=10000&sort=staff_id", token)).data || [];
  const dirByCode = {}, statusBy = {};
  for (const s of dir) {
    statusBy[String(s.code)] = s.staff_status; if (s.staff_id != null) statusBy[String(s.staff_id)] = s.staff_status;
    dirByCode[String(s.code)] = s;
  }
  // Bảng mã trạng thái WMS (kiểm chứng 2026-07-09: 1=đang làm; 4=nghỉ chế độ/thai sản — vẫn là NV; 2/3 suy luận — SỬA tại đây nếu HR xác nhận khác)
  const TT_STATUS = { 1: "Đang làm việc", 2: "Thử việc", 3: "Chờ kích hoạt", 4: "Nghỉ chế độ (thai sản)" };
  const trangThai = (code, sid) => {
    const st = statusBy[String(code)] != null ? statusBy[String(code)] : statusBy[String(sid)];
    if (st == null) return "Đã nghỉ việc (đóng hồ sơ)";   // không còn trong danh bạ = nghỉ hẳn
    return TT_STATUS[st] || ("Trạng thái " + st);
  };
  log("  ✓ Danh bạ WMS: " + dir.length + " NV; Địa điểm: " + Object.keys(locMap).length + " chi nhánh.");

  // 3) Kho tích luỹ
  let cache = {}; try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")).byCode || {}; } catch {}

  // 3a) SEED từ lịch sử chấm công 1/4→nay (chỉ khi kho rỗng hoặc FULL_SEED) → bắt cả NV đã nghỉ
  if (!Object.keys(cache).length || FULL_SEED) {
    log("  ⏳ Rà lịch sử chấm công " + SEED_FROM + " → " + today + " để liệt kê toàn bộ NV từng đi làm...");
    let n = 0;
    for (const mid of MAJOR_IDS) {
      const rows = await keoTimesheet(token, mid, SEED_FROM, today);
      for (const r of rows) {
        const s = r.staff || {}; const code = String(s.code || r.staff_code || ""); if (!code) continue;
        if (!cache[code]) { cache[code] = { staff_id: s.staff_id || "", code, staff_name: s.staff_name || "", staff_email: "", staff_title: "", staff_dept: "", staff_major: MAJOR_NAME[mid] || "", chinhanh: "", diadiem: tenLoc(s.staff_loc_id) }; n++; }
      }
    }
    log("  ✓ Seed lịch sử: thêm " + n + " NV vào kho.");
  }

  // 3b) Cập nhật/thêm NV đang trong danh bạ (phạm vi 2 nghiệp vụ, kho 398) — thông tin đầy đủ
  for (const s of dir) {
    if (!MAJOR_IDS.includes(Number(s.major_id))) continue;
    if (String(s.working_loc_id) !== String(LOCATION_ID) && String(s.staff_loc_id) !== String(LOCATION_ID)) continue;
    const code = String(s.code || s.staff_id);
    cache[code] = {
      staff_id: s.staff_id, code, staff_name: s.staff_name || "", staff_email: s.staff_email || "",
      staff_title: s.staff_title || "", staff_dept: s.staff_dept || "", staff_major: s.staff_major || MAJOR_NAME[s.major_id] || "",
      chinhanh: tenLoc(s.working_loc_id), diadiem: tenLoc(s.staff_loc_id),
    };
  }

  // 3c) Đánh trạng thái cho MỌI NV trong kho + bổ sung info cho NV còn trong danh bạ (đổi vị trí…)
  for (const code in cache) {
    const e = cache[code]; const d = dirByCode[code];
    if (d) { // còn trong danh bạ (bất kể vị trí) → cập nhật info mới nhất
      e.staff_name = d.staff_name || e.staff_name; e.staff_email = d.staff_email || e.staff_email;
      e.staff_title = d.staff_title || e.staff_title; e.staff_dept = d.staff_dept || e.staff_dept;
      e.staff_major = d.staff_major || e.staff_major; e.chinhanh = tenLoc(d.working_loc_id) || e.chinhanh; e.diadiem = tenLoc(d.staff_loc_id) || e.diadiem;
    }
    e.trangthai = trangThai(code, e.staff_id);
  }
  try { fs.mkdirSync(path.join(DIR, ".exports"), { recursive: true }); fs.writeFileSync(CACHE_FILE, JSON.stringify({ byCode: cache, updatedAt: new Date().toISOString() })); } catch (e) { log("  (cảnh báo cache: " + e.message + ")"); }
  const soConLam = Object.values(cache).filter(x => x.trangthai === "Đang làm việc").length;
  log("  ✓ Kho nhân sự: " + Object.keys(cache).length + " NV (còn làm " + soConLam + ", đã nghỉ " + (Object.keys(cache).length - soConLam) + ").");

  // 4) Chấm công HÔM NAY
  const att = {};
  for (const mid of MAJOR_IDS) {
    let recs = []; try { recs = await keoTimesheet(token, mid, today, today); } catch {}
    for (const r of recs) {
      const code = String((r.staff && r.staff.code) || r.staff_code || ""); if (!code) continue;
      const sc = r.staff_schedule || {}; const cur = att[code] || { ci: null, co: null, lich: "" };
      if (r.check_in && (!cur.ci || r.check_in < cur.ci)) cur.ci = r.check_in;
      if (r.check_out && (!cur.co || r.check_out > cur.co)) cur.co = r.check_out;
      if (!cur.lich && (sc.staffsche_time_in || sc.staffsche_time_out)) cur.lich = gio(sc.staffsche_time_in) + "–" + gio(sc.staffsche_time_out) + (sc.staffsche_title && sc.staffsche_title !== "NA" ? " (" + sc.staffsche_title + ")" : "");
      att[code] = cur;
    }
  }
  const soCC = Object.values(att).filter(a => a.ci || a.co).length;
  log("  ✓ Chấm công hôm nay: " + soCC + " NV có dữ liệu.");

  // 5) Dựng bảng
  const header = ["staff_id", "code", "staff_name", "staff_email", "staff_title", "staff_dept", "staff_major", "Chi nhánh làm việc", "Địa điểm", "Giờ vào", "Giờ ra", "Lịch làm việc", "Trạng thái làm việc"];
  const rows = Object.values(cache)
    .sort((a, b) => (a.trangthai || "").localeCompare(b.trangthai || "") || (a.staff_major || "").localeCompare(b.staff_major || "", "vi") || (a.staff_name || "").localeCompare(b.staff_name || "", "vi"))
    .map(s => { const a = att[s.code] || {}; return [s.staff_id || "", s.code || "", s.staff_name || "", s.staff_email || "", s.staff_title || "", s.staff_dept || "", s.staff_major || "", s.chinhanh || "", s.diadiem || "", gio(a.ci), gio(a.co), a.lich || "", s.trangthai || ""]; });
  log("→ Tổng " + rows.length + " nhân sự (" + soConLam + " còn làm, " + (rows.length - soConLam) + " đã nghỉ; " + soCC + " có chấm công hôm nay).");

  if (DRY) { fs.writeFileSync(path.join(DIR, ".exports", "nhansu-out.json"), JSON.stringify({ header, rows }, null, 0)); log("(DRY) Đã lưu .exports/nhansu-out.json."); process.exit(0); }

  const body = JSON.stringify({ action: "syncTasks", tab: TAB, key: APPSCRIPT_KEY, header, rows });
  let ok = false, written = 0;
  try { const j = JSON.parse(await (await fetch(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body })).text()); ok = j.status === "success"; written = j.written || 0; }
  catch (e) { log("  ⚠ POST lỗi (" + e.message + ") — kiểm tra lại qua gviz..."); }
  if (!ok) {
    await new Promise(r => setTimeout(r, 4000));
    try { const t = await (await fetch("https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?sheet=" + encodeURIComponent(TAB) + "&tqx=out:json&headers=1")).text(); const n = (JSON.parse(t.match(/\{[\s\S]*\}/)[0]).table.rows || []).length; if (n >= Math.floor(rows.length * 0.9)) { ok = true; written = n; log("  ✓ Xác minh qua gviz: " + n + " dòng."); } } catch {}
  }
  log(ok ? "✓ Đã ghi " + written + " dòng vào tab " + TAB + "." : "✗ Ghi tab " + TAB + " thất bại.");
  process.exit(ok ? 0 : 2);
})().catch(e => { log("✗ " + e.message); process.exit(2); });
