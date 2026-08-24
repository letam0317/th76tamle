/**
 * canh-suc-khoe.js — ĐỒNG HỒ CHẾT phía máy trạm (12/08/2026).
 *
 *  Trả lời đúng một câu hỏi mà 16 ngày qua không ai trả lời được:
 *  "bước nào đã ngừng chạy, và ngừng bao lâu rồi?"
 *
 *  Vì sao cần, dù Task Scheduler đã báo Result 0 mỗi ngày: mã thoát bị .bat/.vbs nuốt,
 *  nên Result 0 KHÔNG chứng minh bước chạy thành công — bước chấm công trượt suốt
 *  27/07→11/08 mà Task Scheduler vẫn xanh. Chỉ có MỐC GHI THÀNH CÔNG mới nói thật.
 *
 *  Chạy từ 2 nơi:
 *   - sync-guard.js (mỗi giờ 7h-18h) — gọi ở cuối mỗi tick, tốn ~1 giây.
 *   - Chạy tay: node canh-suc-khoe.js [--xem]     (--xem = chỉ in, không báo sự cố)
 *
 *  Chia làm 2 danh sách CỐ Ý:
 *   • CAC_BUOC_SYNC  — guard tự chạy lại được (AUTO-EXPORT.bat gọi đủ 5 bước này).
 *   • BUOC_NGOAI_CUM — guard KHÔNG chạy lại được vì .bat không gọi tới (chấm công).
 *     Đây chính là loại bước từng chết trong im lặng, nên phải canh riêng.
 *     TUYỆT ĐỐI không nhét "chamcong" vào CAC_BUOC_SYNC: guard sẽ coi cả cụm là cũ
 *     rồi spawn AUTO-EXPORT.bat mỗi 20' trong vô vọng — bat đó không chạy pull-timesheet.
 *
 *  BỔ SUNG 11/08/2026 — HAI CẢM BIẾN TRONG NGÀY (sự cố bridge bị Edge tắt):
 *   Ngưỡng 26 giờ ở trên cố ý thô: nó chỉ bắt ca "chết cả ngày". Ca 11/08 lại là ca khác —
 *   token WMS bị thu hồi lúc 13:03, cầu nối (extension) thì Edge đã tắt nên không ai vá được,
 *   dữ liệu đứng 5 tiếng mà mọi hạng mục vẫn "ok" vì chưa tới 26 giờ. Thêm 2 cảm biến nhịp giờ:
 *    • CẦU NỐI  — đọc thẳng profile Edge (trang-thai-bridge.js): extension bị tắt/chưa cài là
 *      báo NGAY, dù dữ liệu còn tươi. Đây là bom hẹn giờ: còn token cũ thì chưa thấy gì, token
 *      hết hạn mới vỡ, và lúc vỡ thì không có đường tự lành nào.
 *    • TRỄ TRONG NGÀY — mốc bước nhịp nhanh nhất (vệ sinh, nhịp poller 15') cũ quá 90' trong giờ
 *      làm = dashboard đang hiện số cũ. Kèm chẩn đoán nguyên nhân vào thư để không phải mò.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CAC_BUOC_SYNC, docMocBuoc, imLangBridgeMs, trangThaiPhien } from "./session-rules.js";
import { moSuCo, dongSuCo, nhipTim, guiThuDangBat } from "./tu-chua.js";
import { docTrangThaiExt } from "./trang-thai-bridge.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CHI_XEM = process.argv.includes("--xem");
const log = (...a) => console.log(new Date().toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }), ...a);

const BUOC_NGOAI_CUM = ["chamcong"];
const TEN = {
  stocklocation: "Tồn mã vị trí",
  kiemke: "Kiểm kê",
  tonbatthuong: "Tồn kho bất thường",
  vesinh: "Vệ sinh planogram",
  "5s": "Báo cáo 5S",
  chamcong: "Chấm công · Danh bạ nhân sự"
};

/* 26 giờ: bước nào cũng phải xong ít nhất 1 lần/ngày. Hôm qua xong 09:00, hôm nay 11:00 mà
 * chưa xong = 26h → lúc đó cụm 8h40 đã chạy xong và guard đã vá vài lượt rồi vẫn không được.
 * Đặt ngắn hơn (vd 12h) sẽ báo động giả mỗi sáng khi máy bật muộn. */
const NGUONG_GIO = 26;

/* Ngưỡng TRONG NGÀY: bước nhịp nhanh nhất (vệ sinh — poller 15') cũ quá 90' trong giờ làm là
 * dashboard đang hiện số cũ. 90' = 6 lượt poller trượt liên tiếp → không còn là nhiễu; đặt ngắn
 * hơn (vd 30') sẽ báo động giả mỗi lần WMS chậm hoặc máy vừa boot. */
const NGUONG_TRE_PHUT = Number(process.env.CANH_TRE_PHUT || 90);
const BUOC_NHANH = "vesinh";

/* Chỉ MỞ sự cố trong giờ người ta còn đọc mail. ĐÓNG thì lúc nào cũng được — tin vui
 * không cần chờ giờ hành chính, và đóng muộn sẽ khiến thư nhắc hôm sau gửi thừa. */
const gioVN = () => Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hour12: false }));
/* 18h thay 19h (23/08/2026): sync-guard nay chỉ chạy cụm 07:00–18:00 T2–T7 — sau 18h dữ liệu
 * CỐ Ý để cũ, báo động lúc đó là báo động giả dạy người ta bỏ qua cảnh báo thật. */
const trongGioBao = () => { const h = gioVN(); return h >= 7 && h < 18; };
/* Chủ nhật kho không làm: không ai mở WMS thì không có phiên để mượn, mà đó là bình thường —
 * báo động ngày đó chỉ dạy người ta bỏ qua thư. Cảm biến trong ngày vì vậy nghỉ Chủ nhật. */
const laNgayLam = () => new Date().toLocaleDateString("en-US", { timeZone: "Asia/Ho_Chi_Minh", weekday: "short" }) !== "Sun";
const canhTrongNgay = () => trongGioBao() && laNgayLam();

const tuoiGio = (ms) => ms ? (Date.now() - ms) / 3600000 : Infinity;
const tuoiPhut = (ms) => ms ? (Date.now() - ms) / 60000 : Infinity;
const doiGio = (g) => g === Infinity ? "chưa từng chạy" : g < 24 ? Math.round(g) + " giờ" : Math.floor(g / 24) + " ngày " + Math.round(g % 24) + " giờ";

/* Bộ nhớ trạng thái lượt trước (.canh-suc-khoe.json). Guard gọi bộ này ~12 lượt/ngày; không có
 * bộ nhớ thì mỗi lượt bắn 7 lệnh "đóng sự cố" lên GAS dù chẳng có sự cố nào — tốn quota vô ích.
 * Chỉ gọi GAS khi trạng thái ĐỔI (hỏng→lành) hoặc khi đang hỏng (GAS tự chống spam thư). */
const F_TRANGTHAI = path.join(DIR, ".canh-suc-khoe.json");
let _tt = {};
try { _tt = JSON.parse(fs.readFileSync(F_TRANGTHAI, "utf8")); } catch { _tt = {}; }
const luuTrangThai = () => { try { fs.writeFileSync(F_TRANGTHAI, JSON.stringify(_tt)); } catch { /* best-effort */ } };
const vuaLanhLai = (khoa) => _tt[khoa] === "hong";
/* Đuôi câu cho các dòng "vừa lành lại": nói đúng có thư hay không (công tắc CANH_GUI_THU). */
const duoiKhacPhuc = () => guiThuDangBat() ? "gửi thư báo khắc phục." : "không gửi thư (CANH_GUI_THU=0).";

async function canhCacBuoc() {
  let hong = 0;
  for (const buoc of [...CAC_BUOC_SYNC, ...BUOC_NGOAI_CUM]) {
    const g = tuoiGio(docMocBuoc(DIR, buoc));
    const ten = TEN[buoc] || buoc;
    const ngoaiCum = BUOC_NGOAI_CUM.includes(buoc);
    if (g > NGUONG_GIO) {
      hong++;
      log("  ⛔ " + ten + ": " + (g === Infinity ? "CHƯA TỪNG ghi thành công" : "lần ghi thành công gần nhất cách đây " + doiGio(g)) + (ngoaiCum ? " (guard KHÔNG tự vá được bước này)" : ""));
      if (!CHI_XEM && trongGioBao()) {
        await moSuCo({
          ma: "DUNG-" + buoc,
          loai: "BUOC_DUNG",
          nguon: ten,
          soLieu: { treGio: Math.round(g === Infinity ? 999 : g) },
          chiTiet: ngoaiCum
            ? "Bước này nằm ngoài cụm tự vá — chỉ chạy theo lịch riêng, hỏng thì không ai chạy lại hộ."
            : "Watchdog đã thử chạy lại nhiều lượt nhưng vẫn chưa ghi được."
        });
      }
      if (!CHI_XEM) _tt["DUNG-" + buoc] = "hong";
    } else {
      log("  ✓ " + ten + ": " + doiGio(g) + " trước");
      if (!CHI_XEM && vuaLanhLai("DUNG-" + buoc)) { await dongSuCo("DUNG-" + buoc); log("    → đã chảy lại, " + duoiKhacPhuc()); }
      if (!CHI_XEM) _tt["DUNG-" + buoc] = "ok";
    }
  }
  return hong;
}

/* Cầu dao đăng nhập (.login-that-bai.json do login-hasaki.js đặt): IdP đã từ chối nhiều lượt.
 * Đây là ca BẮT BUỘC gọi người — mỗi lượt sai thêm là một bước tới KHOÁ TÀI KHOẢN, mà khoá
 * thì chính chủ cũng không đăng nhập được. Hệ cố tình không tự thử tiếp. */
async function canhCauDao() {
  let cd = null;
  try { cd = JSON.parse(fs.readFileSync(path.join(DIR, ".login-that-bai.json"), "utf8")); } catch { /* không có = tốt */ }
  if (!cd || !(cd.lan >= 3)) {
    if (!CHI_XEM && vuaLanhLai("CAUDAO")) { await dongSuCo("CAUDAO"); log("    → cầu dao đã gỡ, " + duoiKhacPhuc()); }
    if (!CHI_XEM) _tt.CAUDAO = "ok";
    if (cd) log("  ✓ Cầu dao đăng nhập: " + cd.lan + " lượt trượt — chưa tới ngưỡng gọi người.");
    else log("  ✓ Cầu dao đăng nhập: không bật.");
    return 0;
  }
  const ngay = Math.round(tuoiGio(Date.parse(cd.luc)) / 24);
  log("  ⛔ Cầu dao đăng nhập ĐANG NGẮT từ " + (cd.luc || "?") + " (" + cd.lan + " lượt trượt, " + ngay + " ngày)");
  if (!CHI_XEM && trongGioBao()) {
    await moSuCo({
      ma: "CAUDAO", loai: "DANG_NHAP_TAY", nguon: "Đăng nhập tự động",
      soLieu: { soLuot: cd.lan, treGio: ngay * 24 },
      chiTiet: String(cd.mota || "")
    });
  }
  if (!CHI_XEM) _tt.CAUDAO = "hong";
  return 1;
}

/* ══════════ CẢM BIẾN 1: CẦU NỐI PHIÊN (extension trong Edge) ══════════
 * Đọc thẳng profile Edge chứ không suy đoán từ hậu quả. Báo NGAY khi extension tắt/chưa cài, kể cả
 * lúc dữ liệu còn tươi: còn token cũ thì chưa ai thấy gì, nhưng token hết hạn là vỡ, và vỡ theo
 * kiểu KHÔNG THỂ TỰ LÀNH (bot không sinh được OTP, không có phiên nào để mượn). Báo sớm 1 ngày
 * ở đây rẻ hơn nhiều so với 5 tiếng dữ liệu đứng như chiều 11/08. */
async function canhCauNoi() {
  const ext = docTrangThaiExt();
  if (!ext.coEdge) { log("  – Cầu nối WMS: không đọc được profile Edge — bỏ qua cảm biến này."); return 0; }

  if (ext.on) {
    log("  ✓ Cầu nối WMS (extension): " + ext.vi);
    if (!CHI_XEM && vuaLanhLai("BRIDGE-TAT")) { await dongSuCo("BRIDGE-TAT"); log("    → cầu nối đã bật lại, " + duoiKhacPhuc()); }
    if (!CHI_XEM) _tt["BRIDGE-TAT"] = "ok";
    return 0;
  }

  const treGio = tuoiGio(docMocBuoc(DIR, BUOC_NHANH));
  const imPhut = Math.round(imLangBridgeMs(DIR) / 60000);
  log("  ⛔ Cầu nối WMS (extension): " + ext.vi + " · cầu nối im " + imPhut + "' · " + TEN[BUOC_NHANH] + " cũ " + doiGio(treGio));
  if (!CHI_XEM && canhTrongNgay()) {
    await moSuCo({
      ma: "BRIDGE-TAT", loai: "BRIDGE_TAT", nguon: "Cầu nối phiên WMS",
      soLieu: { trePhut: Math.round(tuoiPhut(docMocBuoc(DIR, BUOC_NHANH))), imPhut, treGio: Math.round(treGio === Infinity ? 999 : treGio) },
      chiTiet: ext.coCai
        ? "Extension đã cài (" + (ext.duongDan || ext.id) + ") nhưng đang bị tắt: " + (ext.lyDoTat || "không rõ lý do") + "."
        : "Chưa thấy extension trong profile Edge nào — có thể đã bị xoá khỏi danh sách."
    });
  }
  if (!CHI_XEM) _tt["BRIDGE-TAT"] = "hong";
  return 1;
}

/* ══════════ CẢM BIẾN 2: TRỄ TRONG NGÀY ══════════
 * Đo đúng cái người dùng nhìn thấy: "dashboard đang hiện số của mấy giờ?". Lấy bước nhịp nhanh
 * nhất (vệ sinh, poller 15') làm đại diện — bước nào chậm thì cũng do cùng một cái token.
 * Chẩn đoán luôn nguyên nhân để thư nói được VIỆC CẦN LÀM, không chỉ báo "có gì đó sai":
 *   cầu nối tắt → đã có sự cố riêng, không gửi thư thứ hai cho cùng một gốc.
 *   không phiên nào sống → thư có nút mở cửa sổ đăng nhập (việc 3 phút).
 *   có phiên mà vẫn trễ → lỗi kỹ thuật thật, cần người đọc log. */
async function canhTreTrongNgay() {
  const ten = TEN[BUOC_NHANH] || BUOC_NHANH;
  const treP = tuoiPhut(docMocBuoc(DIR, BUOC_NHANH));
  const MA_PHIEN = "KHONG-PHIEN", MA_TRE = "TRE-" + BUOC_NHANH;

  if (treP <= NGUONG_TRE_PHUT) {
    log("  ✓ " + ten + " (nhịp trong ngày): " + Math.round(treP) + "' trước");
    for (const ma of [MA_PHIEN, MA_TRE]) {
      if (!CHI_XEM && vuaLanhLai(ma)) { await dongSuCo(ma); log("    → đã chảy lại, " + duoiKhacPhuc()); }
      if (!CHI_XEM) _tt[ma] = "ok";
    }
    return 0;
  }

  const ext = docTrangThaiExt();
  const imPhut = Math.round(imLangBridgeMs(DIR) / 60000);
  let phien = null;
  try { phien = await trangThaiPhien(DIR); } catch { /* mất mạng: coi như không kết luận được */ }
  const khongPhien = !!phien && phien.ai === "khong";
  log("  ⛔ " + ten + ": mốc cũ " + Math.round(treP) + "' (ngưỡng " + NGUONG_TRE_PHUT + "') · cầu nối im " + imPhut + "' · phiên: " + (phien ? phien.vi : "không kiểm được"));

  // Cầu nối tắt là GỐC — canhCauNoi() đã gửi thư đúng việc cần làm, đừng gửi thư thứ hai.
  if (!ext.on) { log("    (gốc là cầu nối bị tắt — sự cố BRIDGE-TAT đã báo, không gửi thư trùng)"); return 1; }

  if (khongPhien) {
    if (!CHI_XEM && canhTrongNgay()) {
      await moSuCo({
        ma: MA_PHIEN, loai: "PHIEN_CHET", nguon: ten,
        soLieu: { trePhut: Math.round(treP), imPhut, treGio: treP / 60 },
        chiTiet: "Cầu nối vẫn bật nhưng không nghe được token nào — nghĩa là không còn tab WMS/work nào đang đăng nhập."
      });
    }
    if (!CHI_XEM) { _tt[MA_PHIEN] = "hong"; _tt[MA_TRE] = "ok"; }
    return 1;
  }

  if (!CHI_XEM && canhTrongNgay()) {
    await moSuCo({
      ma: MA_TRE, loai: "BUOC_DUNG", nguon: ten,
      soLieu: { treGio: treP / 60 },
      chiTiet: "Phiên vẫn sống (" + (phien ? phien.vi : "?") + ") mà bước vẫn không ghi được — xem vesinh.log / poller.log trên máy trạm."
    });
  }
  if (!CHI_XEM) { _tt[MA_TRE] = "hong"; _tt[MA_PHIEN] = "ok"; }
  return 1;
}

/* ══════════ KÊNH TELEGRAM (audit 23/08/2026) ══════════
 * Thư đã tắt (CANH_GUI_THU=0) nên "cầu dao ngắt chờ người" từng là chết CÂM vô thời hạn.
 * Kênh Telegram có sẵn (tin-nhan-bot.mjs) → mượn luôn: hỏng thì nhắn 1 tin, nhắc lại tối đa
 * mỗi 12h; lành thì nhắn tin xanh 1 lần. Thiếu TELEGRAM_BOT_TOKEN/CHAT_ID thì im lặng bỏ qua. */
async function baoTelegram(hong, tomTat) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = String(process.env.TELEGRAM_CHAT_ID || "").split(",")[0];
  if (!token || !chat) return;
  const gui = async (text) => {
    try {
      await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text }),
      });
    } catch { /* mất mạng thì thôi — tick sau thử lại */ }
  };
  if (hong > 0 && trongGioBao() && laNgayLam()) {
    if (Date.now() - Number(_tt.tgLuc || 0) < 12 * 3600 * 1000) return;   // nhắc lại tối đa mỗi 12h
    await gui("⛔ Máy trạm 5S: " + hong + " hạng mục cần người xử lý.\n" + tomTat + "\nXem chi tiết: node canh-suc-khoe.js --xem");
    _tt.tgLuc = Date.now(); _tt.tgDangHong = 1; luuTrangThai();
  } else if (hong === 0 && _tt.tgDangHong) {
    await gui("✅ Máy trạm 5S: mọi hạng mục đã bình thường trở lại.");
    _tt.tgLuc = 0; _tt.tgDangHong = 0; luuTrangThai();
  }
}

(async () => {
  log("Soát sức khoẻ các bước đồng bộ" + (CHI_XEM ? " (chỉ xem)" : "") + "...");
  const dsHong = [];
  const hongBuoc = await canhCacBuoc(); if (hongBuoc) dsHong.push(hongBuoc + " bước đồng bộ đứng");
  const hongCauDao = await canhCauDao(); if (hongCauDao) dsHong.push("cầu dao đăng nhập NGẮT (chờ người gỡ)");
  const hongCauNoi = await canhCauNoi(); if (hongCauNoi) dsHong.push("cầu nối extension tắt");
  const hongTre = await canhTreTrongNgay(); if (hongTre) dsHong.push("dữ liệu trễ trong ngày");
  const hong = hongBuoc + hongCauDao + hongCauNoi + hongTre;
  // nhịp tim MANG sức khoẻ (audit 23/08/2026): GAS thấy tim đập + n bước hỏng → tự cảnh báo được
  if (!CHI_XEM) { luuTrangThai(); await nhipTim("canh-suc-khoe", { soBuocHong: hong }); await baoTelegram(hong, dsHong.join(" · ")); }
  /* Log phải nói ĐÚNG cái đã xảy ra: từ 15/08/2026 có công tắc CANH_GUI_THU=0 (ngưng gửi mail
     cảnh báo) — lúc đó vẫn soát, vẫn in ⛔, nhưng không có thư nào rời máy. Ghi "đã báo lên hộp thư"
     trong trạng thái đó là nói dối người đọc log. */
  log(hong
    ? "→ " + hong + " hạng mục cần người xử lý"
      + (CHI_XEM ? " (chế độ xem — CHƯA gửi thư)."
        : guiThuDangBat() ? " — đã báo lên hộp thư."
          : " — CHỈ ghi log, KHÔNG gửi thư (CANH_GUI_THU=0).")
    : "→ Tất cả bình thường.");
  process.exitCode = 0;   // luôn 0: đây là bộ giám sát, không được làm hỏng mã thoát của bộ gọi
})();
