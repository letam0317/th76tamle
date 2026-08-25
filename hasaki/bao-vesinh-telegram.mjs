/**
 * ============================================================================
 *  bao-vesinh-telegram.mjs — BÁO 17H QUA TELEGRAM: "ĐI LÀM MÀ CHƯA BÁO CÁO VỆ SINH"
 * ============================================================================
 *  YÊU CẦU (user chốt 24/08/2026): mỗi ngày ĐÚNG MỘT tin Telegram lúc 17h liệt kê các
 *  cá nhân CÓ CHẤM CÔNG hôm nay nhưng CHƯA có báo cáo vệ sinh nào, LOẠI TRỪ người đi
 *  ca trễ (Giờ vào từ 13:00 — 17h họ chưa xong ca, nhắc là oan).
 *
 *  CÁCH CHẠY — không thêm lịch, không thêm lượt gọi upstream:
 *  sync-vesinh-all.js (poller nhịp 15', cửa 07–18h) gọi baoChuaVeSinh(rowsCC) ngay sau
 *  khi tính xong bảng CHAMCONG-VESINH → lượt sync ĐẦU TIÊN từ 17:00 trở đi nhắn tin
 *  (thực tế 17:00–17:15; máy bật muộn thì tin đi muộn theo chứ không mất). Gửi LỖI thì
 *  KHÔNG ghi mốc → lượt 15' sau tự thử lại. Dữ liệu là rowsCC của CHÍNH lượt quét vừa
 *  xong (timesheet + planogram mới gọi trong lượt) nên không đọc lại Sheet, không thêm
 *  lượt gọi WMS/HR/GAS nào.
 *
 *  Thiếu TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID → thoát êm (kênh chưa bật), giống
 *  canh-suc-khoe. Hôm nay KHÔNG AI chấm công (ngày nghỉ) → không nhắn, chỉ ghi log.
 *
 *  Chỉnh trong .env:  VS_BAO_GIO=17:00   VS_BAO_CA_TRE=13:00
 *  Chạy thử:  node bao-vesinh-telegram.mjs         (chỉ in tin mẫu ra màn hình)
 *             node bao-vesinh-telegram.mjs --thu   (gửi 1 tin số liệu MẪU, không ghi mốc)
 * ============================================================================
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";   // chạy thẳng file (--thu) vẫn đọc được token trong .env

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE_MOC = path.join(DIR, ".bao-vesinh-17h.json");   // {ngay} — chốt "hôm nay đã nhắn rồi"
const GIO_BAO = process.env.VS_BAO_GIO || "17:00";
const GIO_CA_TRE = process.env.VS_BAO_CA_TRE || "13:00";

const gioVN = () => new Date().toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });
const ngayVN = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });   // YYYY-MM-DD
const ddmm = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
/* "HH:MM" → phút trong ngày. So bằng SỐ chứ không so chuỗi: locale có thể trả "7:32" thiếu số 0 đầu. */
const raPhut = (s) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(s || "")); return m ? +m[1] * 60 + +m[2] : null; };

/* Soạn nội dung tin từ rowsCC (bảng CHAMCONG-VESINH — cột: 0 Code | 1 Name | 2 Email | 3 Major |
 * 4 Giờ vào | 5 Giờ ra | 6 Đã vệ sinh hôm nay | 7 Vị trí gần nhất | 8 Trạng thái).
 * Trả { text, soNhac } — text = null khi hôm nay không ai chấm công (ngày nghỉ: đừng nhắn). */
export function soanTinChuaVS(rowsCC, gio, ngayIso) {
  const diLam = rowsCC.filter((r) => r[8] !== "Nghỉ / không chấm công");
  if (!diLam.length) return { text: null, soNhac: 0 };
  const chua = diLam.filter((r) => r[8] === "Đi làm - chưa vệ sinh");
  /* Ca trễ = Giờ vào ≥ 13:00. Giờ vào TRỐNG (chỉ có giờ ra — máy chấm sót) thì không chứng minh
     được là ca trễ → vẫn nhắc, ghi "vào ?". */
  const mocTre = raPhut(GIO_CA_TRE), nhac = [], caTre = [];
  for (const r of chua) {
    const p = raPhut(r[4]);
    (p != null && p >= mocTre ? caTre : nhac).push(r);
  }
  const ten = (r) => (r[1] || r[2] || r[0]) + (r[0] && r[1] ? " (" + r[0] + ")" : "");
  const duoi = "Đi làm " + diLam.length + " · đã báo cáo " + (diLam.length - chua.length) +
    (caTre.length ? " · loại " + caTre.length + " người ca trễ (vào từ " + GIO_CA_TRE + ")" : "") + ".";
  const text = nhac.length
    ? "⚠ Vệ sinh " + gio + " — " + ddmm(ngayIso) + ": " + nhac.length + " người ĐI LÀM nhưng CHƯA báo cáo:\n" +
      nhac.map((r) => "• " + ten(r) + " — vào " + (r[4] || "?")).join("\n") + "\n" + duoi
    : "✅ Vệ sinh " + gio + " — " + ddmm(ngayIso) + ": ai đi làm đều đã báo cáo. " + duoi;
  return { text, soNhac: nhac.length };
}

async function guiTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = String(process.env.TELEGRAM_CHAT_ID || "").split(",")[0];
  if (!token || !chat) return "chua-bat";
  const r = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error("Telegram HTTP " + r.status);
  return "ok";
}

/* Gọi từ sync-vesinh-all NGAY SAU khi có rowsCC. Tự gác hết: chưa tới giờ / hôm nay đã nhắn /
 * không ai đi làm / kênh chưa bật / --dry → thoát êm, không tốn gì. */
export async function baoChuaVeSinh(rowsCC, { log = console.log, dry = false } = {}) {
  const gio = gioVN(), ngay = ngayVN();
  if (raPhut(gio) < raPhut(GIO_BAO)) return;
  let moc = {};
  try { moc = JSON.parse(fs.readFileSync(FILE_MOC, "utf8")); } catch { /* chưa có mốc — lần đầu */ }
  if (moc.ngay === ngay) return;
  const { text, soNhac } = soanTinChuaVS(rowsCC, gio, ngay);
  if (!text) { log("  · Báo 17h: hôm nay không ai chấm công — không nhắn (ngày nghỉ?)."); return; }
  if (dry) { log("  · Báo 17h (--dry, KHÔNG gửi):\n" + text); return; }
  try {
    const kq = await guiTelegram(text);
    if (kq === "chua-bat") return;   // kênh Telegram chưa bật — đừng ồn log mỗi lượt 15'
    try { fs.writeFileSync(FILE_MOC, JSON.stringify({ ngay, luc: new Date().toISOString(), soNhac })); }
    catch (e) { log("  ⚠ Báo 17h: gửi rồi nhưng không ghi được mốc (" + e.message + ") — lượt sau có thể nhắn trùng."); }
    log("  ✓ Báo 17h Telegram: " + (soNhac ? soNhac + " người đi làm chưa báo cáo." : "ai đi làm đều đã báo cáo."));
  } catch (e) {
    log("  ⚠ Báo 17h Telegram lỗi (" + (e && e.message) + ") — chưa ghi mốc, lượt sync 15' sau thử lại.");
  }
}

/* ── Chạy thẳng file = xem/gửi tin CHẠY THỬ bằng số liệu mẫu (không đụng mốc ngày) ── */
if (process.argv[1] && /bao-vesinh-telegram\.mjs$/i.test(process.argv[1])) {
  const mau = [
    ["12345", "Nguyễn Văn Mẫu", "mau@x", "Đóng gói", "07:32", "", 0, "", "Đi làm - chưa vệ sinh"],
    ["12346", "Trần Thị Ca Trễ", "tre@x", "Đóng gói", "13:05", "", 0, "", "Đi làm - chưa vệ sinh"],
    ["12347", "Lê Thiếu Giờ Vào", "sot@x", "Đóng gói", "", "16:40", 0, "", "Đi làm - chưa vệ sinh"],
    ["12348", "Phạm Đã Báo Cáo", "bc@x", "Đóng gói", "07:10", "", 3, "F0-A1-01", "Đi làm - đã vệ sinh"],
    ["12349", "Hoàng Nghỉ", "ng@x", "Đóng gói", "", "", 0, "", "Nghỉ / không chấm công"],
  ];
  const { text } = soanTinChuaVS(mau, gioVN(), ngayVN());
  console.log("— Tin sẽ gửi (số liệu MẪU) —\n" + text + "\n—");
  if (process.argv.includes("--thu")) {
    guiTelegram("(CHẠY THỬ — số liệu MẪU, không phải dữ liệu thật)\n" + text)
      .then((kq) => console.log(kq === "ok" ? "✓ Đã gửi tin thử lên Telegram." : "· Kênh Telegram chưa bật (thiếu token/chat_id trong .env)."))
      .catch((e) => { console.error("✗ Gửi lỗi: " + e.message); process.exit(1); });
  }
}
