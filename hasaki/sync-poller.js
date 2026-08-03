/**
 * sync-poller.js — NHỊP PHÂN TẦNG giữ dữ liệu factory/hasaki tươi TRONG NGÀY (26/07/2026).
 * ============================================================================
 *  Thay cho ý tưởng "chụp full mỗi 5 phút" (bất khả thi: 1 lượt full ~270 call WMS/~25 phút,
 *  GAS ~19h runtime/ngày nếu 288 lượt). Nguyên tắc: PING RẺ phát hiện thay đổi → chỉ kéo
 *  DELTA khi có thay đổi → tần suất theo giá trị tươi của từng nguồn:
 *   • VỆ SINH (sync-vesinh-all): mỗi ≥15' — nguồn thời sự nhất; từ 03/08/2026 chỉ quét
 *     POLLER_VESINH_QUET_NGAY=10 ngày planogram (~2 trang) thay vì 45 ngày (~7 trang).
 *   • AI xét ảnh (sync-vesinh-ai): mỗi ≥30' — tự thoát nhanh khi không có request Chờ duyệt.
 *   • KIỂM KÊ (push-pc-to-sheet PC_DELTA=1): mốc ≥30' + PING 4 call size=1 (đếm hôm nay
 *     + plan hôm nay) đổi số so với lần trước → mới kéo delta (vài trang, không phải ~220 call).
 *   • TỒN MÃ VỊ TRÍ + TỒN BẤT THƯỜNG: 2 khung bổ sung trưa/chiều (POLLER_SLOTS, mặc định
 *     12:15 + 17:00, cửa 90') — cộng lượt 8h40 là 3 lần/ngày, dữ liệu đổi chậm không cần hơn.
 *   • 5S (auto-export-sync, thêm 31/07/2026): mỗi ≥45' — trước đây 1 lần/ngày ở cụm 8h40 nên
 *     lượt đó trượt là dashboard 5S đứng cả ngày. Đi CỔNG wshr (không phải WMS) nên vẫn chạy
 *     được khi operator chỉ mở work/hr; chạy kèm KHONG_LOGIN=1 → hết phiên thì hoãn, không login.
 *
 *  AN TOÀN: CHỈ chạy khi có token phiên SỐNG (kho/bridge — layTokenSongWms), KHÔNG bao giờ
 *  re-login; né cụm sync khác đang chạy; khoá đơn lượt; jitter vài giây; fetchThuLai tự
 *  backoff khi 429/5xx. Các script con tự ghi hash tab (.sheet-hash.json) — dữ liệu không
 *  đổi thì KHÔNG ghi Sheet (khỏi phí GAS).
 *
 *  Được watch-login-request.js gọi mỗi tick ~2' (log: poller.log) — tự quyết có việc hay không.
 *  Chạy tay: node sync-poller.js
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { layTokenSongWms, fetchThuLai, docMocBuoc } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const LOCK = path.join(DIR, ".poller.lock");
const STATE = path.join(DIR, ".poller-state.json");
const GW = "https://wms-gw.inshasaki.com/api/v1/wms/counting-plan/checklists";
const WH_PING = "1177,1339,863,874";   // MTG + GARMENT + SHOP/WH 170 QL1A — đủ cả 2 nhóm kiểm kê

const PHUT = 60 * 1000;
const VESINH_MIN = Number(process.env.POLLER_VESINH_MIN || 15) * PHUT;
/* CỬA SỔ QUÉT PLANOGRAM CỦA NHỊP POLLER (03/08/2026): 10 ngày thay vì 45 mặc định.
 * Vì sao được: mọi thứ CẦN quá khứ đã chuyển sang kho CỘNG DỒN trong sync-vesinh-all.js
 * (danh mục vị trí · VESINH-LICHSU 60 ngày · VESINH-CHAMCONG-NGAY 60 ngày) nên lượt quét chỉ
 * còn nhiệm vụ "bắt cái mới"; 10 ngày là thừa cho cửa sổ yêu cầu 7 ngày của VESINH-YEUCAU.
 * Lợi: ~7 trang → ~2 trang mỗi lượt, mà lượt này chạy tới ~36 lần/ngày.
 * Lượt cụm 8h40 (SYNC-STOCK.bat) VẪN quét đủ 45 ngày → mỗi ngày một lần vá lại mọi lệch tích luỹ. */
const VESINH_QUET_NGAY = Number(process.env.POLLER_VESINH_QUET_NGAY || 10);
const AI_MIN = Number(process.env.POLLER_AI_MIN || 30) * PHUT;
const KIEMKE_MIN = Number(process.env.POLLER_KIEMKE_MIN || 30) * PHUT;
const PING_MIN = Number(process.env.POLLER_PING_MIN || 10) * PHUT;
/* 5S (auto-export-sync) — 31/07/2026. Nhịp thưa hơn vệ sinh vì mỗi lượt là 2 job export WMS
   (~50s), không có ping rẻ nào để dò thay đổi. THU_LAI_MIN chặn dội khi lượt trước hoãn
   (thiếu phiên work/hr thì mốc bước không nhích, không có nó sẽ spawn lại mỗi tick 2'). */
const S5_MIN = Number(process.env.POLLER_5S_MIN || 45) * PHUT;
const S5_THU_LAI_MIN = Number(process.env.POLLER_5S_THU_LAI_MIN || 10) * PHUT;
const WINDOW = process.env.POLLER_WINDOW || "08:45-18:00";   // theo giờ làm việc — ngoài khung: 8h40 + guard 18:05 lo
const SLOTS = (process.env.POLLER_SLOTS || "12:15,17:00").split(",").map((s) => s.trim()).filter(Boolean);
const SLOT_CUA_MS = 90 * PHUT;   // mỗi slot mở cửa 90' (máy bận/thiếu token thì các tick sau trong cửa vẫn kịp vá)

const log = (...a) => console.log(new Date().toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
const phut = (s) => { const m = String(s).trim().match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

/* ---- Khoá đơn lượt: lock < 20' coi như có poller khác đang chạy ---- */
function giuKhoa() {
  try { if (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs < 20 * 60 * 1000) return false; } catch { /* lock hỏng → ghi đè */ }
  fs.writeFileSync(LOCK, String(process.pid));
  return true;
}
const nhaKhoa = () => { try { fs.rmSync(LOCK, { force: true }); } catch { /* bỏ qua */ } };

/* ---- Né cụm sync khác (task 8h40 / guard vá / chạy tay) — cùng cách soi của sync-guard ---- */
function cumDangChay() {
  return new Promise((res) => {
    execFile("powershell", ["-NoProfile", "-Command",
      "Get-CimInstance Win32_Process -Filter \"Name='node.exe' or Name='cmd.exe'\" | Select-Object -ExpandProperty CommandLine"],
      { windowsHide: true, timeout: 30000 },
      (err, out) => {
        if (err || !out) return res(false);
        const dau = /sync-stocklocation\.js|push-pc-to-sheet\.mjs|sync-tonbatthuong\.js|sync-vesinh-all\.js|sync-vesinh-ai\.mjs|auto-export-sync\.js|SYNC-STOCK\.bat|AUTO-EXPORT\.bat/i;
        res(out.split(/\r?\n/).some((l) => dau.test(l)));
      });
  });
}

function docState() { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return {}; } }
function luuState(st) { try { fs.writeFileSync(STATE, JSON.stringify(st)); } catch { /* best-effort */ } }

/* ---- Chạy 1 script con, output nối vào đúng log riêng của bước (kèm dòng mốc [poller]) ---- */
function chayBuoc(nhan, lenh, logFile, env) {
  try { fs.appendFileSync(path.join(DIR, logFile), "[poller " + new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false }) + "] " + nhan + "\r\n"); } catch { /* mốc best-effort */ }
  return new Promise((res) => {
    const c = spawn("cmd.exe", ["/c", lenh + " >> " + logFile + " 2>&1"], { cwd: DIR, stdio: "ignore", windowsHide: true, env: { ...process.env, ...(env || {}) } });
    c.on("exit", (code) => res(code == null ? -1 : code));
    c.on("error", () => res(-1));
  });
}

/* ---- PING kiểm kê: 4 call size=1 → chuỗi marker "count@updated_at|..." (API trả {page,size}
 *      khi không có bản ghi → count coi như 0). Marker đổi = có hoạt động đếm/plan mới. ---- */
async function pingKiemKe(token) {
  const vn = new Date(Date.now() + 7 * 3600 * 1000);
  const d0 = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - 7 * 3600 * 1000;
  const dem = async (u) => {
    const r = await fetchThuLai(u, { headers: { authorization: token } });
    if (!r.ok) throw new Error("ping HTTP " + r.status);
    const j = await r.json().catch(() => ({}));
    const recs = j.records || [];
    return String(j.count ?? 0) + "@" + String((recs[0] && recs[0].updated_at) || "");
  };
  const kq = [];
  for (const u of [
    GW + "/type-sku?from_counted_date=" + d0 + "&to_counted_date=" + (d0 + 86399999) + "&page=1&size=1",
    GW + "/type-location?from_counted_date=" + d0 + "&to_counted_date=" + (d0 + 86399999) + "&page=1&size=1",
    GW + "/type-sku?from_plan_date=" + d0 + "&to_plan_date=" + (d0 + 86399999) + "&warehouse_ids=" + WH_PING + "&page=1&size=1",
    GW + "/type-location?from_plan_date=" + d0 + "&to_plan_date=" + (d0 + 86399999) + "&warehouse_ids=" + WH_PING + "&page=1&size=1",
  ]) { kq.push(await dem(u)); await nghi(300); }
  return kq.join("|");
}

async function main() {
  const now = new Date(), bayGio = now.getTime(), pNow = now.getHours() * 60 + now.getMinutes();

  // 0) Trong khung hoạt động? (ngoài khung: lịch 8h40 + guard 18:05 đã lo phần còn lại)
  const [wa, wb] = WINDOW.split("-").map(phut);
  if (wa == null || wb == null || pNow < wa || pNow >= wb) return 0;   // im lặng — ngoài giờ poller

  // 1) Có việc gì tới hạn không? (tính TRƯỚC khi động tới token cho rẻ)
  const st = docState();
  const tuoi = (buoc) => bayGio - docMocBuoc(DIR, buoc);
  const vesinhDue = tuoi("vesinh") >= VESINH_MIN;
  const aiDue = bayGio - (st.aiAt || 0) >= AI_MIN;
  const kkPingDue = tuoi("kiemke") >= KIEMKE_MIN && bayGio - (st.pcPingAt || 0) >= PING_MIN;
  const s5Due = tuoi("5s") >= S5_MIN && bayGio - (st.s5At || 0) >= S5_THU_LAI_MIN;
  const slotDue = [];   // [{buoc, script, logFile}] tới hạn trong cửa slot trưa/chiều
  for (const s of SLOTS) {
    const p = phut(s); if (p == null) continue;
    const slotStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(p / 60), p % 60).getTime();
    if (bayGio < slotStart || bayGio >= slotStart + SLOT_CUA_MS) continue;
    if (docMocBuoc(DIR, "stocklocation") < slotStart) slotDue.push({ buoc: "stocklocation", lenh: "node sync-stocklocation.js", logFile: "stocklocation.log" });
    if (docMocBuoc(DIR, "tonbatthuong") < slotStart) slotDue.push({ buoc: "tonbatthuong", lenh: "node sync-tonbatthuong.js", logFile: "tonbatthuong.log" });
  }
  if (!vesinhDue && !aiDue && !kkPingDue && !s5Due && !slotDue.length) return 0;   // im lặng — chưa tới hạn gì

  // 2) Né cụm khác + token phiên sống (KHÔNG re-login — không có thì thôi, tick sau thử lại)
  if (await cumDangChay()) { log("Cụm đồng bộ khác đang chạy — poller đứng ngoài."); return 0; }
  /* Token WMS gác các bước factory. Bước 5S đi CỔNG KHÁC (wshr) và tự lo token của nó
     (layTokenSongWork + KHONG_LOGIN=1) — nên thiếu token WMS vẫn phải cho 5S chạy, đúng ca
     operator chỉ mở work/hr mà không mở WMS. */
  const token = await layTokenSongWms(DIR, log);
  if (!token && !s5Due) { log("… chưa có token phiên sống (đợi operator mở WMS/bridge) — thôi, tick sau."); return 0; }
  if (!token) log("… chưa có token WMS — chỉ chạy bước 5S (cổng work/hr riêng).");
  await nghi(3000 + Math.floor(Math.random() * 7000));   // jitter 3-10s: tránh mọi nhịp rơi đúng 1 giây

  // 3) VỆ SINH mỗi ≥15' (script con tự hash-skip ghi Sheet nếu dữ liệu không đổi)
  if (token && vesinhDue) {
    log("→ vệ sinh: mốc cũ " + Math.round(tuoi("vesinh") / PHUT) + "' — chạy sync-vesinh-all.js (quét " + VESINH_QUET_NGAY + " ngày)...");
    const ma = await chayBuoc("poller: vệ sinh (nhịp " + Math.round(VESINH_MIN / PHUT) + "', quét " + VESINH_QUET_NGAY + " ngày)",
      "node sync-vesinh-all.js", "vesinh.log", { PHUTRACH_DAYS: String(VESINH_QUET_NGAY) });
    log(ma === 0 ? "  ✓ vệ sinh xong." : "  ⚠ vệ sinh exit " + ma + (ma === 75 ? " (hoãn — mất token giữa chừng)" : " — xem vesinh.log"));
    /* Bảng phân công đi kèm ngay sau: g-sheet gốc do đội sửa liên tục nên phải bám nhịp này,
       và nguồn bù (PHU-TRACH-QUAY-KE) vừa được bước trên làm mới. Chỉ đọc Google, không cần
       token WMS → chạy được cả khi bước trên hoãn vì mất token. */
    const maPC = await chayBuoc("poller: bảng phân công", "node sync-phancong.mjs", "vesinh.log");
    log(maPC === 0 ? "  ✓ phân công xong." : "  ⚠ phân công exit " + maPC + " — xem vesinh.log");
  }

  // 4) AI xét ảnh mỗi ≥30' (tự thoát nhanh khi không có request Chờ duyệt).
  // aiAt cập nhật kể cả khi LỖI — lỗi cấu hình (thiếu API key…) mà retry mỗi tick 2' là vô ích.
  if (token && aiDue) {
    const ma = await chayBuoc("poller: AI xét ảnh vệ sinh (nhịp " + Math.round(AI_MIN / PHUT) + "')", "node sync-vesinh-ai.mjs", "vesinh.log");
    st.aiAt = bayGio;
    log(ma === 0 ? "→ AI xét ảnh: xong." : "→ AI xét ảnh exit " + ma + " — xem vesinh.log, thử lại sau " + Math.round(AI_MIN / PHUT) + "'.");
  }

  // 5) KIỂM KÊ: ping 4 call — marker đổi mới kéo DELTA (push-pc tự nâng FULL nếu cache thiếu/cũ)
  if (token && kkPingDue) {
    st.pcPingAt = bayGio;
    try {
      const marker = await pingKiemKe(token);
      if (marker !== st.pcMarker) {
        log("→ kiểm kê: marker ĐỔI (" + (st.pcMarker || "chưa có") + " → " + marker + ") — kéo delta...");
        const ma = await chayBuoc("poller: kiểm kê DELTA (marker đổi)", "node push-pc-to-sheet.mjs", "kiemke.log", { PC_DELTA: "1" });
        if (ma === 0) { st.pcMarker = marker; log("  ✓ kiểm kê delta xong."); }
        else log("  ⚠ kiểm kê delta exit " + ma + " — giữ marker cũ để tick sau thử lại.");
      } else log("→ kiểm kê: marker không đổi (" + marker + ") — khỏi kéo.");
    } catch (e) { log("→ kiểm kê: ping lỗi (" + e.message + ") — bỏ qua tick này."); }
  }

  /* 6) 5S mỗi ≥45' — bộ duy nhất đi cổng wshr. KHONG_LOGIN=1: hết phiên thì tự exit 75, KHÔNG
     đăng nhập (giữ đúng nguyên tắc "poller không bao giờ tạo phiên mới"). s5At chạm kể cả khi
     hoãn/lỗi để không dội lại mỗi tick 2'. */
  if (s5Due) {
    st.s5At = bayGio;
    log("→ 5S: mốc cũ " + Math.round(tuoi("5s") / PHUT) + "' — chạy auto-export-sync.js...");
    const ma = await chayBuoc("poller: 5S (nhịp " + Math.round(S5_MIN / PHUT) + "')", "node auto-export-sync.js", "auto-export.log", { KHONG_LOGIN: "1" });
    log(ma === 0 ? "  ✓ 5S xong." : ma === 75 ? "  … 5S hoãn (chưa có phiên work/hr sống) — thử lại sau " + Math.round(S5_THU_LAI_MIN / PHUT) + "'." : "  ⚠ 5S exit " + ma + " — xem auto-export.log.");
  }

  // 7) Slot trưa/chiều cho tồn kho (đổi chậm — 8h40 + 2 slot = 3 lần/ngày là đủ tươi)
  for (const s of (token ? slotDue : [])) {
    log("→ slot " + SLOTS.join("/") + ": bổ sung " + s.buoc + "...");
    const ma = await chayBuoc("poller: lượt bổ sung slot (" + s.buoc + ")", s.lenh, s.logFile);
    log(ma === 0 ? "  ✓ " + s.buoc + " xong." : "  ⚠ " + s.buoc + " exit " + ma + (ma === 75 ? " (hoãn)" : ""));
  }

  luuState(st);
  return 0;
}

(async () => {
  if (!giuKhoa()) return;   // poller khác đang chạy — im lặng rút lui, không nhả lock của họ
  let code = 0;
  try { code = await main(); }
  catch (e) { log("✗ " + (e && e.message ? e.message : e)); code = 2; }
  nhaKhoa();
  process.exitCode = code;
})();
