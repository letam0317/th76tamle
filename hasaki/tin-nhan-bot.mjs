/**
 * ============================================================================
 *  tin-nhan-bot.mjs — KÊNH RA LỆNH BẰNG TIN NHẮN (Telegram) CHO CẢ 2 DỰ ÁN
 * ============================================================================
 *  Nhắn cho bot từ điện thoại → máy trạm chạy đúng script của dự án → nhắn lại
 *  kết quả. Phủ cả `hasaki/` (5S · chấm công · vệ sinh · task hằng ngày) lẫn
 *  `factory/` (tồn vị trí · kiểm kê · tồn bất thường).
 *
 *  VÌ SAO TELEGRAM CHỨ KHÔNG ZALO (chốt 19/08/2026):
 *  Máy trạm nằm sau NAT công ty và nguyên tắc của dự án là KHÔNG nhờ IT (không xin IP tĩnh,
 *  không mở port, không service account). Telegram Bot API cho phép máy **tự hỏi ra ngoài**
 *  (`getUpdates` long-poll) — chỉ cần HTTPS đi ra, y như mọi lượt gọi WMS/GAS đang chạy.
 *  Zalo OA thì ngược lại: nó ĐẨY vào bằng webhook ⇒ bắt buộc có URL công khai ⇒ phải nhờ IT
 *  hoặc thuê tunnel. Đường Zalo vẫn để ngỏ (xem KENH-TIN-NHAN.md §8: cho OA trỏ webhook vào
 *  Apps Script Web App — vốn đã là URL công khai miễn phí của dự án — rồi máy long-poll GAS),
 *  nên phần "hộp thư" ở đây tách riêng khỏi phần thông dịch lệnh.
 *
 *  NHỊP CHẠY: KHÔNG phải dịch vụ thường trú. Task Scheduler gọi mỗi 2', mỗi lượt long-poll
 *  ~100 giây rồi thoát ⇒ phủ gần liên tục mà vẫn tự hồi sinh khi máy tắt/bật hoặc script chết —
 *  đúng mô hình đang nuôi sống cả hệ. Chạy lượt riêng chứ KHÔNG nhét vào watch-login-request
 *  (bài học 17/08: nhét tra-UID vào bộ canh làm lượt tra phải xếp hàng 181 giây).
 *
 *  BẤT BIẾN PHẢI GIỮ (đừng nới trong lúc thêm lệnh):
 *   1. KHÔNG tự đăng nhập. Script con vẫn tự tuân session-rules; hết phiên thì exit 75 và bot
 *      trả lời "mở work/WMS rồi bấm lại" — tuyệt đối không đá phiên người đang làm.
 *   2. Nộp báo cáo task hằng ngày vẫn phải CÓ NGƯỜI RA LỆNH. Ở nút desktop, "người" =
 *      bàn phím thật (chặn bằng TTY). Ở đây, "người" = chat đã nằm trong allowlist BẤM NÚT
 *      xác nhận trong tin nhắn — hai bước, có nonce, hết hạn 5'.
 *   3. Nhẹ tải upstream: mỗi lệnh ghi có cooldown riêng + né cụm đang chạy.
 *   4. Chat là bên thứ ba: chỉ trả SỐ LIỆU TỔNG HỢP + link dashboard, không đổ danh sách tên
 *      nhân viên / ảnh chứng từ vào tin nhắn.
 *
 *  Chạy:
 *    node tin-nhan-bot.mjs --ghepnoi   # cài đặt lần đầu: dò bot, bắt chat_id, ghi vào .env
 *    node tin-nhan-bot.mjs --thu       # gửi 1 tin thử tới các chat đã cho phép
 *    node tin-nhan-bot.mjs             # 1 lượt nghe (Task Scheduler gọi mỗi 2')
 *    node tin-nhan-bot.mjs --lenh /trangthai   # chạy thử 1 lệnh ngay trên máy, không cần chat
 *
 *  Chưa khai TELEGRAM_BOT_TOKEN thì thoát êm (exit 0) — lịch cứ chạy, kênh coi như chưa bật.
 * ============================================================================
 */
import fs from "node:fs";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { docMocBuoc, trangThaiPhien, moTaLoiMang, gasPost } from "./session-rules.js";
/* Hộp thư (gửi/nhận Telegram + sổ offset) nằm ở hop-thu.mjs vì bộ ĐĂNG NHẬP cũng dùng chung:
   chỉ được MỘT bộ long-poll `getUpdates` cùng lúc, nên hai bên phải chung một sổ offset và một
   luật nhường lượt (xem dangChoOtp bên dưới). */
import { TOKEN, CHO_PHEP, tg, guiTin, docState as docStateChung, luuState as luuStateChung, dangChoOtp } from "./hop-thu.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const GOC = path.resolve(DIR, "..");                       // thư mục cha: chứa cả hasaki/ và factory/
const GIAY_CHAY = Number(process.env.TIN_NHAN_GIAY_CHAY || 100);        // ngân sách 1 lượt (lịch 2')
const LONG_POLL = Number(process.env.TIN_NHAN_LONG_POLL || 45);         // giây giữ kết nối mỗi lượt hỏi
const HAN_PHUT = Number(process.env.TIN_NHAN_HAN_PHUT || 15);           // lệnh cũ hơn ⇒ bỏ (xem §bẫy)
const CHAY_TOI_DA_PHUT = Number(process.env.TIN_NHAN_CHAY_TOI_DA_PHUT || 10);
const MAX_LENH_GIO = Number(process.env.TIN_NHAN_MAX_LENH_GIO || 20);
const XACNHAN_PHUT = 5;

const CO = { ghepnoi: false, thu: false, lenh: "", cb: "" };
for (let i = 0; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--ghepnoi") CO.ghepnoi = true;
  else if (a === "--thu") CO.thu = true;
  else if (a === "--cb") CO.cb = process.argv[i + 1] || "";        // thử nhánh bấm nút (gỡ lỗi)
  else if (a === "--lenh") CO.lenh = process.argv.slice(i + 1).join(" ");
}

const gio = () => new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" });
const log = (...a) => console.log(gio(), ...a);
const gioVN = (ms) => new Date(ms).toLocaleTimeString("vi-VN", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" });
const phutTu = (ms) => Math.round((Date.now() - ms) / 60000);
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

/* ═════════════════ 1-2) HỘP THƯ + SỔ TRẠNG THÁI — xem hop-thu.mjs ═════════════════ */

const docState = () => docStateChung(DIR);
const luuState = (st) => luuStateChung(DIR, st);

/* ═════════════════ 3) SỔ LỆNH — 2 DỰ ÁN ═════════════════
 * loai: "doc"  = chỉ đọc / tra cứu (không ghi Sheet, không đụng hệ thống công ty)
 *       "ghi"  = có ghi Sheet hoặc gọi upstream nặng → có cooldown + né cụm
 *       "nop"  = ghi lên hệ thống công ty (work.hasaki.vn) → BẮT BUỘC 2 bước xác nhận
 * cwd:  thư mục chạy — đây là chỗ phân biệt 2 dự án khi script nằm khác nơi. */
const SO_LENH = [
  // ── chung ────────────────────────────────────────────────────────────────
  { ten: "giupdo", biet: ["start", "help", "?"], duAn: "chung", loai: "doc", mo: "danh sách lệnh" },
  { ten: "trangthai", biet: ["tt", "status"], duAn: "chung", loai: "doc", mo: "tuổi dữ liệu + phiên + cụm đang chạy" },
  { ten: "log", biet: [], duAn: "chung", loai: "doc", mo: "20 dòng cuối 1 log · /log kiemke 30" },
  { ten: "dangnhap", biet: ["login", "sso"], duAn: "chung", loai: "dn", mo: "đăng nhập SSO — bot sẽ XIN BẠN mã OTP 6 số" },
  { ten: "choduyet", biet: ["duyet", "xinduyet"], duAn: "chung", loai: "doc", mo: "máy đang xin cấp quyền dashboard · duyệt bằng /duyet_<mã>" },

  // ── dự án 5S (dashboard kiemsoatkho) ─────────────────────────────────────
  { ten: "5s", biet: ["audit"], duAn: "5S", loai: "ghi", cool: 20, script: "auto-export-sync.js", env: { KHONG_LOGIN: "1" }, mo: "kéo lại task 5S (workflow 591)" },
  { ten: "chamcong", biet: ["nhansu"], duAn: "5S", loai: "ghi", cool: 30, script: "pull-timesheet.js", mo: "chấm công + danh bạ nhân sự" },
  { ten: "daybaocao", biet: [], duAn: "5S", loai: "ghi", cool: 10, script: "push-5s-to-workflow.js", mo: "đẩy inbox 5S → task workflow" },
  { ten: "task", biet: [], duAn: "5S", loai: "doc", script: "task-hangngay.mjs", mo: "xem 9 task hôm nay + bản nháp (KHÔNG nộp)" },
  { ten: "nop", biet: [], duAn: "5S", loai: "nop", script: "task-hangngay.mjs", mo: "nộp báo cáo task hằng ngày (hỏi trước)" },

  // ── dự án Factory (dashboard stocklocationfactory) ───────────────────────
  { ten: "dongbo", biet: ["sync"], duAn: "Factory", loai: "ghi", cool: 30, script: "sync-guard.js", args: ["--force"], mo: "cả cụm tồn kho (guard --force)" },
  { ten: "kiemke", biet: ["pc"], duAn: "Factory", loai: "ghi", cool: 20, script: "push-pc-to-sheet.mjs", env: { PC_DELTA: "1" }, mo: "physical-count hôm nay" },
  { ten: "tonkho", biet: ["stocklocation"], duAn: "Factory", loai: "ghi", cool: 30, script: "sync-stocklocation.js", mo: "tồn theo mã vị trí" },
  { ten: "batthuong", biet: [], duAn: "Factory", loai: "ghi", cool: 30, script: "sync-tonbatthuong.js", mo: "tồn bất thường" },
  { ten: "vesinh", biet: [], duAn: "Factory", loai: "ghi", cool: 15, script: "sync-vesinh-all.js", mo: "vệ sinh quầy kệ + phân công" },
  { ten: "uid", biet: [], duAn: "Factory", loai: "doc", script: "tra-uid-ton.mjs", mo: "tra UID → SKU/kho · /uid VN00303841533 …" },
];
const traLenh = (t) => SO_LENH.find((l) => l.ten === t || (l.biet || []).includes(t)) || null;

/* ═════════════════ 4) BỘ CHẠY ═════════════════ */

/** Cụm đồng bộ khác đang chạy? — nhận dạng y như sync-poller.js / task-hangngay.mjs. */
function cumDangChay() {
  return new Promise((res) => {
    execFile("powershell", ["-NoProfile", "-Command",
      "Get-CimInstance Win32_Process -Filter \"Name='node.exe' or Name='cmd.exe'\" | Select-Object -ExpandProperty CommandLine"],
      { windowsHide: true, timeout: 30000 },
      (err, out) => {
        if (err || !out) return res(false);
        const dau = /sync-stocklocation\.js|push-pc-to-sheet\.mjs|sync-tonbatthuong\.js|sync-vesinh-all\.js|sync-vesinh-ai\.mjs|auto-export-sync\.js|SYNC-STOCK\.bat|AUTO-EXPORT\.bat/i;
        res(out.split(/\r?\n/).some((l) => dau.test(l)));
      });
  });
}

/** Spawn node THẲNG (không qua cmd, không redirect): tránh đúng bẫy 19/08 — cụm đang giữ file log
 *  bằng `>>` của cmd thì tiến trình thứ hai mở không được, chết ngay exit 1 trong 0 giây. */
function chayScript(script, args = [], env = {}, cwd = DIR) {
  const t0 = Date.now();
  return new Promise((res) => {
    let ra = "";
    let treo = null;
    const c = spawn(process.execPath, [path.join(cwd, script), ...args],
      { cwd, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, env: { ...process.env, ...env } });
    const xong = (ma) => {
      clearTimeout(treo);
      res({ ma, ra, giay: Math.round((Date.now() - t0) / 1000) });
    };
    treo = setTimeout(() => { try { c.kill(); } catch { /* đã thoát */ } ra += "\n⏱ quá " + CHAY_TOI_DA_PHUT + "' — đã cắt."; }, CHAY_TOI_DA_PHUT * 60000);
    c.stdout.on("data", (d) => { ra += d; });
    c.stderr.on("data", (d) => { ra += d; });
    c.on("exit", (code) => xong(code == null ? -1 : code));
    c.on("error", (e) => { ra += "\nlỗi spawn: " + e.message; xong(-1); });
  });
}

/** Dịch mã thoát sang câu người đọc — 75 = hoãn theo luật phiên, KHÔNG phải lỗi. */
function dichMa(ma) {
  if (ma === 0) return "✓ xong";
  if (ma === 75) return "… HOÃN: chưa có phiên sống. Mở work.hasaki.vn / WMS một lượt rồi gõ lại (bot không tự đăng nhập).";
  if (ma === 2) return "✗ chưa đăng nhập work.hasaki.vn — mở trang rồi gõ lại.";
  if (ma === 4) return "✗ đứt liên lạc mạng giữa chừng — gõ lại.";
  return "⚠ lỗi (exit " + ma + ")";
}

/** Đuôi log: n dòng cuối có nội dung — chat chỉ cần biết kết quả, không cần cả bãi. */
function duoiRa(ra, n = 18) {
  const dong = String(ra).split(/\r?\n/).map((d) => d.replace(/\s+$/, "")).filter((d) => d.trim());
  return dong.slice(-n).join("\n");
}

/* ═════════════════ 5) CÁC LỆNH TỰ XỬ (không spawn) ═════════════════ */

const TEN_BUOC = { "5s": "5S (task)", kiemke: "Kiểm kê", stocklocation: "Tồn vị trí", tonbatthuong: "Tồn bất thường", vesinh: "Vệ sinh", chamcong: "Chấm công", "task-hangngay": "Nộp task" };

async function lenhTrangThai() {
  const dong = ["📊 TUỔI DỮ LIỆU TRONG MÁY"];
  for (const [buoc, ten] of Object.entries(TEN_BUOC)) {
    const m = docMocBuoc(DIR, buoc);
    dong.push(m ? `  ${ten.padEnd(16)} ${gioVN(m)}  (${phutTu(m)}')` : `  ${ten.padEnd(16)} — chưa có mốc`);
  }
  const tt = await trangThaiPhien(DIR, () => {}).catch(() => null);
  dong.push("", "🔑 PHIÊN: " + (tt ? `${tt.ai} — ${tt.vi}` : "không rõ (mất mạng/GAS)"));
  dong.push("⚙️ CỤM ĐỒNG BỘ: " + ((await cumDangChay()) ? "ĐANG CHẠY" : "rảnh"));
  return dong.join("\n");
}

function lenhLog(thamSo) {
  const ten = (thamSo[0] || "").replace(/[^a-z0-9.-]/gi, "");
  const n = Math.min(Number(thamSo[1]) || 20, 60);
  if (!ten) return "Dùng: /log <tên> [số dòng]. Ví dụ: /log kiemke 30\nCó: auto-export · kiemke · stocklocation · tonbatthuong · vesinh · sync-guard · poller · task-hangngay · tin-nhan";
  const f = path.join(DIR, ten.endsWith(".log") ? ten : ten + ".log");
  if (!fs.existsSync(f)) return "Không có log '" + ten + "'.";
  const txt = fs.readFileSync(f, "utf8");
  return `📄 ${path.basename(f)} — ${n} dòng cuối:\n` + duoiRa(txt, n);
}

function lenhGiupDo() {
  const nhom = { chung: "🔧 CHUNG", "5S": "🧹 DỰ ÁN 5S", Factory: "🏭 DỰ ÁN FACTORY" };
  const dong = ["🤖 KÊNH RA LỆNH — 2 DỰ ÁN", ""];
  for (const [k, tieuDe] of Object.entries(nhom)) {
    dong.push(tieuDe);
    for (const l of SO_LENH.filter((x) => x.duAn === k)) {
      const dau = l.loai === "nop" ? "‼️" : l.loai === "dn" ? "🔐" : l.loai === "ghi" ? "✍️" : "👁";
      dong.push(`  ${dau} /${l.ten}${l.cool ? ` (chờ ${l.cool}')` : ""} — ${l.mo}`);
    }
    dong.push("");
  }
  dong.push("👁 chỉ đọc · ✍️ có ghi Sheet · ‼️ ghi lên work.hasaki.vn (hỏi trước khi làm)");
  dong.push("Bot KHÔNG tự đăng nhập: hết phiên thì nó bảo bạn mở trang rồi gõ lại.");
  return dong.join("\n");
}

/* ═════════════════ 6) LỆNH /nop — 2 BƯỚC, GIỮ ĐÚNG BẤT BIẾN "CÓ NGƯỜI BẤM" ═════════════════ */

async function lenhNopBuoc1(chatId, st) {
  await guiTin(chatId, "⏳ Đang soạn bản nháp 9 task hôm nay…");
  const kq = await chayScript("task-hangngay.mjs");
  if (kq.ma !== 0) return guiTin(chatId, dichMa(kq.ma) + "\n" + duoiRa(kq.ra, 12));
  const nonce = String(Date.now() % 1e9);
  st.cho = { nonce, luc: Date.now(), chatId: String(chatId) };
  luuState(st);
  await guiTin(chatId, "📝 BẢN NHÁP (chưa nộp gì):\n\n" + duoiRa(kq.ra, 45), {
    inline_keyboard: [[
      { text: "Nộp tất cả", callback_data: `nop:tatca:${nonce}` },
      { text: "Chỉ nhóm A", callback_data: `nop:A:${nonce}` },
      { text: "Thôi", callback_data: `nop:k:${nonce}` },
    ]],
  });
}

async function lenhNopBuoc2(cb, st) {
  const chatId = cb.message.chat.id;
  const [, chon, nonce] = String(cb.data || "").split(":");
  if (String(process.env.TIN_NHAN_IN_RA || "") !== "1") await tg("answerCallbackQuery", { callback_query_id: cb.id });
  const cho = st.cho;
  if (!cho || cho.nonce !== nonce || String(cho.chatId) !== String(chatId))
    return guiTin(chatId, "Nút này không còn hiệu lực — gõ /nop lại.");
  if (Date.now() - cho.luc > XACNHAN_PHUT * 60000)
    return guiTin(chatId, `Quá ${XACNHAN_PHUT}' rồi (số liệu có thể đã đổi) — gõ /nop lại.`);
  st.cho = null; luuState(st);                      // dùng 1 lần: bấm lại nút cũ không nộp lần hai
  if (chon === "k") return guiTin(chatId, "OK, không nộp gì. Bạn tự bấm Hoàn thành trên work.hasaki.vn.");

  await guiTin(chatId, "⏳ Đang nộp…");
  const args = ["--nop", "--ep", ...(chon === "A" ? ["--nhom=A"] : [])];
  const kq = await chayScript("task-hangngay.mjs", args);
  log(`/nop (${chon}) từ chat ${chatId} → exit ${kq.ma} sau ${kq.giay}s`);
  await guiTin(chatId, `${dichMa(kq.ma)} · ${kq.giay}s\n\n` + duoiRa(kq.ra, 25));
}

/* ═════════════════ 6b) LỆNH /dangnhap — bot tự gõ OTP bạn nhắn về ═════════════════
 * Chuỗi: kiểm luật phiên → chạy `login-hasaki.js --auto --otp-chat` → tới bước OTP, CHÍNH tiến
 * trình login nhắn xin 6 số và giữ hộp thư (bot lúc đó đang đứng chờ trong `await`, không
 * long-poll) → nhận mã, gõ vào SSO, nộp 1 lần duy nhất.
 * Giữ nguyên mọi cửa kiểm cũ của login-hasaki: cầu dao chống khoá tài khoản, khoá chống chạy
 * chồng, và luật phiên (--auto). Cái duy nhất thay đổi là NGUỒN của 6 số. */
async function lenhDangNhap(chatId) {
  const tt = await trangThaiPhien(DIR, () => {}).catch(() => null);
  if (tt && (tt.ai === "nguoi" || tt.ai === "bot")) {
    return guiTin(chatId, `Không cần đăng nhập: ${tt.vi}.\nĐang có vé sống rồi — cứ gõ lệnh bình thường.`);
  }
  await guiTin(chatId, "🔐 Đang mở trang đăng nhập Hasaki ID trên máy trạm… lát nữa tôi sẽ xin bạn mã OTP.");
  const kq = await chayScript("login-hasaki.js", ["--auto", "--otp-chat"]);
  log(`/dangnhap từ chat ${chatId} → exit ${kq.ma} sau ${kq.giay}s`);
  const noi = kq.ma === 0 ? "✓ ĐĂNG NHẬP XONG — vé mới đã vào kho token, mọi bộ dùng chung."
    : kq.ma === 75 ? "… Hoãn: luật phiên chưa cho đăng nhập lúc này (có phiên sống / trong cửa đệm)."
      : kq.ma === 4 ? "⛔ Cầu dao đang ngắt (lượt trước bị IdP từ chối). Kiểm mật khẩu rồi xoá .login-that-bai.json."
        : `⚠ Chưa xong (exit ${kq.ma}).`;
  return guiTin(chatId, `${noi} · ${kq.giay}s\n\n` + duoiRa(kq.ra, 20));
}

/* ═════════════════ 7) THÔNG DỊCH 1 TIN NHẮN ═════════════════ */

/* ═════════════════ DUYỆT TRUY CẬP DASHBOARD (23/08/2026) ═════════════════
 * GAS (action tb_xin) bắn tin "máy lạ xin cấp quyền" kèm lệnh bấm được /duyet_<mã> · /tuchoi_<mã>.
 * Bot gọi lại GAS tb_duyet bằng SECRET (APPSCRIPT_KEY) — duyệt/THU HỒI theo TỪNG MÁY; /tuchoi_<mã>
 * với máy ĐÃ duyệt chính là đường thu hồi, không phải xoay DEVICE_KEY chung. */
async function lenhDuyetTb(chatId, dongY, tb) {
  if (!process.env.APPSCRIPT_KEY) return guiTin(chatId, "Thiếu APPSCRIPT_KEY trong .env — không gọi được GAS.");
  try {
    const j = await gasPost({ action: "tb_duyet", key: process.env.APPSCRIPT_KEY, tb, ok: dongY ? "1" : "0" }, log, "tb_duyet");
    if (!j || j.status !== "success") return guiTin(chatId, `✗ GAS từ chối: ${(j && j.message) || "?"}`);
    return guiTin(chatId, dongY
      ? `✓ ĐÃ DUYỆT máy ${tb}${j.ten ? ` (${j.ten})` : ""} — trang bên đó tự mở khoá trong ~30 giây. Tổng ${j.daDuyet} máy được duyệt.`
      : `✓ Đã TỪ CHỐI/THU HỒI máy ${tb}${j.ten ? ` (${j.ten})` : ""}.`);
  } catch (e) { return guiTin(chatId, `✗ Không gọi được GAS: ${moTaLoiMang(e)}`); }
}
async function lenhChoDuyet(chatId) {
  if (!process.env.APPSCRIPT_KEY) return guiTin(chatId, "Thiếu APPSCRIPT_KEY trong .env — không gọi được GAS.");
  try {
    const j = await gasPost({ action: "tb_cho", key: process.env.APPSCRIPT_KEY }, log, "tb_cho");
    if (!j || j.status !== "success") return guiTin(chatId, `✗ GAS từ chối: ${(j && j.message) || "?"}`);
    const ds = Object.entries(j.ds || {});
    if (!ds.length) return guiTin(chatId, `Không có máy nào đang chờ duyệt. Tổng ${j.daDuyet || 0} máy đã được duyệt.`);
    const dong = ds.map(([tb, t]) =>
      `· ${t.ten || "?"} — ${t.trang || "?"} — ${t.luc ? gioVN(Date.parse(t.luc)) : "?"}\n  /duyet_${tb} · /tuchoi_${tb}`);
    return guiTin(chatId, `${ds.length} máy đang chờ duyệt:\n\n${dong.join("\n\n")}`);
  } catch (e) { return guiTin(chatId, `✗ Không gọi được GAS: ${moTaLoiMang(e)}`); }
}

function quaHan(msg) { return Date.now() / 1000 - Number(msg.date || 0) > HAN_PHUT * 60; }

function chatDuoc(chatId) { return CHO_PHEP.includes(String(chatId)); }

function dinhMuc(st) {
  const gioMs = 3600000, nay = Date.now();
  st.nhip = (st.nhip || []).filter((t) => nay - t < gioMs);
  if (st.nhip.length >= MAX_LENH_GIO) return false;
  st.nhip.push(nay);
  return true;
}

async function xuLyTin(msg, st) {
  const chatId = msg.chat && msg.chat.id;
  const text = String(msg.text || "").trim();
  if (!chatId || !text) return;

  /* Chat lạ: IM LẶNG (chỉ ghi log). Trả lời tức là tự khai bot tồn tại + ai đang giữ máy. */
  if (!chatDuoc(chatId)) return log(`⛔ tin từ chat LẠ ${chatId} (${(msg.from && msg.from.username) || "?"}): ${text.slice(0, 60)}`);

  /* BẪY "lệnh ôi": máy tắt qua đêm, Telegram giữ tin tới 24h ⇒ sáng bật máy là bot nhận cả loạt
     lệnh gõ tối qua và chạy sạch. Quá HAN_PHUT thì bỏ, báo lại cho người gõ. */
  if (quaHan(msg)) {
    log(`⌛ bỏ lệnh quá hạn: ${text.slice(0, 40)}`);
    return guiTin(chatId, `⌛ Lệnh "${text.split(/\s+/)[0]}" gõ lúc ${gioVN(msg.date * 1000)} đã quá ${HAN_PHUT}' — bỏ qua cho an toàn. Gõ lại nếu vẫn cần.`);
  }
  if (!dinhMuc(st)) return guiTin(chatId, `Quá ${MAX_LENH_GIO} lệnh trong 1 giờ — nghỉ chút đã.`);

  /* 6 số lạc: người gõ OTP khi KHÔNG có lượt đăng nhập nào đang xin. Nói thẳng cho biết, và
     tuyệt đối KHÔNG cất lại để "dùng sau" — mã chỉ được nhận trong đúng cửa sổ do máy trạm mở
     (nếu không, một mã gõ nhầm nằm chờ sẵn là mời kẻ khác đăng nhập hộ). */
  if (/^\/?otp[\s:]*\d{6}$/i.test(text) || /^\d{6}$/.test(text)) {
    return guiTin(chatId, dangChoOtp(DIR)
      ? "⏳ Có lượt xin OTP đang chờ nhưng nó do tiến trình đăng nhập giữ — nhắn lại mã sau vài giây."
      : "Không có lượt đăng nhập nào đang xin OTP nên tôi bỏ qua mã này (mã chỉ nhận trong đúng lúc hỏi).\nMuốn đăng nhập: /dangnhap");
  }

  /* Lệnh duyệt mang MÃ MÁY trong tên (/duyet_mabc123) nên bắt bằng regex TRƯỚC sổ lệnh
     (sổ lệnh chỉ khớp tên cố định). Chat lạ đã bị chặn ở trên — chỉ chủ bot duyệt được. */
  const mDuyet = text.match(/^\/?(duyet|tuchoi)_([a-z0-9]{6,20})$/i);
  if (mDuyet) {
    log(`▶ /${mDuyet[1].toLowerCase()} máy ${mDuyet[2].toLowerCase()} — chat ${chatId}`);
    return lenhDuyetTb(chatId, mDuyet[1].toLowerCase() === "duyet", mDuyet[2].toLowerCase());
  }

  const phan = text.split(/\s+/);
  const ten = phan[0].replace(/^\//, "").replace(/@.*$/, "").toLowerCase();
  const thamSo = phan.slice(1);
  const l = traLenh(ten);
  if (!l) return guiTin(chatId, `Không hiểu "${phan[0]}". Gõ /giupdo để xem danh sách.`);
  log(`▶ /${l.ten} ${thamSo.join(" ")} — chat ${chatId}`);

  if (l.ten === "giupdo") return guiTin(chatId, lenhGiupDo());
  if (l.ten === "trangthai") return guiTin(chatId, await lenhTrangThai());
  if (l.ten === "log") return guiTin(chatId, lenhLog(thamSo));
  if (l.ten === "dangnhap") return lenhDangNhap(chatId);
  if (l.ten === "choduyet") return lenhChoDuyet(chatId);
  if (l.ten === "nop") return lenhNopBuoc1(chatId, st);

  if (l.ten === "uid") {
    /* Chặn tham số bậy ngay ở cửa. (Spawn không qua shell nên không có chuyện chèn lệnh, nhưng
       vẫn giới hạn 20 mã/lượt để 1 tin nhắn không kéo nổi một lượt quét WMS to.) */
    const ma = thamSo.filter((s) => /^[A-Za-z0-9._-]{3,24}$/.test(s)).slice(0, 20);
    if (!ma.length) return guiTin(chatId, "Dùng: /uid VN00303841533 [mã nữa…] (tối đa 20 mã/lượt)");
    await guiTin(chatId, `⏳ Tra ${ma.length} mã…`);
    const kq = await chayScript("tra-uid-ton.mjs", ma);
    return guiTin(chatId, `${dichMa(kq.ma)} · ${kq.giay}s\n\n` + duoiRa(kq.ra, 30));
  }

  // Lệnh còn lại = chạy script. "ghi" thì kiểm cooldown + né cụm.
  if (l.loai === "ghi") {
    st.cool = st.cool || {};
    const conCho = (st.cool[l.ten] || 0) + (l.cool || 0) * 60000 - Date.now();
    if (conCho > 0) return guiTin(chatId, `⏱ /${l.ten} vừa chạy lúc ${gioVN(st.cool[l.ten])}. Chờ thêm ${Math.ceil(conCho / 60000)}' (giữ nhẹ tải cho WMS).`);
    if (await cumDangChay()) return guiTin(chatId, "⚙️ Cụm đồng bộ đang chạy sẵn rồi — để nó xong đã, vài phút nữa gõ lại.");
    st.cool[l.ten] = Date.now(); luuState(st);
  }
  await guiTin(chatId, `⏳ Đang chạy /${l.ten}…`);
  const kq = await chayScript(l.script, l.args || [], l.env || {}, l.cwd || DIR);
  log(`  /${l.ten} → exit ${kq.ma} sau ${kq.giay}s`);
  return guiTin(chatId, `${dichMa(kq.ma)} · /${l.ten} · ${kq.giay}s\n\n` + duoiRa(kq.ra));
}

/* ═════════════════ 8) GHÉP NỐI LẦN ĐẦU ═════════════════ */

const HUONG_DAN = `
Chưa có TELEGRAM_BOT_TOKEN. Làm 4 bước này (khoảng 2 phút, KHÔNG cần nhờ IT):

  1. Mở Telegram trên điện thoại → tìm  @BotFather  → bấm Start
  2. Gõ:  /newbot   → đặt tên hiển thị (vd: Kho Hasaki)  → đặt username phải kết thúc bằng
     "bot" (vd: kho_hasaki_tam_bot)
  3. BotFather trả về một dòng token dạng  1234567890:AAH...  → chép nó
  4. Dán vào file hasaki/.env :   TELEGRAM_BOT_TOKEN=1234567890:AAH...
     rồi chạy lại:  node tin-nhan-bot.mjs --ghepnoi

Bước cuối bot sẽ tự bắt chat_id của bạn và ghi vào .env — không phải tra tay.
`;

function ghiEnv(khoa, giaTri) {
  const f = path.join(DIR, ".env");
  let txt = "";
  try { txt = fs.readFileSync(f, "utf8"); } catch { /* chưa có .env thì tạo mới */ }
  const re = new RegExp("^" + khoa + "=.*$", "m");
  txt = re.test(txt) ? txt.replace(re, `${khoa}=${giaTri}`) : (txt.replace(/\s*$/, "") + `\n${khoa}=${giaTri}\n`);
  fs.writeFileSync(f, txt);
}

async function ghepNoi() {
  if (!TOKEN) { console.log(HUONG_DAN); process.exit(1); }
  const me = await tg("getMe", {});
  if (!me.ok) { log("✗ Token không dùng được: " + me.moTa); process.exit(1); }
  log(`✓ Bot: ${me.kq.first_name} (@${me.kq.username})`);
  await tg("deleteWebhook", {});   // getUpdates và webhook loại trừ nhau — dọn cho chắc
  if (CHO_PHEP.length) log("Đã có TELEGRAM_CHAT_ID=" + CHO_PHEP.join(",") + " (ghi đè nếu bạn nhắn tiếp).");
  console.log(`\n➜ Mở Telegram, tìm @${me.kq.username}, bấm Start rồi nhắn một chữ bất kỳ. Đang chờ 3 phút…\n`);
  const het = Date.now() + 180000;
  let offset = 0;
  while (Date.now() < het) {
    const kq = await tg("getUpdates", { offset, timeout: 30 }, 50);
    if (!kq.ok) { log("… " + kq.moTa); await nghi(3000); continue; }
    for (const u of kq.kq) {
      offset = u.update_id + 1;
      const m = u.message || u.edited_message;
      if (!m || !m.chat) continue;
      const id = String(m.chat.id);
      ghiEnv("TELEGRAM_CHAT_ID", id);
      const st = docState(); st.offset = offset; luuState(st);
      log(`✓ Bắt được chat_id = ${id} (${m.from && m.from.first_name}) — đã ghi vào .env`);
      await guiTin(id, "✅ Đã ghép nối. Gõ /giupdo để xem danh sách lệnh.");
      process.exit(0);
    }
  }
  log("✗ Hết 3 phút chưa thấy tin nhắn nào — chạy lại --ghepnoi.");
  process.exit(1);
}

/* ═════════════════ 9) LUỒNG CHÍNH ═════════════════ */

process.on("uncaughtException", (e) => { log("✗ Lỗi không bắt được: " + moTaLoiMang(e)); process.exit(1); });

if (!TOKEN && !CO.ghepnoi) process.exit(0);          // kênh chưa bật — thoát êm, lịch cứ chạy
if (CO.ghepnoi) await ghepNoi();

const st = docState();

if (CO.cb) {                                          // gỡ lỗi nhánh bấm nút: --cb "nop:k:<nonce>"
  if (!CHO_PHEP.length) { log("Chưa có TELEGRAM_CHAT_ID — chạy --ghepnoi trước."); process.exit(1); }
  await lenhNopBuoc2({ id: "thu", data: CO.cb, message: { chat: { id: CHO_PHEP[0] } } }, st);
  luuState(st);
  process.exit(0);
}

if (CO.lenh) {                                        // chạy thử ngay trên máy, không cần Telegram
  const gia = { chat: { id: CHO_PHEP[0] || "0" }, text: CO.lenh, date: Math.floor(Date.now() / 1000), from: { username: "may" } };
  if (!CHO_PHEP.length) { log("Chưa có TELEGRAM_CHAT_ID — chạy --ghepnoi trước."); process.exit(1); }
  await xuLyTin(gia, st);
  luuState(st);
  process.exit(0);
}

if (CO.thu) {
  if (!CHO_PHEP.length) { log("Chưa có TELEGRAM_CHAT_ID — chạy --ghepnoi trước."); process.exit(1); }
  for (const id of CHO_PHEP) await guiTin(id, "🔔 Bot còn sống — " + gio() + ". Gõ /giupdo để xem lệnh.");
  process.exit(0);
}

if (!CHO_PHEP.length) { log("Chưa có TELEGRAM_CHAT_ID (chạy --ghepnoi) — không nghe để tránh nghe nhầm người lạ."); process.exit(0); }

/* NHƯỜNG HỘP THƯ: một lượt đăng nhập đang xin OTP thì CHÍNH nó long-poll (hop-thu.mjs). Hai bộ
   cùng gọi getUpdates một token là Telegram cắt một bên bằng 409 Conflict — nên bot đứng ngoài
   cho tới khi lượt đó xong (tối đa 5', hoặc file .otp-cho.json hết hạn). */
{
  const cho = dangChoOtp(DIR);
  if (cho) { log("🔐 Có lượt xin OTP đang chờ (từ " + gioVN(cho.luc) + ") — nhường hộp thư, lượt sau nghe tiếp."); process.exit(0); }
}

const hetGio = Date.now() + GIAY_CHAY * 1000;
let daNghe = 0;
while (Date.now() < hetGio) {
  if (dangChoOtp(DIR)) { log("🔐 Lượt đăng nhập vừa xin OTP — nhường hộp thư."); break; }
  /* Đọc lại offset từ sổ: tiến trình đăng nhập vừa rồi có thể đã tiêu thụ update và đẩy offset.
     Không đồng bộ chỗ này thì bot nhận LẠI đúng tin chứa mã OTP và trả lời lung tung. */
  const stDia = docState();
  if ((stDia.offset || 0) > (st.offset || 0)) st.offset = stDia.offset;
  const con = Math.max(5, Math.min(LONG_POLL, Math.round((hetGio - Date.now()) / 1000)));
  const kq = await tg("getUpdates", { offset: st.offset || 0, timeout: con, allowed_updates: ["message", "callback_query"] }, con + 20);
  if (!kq.ok) { log("… hộp thư không trả lời (" + kq.moTa + ") — thôi, lượt sau."); break; }
  if (!kq.kq.length) continue;

  /* LƯU OFFSET TRƯỚC KHI CHẠY. Telegram giao LẠI update chưa được xác nhận: nếu chạy trước rồi
     mới lưu, một cú mất mạng giữa chừng là lệnh /nop chạy hai lần. Thà mất lệnh còn hơn nộp đôi. */
  st.offset = kq.kq[kq.kq.length - 1].update_id + 1;
  luuState(st);

  for (const u of kq.kq) {
    daNghe++;
    try {
      if (u.callback_query) await lenhNopBuoc2(u.callback_query, st);
      else if (u.message) await xuLyTin(u.message, st);
    } catch (e) { log("⚠ xử lý update lỗi: " + moTaLoiMang(e)); }
    luuState(st);
  }
}
if (daNghe) log(`Lượt nghe xong — ${daNghe} tin.`);
