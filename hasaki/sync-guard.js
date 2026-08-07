/**
 * sync-guard.js — WATCHDOG "dữ liệu tồn kho factory PHẢI mới trong ngày".
 *
 *  Sinh ra từ sự cố 21/07/2026: máy tắt lúc 7h → task chạy bù 9:34 → máy restart 9:37
 *  giết cả cụm giữa chừng → dashboard trơ dữ liệu cũ tới tận khi chạy tay.
 *
 *  Được gọi từ 3 nơi:
 *   - Task Scheduler "Factory watchdog ton kho": khi đăng nhập máy (+5') và mỗi giờ 7h-17h.
 *   - watch-login-request.js: khi có cờ "Tải lại dữ liệu" từ dashboard (chạy với --force).
 *   - Chạy tay: node sync-guard.js [--force]
 *
 *  Thuật toán:
 *   1) Khoá đơn lượt (.sync-guard.lock) + né khi cụm sync khác đang chạy.
 *   2) Đọc mốc đồng bộ (Metadata!B1 của Sheet, qua gviz công khai) + mốc TỪNG BƯỚC
 *      (.sync-ok-<bước>, vá 25/07/2026 — trước chỉ nhìn Metadata do riêng stocklocation ghi,
 *      nên kiemke chết vì "fetch failed" 24/07 mà guard vẫn tưởng mới, trơ dữ liệu 3 tiếng).
 *      CŨ = mốc CŨ NHẤT của cụm < 08:40 hôm nay VÀ bây giờ ≥ 09:25 (nhường task 8h40 chạy
 *      trước — lịch "5S Dong bo dashboard" dời 7h00→8h40 ngày 22/07/2026 vì máy hay bật muộn).
 *      --force = bỏ kiểm tra cũ/mới (cooldown 4h đã kiểm ở GAS khi đặt cờ).
 *      Lượt VÁ (không --force) đặt SYNC_SKIP_FRESH=1: bước đã tươi hôm nay tự thoát sớm,
 *      chỉ bước còn cũ chạy lại — không kéo trùng cả cụm ~25 phút.
 *   3) Chọn nguồn token qua layTokenSongWms (session-rules, 22/07/2026): kho BẤT KỂ tuổi
 *      + get-me trọng tài → bridge GAS → còn sống là chạy, KHÔNG đăng nhập mới.
 *      Hết cả hai: chỉ re-login trong khung an toàn (<07:45 / ≥18:00) · còn lại HOÃN (exit 75).
 *   4) Gọi SYNC-STOCK.bat (3 bước, log riêng từng bước) rồi đọc lại Metadata để kết luận.
 *
 *  Exit: 0 = đã mới / chạy xong · 75 = hoãn (sẽ tự thử lại ở tick sau) · 2 = lỗi.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { duocPhepReLogin, layTokenSongWms, layTokenSongWork, DEFER_EXIT, docMocBuoc, CAC_BUOC_SYNC } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SHEET_ID = process.env.STOCKLOC_SHEET_ID || "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const LOCK = path.join(DIR, ".sync-guard.lock");
const LAN_VA = path.join(DIR, ".sync-guard.last-run");   // mốc lượt VÁ gần nhất (backoff 20' — tick 2' không được spam cụm khi 1 bước hỏng kéo dài)
const VA_BACKOFF_MS = 20 * 60 * 1000;
const FORCE = process.argv.includes("--force");
const log = (...a) => console.log(new Date().toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }), ...a);

/* ---- 1) Khoá đơn lượt: lock < 45' coi như đang có guard khác chạy ---- */
function giuKhoa() {
  try {
    if (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs < 45 * 60 * 1000) return false;
  } catch { /* đọc lock lỗi → cứ ghi đè */ }
  fs.writeFileSync(LOCK, String(process.pid));
  return true;
}
const nhaKhoa = () => { try { fs.rmSync(LOCK, { force: true }); } catch { /* bỏ qua */ } };

/* ---- Cụm sync khác (task 7h / guard khác / chạy tay) đang chạy? — soi command line ---- */
function cumDangChay() {
  return new Promise((res) => {
    execFile("powershell", ["-NoProfile", "-Command",
      "Get-CimInstance Win32_Process -Filter \"Name='node.exe' or Name='cmd.exe'\" | Select-Object -ExpandProperty CommandLine"],
      { windowsHide: true, timeout: 30000 },
      (err, out) => {
        if (err || !out) return res(false);
        const dau = /sync-stocklocation\.js|push-pc-to-sheet\.mjs|sync-tonbatthuong\.js|sync-vesinh-all\.js|sync-vesinh-factory\.mjs|sync-vesinh-ai\.mjs|auto-export-sync\.js|SYNC-STOCK\.bat|AUTO-EXPORT\.bat/i;
        res(out.split(/\r?\n/).some((l) => dau.test(l)));
      });
  });
}

/* ---- 2) Mốc đồng bộ cuối: Metadata!B1 (epoch ms) qua gviz công khai ---- */
async function docMocMeta() {
  const url = "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/gviz/tq?tqx=out:json&sheet=Metadata&range=B1&_=" + Date.now();
  const r = await fetch(url).catch(() => null);
  if (!r || !r.ok) return null;                       // không đọc được → null = "không biết"
  const t = await r.text().catch(() => "");
  const m = t.match(/"v"\s*:\s*([0-9][0-9.eE+]*)/);
  return m ? Number(m[1]) : 0;                        // 0 = tab chưa có mốc (chưa sync lần nào)
}

const fmtVN = (ms) => new Date(ms).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });

async function main() {
  if (await cumDangChay()) { log("Cụm đồng bộ khác đang chạy (task 7h / chạy tay) — guard đứng ngoài."); return 0; }

  const moc = await docMocMeta();
  if (moc == null && !FORCE) { log("⚠ Không đọc được Metadata (mạng?) — không kết luận được, thử lại tick sau."); return DEFER_EXIT; }

  const now = new Date();
  const bayGio = now.getTime();
  const homNay840 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 40, 0).getTime();
  const homNay925 = homNay840 + 45 * 60 * 1000;
  // Mốc CŨ NHẤT của cả cụm (vá 25/07/2026): Metadata!B1 + mốc từng bước .sync-ok-* —
  // 1 bước chết (như kiemke "fetch failed" 24/07) là cả cụm bị coi CŨ để guard chạy vá.
  const buocCu = () => CAC_BUOC_SYNC.filter((b) => docMocBuoc(DIR, b) < homNay840);
  const mocCum = () => Math.min(moc || 0, ...CAC_BUOC_SYNC.map((b) => docMocBuoc(DIR, b)));
  const mocMin = mocCum();
  const cu = FORCE || (mocMin < homNay840 && bayGio >= homNay925);
  if (!cu) {
    if (mocMin < homNay840) log("… Mốc còn cũ (" + (buocCu().join(", ") || "Metadata") + ") nhưng chưa tới 09:25 — nhường task 8h40 chạy trước.");
    else log("✓ Dữ liệu đã mới (Metadata " + (moc ? fmtVN(moc) : "—") + ", đủ mốc " + CAC_BUOC_SYNC.length + " bước hôm nay) — không cần làm gì.");
    return 0;
  }
  log((FORCE ? "⚡ Có yêu cầu tải lại (--force)" : "⚠ Dữ liệu CŨ (Metadata " + (moc ? fmtVN(moc) : "chưa có") + " · bước cũ: " + (buocCu().join(", ") || "—") + ")") + " — chuẩn bị chạy cụm đồng bộ...");

  /* ---- 2b) BACKOFF lượt vá: tick 2' chỉ được spawn cụm tối đa mỗi 20' (1 bước hỏng kéo dài
     không thành dội API cả ngày). Chỉ tính khi cụm THẬT SỰ được spawn — lượt hoãn vì thiếu token
     không ghi mốc, nên sáng sớm vẫn dò token mỗi 2' và bắt được operator login ngay. ---- */
  if (!FORCE) {
    let lanTruoc = 0; try { lanTruoc = fs.statSync(LAN_VA).mtimeMs; } catch { /* chưa vá lần nào */ }
    if (Date.now() - lanTruoc < VA_BACKOFF_MS) {
      log("… Lượt vá trước mới chạy " + Math.round((Date.now() - lanTruoc) / 60000) + "' trước — chờ đủ backoff 20' rồi vá tiếp.");
      return DEFER_EXIT;
    }
  }

  /* ---- 3) Nguồn token theo session-rules — quyết định chạy hay hoãn ---- */
  let nguon = null;
  if (await layTokenSongWms(DIR, log)) nguon = "token sống (kho/bridge — get-me OK, không tạo phiên mới)";
  // Không có phiên WMS nhưng có phiên work/hr: bước 5S vẫn chạy được (cổng wshr riêng), 4 bước
  // factory sẽ tự hoãn (exit 75) — vẫn hơn là đứng im để 5S cũ nguyên ngày.
  if (!nguon && await layTokenSongWork(DIR, log)) nguon = "token work/hr sống (bridge) — đủ cho bước 5S";
  if (!nguon) {
    if (duocPhepReLogin(now)) nguon = "khung giờ an toàn (cho phép re-login SSO)";
    else {
      log("⛔ Không có token sống và đang TRONG GIỜ LÀM VIỆC — hoãn, không đá phiên ai. (Mẹo: mở WMS trên trình duyệt có extension wms-bridge là guard chạy được ngay.)");
      return DEFER_EXIT;
    }
  }
  log("→ Nguồn: " + nguon + ". Chạy AUTO-EXPORT.bat (5S + cụm tồn kho)...");

  /* ---- 4) Chạy cụm rồi kết luận bằng Metadata + mốc từng bước ---- */
  try { fs.writeFileSync(LAN_VA, new Date().toISOString()); } catch { /* mốc backoff best-effort */ }
  const ma = await new Promise((res) => {
    // Lượt VÁ (không --force): SYNC_SKIP_FRESH=1 — bước đã tươi hôm nay tự thoát sớm trong script.
    const env = { ...process.env, SYNC_SKIP_FRESH: FORCE ? "" : "1" };
    /* 31/07/2026: gọi AUTO-EXPORT.bat thay cho SYNC-STOCK.bat — bat này chạy bước 5S rồi mới
       call SYNC-STOCK.bat, nên guard mới với tới được bước "5s". Không sợ chạy thừa: lượt VÁ đặt
       SYNC_SKIP_FRESH=1 nên bước nào đã tươi hôm nay cũng tự thoát ngay ở dòng đầu. */
    const c = spawn("cmd.exe", ["/c", path.join(DIR, "AUTO-EXPORT.bat")], { cwd: DIR, stdio: "ignore", windowsHide: true, env });
    c.on("exit", (code) => res(code == null ? -1 : code));
    c.on("error", () => res(-1));
  });
  const mocMoi = await docMocMeta();
  const mocMinMoi = Math.min(mocMoi || 0, ...CAC_BUOC_SYNC.map((b) => docMocBuoc(DIR, b)));
  const daDu = FORCE ? ((mocMoi || 0) > (moc || 0) || mocMinMoi > mocMin) : mocMinMoi >= homNay840;
  if (daDu) {
    log("✓ XONG — Metadata " + fmtVN(mocMoi || 0) + ", mốc bước cũ nhất " + fmtVN(mocMinMoi) + " (bat exit " + ma + ").");
    return 0;
  }
  log("⚠ Cụm chạy xong (bat exit " + ma + ") nhưng còn CŨ: " + (buocCu().join(", ") || "Metadata") + " — nhiều khả năng bước bị hoãn (ngoài khung an toàn) hoặc lỗi; xem log từng bước. Guard sẽ thử lại tick sau.");
  return DEFER_EXIT;
}

(async () => {
  // Dùng process.exitCode (không process.exit) để socket keep-alive tự đóng, thoát sạch.
  if (!giuKhoa()) { log("Guard khác đang chạy (lock còn tươi) — thoát."); return; }   // không nhả lock của người khác
  let code = 2;
  try { code = await main(); }
  catch (e) { log("✗ " + (e && e.message ? e.message : e)); code = 2; }
  nhaKhoa();
  process.exitCode = code;
})();
