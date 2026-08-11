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
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CAC_BUOC_SYNC, docMocBuoc } from "./session-rules.js";
import { moSuCo, dongSuCo, nhipTim } from "./tu-chua.js";

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

/* Chỉ MỞ sự cố trong giờ người ta còn đọc mail. ĐÓNG thì lúc nào cũng được — tin vui
 * không cần chờ giờ hành chính, và đóng muộn sẽ khiến thư nhắc hôm sau gửi thừa. */
const gioVN = () => Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hour12: false }));
const trongGioBao = () => { const h = gioVN(); return h >= 7 && h < 19; };

const tuoiGio = (ms) => ms ? (Date.now() - ms) / 3600000 : Infinity;
const doiGio = (g) => g === Infinity ? "chưa từng chạy" : g < 24 ? Math.round(g) + " giờ" : Math.floor(g / 24) + " ngày " + Math.round(g % 24) + " giờ";

/* Bộ nhớ trạng thái lượt trước (.canh-suc-khoe.json). Guard gọi bộ này ~12 lượt/ngày; không có
 * bộ nhớ thì mỗi lượt bắn 7 lệnh "đóng sự cố" lên GAS dù chẳng có sự cố nào — tốn quota vô ích.
 * Chỉ gọi GAS khi trạng thái ĐỔI (hỏng→lành) hoặc khi đang hỏng (GAS tự chống spam thư). */
const F_TRANGTHAI = path.join(DIR, ".canh-suc-khoe.json");
let _tt = {};
try { _tt = JSON.parse(fs.readFileSync(F_TRANGTHAI, "utf8")); } catch { _tt = {}; }
const luuTrangThai = () => { try { fs.writeFileSync(F_TRANGTHAI, JSON.stringify(_tt)); } catch { /* best-effort */ } };
const vuaLanhLai = (khoa) => _tt[khoa] === "hong";

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
      if (!CHI_XEM && vuaLanhLai("DUNG-" + buoc)) { await dongSuCo("DUNG-" + buoc); log("    → đã chảy lại, gửi thư báo khắc phục."); }
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
    if (!CHI_XEM && vuaLanhLai("CAUDAO")) { await dongSuCo("CAUDAO"); log("    → cầu dao đã gỡ, gửi thư báo khắc phục."); }
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

(async () => {
  log("Soát sức khoẻ các bước đồng bộ" + (CHI_XEM ? " (chỉ xem)" : "") + "...");
  const hong = (await canhCacBuoc()) + (await canhCauDao());
  if (!CHI_XEM) { luuTrangThai(); await nhipTim("canh-suc-khoe"); }   // nhịp tim: GAS canh nhịp này để bắt ca máy trạm tắt
  log(hong ? "→ " + hong + " hạng mục cần người xử lý" + (CHI_XEM ? " (chế độ xem — CHƯA gửi thư)." : " — đã báo lên hộp thư.") : "→ Tất cả bình thường.");
  process.exitCode = 0;   // luôn 0: đây là bộ giám sát, không được làm hỏng mã thoát của bộ gọi
})();
