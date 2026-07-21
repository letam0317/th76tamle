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
 *   2) Đọc mốc đồng bộ (Metadata!B1 của Sheet, qua gviz công khai).
 *      CŨ = mốc < 07:00 hôm nay VÀ bây giờ ≥ 07:45 (nhường task 7h chạy trước).
 *      --force = bỏ kiểm tra cũ/mới (cooldown 4h đã kiểm ở GAS khi đặt cờ).
 *   3) Chọn nguồn token theo session-rules (KHÔNG bao giờ đá phiên trong giờ làm):
 *      token kho còn sống → chạy · token BRIDGE sống → nạp vào kho rồi chạy ·
 *      trong khung giờ an toàn → chạy (cho phép re-login) · còn lại → HOÃN (exit 75).
 *   4) Gọi SYNC-STOCK.bat (3 bước, log riêng từng bước) rồi đọc lại Metadata để kết luận.
 *
 *  Exit: 0 = đã mới / chạy xong · 75 = hoãn (sẽ tự thử lại ở tick sau) · 2 = lỗi.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tokenCon, luuToken } from "./token-store.js";
import { duocPhepReLogin, layBridgeToken, DEFER_EXIT } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SHEET_ID = process.env.STOCKLOC_SHEET_ID || "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const GET_ME = "https://wms-gw.inshasaki.com/api/v1/auth/user/get-me";
const LOCK = path.join(DIR, ".sync-guard.lock");
const FORCE = process.argv.includes("--force");
const log = (...a) => console.log(new Date().toISOString().replace("T", " ").slice(0, 19), ...a);

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
        const dau = /sync-stocklocation\.js|push-pc-to-sheet\.mjs|sync-tonbatthuong\.js|SYNC-STOCK\.bat|AUTO-EXPORT\.bat/i;
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
  const homNay7h = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0).getTime();
  const homNay745 = homNay7h + 45 * 60 * 1000;
  const cu = FORCE || ((moc || 0) < homNay7h && bayGio >= homNay745);
  if (!cu) {
    log("✓ Dữ liệu đã mới (mốc " + (moc ? fmtVN(moc) : "—") + ") — không cần làm gì.");
    return 0;
  }
  log((FORCE ? "⚡ Có yêu cầu tải lại (--force)" : "⚠ Dữ liệu CŨ (mốc " + (moc ? fmtVN(moc) : "chưa có") + ")") + " — chuẩn bị chạy cụm đồng bộ...");

  /* ---- 3) Nguồn token theo session-rules — quyết định chạy hay hoãn ---- */
  let nguon = null;
  const cache = tokenCon(DIR, "wms");
  if (cache) {
    const me = await fetch(GET_ME, { headers: { authorization: cache } }).catch(() => null);
    if (me && me.ok) nguon = "token kho còn sống";
  }
  if (!nguon) {
    const bridge = await layBridgeToken(log);
    if (bridge) { luuToken(DIR, "wms", bridge); nguon = "token BRIDGE của operator (đã nạp vào kho)"; }
  }
  if (!nguon) {
    if (duocPhepReLogin(now)) nguon = "khung giờ an toàn (cho phép re-login SSO)";
    else {
      log("⛔ Không có token sống và đang TRONG GIỜ LÀM VIỆC — hoãn, không đá phiên ai. (Mẹo: mở WMS trên trình duyệt có extension wms-bridge là guard chạy được ngay.)");
      return DEFER_EXIT;
    }
  }
  log("→ Nguồn: " + nguon + ". Chạy SYNC-STOCK.bat...");

  /* ---- 4) Chạy cụm rồi kết luận bằng chính Metadata ---- */
  const ma = await new Promise((res) => {
    const c = spawn("cmd.exe", ["/c", path.join(DIR, "SYNC-STOCK.bat")], { cwd: DIR, stdio: "ignore", windowsHide: true });
    c.on("exit", (code) => res(code == null ? -1 : code));
    c.on("error", () => res(-1));
  });
  const mocMoi = await docMocMeta();
  if (mocMoi && mocMoi > (moc || 0)) {
    log("✓ XONG — Metadata đã sang mốc mới: " + fmtVN(mocMoi) + " (bat exit " + ma + ").");
    return 0;
  }
  log("⚠ Cụm chạy xong (bat exit " + ma + ") nhưng Metadata CHƯA đổi — nhiều khả năng các bước bị hoãn (ngoài khung an toàn) hoặc lỗi; xem stocklocation.log. Guard sẽ thử lại tick sau.");
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
