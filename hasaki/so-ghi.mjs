// so-ghi.mjs — HÀM GHI SỔ JSON DÙNG CHUNG cho mọi cò · 20/10/2026
// Đánh giá 20/10: 240 chỗ `fs.writeFileSync(…, JSON.stringify(…))` rải ở 145 tệp — ghi đè cả tệp, mất giữa chừng là hỏng sổ, không ai biết ai ghi.
//   import { ghiJson, docJson } from "./so-ghi.mjs";
//   ghiJson(tep, obj[, { thut: 1, ai: "tên cò" }])   → ghi TẠM rồi đổi tên (không bao giờ để tệp dở), từ chối ghi undefined/hàm,
//                                                      ghi 1 dòng nhật ký .exports/.nhat-ky-ghi.jsonl {luc, tep, ai, co} (xoay 2 MB)
//   docJson(tep, macDinh)                            → đọc, hỏng/không có → macDinh (không ném)
// Mọi tệp mới PHẢI dùng hàm này; qc-ma-tinh đếm chỗ ghi thô trong *.mjs (răng cưa) để số đó chỉ giảm.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const NK = path.join(DIR, ".exports", ".nhat-ky-ghi.jsonl");
const AI_MAC = (() => { try { return path.basename(process.argv[1] || "").replace(/\.(mjs|js)$/, "") || "node"; } catch { return "node"; } })();

export function docJson(tep, macDinh) { try { return JSON.parse(fs.readFileSync(tep, "utf8")); } catch { return macDinh; } }

export function ghiJson(tep, obj, o = {}) {
  if (obj === undefined || typeof obj === "function") throw new Error("ghiJson: không ghi undefined/hàm vào " + tep);
  const chuoi = JSON.stringify(obj, null, o.thut === undefined ? 1 : o.thut);
  if (typeof chuoi !== "string") throw new Error("ghiJson: không chuyển được thành JSON: " + tep);
  fs.mkdirSync(path.dirname(tep), { recursive: true });
  const tam = tep + ".ghi-tam-" + process.pid;
  fs.writeFileSync(tam, chuoi);
  try { fs.renameSync(tam, tep); } catch (e) { try { fs.unlinkSync(tam); } catch { /* */ } throw e; }   // Windows: tệp đích đang bị khoá → ném, không để tệp tạm
  if (o.nhatKy !== false) {
    try {
      try { if (fs.statSync(NK).size > 2 * 1048576) fs.renameSync(NK, NK + ".cu"); } catch { /* chưa có */ }
      fs.appendFileSync(NK, JSON.stringify({ luc: new Date().toISOString(), tep: path.relative(DIR, tep).replace(/\\/g, "/"), ai: o.ai || AI_MAC, co: chuoi.length }) + "\n");
    } catch { /* nhật ký lỗi không chặn việc ghi */ }
  }
  return chuoi.length;
}
