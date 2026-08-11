/**
 * watch-login-request.js — Bộ canh trên MÁY PC (chạy định kỳ mỗi ~2 phút).
 * Hỏi Apps Script 2 việc (cờ đặt từ điện thoại/web/dashboard):
 *   1) "Cập nhật dashboard?" (nút Cập nhật ngay + PIN) → chạy auto-export-sync.js
 *   2) "Đăng nhập lại?" (nút trong email) → mở login-hasaki.js
 *
 * Chạy 1 lần:  node watch-login-request.js   (Task Scheduler gọi mỗi 2 phút)
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { docTokenCu } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const APPSCRIPT_URL = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const KEY = process.env.APPSCRIPT_KEY;
const LOCK = path.join(DIR, ".login-open.lock");
const OTP_TAY = String(process.env.LOGIN_OTP_TAY || "") === "1";   // Đường 2: người gõ OTP → cửa sổ phải HIỆN RA
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

if (!KEY) { console.error("✗ Thiếu APPSCRIPT_KEY trong .env."); process.exit(3); }

/* ===== IM LẶNG KHI KHÔNG CÓ VIỆC (01/08/2026) ==================================================
 * Bộ này chạy MỖI 2 PHÚT nên 4 dòng "Không có yêu cầu…" mỗi lượt = ~2.900 dòng/ngày thuần rác:
 * watch-login.log đã phình 1,2MB / 27.500 dòng trong ~13 ngày và dòng THẬT (có yêu cầu, lỗi) bị
 * lấp giữa đống đó — đúng lúc cần tra thì không thấy. Nay: việc thật vẫn log đầy đủ, lượt rỗng chỉ
 * ghi 1 dòng NHỊP TIM mỗi ~giờ (vẫn kiểm được bộ canh còn sống). Giảm ~97% dòng log. */
const imLang = [];
let coViec = false;
const NHIP = path.join(DIR, ".watch-nhiptim");
function nenGhiNhipTim(){
  try { if (Date.now() - fs.statSync(NHIP).mtimeMs < 55 * 60 * 1000) return false; } catch { /* chưa có mốc */ }
  try { fs.writeFileSync(NHIP, String(Date.now())); } catch { /* best-effort */ }
  return true;
}

// SECRET đi trong POST body (không qua query → không lọt access-log)
const apiPost = async (act, extra) => { const r = await fetch(APPSCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: act, key: KEY, ...(extra || {}) }) }).catch(() => null); return r && r.ok ? r.json().catch(() => null) : null; };
const hoi = (act) => apiPost(act);
const chay = (file, args = []) => { const c = spawn(process.execPath, [path.join(DIR, file), ...args], { cwd: DIR, detached: true, stdio: "ignore" }); c.unref(); };   // GUI (login): chạy nền, không chờ
const chayCho = (file) => new Promise((res) => { const c = spawn(process.execPath, [path.join(DIR, file)], { cwd: DIR, stdio: "ignore" }); c.on("exit", res); c.on("error", res); });   // nền (auto-export): CHỜ xong
const chayGuard = (force = true) => new Promise((res) => { const c = spawn("cmd.exe", ["/c", "node sync-guard.js " + (force ? "--force " : "") + ">> sync-guard.log 2>&1"], { cwd: DIR, stdio: "ignore", windowsHide: true }); c.on("exit", res); c.on("error", res); });   // guard: CHỜ xong, log riêng (force=true bỏ kiểm mới/cũ)

// 1) Yêu cầu CẬP NHẬT dashboard (nút "Cập nhật ngay" + PIN)
const s = await hoi("syncStatus");
if (s && s.requested) {
  coViec = true; log("⚡ Có yêu cầu cập nhật dashboard! Chạy auto-export (chờ xong)...");
  await apiPost("clearSync");
  await chayCho("auto-export-sync.js");   // chờ hoàn tất; auto-export có khoá chống chạy chồng
  log("Auto-export xong.");
} else imLang.push("cập nhật");

// 1b) Yêu cầu CẬP NHẬT CHẤM CÔNG (nút "Cập nhật chấm công" + PIN)
const tsq = await hoi("timesheetStatus");
if (tsq && tsq.requested) {
  coViec = true; log("⚡ Có yêu cầu cập nhật chấm công! Chạy pull-timesheet (chờ xong)...");
  await apiPost("clearTimesheet");
  await chayCho("pull-timesheet.js");
  log("Pull-timesheet xong.");
} else imLang.push("chấm công");

// 1c) Yêu cầu TẢI LẠI TỒN KHO FACTORY (nút "Tải lại dữ liệu" dashboard đặt cờ qua GAS).
// CHỈ hỏi khi backend đã có action này (caps.stockFlag) — hỏi action lạ trên GAS bản cũ
// sẽ rơi vào nhánh appendRow mặc định và ghi rác vào sheet 5S.
const caps = await hoi("caps");
let daChayGuard = false;
if (caps && caps.stockFlag) {
  const sk = await hoi("stockSyncStatus");
  if (sk && sk.requested) {
    coViec = true; log("⚡ Có yêu cầu tải lại tồn kho factory! Chạy sync-guard --force (chờ xong, log: sync-guard.log)...");
    await apiPost("clearStockSync");
    await chayGuard();   // guard tự lo luật phiên (bridge/khung an toàn) — không đá ai trong giờ làm
    daChayGuard = true;
    log("Sync-guard xong.");
  } else imLang.push("tồn kho");
}

// 1d) CHỦ ĐỘNG GIỮ DỮ LIỆU TƯƠI (23/07/2026) — thay vì chỉ trông vào tick guard mỗi GIỜ:
// mỗi lượt canh (~2'), gọi guard KHÔNG --force. Guard tự kiểm mới/cũ (rẻ, chỉ 1 lượt đọc Metadata
// khi đã mới) và CHỈ đồng bộ khi dữ liệu CŨ + mượn được token SỐNG (kho/bridge — phiên operator
// đang đăng nhập, extension đẩy lên). Tận dụng thực tế "giờ làm LUÔN có phiên WMS đăng nhập":
// data sáng (máy vừa boot) tự bắt kịp trong ≤2' NGAY KHI có token sống — không chờ tick giờ,
// KHÔNG re-login SSO, KHÔNG đá ai. Guard tự có khoá 45' + né cụm đang chạy nên không chạy chồng.
if (caps && caps.stockFlag && !daChayGuard) {
  await chayGuard(false);
}

// 1f) NHỊP PHÂN TẦNG (26/07/2026 — sync-poller.js, log: poller.log): giữ vệ sinh/kiểm kê
// tươi 15-30' trong ngày + 2 slot trưa/chiều cho tồn kho. Poller TỰ quyết có việc hay không
// (đọc mốc .sync-ok-*, ping rẻ), CHỈ chạy khi có token phiên sống, tự né cụm đang chạy —
// nên gọi mỗi tick 2' là an toàn, đa số tick nó thoát ngay không tốn gì.
await new Promise((res) => { const c = spawn("cmd.exe", ["/c", "node sync-poller.js >> poller.log 2>&1"], { cwd: DIR, stdio: "ignore", windowsHide: true }); c.on("exit", res); c.on("error", res); });

// 1e) SỔ NHẬT KÝ PHIÊN WMS (25/07/2026 — điều tra "bị đá văng phiên"): mỗi tick 2' kiểm
// get-me trên token wms trong kho, ghi session-ledger.log khi phiên ĐỔI (jti mới) hoặc CHẾT.
// Bot này KHÔNG re-login trong giờ làm (session-rules) — nên mọi cú "phiên vừa chết" trong
// sổ = có người/máy KHÁC đăng nhập cùng tài khoản (WMS 1 phiên/tài khoản) hoặc hết hạn idle.
// Nhờ đó lần sau bị đá là tra được ĐÚNG PHÚT, khỏi đổ oan cho bộ đồng bộ.
try {
  const LEDGER = path.join(DIR, "session-ledger.log");
  const LSTATE = path.join(DIR, ".session-ledger-state.json");
  const jtiOf = (t) => { try { return JSON.parse(Buffer.from(String(t).replace(/^Bearer /i, "").split(".")[1], "base64url").toString()).jti || "?"; } catch { return "?"; } };
  const cu = docTokenCu(DIR, "wms");
  if (cu && cu.token) {
    const me = await fetch("https://wms-gw.inshasaki.com/api/v1/auth/user/get-me", { headers: { authorization: cu.token } }).catch(() => null);
    if (me) {   // chỉ kết luận khi có câu trả lời chắc chắn (lỗi mạng thì bỏ qua tick này)
      const jti = jtiOf(cu.token), song = me.ok;
      let st = {}; try { st = JSON.parse(fs.readFileSync(LSTATE, "utf8")); } catch { /* chưa có sổ */ }
      const ghi = (dong) => fs.appendFileSync(LEDGER, new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false }) + "  " + dong + "\n");
      if (st.jti !== jti) ghi("PHIÊN MỚI trong kho: jti=" + jti + (song ? " (đang sống)" : " (đã chết ngay khi ghi nhận)"));
      else if (st.song === true && !song) {
        /* VÁ 31/07/2026 — sổ cũ khẳng định luôn "có người/máy khác vừa đăng nhập WMS", và đó là
         * kết luận SAI trong ca 11:14 hôm nay: cổng work/hr chết CÙNG LÚC. Hai ca hoàn toàn khác:
         *   • chỉ WMS chết → đúng luật "WMS 1 phiên/tài khoản": ai đó vừa đăng nhập WMS.
         *   • chết CẢ HAI → phiên IdP bị huỷ: đăng nhập mới ở BẤT KỲ app/thiết bị nào, hoặc IdP
         *     thu hồi (khoá/throttle sau các lượt sai). Bot đá phiên WMS KHÔNG tạo ra cảnh này.
         * Chỉ hỏi wshr ĐÚNG LÚC phát hiện chết → tick thường vẫn chỉ tốn 1 call như cũ. */
        const w = docTokenCu(DIR, "work");
        let cong = "không có token work để đối chứng";
        if (w && w.token) {
          const r = await fetch("https://wshr.hasaki.vn/api/news/staff/search-for-dropdown?limit=1", { headers: { authorization: w.token } }).catch(() => null);
          cong = !r ? "không hỏi được wshr (mất mạng?) — chưa kết luận"
            : r.ok ? "cổng work/hr CÒN SỐNG ⇒ chỉ phiên WMS bị đá: ai đó vừa ĐĂNG NHẬP WMS"
              : "cổng work/hr CŨNG CHẾT (" + r.status + ") ⇒ phiên IdP bị huỷ (login mới ở app/thiết bị bất kỳ, hoặc IdP thu hồi) — KHÔNG phải kiểu đá phiên WMS";
        }
        const phut = st.luc ? Math.round((Date.now() - st.luc) / 60000) : null;
        ghi("PHIÊN jti=" + jti + " VỪA CHẾT (get-me " + me.status + ")"
          + (phut != null ? " sau " + Math.floor(phut / 60) + "h" + String(phut % 60).padStart(2, "0") : "")
          + " — " + cong);
      }
      else if (st.song === false && song) ghi("PHIÊN jti=" + jti + " sống lại (hiếm — kiểm tra đồng hồ/proxy).");
      if (st.jti !== jti || st.song !== song) fs.writeFileSync(LSTATE, JSON.stringify({ jti, song, luc: Date.now() }));
    }
  }
} catch { /* sổ phiên best-effort — không chặn các việc chính */ }

// 2) Yêu cầu ĐĂNG NHẬP (nút trong email). Bỏ qua nếu cửa sổ login đang mở (<15').
let boQuaLogin = false;
if (fs.existsSync(LOCK)) {
  if (Date.now() - fs.statSync(LOCK).mtimeMs < 15 * 60 * 1000) boQuaLogin = true;
  else fs.rmSync(LOCK, { force: true });
}
if (!boQuaLogin) {
  const d = await hoi("loginStatus");
  if (d && d.requested) {
    coViec = true; log("⚡ Có yêu cầu đăng nhập! Mở màn hình login..." + (OTP_TAY ? " (OTP thủ công — cửa sổ hiện ra để gõ 6 số)" : ""));
    await apiPost("clearLogin");
    // OTP thủ công (Đường 2): --show để cửa sổ HIỆN RA cho người đọc mã từ Hasaki Authenticator gõ vào
    // (email+mật khẩu login-hasaki tự điền sẵn). Chế độ tự động cũ thì chạy ngầm ngoài màn hình như trước.
    chay("login-hasaki.js", OTP_TAY ? ["--show"] : []);   // login-hasaki.js tự quản lock
  } else imLang.push("đăng nhập");
}
if (!coViec && imLang.length && nenGhiNhipTim()) log("· nhịp tim: không có yêu cầu nào (" + imLang.join(" · ") + ") — lượt rỗng không ghi log nữa.");
process.exit(0);
