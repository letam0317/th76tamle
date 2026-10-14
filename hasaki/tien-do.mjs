// tien-do.mjs — BÁO TIẾN ĐỘ việc đang chạy lên tab Máy trạm (14/10 user «thêm trạng thái đang chạy việc gì, chạy ra sao,
//   của task nào vào từng máy pc trạm»). Máy nào chạy cũng báo được (PC hay laptop dự phòng) — gửi thẳng GAS pcPhu, KHÔNG
//   phụ thuộc nhịp tim (nhịp tim laptop gửi từ bản cài C:/AuditFactory, không thấy cò gốc).
//   import { batDau, tienDo, xong } from "./tien-do.mjs";
//   batDau("canh-xac-minh-b1", "Đọc phiếu B1 đang mở");
//   tienDo({ buoc: "Soát phiếu", task: p.id, i: 23, n: 83, chiTiet: "TB-03 → B1.1" });   // tự giãn ≥15 s/lần
//   await xong();
// Chỉ HIỂN THỊ: lỗi mạng thì thôi, không bao giờ làm hỏng cò. Diễn tập / --qc / TIEN_DO=0 → không gửi.
// Còn sống: nhắc lại mỗi 60 s (timer unref) — cò chết giữa chừng thì GAS coi tiến độ quá 5' là đã dừng.
import os from "node:os";

const TAT = process.env.TIEN_DO === "0" || process.argv.includes("--qc");
let VIEC = "", cuoi = 0, dangGui = null, moi = null, nhac = null;

async function gui(goi) {
  if (TAT || !VIEC) return;
  try {
    const { gasPost } = await import("./session-rules.js");
    await Promise.race([gasPost({ action: "pcPhu", key: process.env.APPSCRIPT_KEY, may: os.hostname(), viec: VIEC, ...goi }, () => {}, "pcPhu tiến độ"),
      new Promise((r) => setTimeout(r, 10000).unref())]);
  } catch { /* chỉ hiển thị */ }
}

export function batDau(viec, buoc = "Bắt đầu") {
  VIEC = viec; moi = { buoc }; cuoi = Date.now();
  dangGui = gui({ tienDo: moi });
  nhac = setInterval(() => { if (moi) dangGui = gui({ tienDo: moi }); }, 60000); nhac.unref();
}

export function tienDo(td = {}) {
  if (!VIEC) return;
  moi = { ...moi, ...td };
  if (Date.now() - cuoi < 15000) return;
  cuoi = Date.now(); dangGui = gui({ tienDo: moi });
}

export async function xong() {
  if (!VIEC) return;
  clearInterval(nhac); moi = null;
  try { await dangGui; } catch { /* */ }
  await gui({ xong: true });
}
