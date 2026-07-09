/**
 * auto-login.js — Tự phục hồi phiên work.hasaki.vn (dùng chung cho push & auto-export).
 *
 * coSecret()          : có HASAKI_2FA_SECRET trong .env không (mới tự đăng nhập được).
 * chayAutoLogin(DIR)  : chạy login-hasaki.js --auto (HIỆN cửa sổ — Turnstile cần trình
 *                       duyệt thật; tự điền email+mật khẩu+OTP rồi tự đóng), CHỜ xong. true nếu OK.
 * layTokenTuPhucHoi(getToken, DIR, log):
 *      thử getToken(); nếu hết phiên & có secret → tự đăng nhập lại rồi thử lại 1 lần.
 *
 * Lưu ý: getToken & login --auto đều dùng chung 1 profile Edge nên PHẢI chạy tuần tự
 * (getToken đóng browser trước khi ta spawn login; login đóng xong mới getToken lại).
 */
import { spawn } from "node:child_process";
import path from "node:path";

export const coSecret = () => !!(process.env.HASAKI_2FA_SECRET || "").trim();

export function chayAutoLogin(DIR) {
  return new Promise((res) => {
    const c = spawn(process.execPath, [path.join(DIR, "login-hasaki.js"), "--auto"], { cwd: DIR, stdio: "inherit" });
    c.on("exit", (code) => res(code === 0));
    c.on("error", () => res(false));
  });
}

export async function layTokenTuPhucHoi(getToken, DIR, log = () => {}) {
  try {
    return await getToken();
  } catch (e) {
    if (!coSecret()) throw e;   // không có secret → giữ hành vi cũ (báo lỗi để người xử lý)
    log("⚠ Phiên hết hạn — thử tự đăng nhập lại (headless)...");
    const ok = await chayAutoLogin(DIR);
    if (!ok) throw new Error("Tự đăng nhập lại thất bại. " + e.message);
    log("✓ Đã tự đăng nhập lại. Lấy token lần nữa...");
    return await getToken();
  }
}
