/**
 * ep-tuoi.mjs — ÉP LÀM TƯƠI THEO SỰ KIỆN ĐĂNG NHẬP (14/09/2026).
 * ============================================================================
 *  VẤN ĐỀ: nhịp poller là nhịp ĐỒNG HỒ (vệ sinh 15' · kiểm kê 30' · 5S 45'), không phải nhịp
 *  CON NGƯỜI. Người vừa đăng nhập WMS/work/planogram xong, mở dashboard ra vẫn có thể gặp số
 *  của 44 phút trước — dù ĐÚNG LÚC ĐÓ mới là lúc có token sống để kéo dữ liệu về.
 *
 *  CÁCH CHỮA: coi "vừa có phiên mới" là SỰ KIỆN, kéo lượt đồng bộ sắp tới về NGAY.
 *  Hai đường vào, cùng gọi hàm ở đây:
 *    • NHANH (~3-5 giây): extension wms-bridge v1.5.0 bắn 1 POST vào cò co-dang-nhap.mjs.
 *    • DỰ PHÒNG (≤2 phút): watch-login-request.js thấy jti token đổi ở tick canh 2'.
 *  Đường 2 chạy được cả khi chưa Reload extension → không có cửa "quên nạp bản mới thì mất tính năng".
 *
 *  RÀNG BUỘC TẢI UPSTREAM (BO-CHUAN §2) — đây là KÉO SỚM, KHÔNG PHẢI THÊM LƯỢT:
 *    1. Bước nào còn tươi hơn NGUONG (5') thì KHÔNG ép — lượt vừa chạy xong không chạy lại.
 *    2. Ép xong là mốc bước nhích lên ⇒ lượt theo đồng hồ kế tiếp tự lùi ra đúng bấy nhiêu.
 *    3. Mỗi khe token chỉ ép tối đa 1 lần / DEBOUNCE (10') — SPA mint token liên tục không tạo bão.
 *   Tổng cộng: đăng nhập 4-5 lần/ngày ⇒ số lượt/ngày gần như không đổi, chỉ ĐỔI GIỜ chạy.
 * ============================================================================
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { docMocBuoc } from "./session-rules.js";

const PHUT = 60 * 1000;
// Bước nào cũ hơn ngưỡng này mới đáng ép (dưới ngưỡng = vừa chạy xong, ép lại là phí lượt upstream).
const NGUONG = Number(process.env.EP_NGUONG_PHUT || 5) * PHUT;
// Mỗi khe token chỉ được ép 1 lần trong ngần này phút.
const DEBOUNCE = Number(process.env.EP_DEBOUNCE_PHUT || 10) * PHUT;
const MOC = ".ep-tuoi-moc.json";

/* Khe token nào mở cửa cho bước nào:
 *   wms  → cổng wms-gw/planogram: vệ sinh + kiểm kê (+ tồn kho theo slot, poller tự lo)
 *   wshr → cổng work/hr: bộ 5S
 * Người mở WMS mà không mở work thì ép đúng nhóm WMS, và ngược lại — không ép mù cả cụm. */
export const BUOC_THEO_KHE = { wms: ["vesinh", "kiemke"], wshr: ["5s"] };

const docMoc = (DIR) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, MOC), "utf8")); } catch { return {}; } };
const ghiMoc = (DIR, m) => { try { fs.writeFileSync(path.join(DIR, MOC), JSON.stringify(m)); } catch { /* best-effort */ } };

/**
 * Có nên ép không? Trả { ep, ly } — `ly` luôn nói được lý do để log đọc hiểu ngay.
 * KHÔNG chạm mạng, không chạm upstream: chỉ đọc mtime mấy file mốc cục bộ.
 */
export function nenEp(DIR, khe) {
  const buoc = BUOC_THEO_KHE[khe];
  if (!buoc) return { ep: false, ly: "khe token lạ (" + khe + ")" };
  const m = docMoc(DIR), bayGio = Date.now();
  const cach = bayGio - (m[khe] || 0);
  if (cach < DEBOUNCE) return { ep: false, ly: "vừa ép " + Math.round(cach / PHUT) + "' trước (cửa " + Math.round(DEBOUNCE / PHUT) + "')" };
  const cu = buoc.filter((b) => bayGio - docMocBuoc(DIR, b) >= NGUONG);
  if (!cu.length) return { ep: false, ly: "các bước " + buoc.join("/") + " đều tươi <" + Math.round(NGUONG / PHUT) + "' — khỏi ép" };
  const tuoi = cu.map((b) => b + " " + Math.round((bayGio - docMocBuoc(DIR, b)) / PHUT) + "'").join(", ");
  return { ep: true, ly: "bước cũ: " + tuoi, buoc: cu };
}

/**
 * Chạy lượt ép: spawn sync-poller.js ở CHẾ ĐỘ ÉP (EP_TUOI=1) — poller tự lo khoá đơn lượt,
 * né cụm đang chạy (FAIL-CLOSED) và luật token phiên sống, nên gọi thẳng ở đây là an toàn.
 * Chạm mốc debounce TRƯỚC khi spawn: lượt sau có nổ dồn cũng không xếp hàng chồng lên nhau.
 */
export function chayEp(DIR, khe, nguon, log = () => {}) {
  const m = docMoc(DIR); m[khe] = Date.now(); ghiMoc(DIR, m);
  log("⚡ ÉP TƯƠI (" + nguon + ", khe " + khe + ") → sync-poller EP_TUOI=1...");
  return new Promise((res) => {
    const c = spawn("cmd.exe", ["/c", "node sync-poller.js >> poller.log 2>&1"], {
      cwd: DIR, stdio: "ignore", windowsHide: true,
      env: { ...process.env, EP_TUOI: "1", EP_KHE: khe, EP_NGUON: nguon },
    });
    c.on("exit", (code) => res(code == null ? -1 : code));
    c.on("error", () => res(-1));
  });
}

/** Gộp 2 bước trên: kiểm rồi chạy. Trả { ep, ly, code }. */
export async function epNeuCan(DIR, khe, nguon, log = () => {}) {
  const q = nenEp(DIR, khe);
  if (!q.ep) { log("· bỏ qua ép tươi (" + nguon + ", khe " + khe + "): " + q.ly); return { ...q, code: null }; }
  log("· ép tươi vì " + q.ly);
  const code = await chayEp(DIR, khe, nguon, log);
  return { ...q, code };
}
