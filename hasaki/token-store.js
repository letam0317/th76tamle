/**
 * token-store.js — KHO TOKEN DÙNG CHUNG cho mọi bộ (auto-export / timesheet / push).
 *
 *  MỤC TIÊU: ĐĂNG NHẬP 1 LẦN → mọi bộ xài lại token, KHÔNG mỗi bộ tự mở trình duyệt /
 *  đăng nhập lại → giảm tải & tránh spam đăng nhập lên work / hr / wms (wshr.hasaki.vn).
 *
 *  - tokenCon(DIR, app)      : token còn "tươi" (< TTL) cho app ("work" | "hr") → chuỗi, else null.
 *  - luuToken(DIR, app, tk)  : lưu 1 token.
 *  - luuNhieu(DIR, {work,hr}) : lưu nhiều token 1 lần (login-hasaki dùng sau khi đăng nhập).
 *  - voiKhoa(DIR, fn, opt)   : chạy fn khi GIỮ khoá tuần tự → 2 bộ KHÔNG cùng mở Edge trên 1 profile.
 *
 *  Token wshr sống rất lâu (~48h); TTL mặc định 40' chỉ để chắc chắn token tái dùng còn hiệu lực,
 *  vẫn đủ cho cả cụm job chạy gần nhau (7h00 / 7h20 / nút PIN) dùng chung 1 lượt đăng nhập.
 */
import fs from "node:fs";
import path from "node:path";

const CACHE = (DIR) => path.join(DIR, ".wms-session", "token-cache.json");
const KHOA = (DIR) => path.join(DIR, ".wms-session", ".capture.lock");

// ===== Đường dẫn dùng chung (khả chuyển giữa các máy — không hardcode C:/Users/...) =====
// Edge cài mặc định ở Program Files (x86) trên Win64; bản 64-bit mới có thể ở Program Files.
// Máy nào khác lạ thì đặt biến EDGE_PATH trong .env.
export const EDGE_PATH = process.env.EDGE_PATH
  || ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p))
  || "msedge.exe";
// Profile Edge dùng chung (phiên SSO) — luôn nằm trong thư mục dự án, theo DIR của script gọi.
export const duongDanProfile = (DIR) => process.env.EDGE_PROFILE_DIR || path.join(DIR, ".wms-session", "edge-profile");
const TTL_MS = Number(process.env.TOKEN_TTL_PHUT || 40) * 60 * 1000;
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

const doc = (DIR) => { try { return JSON.parse(fs.readFileSync(CACHE(DIR), "utf8")); } catch { return {}; } };
const ghi = (DIR, o) => { try { fs.mkdirSync(path.dirname(CACHE(DIR)), { recursive: true }); fs.writeFileSync(CACHE(DIR), JSON.stringify(o)); } catch {} };

export function tokenCon(DIR, app) {
  const e = doc(DIR)[app];
  return (e && e.token && Date.now() - (e.at || 0) < TTL_MS) ? e.token : null;
}
/** Token đã lưu BẤT KỂ TUỔI ({token, at} hoặc null) — cho WMS, nơi get-me là trọng tài duy nhất:
 *  token WMS sống hàng chục giờ và chỉ chết khi có người ĐĂNG NHẬP đè; vứt theo tuổi 40'
 *  là vứt phí token còn tốt → ép re-login vô ích (= đá phiên người đang làm việc). */
export function docTokenCu(DIR, app) {
  const e = doc(DIR)[app];
  return (e && e.token) ? e : null;
}
/* NHÃN `nguon` (30/07/2026 — thiết kế Phần F "dữ liệu luôn tươi"):
 *   "bridge" = token của PHIÊN NGƯỜI THẬT (extension đẩy qua GAS) → CÓ NGƯỜI ĐANG LÀM.
 *   "bot"    = token do chính bot login SSO mà có → không ai bị đá khi phiên này chết.
 * Không có nhãn thì không phân biệt được "phiên của người" với "phiên của chính mình", mà đó
 * chính là cửa an toàn duy nhất của luật "chỉ login khi KHÔNG có phiên sống". Tham số thêm ở
 * cuối nên mọi chỗ gọi cũ (3 tham số) vẫn chạy — chỉ là không có nhãn (coi như "khongro"). */
/* VÁ 30/07/2026 (rà sự cố "bị đá 18h16"): lưu lại CÙNG MỘT token thì KHÔNG được đổi gốc gác.
 * layTokenTuPhucHoi/lamTuoiToken gọi getWmsToken — hàm này ưu tiên trả token BRIDGE (phiên NGƯỜI)
 * đang có sẵn, nhưng call site dán nhãn "bot" đồng loạt → nhãn "bridge" bị ghi đè thành "bot"
 * (bắt quả tang 17:00:27 30/07), làm trangThaiPhien tưởng phiên người là phiên bot: khi phiên đó
 * chết, luật phiên coi như "không ai bị đá" → mở cửa login trong khi người có thể đang làm.
 * Luật: token TRÙNG → giữ nhãn cũ; riêng nhãn "bridge" luôn thắng (token đi qua kênh bridge
 * là bằng chứng chắc chắn đó là phiên người thật). */
function nhanGiuGoc(cu, token, nguon) {
  return (cu && cu.token === token && nguon !== "bridge" && cu.nguon) ? cu.nguon : nguon;
}
export function luuToken(DIR, app, token, nguon) {
  if (!token) return;
  const o = doc(DIR); const nhan = nhanGiuGoc(o[app], token, nguon);
  o[app] = { token, at: Date.now(), ...(nhan ? { nguon: nhan } : {}) }; ghi(DIR, o);
}
export function luuNhieu(DIR, obj, nguon) {
  const o = doc(DIR);
  for (const k in obj) if (obj[k]) { const nhan = nhanGiuGoc(o[k], obj[k], nguon); o[k] = { token: obj[k], at: Date.now(), ...(nhan ? { nguon: nhan } : {}) }; }
  ghi(DIR, o);
}
/** Nhãn nguồn của token đang lưu: "bridge" | "bot" | "khongro". */
export function nguonToken(DIR, app) {
  const e = doc(DIR)[app];
  return (e && e.nguon) ? String(e.nguon) : "khongro";
}

/**
 * Giữ khoá tuần tự rồi chạy fn. Nếu bộ khác đang giữ → CHỜ (poll) tối đa waitMs;
 * khoá "chết" (quá staleMs, tiến trình đã thoát) thì giành lấy. Luôn nhả khoá khi xong.
 */
export async function voiKhoa(DIR, fn, { log = () => {}, waitMs = 8 * 60 * 1000, staleMs = 10 * 60 * 1000 } = {}) {
  const lk = KHOA(DIR); const t0 = Date.now(); let giu = false;
  for (;;) {
    try { fs.mkdirSync(path.dirname(lk), { recursive: true }); fs.writeFileSync(lk, String(Date.now()), { flag: "wx" }); giu = true; break; }
    catch {
      let age = Infinity; try { age = Date.now() - fs.statSync(lk).mtimeMs; } catch {}
      if (age > staleMs) { try { fs.rmSync(lk, { force: true }); } catch {} continue; }   // khoá chết → giành
      if (Date.now() - t0 > waitMs) { log("  (khoá token bận quá lâu — chạy không khoá)"); break; }
      await nghi(1500);
    }
  }
  try { return await fn(); } finally { if (giu) { try { fs.rmSync(lk, { force: true }); } catch {} } }
}
