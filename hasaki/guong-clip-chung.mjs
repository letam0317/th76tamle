/**
 * guong-clip-chung.mjs — PHẦN DÙNG CHUNG của «gương clip» (22/10 user: «cải tiến để laptop tắt vẫn xem được các clip ở theo tác vụ/theo máy/vi phạm»).
 *
 *  Laptop (guong-clip-du-phong.mjs) đẩy clip/ảnh bằng chứng sang máy chủ Xác minh DỰ PHÒNG trên PC (bang-591.mjs, XM_DU_PHONG=1)
 *  qua đường hầm của PC. Tệp này giữ những luật mà HAI ĐẦU phải giống hệt nhau: chữ ký, kiểm đường dẫn, đuôi được nhận, trần cỡ,
 *  cách đổi đường dẫn tuyệt đối ↔ đường dẫn tương đối trong thư mục bằng chứng.
 *
 *  Xác thực: KHÔNG gửi APPSCRIPT_KEY. Khoá gương = HMAC(APPSCRIPT_KEY, "guong-clip-v1"); mỗi yêu cầu ký
 *  HMAC(khoá gương, phương thức|đường dẫn|giờ|cỡ|sha256 thân) → header x-guong-luc + x-guong-ky. Giờ lệch > 5' → từ chối (chống phát lại),
 *  sha256 nằm trong chữ ký ⇒ chép lại header cũng không thay được nội dung tệp.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const DUOI_OK = /\.(mp4|webm|jpg|jpeg|png)$/i;
export const TRAN_TEP = 100 * 1024 * 1024;   // trần thân yêu cầu của Cloudflare (gói miễn phí) — tệp lớn hơn đi qua hầm sẽ gãy
export const LECH_GIO = 5 * 60e3;
export const THU_MUC_TAM_LUOT = "bai-xe-tam";   // video lượt bãi xe nằm ở .exports/.bai-xe-tam (ngoài thư mục bằng chứng) → gương đặt ở <BC>/bai-xe-tam/

const khoaGuong = (goc) => crypto.createHmac("sha256", String(goc || "")).update("guong-clip-v1").digest();

/** Chữ ký 1 yêu cầu. o = { pt: "GET"|"PUT", rel, luc, co, sha } */
export function kyGuong(goc, o) {
  const thu = [o.pt, o.rel || "", String(o.luc), String(o.co || 0), o.sha || ""].join("\n");
  return crypto.createHmac("sha256", khoaGuong(goc)).update(thu).digest("hex");
}

/** Kiểm chữ ký phía máy chủ — so sánh hằng thời gian. Trả "" nếu đạt, ngược lại lý do. */
export function kiemKy(goc, o, ky) {
  if (!goc) return "máy chủ chưa có khoá";
  const luc = Number(o.luc);
  if (!Number.isFinite(luc) || Math.abs(Date.now() - luc) > LECH_GIO) return "giờ ký lệch quá 5 phút";
  const dung = Buffer.from(kyGuong(goc, o), "hex"), gui = Buffer.from(String(ky || ""), "hex");
  if (gui.length !== dung.length || !crypto.timingSafeEqual(gui, dung)) return "chữ ký sai";
  return "";
}

/** Đường dẫn tương đối hợp lệ? (dấu /, không .., không tuyệt đối, không đoạn ẩn, ký tự chữ/số/_-.() khoảng trắng +,). Trả "" nếu đạt. */
export function kiemRel(rel) {
  rel = String(rel || "");
  if (!rel || rel.length > 300) return "đường dẫn trống hoặc quá dài";
  if (/^[\\/]|^[a-z]:|\\|\0/i.test(rel)) return "đường dẫn tuyệt đối / ký tự lạ";
  const doan = rel.split("/");
  if (doan.length > 6) return "đường dẫn quá sâu";
  for (const d of doan) {
    if (!d || d === "." || d === ".." || d.startsWith(".")) return "đoạn đường dẫn không hợp lệ";
    if (!/^[\p{L}\p{N}_\-.() +,]+$/u.test(d)) return "ký tự lạ trong đường dẫn";
  }
  if (!DUOI_OK.test(rel)) return "đuôi tệp không được nhận";
  return "";
}

/** Đường dẫn tương đối (dấu /) của tệp TUYỆT ĐỐI trên máy này, hoặc null nếu tệp không thuộc vùng gương được.
 *  bc = thư mục bằng chứng, exp = hasaki/.exports */
export function relTuDuong(abs, bc, exp) {
  const a = path.resolve(abs);
  const r1 = path.relative(path.resolve(bc), a);
  if (r1 && !r1.startsWith("..") && !path.isAbsolute(r1)) return r1.split(path.sep).join("/");
  const tam = path.resolve(exp, ".bai-xe-tam"), r2 = path.relative(tam, a);
  if (r2 && !r2.startsWith("..") && !path.isAbsolute(r2)) return THU_MUC_TAM_LUOT + "/" + r2.split(path.sep).join("/");
  return null;
}

/** Đường tương đối của tệp video lượt ghi trong ket-qua.json (có thể là đường của máy KHÁC): «…/.bai-xe-tam/<ngày>/<tệp>» → «bai-xe-tam/<ngày>/<tệp>». */
export function relTepLuot(file, bc, exp) {
  const m = /[\\/]\.bai-xe-tam[\\/](.+)$/i.exec(String(file || ""));
  if (m) return THU_MUC_TAM_LUOT + "/" + m[1].split(/[\\/]/).join("/");
  return relTuDuong(String(file || ""), bc, exp);
}

/** Tệp video lượt (đường tuyệt đối ghi trong ket-qua.json — có thể là đường của LAPTOP) → tệp thật trên máy này, hoặc null.
 *  Thứ tự: đúng đường đã ghi → bản gương <BC>/bai-xe-tam → .exports/.bai-xe-tam của máy này → đuôi «…/5S-bang-chung|bang-chung/…» trong BC. */
export function timTepLuot(file, bc, exp) {
  const f = String(file || "");
  if (!f) return null;
  if (fs.existsSync(f)) return f;
  const m = /[\\/]\.bai-xe-tam[\\/](.+)$/i.exec(f);
  if (m) {
    const duoi = m[1].split(/[\\/]/);
    for (const c of [path.join(bc, THU_MUC_TAM_LUOT, ...duoi), path.join(exp, ".bai-xe-tam", ...duoi)]) if (fs.existsSync(c)) return c;
  }
  const m2 = /[\\/](?:5S-bang-chung|bang-chung)[\\/](.+)$/i.exec(f);
  if (m2) { const c = path.join(bc, ...m2[1].split(/[\\/]/)); if (fs.existsSync(c)) return c; }
  return null;
}
