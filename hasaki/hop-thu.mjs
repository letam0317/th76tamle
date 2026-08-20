/**
 * ============================================================================
 *  hop-thu.mjs — HỘP THƯ DÙNG CHUNG (Telegram) + XIN MÃ OTP QUA TIN NHẮN
 * ============================================================================
 *  Hai bộ dùng chung file này:
 *    • tin-nhan-bot.mjs  — nghe lệnh (/trangthai, /nop, /kiemke…)
 *    • login-hasaki.js   — khi tới bước OTP mà bot không tự sinh mã được thì
 *                          NHẮN XIN CHỦ MÁY 6 số, nhận về rồi gõ vào SSO.
 *
 *  VÌ SAO TÁCH RA: chỉ được có MỘT bộ gọi `getUpdates` tại một thời điểm —
 *  hai bộ cùng long-poll một token thì Telegram trả 409 "Conflict: terminated by
 *  other getUpdates request" và cả hai cùng hỏng. Nên:
 *    · offset nằm chung một sổ `.tin-nhan-state.json` (không bộ nào bỏ sót/nhận lại tin);
 *    · lúc đang xin OTP, `.otp-cho.json` tồn tại ⇒ bot NHƯỜNG hộp thư (thoát êm),
 *      trả toàn quyền cho lượt đăng nhập cho tới khi xong.
 *
 *  NGUYÊN TẮC VỀ MÃ OTP:
 *    · Mã CHỈ được nhận khi CÓ YÊU CẦU đang treo (do chính máy trạm phát ra) và còn hạn.
 *      Người lạ (hay chính chủ) nhắn 6 số lúc không có yêu cầu ⇒ vứt, không lưu.
 *    · Không bao giờ ghi mã ra log/ảnh chụp. Nhận xong xoá luôn tin nhắn chứa mã.
 *    · Mã dùng một lần, nonce một lần; hết hạn thì lượt đăng nhập tự thất bại chứ không
 *      chờ vô hạn (IdP có cầu dao chống khoá tài khoản — xem login-hasaki.js).
 *    · Bot KHÔNG BAO GIỜ tự phát yêu cầu OTP: yêu cầu chỉ sinh ra từ một lượt đăng nhập
 *      đã qua đủ cửa kiểm (cầu dao + luật phiên). Chat chỉ là đường chuyển 6 số.
 * ============================================================================
 */
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";
import { moTaLoiMang } from "./session-rules.js";

export const TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
export const CHO_PHEP = String(process.env.TELEGRAM_CHAT_ID || "").split(",").map((s) => s.trim()).filter(Boolean);
const IN_RA = String(process.env.TIN_NHAN_IN_RA || "") === "1";   // thử không cần chat thật
const TEN_STATE = ".tin-nhan-state.json";
const TEN_CHO = ".otp-cho.json";
const NGHI_LAI_PHUT = Number(process.env.LOGIN_OTP_NGHI_LAI_PHUT || 30);
/** "5 phút" / "45 giây" — cho câu thông báo đọc xuôi ở mọi độ dài chờ. */
const noThoiGian = (giay) => (giay >= 60 ? Math.round(giay / 60) + " phút" : Math.round(giay) + " giây");

const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

/* ───────── hộp thư ───────── */

export async function tg(method, body, giay = 60) {
  const ac = new AbortController();
  const hen = setTimeout(() => ac.abort(), giay * 1000);
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
      signal: ac.signal,
    });
    const j = await r.json().catch(() => null);
    if (!j || !j.ok) return { ok: false, moTa: (j && j.description) || "HTTP " + r.status };
    return { ok: true, kq: j.result };
  } catch (e) {
    return { ok: false, moTa: e.name === "AbortError" ? "quá hạn chờ" : moTaLoiMang(e) };
  } finally { clearTimeout(hen); }
}

/** Telegram chặn tin > 4096 ký tự — cắt khúc, nút chỉ gắn vào khúc cuối. */
export function catKhuc(s, max = 3500) {
  const ra = [];
  let con = String(s);
  while (con.length > max) {
    let cat = con.lastIndexOf("\n", max);
    if (cat < max * 0.5) cat = max;
    ra.push(con.slice(0, cat));
    con = con.slice(cat);
  }
  ra.push(con);
  return ra.filter((x) => x.trim().length);
}

export async function guiTin(chatId, text, banPhim) {
  if (IN_RA) {
    console.log(`\n──── [gửi → chat ${chatId}] ────\n${text}`
      + (banPhim ? `\n[nút] ${banPhim.inline_keyboard[0].map((b) => b.text).join(" | ")}` : "") + "\n");
    return;
  }
  const doan = catKhuc(text);
  for (let i = 0; i < doan.length; i++) {
    const cuoi = i === doan.length - 1;
    const kq = await tg("sendMessage", {
      chat_id: chatId, text: doan[i], disable_web_page_preview: true,
      ...(cuoi && banPhim ? { reply_markup: banPhim } : {}),
    });
    if (!kq.ok) console.log("⚠ gửi tin lỗi: " + kq.moTa);
  }
}

/** Xoá một tin trong chat riêng (Bot API cho phép xoá tin đến trong chat riêng). Best-effort. */
export async function xoaTin(chatId, messageId) {
  if (IN_RA) return;
  await tg("deleteMessage", { chat_id: chatId, message_id: messageId }).catch(() => null);
}

/* ───────── sổ chung: offset + cooldown + nonce ───────── */

export function docState(DIR) { try { return JSON.parse(fs.readFileSync(path.join(DIR, TEN_STATE), "utf8")); } catch { return {}; } }
export function luuState(DIR, st) { try { fs.writeFileSync(path.join(DIR, TEN_STATE), JSON.stringify(st)); } catch { /* best-effort */ } }

/* ───────── yêu cầu OTP đang treo ───────── */

const fCho = (DIR) => path.join(DIR, TEN_CHO);
function ghiCho(DIR, o) { try { fs.writeFileSync(fCho(DIR), JSON.stringify(o)); } catch { /* best-effort */ } }
function xoaCho(DIR) { try { fs.unlinkSync(fCho(DIR)); } catch { /* đã xoá */ } }

/** Có lượt xin OTP đang treo không? Bot gọi hàm này để NHƯỜNG hộp thư. */
export function dangChoOtp(DIR) {
  try {
    const j = JSON.parse(fs.readFileSync(fCho(DIR), "utf8"));
    if (Date.now() > Number(j.hetHan || 0)) { xoaCho(DIR); return null; }
    return j;
  } catch { return null; }
}

/**
 * Nhắn xin OTP rồi CHỜ 6 số nhắn về.
 * Trả { ma, ly }: ly = "ok" | "chua-bat" | "huy" | "het-gio".
 * Trong lúc chờ, HÀM NÀY giữ hộp thư (bot đã nhường) — lệnh khác gõ vào sẽ được trả lời
 * "đang bận đăng nhập" chứ không im lặng nuốt mất.
 */
export async function hoiOtpQuaChat(DIR, { nhan = "", choGiay = 300, log = () => {} } = {}) {
  if (!TOKEN || !CHO_PHEP.length) {
    log("… kênh tin nhắn chưa bật (thiếu TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID) — không xin OTP được.");
    return { ma: null, ly: "chua-bat" };
  }
  /* CHỐNG DỘI: lượt xin trước vừa hết giờ (chủ máy đang ngủ/đang họp) mà watchdog cứ gọi lại mỗi
     giờ thì chat thành cái chuông báo thức. Im NGHI_LAI_PHUT rồi hãy xin tiếp. */
  {
    const st0 = docState(DIR);
    const cach = Date.now() - Number(st0.otpXinHong || 0);
    if (st0.otpXinHong && cach < NGHI_LAI_PHUT * 60000) {
      log(`… vừa xin OTP ${Math.round(cach / 60000)}' trước mà không có mã — im tới đủ ${NGHI_LAI_PHUT}' rồi mới xin lại.`);
      return { ma: null, ly: "vua-xin" };
    }
  }
  const nonce = String(Date.now() % 1e9);
  const hetHan = Date.now() + choGiay * 1000;
  ghiCho(DIR, { nonce, luc: Date.now(), hetHan, nhan, pid: process.pid });

  const chat = CHO_PHEP[0];
  await guiTin(chat, [
    "🔐 CẦN MÃ OTP ĐỂ ĐĂNG NHẬP SSO",
    nhan ? "Lý do: " + nhan : "",
    "Máy trạm đang mở trang Hasaki ID, email + mật khẩu đã điền sẵn, chỉ thiếu 6 số.",
    "",
    "➜ Mở app Hasaki Authenticator rồi nhắn 6 số về đây — nhắn NGAY KHI MÃ VỪA ĐỔI",
    "   (mã chỉ sống 30 giây, gửi lúc sắp hết là hỏng lượt).",
    "   Gõ:  123456   hoặc  /otp 123456",
    "",
    `Hết hạn sau ${noThoiGian(choGiay)}. Đổi ý: /huy`,
    "⚠️ KHÔNG PHẢI BẠN vừa yêu cầu đăng nhập? Nhắn /huy và đổi mật khẩu Hasaki ID ngay.",
  ].filter(Boolean).join("\n"));
  log("🔐 Đã nhắn xin OTP qua Telegram — chờ tối đa " + noThoiGian(choGiay) + ".");

  const st = docState(DIR);
  try {
    while (Date.now() < hetHan) {
      const con = Math.max(3, Math.min(20, Math.round((hetHan - Date.now()) / 1000)));
      const kq = await tg("getUpdates", { offset: st.offset || 0, timeout: con, allowed_updates: ["message"] }, con + 20);
      if (!kq.ok) { log("  … hộp thư chưa trả lời (" + kq.moTa + ")"); await nghi(2000); continue; }
      for (const u of kq.kq) {
        st.offset = u.update_id + 1; luuState(DIR, st);
        const m = u.message;
        if (!m || !m.text || !m.chat) continue;
        const id = String(m.chat.id);
        if (!CHO_PHEP.includes(id)) continue;                       // người lạ: im lặng tuyệt đối
        const t = String(m.text).trim();
        if (/^\/?huy\b/i.test(t)) {
          await guiTin(id, "Đã huỷ lượt đăng nhập. Không có mã nào được dùng.");
          return { ma: null, ly: "huy" };
        }
        const khop = t.match(/^\/?otp[\s:]*(\d{6})$/i) || t.match(/^(\d{6})$/);
        if (khop) {
          await xoaTin(id, m.message_id);                           // đừng để 6 số nằm lại trong chat
          await guiTin(id, "✓ Nhận mã (đã xoá tin cho sạch) — đang nộp lên SSO…");
          st.otpXinHong = 0;                                        // có người trả lời → gỡ chống dội
          return { ma: khop[1], ly: "ok" };
        }
        await guiTin(id, "⏳ Đang chờ MÃ OTP 6 số cho lượt đăng nhập. Lệnh khác gõ lại sau nhé — hoặc /huy.");
      }
    }
    await guiTin(chat, `⌛ Hết ${noThoiGian(choGiay)} chưa nhận được mã — bỏ lượt đăng nhập này (không nộp gì lên IdP).`);
    st.otpXinHong = Date.now();
    return { ma: null, ly: "het-gio" };
  } finally {
    xoaCho(DIR);          // trả hộp thư lại cho bot dù đi lối nào
    luuState(DIR, st);
  }
}
