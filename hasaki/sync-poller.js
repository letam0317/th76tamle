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
import { layTokenSongWms, fetchThuLai, docMocBuoc, mayDuocChay } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const LOCK = path.join(DIR, ".poller.lock");
const STATE = path.join(DIR, ".poller-state.json");
const GW = "https://wms-gw.inshasaki.com/api/v1/wms/counting-plan/checklists";
const WH_PING = "1177,1339,863,874";   // MTG + GARMENT + SHOP/WH 170 QL1A — đủ cả 2 nhóm kiểm kê

const PHUT = 60 * 1000;
const VESINH_MIN = Number(process.env.POLLER_VESINH_MIN || 15) * PHUT;
/* CỬA SỔ QUÉT PLANOGRAM CỦA NHỊP POLLER (03/08/2026): hẹp hơn 45 ngày mặc định.
 * Vì sao được: mọi thứ CẦN quá khứ đã chuyển sang kho CỘNG DỒN trong sync-vesinh-all.js
 * (danh mục vị trí · VESINH-LICHSU 60 ngày · VESINH-CHAMCONG-NGAY 60 ngày) nên lượt quét chỉ
 * còn nhiệm vụ "bắt cái mới".
 * Lượt cụm 8h40 (SYNC-STOCK.bat) VẪN quét đủ 45 ngày → mỗi ngày một lần vá lại mọi lệch tích luỹ.
 *
 * VÁ 15/08/2026 — 10 → 8 ngày, và SỬA LUÔN CON SỐ SAI TRONG CHÚ THÍCH CŨ.
 * Chú thích cũ ghi "~7 trang → ~2 trang". ĐO THẬT trong vesinh.log (30/32 lượt gần nhất):
 *     10 ngày = 1.636–1.740 request / size 500 = **4 trang**   (không phải 2)
 *     45 ngày = 4.398–4.652 request           = **9–10 trang**
 * Suy ra 8 ngày ≈ 1.350 request = **3 trang** ⇒ cắt 1 trang mỗi lượt, ~30 lượt/ngày ⇒ −30 trang/ngày
 * lên planogram mà không mất gì: hai thứ tiêu thụ cửa sổ này đều ≤7 ngày (VESINH-YEUCAU giữ
 * VS_YC_DAYS=7, ảnh giữ VS_ANH_NGAY=3 — trần 7 ngày). 8 = 7 + 1 ngày biên cho lệch múi giờ.
 * Đừng hạ xuống 7: mất sạch biên, request tạo lúc 23h hôm thứ 7 sẽ rơi ra ngoài. */
const VESINH_QUET_NGAY = Number(process.env.POLLER_VESINH_QUET_NGAY || 8);
const AI_MIN = Number(process.env.POLLER_AI_MIN || 30) * PHUT;
const KIEMKE_MIN = Number(process.env.POLLER_KIEMKE_MIN || 30) * PHUT;
const PING_MIN = Number(process.env.POLLER_PING_MIN || 10) * PHUT;
/* 5S (auto-export-sync) — 31/07/2026. Nhịp thưa hơn vệ sinh vì mỗi lượt là 2 job export WMS
   (~50s), không có ping rẻ nào để dò thay đổi. THU_LAI_MIN chặn dội khi lượt trước hoãn
   (thiếu phiên work/hr thì mốc bước không nhích, không có nó sẽ spawn lại mỗi tick 2'). */
const S5_MIN = Number(process.env.POLLER_5S_MIN || 45) * PHUT;
const S5_THU_LAI_MIN = Number(process.env.POLLER_5S_THU_LAI_MIN || 10) * PHUT;
/* ---- CHẾ ĐỘ ÉP TƯƠI (14/09/2026 — ep-tuoi.mjs gọi vào) ----------------------------------
 * EP_TUOI=1 nghĩa là lượt này KHÔNG do đồng hồ gọi mà do SỰ KIỆN "có người vừa đăng nhập"
 * (cò co-dang-nhap.mjs, hoặc tick canh thấy jti đổi). Khác lượt thường đúng 4 điểm:
 *   1. Bỏ cửa giờ + cửa Chủ nhật — có người đăng nhập tức là có người đang làm việc thật.
 *   2. Ngưỡng "tới hạn" hạ từ 15/30/45 phút xuống EP_NGUONG (5 phút) cho ĐÚNG nhóm bước của
 *      khe token vừa đăng nhập (wms = vệ sinh/kiểm kê · wshr = 5S). Bước còn tươi dưới 5 phút
 *      vẫn KHÔNG chạy lại: ép là KÉO SỚM lượt sắp tới, không phải THÊM lượt (BO-CHUAN §2).
 *   3. Bỏ jitter 3-10s — jitter sinh ra để rải các nhịp đồng hồ trùng giây, còn lượt sự kiện
 *      chỉ có một và người vừa đăng nhập đang ngồi chờ.
 *   4. Bước 5S chạy TRƯỚC (đo 14/09: 5S lên Sheet sau ~17 giây, vệ sinh quét planogram 2-3 phút).
 * KHÔNG nới: khoá đơn lượt, cửa né cụm đang chạy (FAIL-CLOSED) và luật token phiên sống. */
const EP_TUOI = String(process.env.EP_TUOI || "") === "1";
const EP_KHE = process.env.EP_KHE === "wshr" ? "wshr" : "wms";
const EP_NGUON = process.env.EP_NGUON || "?";
const EP_NGUONG = Number(process.env.EP_NGUONG_PHUT || 5) * PHUT;
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
        /* FAIL-CLOSED (audit 23/08/2026, cùng vá với sync-guard): lỗi soi tiến trình → coi như
           CÓ cụm đang chạy để không bao giờ spawn chồng; log to để thấy khi PowerShell hỏng lâu. */
        if (err) { log("⚠ cumDangChay: Get-CimInstance lỗi (" + (err.message || err) + ") — FAIL-CLOSED, poller đứng ngoài."); return res(true); }
        if (!out) return res(false);
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
  if (!mayDuocChay(log)) return;   // vai máy (laptop/PC) — Phần G; PC có watch-login riêng nên lượt ép tươi không mất
  const now = new Date(), bayGio = now.getTime(), pNow = now.getHours() * 60 + now.getMinutes();

  // 0) Trong khung hoạt động? (ngoài khung: lịch 8h40 + guard 18:05 đã lo phần còn lại)
  const [wa, wb] = WINDOW.split("-").map(phut);
  if (!EP_TUOI && (wa == null || wb == null || pNow < wa || pNow >= wb)) return 0;   // im lặng — ngoài giờ poller
  if (EP_TUOI) log("⚡ LƯỢT ÉP TƯƠI — nguồn " + EP_NGUON + ", khe " + EP_KHE + " (bỏ cửa giờ/Chủ nhật, ngưỡng " + Math.round(EP_NGUONG / PHUT) + "').");
  /* CỔNG NGÀY LÀM (24/08/2026 — nối tiếp cửa giờ của sync-guard): guard đã nghỉ Chủ nhật, nhưng
     poller thì chỉ có khung GIỜ nên CN vẫn tự phát vệ sinh 15'/AI 30'/5S 45' + 2 slot tồn kho.
     Đo log CN 23/08: 116 trang planogram + 6 lượt quét 178k dòng + 284 call chi tiết kiểm kê cho
     một ngày KHÔNG AI LÀM VIỆC. Chủ nhật thì dữ liệu đứng yên — nghỉ luôn cho nhẹ upstream.
     Muốn chạy CN (đợt kiểm kê cuối tuần): đặt POLLER_CHU_NHAT=1 trong .env. */
  if (!EP_TUOI && now.getDay() === 0 && process.env.POLLER_CHU_NHAT !== "1") return 0;   // im lặng — Chủ nhật

  // 1) Có việc gì tới hạn không? (tính TRƯỚC khi động tới token cho rẻ)
  const st = docState();
  const tuoi = (buoc) => bayGio - docMocBuoc(DIR, buoc);
  const epWms = EP_TUOI && EP_KHE === "wms", epWshr = EP_TUOI && EP_KHE === "wshr";
  const vesinhDue = tuoi("vesinh") >= (epWms ? EP_NGUONG : VESINH_MIN);
  /* AI xét ảnh GIỮ NGUYÊN nhịp 30 phút kể cả trong lượt ép: nó tiêu khoá Gemini chứ không phải
     lượt WMS, và ngay sau khi đăng nhập thì chưa thể có ảnh báo cáo mới để xét. */
  const aiDue = bayGio - (st.aiAt || 0) >= AI_MIN;
  const kkPingDue = tuoi("kiemke") >= (epWms ? EP_NGUONG : KIEMKE_MIN) && bayGio - (st.pcPingAt || 0) >= (epWms ? 0 : PING_MIN);
  const s5Due = tuoi("5s") >= (epWshr ? EP_NGUONG : S5_MIN) && bayGio - (st.s5At || 0) >= (epWshr ? 0 : S5_THU_LAI_MIN);
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
  if (!EP_TUOI) await nghi(3000 + Math.floor(Math.random() * 7000));   // jitter 3-10s: tránh mọi nhịp rơi đúng 1 giây

  /* Bước 5S tách thành hàm để LƯỢT ÉP gọi được TRƯỚC vệ sinh (ghi chú EP_TUOI ở đầu file).
     Lượt thường vẫn gọi ở đúng chỗ cũ, đúng thứ tự cũ. */
  const chay5S = async () => {
    st.s5At = bayGio;
    log("→ 5S: mốc cũ " + Math.round(tuoi("5s") / PHUT) + "'" + " — chạy auto-export-sync.js...");
    const ma = await chayBuoc("poller: 5S (" + (EP_TUOI ? "ÉP TƯƠI · " + EP_NGUON : "nhịp " + Math.round(S5_MIN / PHUT) + "'") + ")", "node auto-export-sync.js", "auto-export.log", { KHONG_LOGIN: "1" });
    log(ma === 0 ? "  ✓ 5S xong." : ma === 75 ? "  … 5S hoãn (chưa có phiên work/hr sống) — thử lại sau " + Math.round(S5_THU_LAI_MIN / PHUT) + "'" + "." : "  ⚠ 5S exit " + ma + " — xem auto-export.log.");
  };
  if (EP_TUOI && s5Due) await chay5S();

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
  if (!EP_TUOI && s5Due) await chay5S();

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
  /* LƯỢT ÉP KHÔNG ĐƯỢC CHẾT CÂM VÌ TRÙNG TICK ĐỒNG HỒ (bắt được trong QC 14/09/2026):
     tick canh 2 phút có thể đang chạy đúng lúc người vừa đăng nhập — đo thật: ép lúc 15:18:37
     rơi vào lượt tick 15:18:30, giuKhoa() trả false, lượt ép thoát IM LẶNG và sự kiện đăng nhập
     mất hẳn. Với tick 2 phút mà mỗi lượt tốn ~30-60 giây thì xác suất trùng không hề nhỏ.
     Nay: lượt ép CHỜ lượt kia xong rồi vào (trần EP_CHO_KHOA_GIAY), quá hạn thì BÁO RÕ.
     Lượt thường vẫn rút lui im lặng như cũ — chúng có tick sau, còn sự kiện thì không. */
  if (!giuKhoa()) {
    if (!EP_TUOI) return;   // poller khác đang chạy — im lặng rút lui, không nhả lock của họ
    const tranCho = Number(process.env.EP_CHO_KHOA_GIAY || 120) * 1000, t0 = Date.now();
    let vaoDuoc = false;
    while (Date.now() - t0 < tranCho) { await nghi(3000); if (giuKhoa()) { vaoDuoc = true; break; } }
    if (!vaoDuoc) { log("⚡ lượt ép (" + EP_NGUON + " · khe " + EP_KHE + ") BỎ — lượt poller khác giữ khoá quá " + Math.round(tranCho / 1000) + "s."); return; }
    log("⚡ lượt ép chờ " + Math.round((Date.now() - t0) / 1000) + "s cho lượt poller kia xong rồi mới vào.");
  }
  let code = 0;
  try { code = await main(); }
  catch (e) { log("✗ " + (e && e.message ? e.message : e)); code = 2; }
  nhaKhoa();
  process.exitCode = code;
})();
