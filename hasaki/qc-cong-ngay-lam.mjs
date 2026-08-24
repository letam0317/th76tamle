/**
 * qc-cong-ngay-lam.mjs — kiểm CỔNG GIỜ + CỔNG NGÀY LÀM của 2 bộ tự phát cụm nặng.
 *
 *  Cách làm: CẮT đúng biểu thức điều kiện từ `sync-guard.js` và `sync-poller.js` rồi chạy nó với
 *  `now` giả — test và bản chạy thật dùng CHUNG một bản mã, không có bản sao nào để lệch nhau
 *  (cùng lối với qc-in-tem.mjs). Không gọi mạng, không spawn cụm nào.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const doc = (f) => fs.readFileSync(path.join(DIR, f), "utf8");

/* ---- 1) Lấy điều kiện THẬT từ file ---- */
const src = { guard: doc("sync-guard.js"), poller: doc("sync-poller.js") };
const dkGuard = src.guard.match(/if \(!FORCE && \((ngaySom === 0 \|\| pSom < 7 \* 60 \|\| pSom >= 18 \* 60)\)\)/);
const dkPoller = src.poller.match(/if \((now\.getDay\(\) === 0 && process\.env\.POLLER_CHU_NHAT !== "1")\) return 0;/);
const WINDOW = (src.poller.match(/POLLER_WINDOW \|\| "([\d:]+-[\d:]+)"/) || [])[1];

let dat = 0, hong = 0;
const ok  = (t, gc="") => { console.log("  ✓ " + t + (gc ? "  — " + gc : "")); dat++; };
const loi = (t, gc="") => { console.log("  ✗ " + t + (gc ? "  — " + gc : "")); hong++; };
const ktra = (t, dung, gc) => (dung ? ok : loi)(t, gc);

console.log("A. Điều kiện có còn nằm trong file thật không (chống ai đó gỡ mất cổng)");
ktra("sync-guard.js: còn cổng 'CN hoặc <07:00 hoặc ≥18:00' và vẫn nhường --force", !!dkGuard, dkGuard ? dkGuard[1] : "KHÔNG TÌM THẤY");
ktra("sync-poller.js: còn cổng Chủ nhật + đường lùi POLLER_CHU_NHAT", !!dkPoller, dkPoller ? dkPoller[1] : "KHÔNG TÌM THẤY");
ktra("sync-poller.js: khung giờ vẫn là 08:45-18:00", WINDOW === "08:45-18:00", "WINDOW = " + WINDOW);

/* ---- 2) Chạy CHÍNH biểu thức đó với now giả ---- */
const guardChan = (iso, force = false) => {
  const now = new Date(iso);                                   // giờ VN (test chạy ở máy VN)
  const pSom = now.getHours() * 60 + now.getMinutes();
  const ngaySom = new Date(now.getTime() + 7 * 3600 * 1000).getUTCDay();
  return new Function("FORCE", "pSom", "ngaySom", "return !!(!FORCE && (" + dkGuard[1] + "))")(force, pSom, ngaySom);
};
const pollerChan = (iso, cn = "") => {
  const now = new Date(iso);
  const pNow = now.getHours() * 60 + now.getMinutes();
  const [wa, wb] = WINDOW.split("-").map((s) => { const m = s.match(/^(\d{1,2}):(\d{2})$/); return Number(m[1]) * 60 + Number(m[2]); });
  if (pNow < wa || pNow >= wb) return "ngoài giờ";
  const chan = new Function("now", "process", "return !!(" + dkPoller[1] + ")")(now, { env: { POLLER_CHU_NHAT: cn } });
  return chan ? "Chủ nhật" : false;
};

console.log("\nB. GUARD — các mốc giờ đã đo trong log 22-23/08 (phải CHẶN đúng cái đã nổ vô ích)");
[["2026-08-22T19:14:00", true,  "T7 19:14 — cụm nổ tối thứ 7 (log thật)"],
 ["2026-08-22T20:48:00", true,  "T7 20:48 (log thật)"],
 ["2026-08-22T22:20:00", true,  "T7 22:20 (log thật)"],
 ["2026-08-23T07:00:00", true,  "CN 07:00 — Chủ nhật (log thật)"],
 ["2026-08-23T14:24:00", true,  "CN 14:24 — CN giữa trưa vẫn phải chặn"],
 ["2026-08-24T09:18:00", false, "T2 09:18 — giờ làm, PHẢI cho chạy (log thật hôm nay)"],
 ["2026-08-24T07:00:00", false, "T2 07:00 — mép trong, cho chạy"],
 ["2026-08-24T06:59:00", true,  "T2 06:59 — mép ngoài, chặn"],
 ["2026-08-24T17:59:00", false, "T2 17:59 — mép trong, cho chạy"],
 ["2026-08-24T18:00:00", true,  "T2 18:00 — mép ngoài, chặn"],
 ["2026-08-22T13:58:00", false, "T7 13:58 — thứ 7 là NGÀY LÀM, không được chặn"],
].forEach(([iso, mong, ten]) => ktra(ten, guardChan(iso) === mong, "chặn=" + guardChan(iso)));
ktra("CN 07:00 nhưng người bấm --force → VẪN CHẠY (chủ đích của người)", guardChan("2026-08-23T07:00:00", true) === false, "chặn=" + guardChan("2026-08-23T07:00:00", true));

console.log("\nC. POLLER — cổng mới (trước đây CN vẫn tự phát vệ sinh 15'/AI 30'/5S 45' + 2 slot)");
[["2026-08-23T10:10:00", "Chủ nhật", "CN 10:10 — trong khung giờ nhưng là CN → chặn (log thật: 10:10 có quét)"],
 ["2026-08-23T14:21:00", "Chủ nhật", "CN 14:21 — chặn (log thật có quét)"],
 ["2026-08-24T09:06:00", false,      "T2 09:06 — cho chạy (log thật hôm nay)"],
 ["2026-08-22T15:30:00", false,      "T7 15:30 — thứ 7 vẫn cho chạy"],
 ["2026-08-24T08:44:00", "ngoài giờ","T2 08:44 — trước 08:45, cổng giờ cũ vẫn chặn"],
 ["2026-08-24T18:00:00", "ngoài giờ","T2 18:00 — hết khung"],
].forEach(([iso, mong, ten]) => ktra(ten, pollerChan(iso) === mong, "kết quả=" + pollerChan(iso)));
ktra("CN + POLLER_CHU_NHAT=1 → CHẠY (đợt kiểm kê cuối tuần vẫn bật được)", pollerChan("2026-08-23T10:10:00", "1") === false, "kết quả=" + pollerChan("2026-08-23T10:10:00", "1"));
ktra("Guard và poller KHÔNG chồng cổng: cùng nghỉ CN, cùng nghỉ sau 18:00", guardChan("2026-08-23T10:10:00") === true && pollerChan("2026-08-23T10:10:00") === "Chủ nhật");

console.log("\nKẾT QUẢ: " + dat + " đạt · " + hong + " hỏng");
process.exit(hong ? 1 : 0);
