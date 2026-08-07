/**
 * auto-login.js — Tự phục hồi phiên Hasaki SSO (dùng chung cho push / auto-export / timesheet).
 *
 *  MỘT LẦN ĐĂNG NHẬP → CẢ 3 BỘ DÙNG CHUNG (work / hr / wms đều là Hasaki SSO, chung 1 Edge profile).
 *  - Ưu tiên TOKEN TRONG KHO (token-store): còn tươi thì DÙNG LẠI, KHÔNG mở trình duyệt.
 *  - Việc chụp token & đăng nhập được TUẦN TỰ HOÁ bằng khoá (voiKhoa) → 2 bộ không cùng mở Edge.
 *  - Đăng nhập lại là ĐƠN LƯỢT (single-flight): nếu đã có phiên login đang chạy → CHỜ nó xong,
 *    TUYỆT ĐỐI không mở thêm lượt đăng nhập (chống spam đăng nhập gây quá tải/khoá tài khoản).
 *
 * coSecret()          : có HASAKI_2FA_SECRET trong .env không (mới tự đăng nhập được).
 * chayAutoLogin(DIR)  : chạy login-hasaki.js --auto (tự điền email+mật khẩu+OTP rồi tự đóng), CHỜ xong.
 * layTokenTuPhucHoi(getToken, DIR, log, app):
 *      kho → (khoá) kho-lại → getToken → nếu hết phiên & có secret: đăng nhập ĐƠN LƯỢT → getToken lại.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { tokenCon, luuToken, voiKhoa } from "./token-store.js";
import { DEFER_EXIT, layBridgeTokenWshr } from "./session-rules.js";

export const coSecret = () => !!(process.env.HASAKI_2FA_SECRET || "").trim();

const LOGIN_LOCK = (DIR) => path.join(DIR, ".login-open.lock");
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

/** Mã thoát của lượt login: 0 = xong · 75 = HOÃN (cửa kiểm phiên chặn) · khác = trượt thật. */
export function chayAutoLoginMa(DIR) {
  return new Promise((res) => {
    const c = spawn(process.execPath, [path.join(DIR, "login-hasaki.js"), "--auto"], { cwd: DIR, stdio: "inherit" });
    c.on("exit", (code) => res(code == null ? -1 : code));
    c.on("error", () => res(-1));
  });
}
/** Bọc boolean cho các chỗ gọi cũ (giữ nguyên hợp đồng: true = đăng nhập xong). */
export async function chayAutoLogin(DIR) { return (await chayAutoLoginMa(DIR)) === 0; }

// Đăng nhập ĐƠN LƯỢT: nếu ĐÃ có phiên login đang chạy (lock < 15') → CHỜ nó xong, KHÔNG mở thêm.
async function dangNhapMotLan(DIR, log) {
  const lk = LOGIN_LOCK(DIR);
  const dangChay = () => { try { return Date.now() - fs.statSync(lk).mtimeMs < 15 * 60 * 1000; } catch { return false; } };
  if (dangChay()) {
    log("  ⏳ Đã có phiên đăng nhập khác đang chạy — CHỜ (không mở thêm lượt)...");
    for (let i = 0; i < 320 && dangChay(); i++) await nghi(1500);   // chờ tối đa ~8'
    return true;   // lượt login kia lo phần đăng nhập; ta chỉ cần lấy token lại
  }
  log("  ⚠ Phiên hết hạn — tự đăng nhập lại (ĐƠN LƯỢT)...");
  const ma1 = await chayAutoLoginMa(DIR);
  if (ma1 === 0) return true;
  // 75 = cửa kiểm phiên CHẶN (có người đang làm / chưa đủ cửa im lặng). Đây KHÔNG phải lỗi và
  // thử lại ngay cũng vẫn bị chặn → hoãn hẳn lượt này, để tick sau (hoặc khung khác) lo.
  if (ma1 === DEFER_EXIT) { const e = new Error("Hoãn đăng nhập: cửa kiểm phiên chặn (xem log login)."); e.defer = true; throw e; }
  // Trượt lượt 1 (Turnstile chậm / IdP trả trang lạ 1 nhịp) → nghỉ 25s thử ĐÚNG 1 lượt nữa rồi thôi
  // (mỗi lượt login-hasaki chỉ nộp OTP 1 lần nên 2 lượt vẫn an toàn khoá tài khoản, không spam IdP).
  log("  ⚠ Lượt đăng nhập 1 trượt — nghỉ 25s, thử lượt 2 (lượt CUỐI)...");
  await nghi(25000);
  const ma2 = await chayAutoLoginMa(DIR);
  if (ma2 === DEFER_EXIT) { const e = new Error("Hoãn đăng nhập: cửa kiểm phiên chặn ở lượt 2."); e.defer = true; throw e; }
  return ma2 === 0;
}

/**
 * @param app "work" (work.hasaki + wms) hoặc "hr" (hr.hasaki) — khoá kho token theo nghiệp vụ.
 */
export async function layTokenTuPhucHoi(getToken, DIR, log = () => {}, app = "work") {
  // 1) Token còn tươi trong kho → dùng lại, KHÔNG mở trình duyệt (không tải thêm lên hệ thống).
  const cached = tokenCon(DIR, app);
  if (cached) { log("✓ Dùng token sẵn có trong kho (" + app + ")."); return cached; }

  // 2) Chụp token dưới KHOÁ tuần tự (2 bộ không cùng mở Edge trên 1 profile).
  return await voiKhoa(DIR, async () => {
    const lai = tokenCon(DIR, app);   // trong lúc chờ khoá, bộ khác có thể đã nạp token
    if (lai) { log("✓ Token vừa được lượt khác nạp (" + app + ")."); return lai; }

    // 2b) KÊNH BRIDGE work/hr (extension v1.4.0) — mượn phiên đang sống của operator.
    //     Vì sao bắt buộc: cửa kiểm phiên CẤM bot login khi có người đang làm (đúng), mà bộ 5S
    //     trước đây không có kênh nào khác ngoài SSO ⇒ hễ operator online là 5S đứng luôn cả ngày
    //     (sự cố 31/07: factory tươi nhờ bridge WMS, còn 5S đóng băng từ 29/07). Bridge không tạo
    //     phiên mới, không đá ai, và tự trả null khi GAS chưa có khe wshr (fail closed).
    //     Chỉ áp cho "work": khe wshr được trọng tài bằng API danh bạ — đúng cổng mà bộ 5S dùng.
    if (app === "work") {
      const bridge = await layBridgeTokenWshr(log).catch(() => null);
      if (bridge) { luuToken(DIR, app, bridge, "bridge"); return bridge; }
    }
    try {
      const t = await getToken();
      luuToken(DIR, app, t, "bot");   // getToken = bot tự chụp từ Edge profile → phiên của BOT
      return t;
    } catch (e) {
      if (e && e.defer) throw e;  // session-rules hoãn re-login (ngoài khung an toàn) → KHÔNG auto-login (cũng đá phiên)
      if (!coSecret()) throw e;   // không có secret → giữ hành vi cũ (báo lỗi để người xử lý)
      const ok = await dangNhapMotLan(DIR, log);
      if (!ok) throw new Error("Tự đăng nhập lại thất bại. " + e.message);
      const sauLogin = tokenCon(DIR, app);   // login-hasaki đã cache sẵn token cho cả work+hr?
      if (sauLogin) { log("✓ Token đã có sẵn sau đăng nhập (" + app + ")."); return sauLogin; }
      log("✓ Đăng nhập xong — lấy token lần nữa (" + app + ")...");
      const t2 = await getToken();
      luuToken(DIR, app, t2, "bot");
      return t2;
    }
  }, { log });
}
