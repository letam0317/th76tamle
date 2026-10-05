/**
 * ============================================================================
 *  cap-token-toi.mjs — CẤP TOKEN KHI KHÔNG CÒN PHIÊN NÀO SỐNG (user chốt 01/10/2026, Phần G)
 * ============================================================================
 *  Thứ tự ưu tiên user chốt: (1) extension từ laptop (phiên người thật) → (2) token còn trong kho →
 *  (3) hết cả hai mới "tự đăng nhập bằng tài khoản của user, OTP thì nhắn cho user đưa".
 *  Bước (3) là Đường 2b sẵn có: `login-hasaki.js --auto --otp-chat` → hop-thu.hoiOtpQuaChat nhắn
 *  Telegram xin 6 số, user trả lời, bot gõ + nộp 1 lần. Chốt CAM_TU_DANG_NHAP=1 MIỄN TRỪ lượt này
 *  (có người trong vòng lặp), nên .env không phải đổi.
 *
 *  File này chỉ QUYẾT ĐỊNH CÓ XIN HAY KHÔNG, rồi gọi login-hasaki — không tự đụng SSO:
 *    · chỉ trong giờ lịch sự LOGIN_OTP_GIO (mặc định 07:00-21:30; token WMS hay chết ~00:15, không nhắn đêm);
 *    · không chạy ở máy vai PC (RUNNER_VAI=pc: PC có người dùng ban ngày, không chắc có màn hình cho Turnstile);
 *    · trangThaiPhien phải là "khong" + đủ cửa im lặng (bridge/kho còn sống → thôi, ưu tiên extension);
 *    · ngân sách: tối đa CAP_TOKEN_MAX_NGAY lượt/ngày (mặc định 2), cách nhau ≥ 2 h; hop-thu còn chống dội 30'
 *      riêng khi user không trả lời.
 *  Mặc định DIỄN TẬP (chỉ in quyết định). --lam mới gọi login-hasaki. --force bỏ cửa giờ lịch sự.
 *  Lịch dự kiến: task "5S Cap token toi" mỗi 30' trên laptop (đăng ký sau khi user duyệt).
 * ============================================================================
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { trangThaiPhien, phutVN, DEFER_EXIT, camTuDangNhap } from "./session-rules.js";
import { tokenCon } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
process.chdir(DIR);
const A = process.argv.slice(2);
const LAM = A.includes("--lam"), FORCE = A.includes("--force");
const GIO = String(process.env.LOGIN_OTP_GIO || "07:00-21:30");
const MAX_NGAY = Number(process.env.CAP_TOKEN_MAX_NGAY || 2);
const CACH_MS = Number(process.env.CAP_TOKEN_CACH_PHUT || 120) * 60000;
const F_SO = path.join(DIR, ".cap-token-toi.json");
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const homNay = () => new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
const phut = (s) => { const m = String(s).trim().match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

(async () => {
  if (String(process.env.RUNNER_VAI || "").toLowerCase() === "pc") { log("máy vai PC — không xin OTP ở đây (không có màn hình cho Turnstile)."); return; }
  const [a, b] = GIO.split("-").map(phut);
  const p = phutVN();
  if (!FORCE && a != null && b != null && !(a <= b ? (p >= a && p < b) : (p >= a || p < b))) { log("ngoài giờ lịch sự xin OTP (" + GIO + ") — bỏ lượt."); return; }

  let so = {}; try { so = JSON.parse(fs.readFileSync(F_SO, "utf8")); } catch { /* chưa có sổ */ }
  if (so.ngay !== homNay()) so = { ngay: homNay(), soLan: 0, lanCuoi: 0 };
  if (so.soLan >= MAX_NGAY) { log("đã xin " + so.soLan + " lượt hôm nay (trần " + MAX_NGAY + ") — thôi, mai tính."); return; }
  if (so.lanCuoi && Date.now() - so.lanCuoi < CACH_MS) { log("lượt trước cách đây " + Math.round((Date.now() - so.lanCuoi) / 60000) + "' (< " + CACH_MS / 60000 + "') — chờ."); return; }

  /* Ưu tiên 1-2: còn phiên người (bridge) hoặc token kho sống → KHÔNG xin. */
  const tt = await trangThaiPhien(DIR, log).catch(() => null);
  if (!tt) { log("⚠ không đánh giá được trạng thái phiên — không xin OTP lượt này."); process.exit(DEFER_EXIT); }
  if (tt.ai === "nguoi" || tt.ai === "bot") { log("✓ " + tt.vi + " → ưu tiên extension/kho, không xin OTP."); return; }
  if (tt.ai === "khongro") { log("⚠ " + tt.vi + " — không xin."); process.exit(DEFER_EXIT); }
  if (!tt.duocLogin) { log("⏳ " + tt.vi + " — chờ đủ cửa im lặng."); process.exit(DEFER_EXIT); }
  const work = tokenCon(DIR, "work");
  log("→ KHÔNG còn phiên WMS nào sống" + (work ? " (token work trong kho vẫn còn — cò work chạy được, nhưng cò WMS cần phiên mới)" : ", token work cũng hết") + ".");
  log("→ Đủ điều kiện xin OTP qua Telegram (lượt " + (so.soLan + 1) + "/" + MAX_NGAY + " hôm nay)" + (camTuDangNhap() ? " · CAM_TU_DANG_NHAP=1 miễn trừ vì có người đưa OTP" : "") + ".");
  if (!LAM) { log("[diễn tập] chưa gọi login-hasaki. Thêm --lam để làm thật."); return; }

  so.soLan += 1; so.lanCuoi = Date.now();
  fs.writeFileSync(F_SO, JSON.stringify(so));          // ghi TRƯỚC khi gọi: lỡ văng giữa chừng cũng không dội tin
  log("🔐 Gọi login-hasaki --auto --otp-chat (tối đa " + (Number(process.env.LOGIN_OTP_CHO_GIAY || 300) / 60) + "' chờ 6 số)…");
  const ma = await new Promise((res) => {
    const c = spawn(process.execPath, [path.join(DIR, "login-hasaki.js"), "--auto", "--otp-chat"], { cwd: DIR, stdio: "inherit", env: { ...process.env, LOGIN_OTP_CHAT: "1" } });
    c.on("exit", (code) => res(code)); c.on("error", () => res(1));
  });
  if (ma === 0) log("✓ Đăng nhập xong — token mới đã vào kho; watch-login-request sẽ thấy jti mới và ép tươi trong ≤2'.");
  else if (ma === DEFER_EXIT) log("⏸ login-hasaki hoãn (cửa kiểm phiên/cầu dao) — không sao, lượt sau.");
  else log("✗ login-hasaki trả mã " + ma + " — xem login-hasaki.log / Telegram.");
  process.exit(ma === 0 ? 0 : ma === DEFER_EXIT ? DEFER_EXIT : 1);
})();
