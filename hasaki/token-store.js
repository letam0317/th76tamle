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
const TTL_MS = Number(process.env.TOKEN_TTL_PHUT || 40) * 60 * 1000;
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

const doc = (DIR) => { try { return JSON.parse(fs.readFileSync(CACHE(DIR), "utf8")); } catch { return {}; } };
const ghi = (DIR, o) => { try { fs.mkdirSync(path.dirname(CACHE(DIR)), { recursive: true }); fs.writeFileSync(CACHE(DIR), JSON.stringify(o)); } catch {} };

export function tokenCon(DIR, app) {
  const e = doc(DIR)[app];
  return (e && e.token && Date.now() - (e.at || 0) < TTL_MS) ? e.token : null;
}
export function luuToken(DIR, app, token) {
  if (!token) return;
  const o = doc(DIR); o[app] = { token, at: Date.now() }; ghi(DIR, o);
}
export function luuNhieu(DIR, obj) {
  const o = doc(DIR); for (const k in obj) if (obj[k]) o[k] = { token: obj[k], at: Date.now() }; ghi(DIR, o);
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
