/**
 * tao-khoa-ma-xm.mjs — SINH + NẠP khoá mã hoá bản dự phòng Xác minh (XM_MA_KHOA) · 22/10/2026
 *
 *  22/10 user: «máy gương clip dự phòng phải để cả admin của máy đó cũng KHÔNG xem được clip lẫn dữ liệu Xác minh».
 *  K = 32 byte ngẫu nhiên (base64) — chỉ sống ở .env LAPTOP và Script Properties Apps Script (XM_MA_KHOA). KHÔNG đưa vào gói khoá máy trạm
 *  (cai-pc/dieu-phoi.json envKeys không có XM_MA_KHOA ⇒ goiKhoaB64 của bang-591 không bao giờ gửi nó), không in ra màn hình.
 *
 *   node tao-khoa-ma-xm.mjs              xem: .env có khoá chưa (vân tay) + Apps Script có khoá chưa — KHÔNG ghi gì
 *   node tao-khoa-ma-xm.mjs --ghi        .env chưa có khoá → sinh K, ghi .env, nạp lên Apps Script (xmDatKhoaMa, SECRET) rồi đọc lại vân tay
 *                                        .env đã có khoá → chỉ nạp lại khoá đó lên Apps Script (không đổi khoá)
 *   node tao-khoa-ma-xm.mjs --ghi --doi  ĐỔI khoá: sinh K mới (gửi kèm vân tay khoá cũ để Apps Script cho thay). Sau khi đổi, bản mã cũ
 *                                        trên máy dự phòng không giải được nữa → xoá sổ .exports/guong-ma-da-day.json để lượt gương sau đẩy lại hết.
 *  Cần deploy Apps Script có action xmKhoaMa/xmDatKhoaMa TRƯỚC khi chạy --ghi (API-GAS.md).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { docKhoa, vanTay } from "./guong-ma-hoa.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url)), ENV_F = path.join(DIR, ".env");
const GHI = process.argv.includes("--ghi"), DOI = process.argv.includes("--doi");
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
function ghiEnv(k, v) {   // cùng khuôn doi-khoa.mjs ghiEnv: thay/thêm 1 dòng, giữ các dòng khác, ghi tạm → đổi tên
  const dong = fs.readFileSync(ENV_F, "utf8").split(/\r?\n/), i = dong.findIndex((l) => l.replace(/^\s*/, "").startsWith(k + "="));
  if (i >= 0) dong[i] = k + "=" + v; else dong.push(k + "=" + v);
  const tam = ENV_F + ".tam"; fs.writeFileSync(tam, dong.join("\r\n").replace(/(\r\n)+$/, "") + "\r\n"); fs.renameSync(tam, ENV_F); process.env[k] = v;
}

const cu = docKhoa(process.env.XM_MA_KHOA);
log(".env laptop: " + (cu ? "có XM_MA_KHOA · vân tay " + vanTay(cu) : process.env.XM_MA_KHOA ? "XM_MA_KHOA HỎNG (không phải 32 byte base64)" : "chưa có XM_MA_KHOA"));
if (!GHI) { log("chỉ xem — thêm --ghi để sinh/nạp khoá (xem đầu tệp)"); process.exit(0); }
if (!process.env.APPSCRIPT_KEY) { log("✗ thiếu APPSCRIPT_KEY — không nạp được lên Apps Script"); process.exit(1); }

let K = cu;
if (!K || DOI) { K = crypto.randomBytes(32); ghiEnv("XM_MA_KHOA", K.toString("base64")); log("đã ghi .env: XM_MA_KHOA mới · vân tay " + vanTay(K)); }
const { gasPost } = await import("./session-rules.js");
const j = await gasPost({ action: "xmDatKhoaMa", key: process.env.APPSCRIPT_KEY, khoa: K.toString("base64"), cuVanTay: DOI && cu ? vanTay(cu) : "" }, () => {}, "xmDatKhoaMa");
if (!j || j.status !== "success") { log("✗ Apps Script không nhận khoá: " + ((j && j.message) || "không trả lời") + " — đã deploy GAS có xmDatKhoaMa chưa?"); process.exit(1); }
log((j.vanTay === vanTay(K) ? "✓" : "✗ LỆCH") + " Apps Script giữ khoá vân tay " + j.vanTay + " (laptop " + vanTay(K) + ")");
if (DOI && cu) {
  try { fs.rmSync(path.join(DIR, ".exports", "guong-ma-da-day.json"), { force: true }); } catch { /* */ }
  log("đã đổi khoá — xoá sổ gương laptop; lượt guong-clip-du-phong sau sẽ đẩy lại toàn bộ bản mã bằng khoá mới");
}
process.exit(j.vanTay === vanTay(K) ? 0 : 1);
