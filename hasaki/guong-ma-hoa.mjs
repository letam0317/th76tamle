/**
 * guong-ma-hoa.mjs — MÃ HOÁ ĐẦU–CUỐI cho bản dự phòng Xác minh (22/10 user: «máy gương clip dự phòng phải để CẢ ADMIN của máy đó cũng
 * KHÔNG xem được clip lẫn dữ liệu Xác minh, mà clip vẫn phát nhanh, tua được»).
 *
 *  Khoá gốc K (32 byte ngẫu nhiên, base64) chỉ có ở 2 nơi: .env laptop (XM_MA_KHOA) và Script Properties Apps Script (XM_MA_KHOA,
 *  trả cho trình duyệt qua action xmKhoaMa khi phiên tài khoản có quyền Xác minh). Máy dự phòng (PC) KHÔNG BAO GIỜ có K:
 *  nó chỉ cất và phát lại bản mã theo TÊN ẨN.
 *
 *  ĐỊNH DẠNG TỆP (v1) — bản trình duyệt tương đương ở kiemsoatkho/sw.js (đổi ở đây thì đổi cả ở đó):
 *    đầu 36 byte: "XMGM" · phiên bản 1 · loại (0 octet 1 mp4 2 webm 3 jpeg 4 png 5 json) · 2 byte 0 · salt 16 byte
 *                 · cỡ bản rõ (uint64 BE) · cỡ đoạn (uint32 BE, mặc định 1 MiB)
 *    thân: bản rõ cắt thành đoạn DOAN byte (đoạn cuối ngắn hơn; tệp rỗng = 1 đoạn 0 byte), mỗi đoạn AES-256-GCM (+16 byte thẻ):
 *      khoá tệp = HKDF-SHA256(K, salt, "xm-guong-tep") — mỗi tệp 1 khoá riêng ⇒ nonce xác định theo chỉ số đoạn vẫn không lặp:
 *      nonce 12 byte = [cờ đoạn cuối, 0, 0, 0, chỉ số đoạn uint64 BE]; AAD = 36 byte đầu + chuỗi khoá UTF-8 (cắt cụt / tráo đoạn / sửa cỡ /
 *      PC tráo bản mã của tên này sang tên khác → giải mã hỏng).
 *    Đoạn i nằm ở byte 36 + i·(DOAN+16) ⇒ trình duyệt đọc theo Range đúng đoạn cần (tua video không phải tải cả tệp).
 *  TÊN ẨN: hex HMAC-SHA256(K', khoá) với K' = HKDF-SHA256(K, rỗng, "xm-guong-ten") ⇒ admin PC không thấy mã phiếu / giờ / camera qua tên tệp.
 *    khoá = "tep:<đường dẫn trang dùng>" (vd tep:/bc/may/x.jpg · tep:/anh/2026-10-15/a.jpg · tep:/video/<id>/0 · tep:/cs/<id>/soi.jpg)
 *         · "thu:<đường dẫn>" (ảnh nhỏ 320px của bảng) · "api:<đường>[?query đã sắp]" (bản chụp phản hồi GET /api/* mà trang Xác minh cần).
 */
import crypto from "node:crypto";
import fs from "node:fs";

export const MAGIC = "XMGM", PHIEN_BAN = 1, DAU = 36, THE = 16, DOAN = 1024 * 1024;
export const LOAI = { octet: 0, mp4: 1, webm: 2, jpeg: 3, png: 4, json: 5 };
export const DUOI_TEP = ".bin";                       // đuôi trung tính trên máy dự phòng
export const RE_TEN = /^[0-9a-f]{64}$/;

/** K từ chuỗi base64 (.env XM_MA_KHOA) → Buffer 32 byte, hoặc null nếu thiếu/hỏng. */
export function docKhoa(b64) {
  const s = String(b64 || "").trim(); if (!s) return null;
  const b = Buffer.from(s, "base64");
  return b.length === 32 ? b : null;
}
/** Dấu vân tay của K (16 hex đầu sha256) — để so laptop ↔ Apps Script mà không lộ khoá. */
export const vanTay = (K) => crypto.createHash("sha256").update(K).digest("hex").slice(0, 16);

const hkdf = (K, salt, info) => Buffer.from(crypto.hkdfSync("sha256", K, salt, Buffer.from(info, "utf8"), 32));
const khoaTen = new WeakMap();
/** Tên ẩn của 1 khoá (chuỗi) → 64 hex. */
export function tenAn(K, khoa) {
  let k2 = khoaTen.get(K); if (!k2) { k2 = hkdf(K, Buffer.alloc(0), "xm-guong-ten"); khoaTen.set(K, k2); }
  return crypto.createHmac("sha256", k2).update(String(khoa), "utf8").digest("hex");
}

/** Chuẩn hoá đường dẫn tệp mà trang dùng (bỏ ?query, giải %xx) — trang (index.html hxGuongMa) làm y hệt. */
export function khoaDuong(p) {
  const s = String(p || "").split("?")[0];
  try { return decodeURIComponent(s); } catch { return s; }
}
/** Khoá bản chụp API: "api:" + đường + query đã sắp (bỏ phien). */
export function khoaApi(p) {
  const u = new URL(String(p), "http://x"); u.searchParams.delete("phien"); u.searchParams.sort();
  const q = u.searchParams.toString();
  return "api:" + u.pathname + (q ? "?" + q : "");
}
export const loaiTheoDuoi = (ten) => (/\.mp4$/i.test(ten) ? LOAI.mp4 : /\.webm$/i.test(ten) ? LOAI.webm : /\.jpe?g$/i.test(ten) ? LOAI.jpeg : /\.png$/i.test(ten) ? LOAI.png : /\.json$/i.test(ten) ? LOAI.json : LOAI.octet);

export const soDoan = (coRo, doan = DOAN) => Math.max(1, Math.ceil(coRo / doan));
/** Cỡ bản mã của tệp bản rõ coRo byte. */
export const coMa = (coRo, doan = DOAN) => DAU + coRo + THE * soDoan(coRo, doan);

function taoDau(loai, salt, coRo, doan) {
  const h = Buffer.alloc(DAU);
  h.write(MAGIC, 0, "latin1"); h[4] = PHIEN_BAN; h[5] = loai & 255;
  salt.copy(h, 8); h.writeBigUInt64BE(BigInt(coRo), 24); h.writeUInt32BE(doan, 32);
  return h;
}
/** Đọc 36 byte đầu → { loai, salt, coRo, doan, n, tong } hoặc ném lỗi. */
export function docDau(h) {
  if (!h || h.length < DAU || h.toString("latin1", 0, 4) !== MAGIC) throw new Error("không phải tệp gương mã hoá");
  if (h[4] !== PHIEN_BAN) throw new Error("phiên bản định dạng lạ: " + h[4]);
  const coRo = Number(h.readBigUInt64BE(24)), doan = h.readUInt32BE(32);
  if (!(doan >= 4096 && doan <= 16 * DOAN) || !Number.isSafeInteger(coRo)) throw new Error("đầu tệp hỏng");
  return { loai: h[5], salt: Buffer.from(h.subarray(8, 24)), coRo, doan, n: soDoan(coRo, doan), tong: coMa(coRo, doan) };
}
const nonce = (i, cuoi) => { const n = Buffer.alloc(12); n[0] = cuoi ? 1 : 0; n.writeBigUInt64BE(BigInt(i), 4); return n; };

const aad = (dau, khoa) => Buffer.concat([dau, Buffer.from(String(khoa || ""), "utf8")]);
/** Mã hoá luồng. nguon = Buffer HOẶC đường dẫn tệp (đọc từng đoạn, không nạp cả tệp vào RAM). o.khoa = chuỗi khoá (vào AAD) — BẮT BUỘC.
 *  o.salt cố định (2 lượt đi qua cho ra đúng cùng bản mã — dùng để băm trước rồi gửi sau). Trả async iterator các Buffer. */
export async function* maHoaLuong(K, nguon, o = {}) {
  const doan = o.doan || DOAN, laTep = typeof nguon === "string";
  const coRo = laTep ? fs.statSync(nguon).size : nguon.length;
  const salt = o.salt || crypto.randomBytes(16), loai = o.loai ?? LOAI.octet;
  if (!o.khoa) throw new Error("maHoaLuong: thiếu o.khoa");
  const dau = taoDau(loai, salt, coRo, doan), kTep = hkdf(K, salt, "xm-guong-tep"), n = soDoan(coRo, doan), ad = aad(dau, o.khoa);
  yield dau;
  const fd = laTep ? fs.openSync(nguon, "r") : null;
  try {
    const buf = laTep ? Buffer.alloc(doan) : null;
    for (let i = 0; i < n; i++) {
      const tu = i * doan, co = Math.min(doan, coRo - tu);
      let ro;
      if (laTep) { let da = 0; while (da < co) { const r = fs.readSync(fd, buf, da, co - da, tu + da); if (!r) throw new Error("tệp ngắn đi khi đang đọc"); da += r; } ro = buf.subarray(0, co); }
      else ro = nguon.subarray(tu, tu + co);
      const c = crypto.createCipheriv("aes-256-gcm", kTep, nonce(i, i === n - 1)); c.setAAD(ad);
      yield Buffer.concat([c.update(ro), c.final(), c.getAuthTag()]);
    }
  } finally { if (fd != null) fs.closeSync(fd); }
}
/** Mã hoá cả khối trong RAM (JSON nhỏ, ảnh nhỏ) → Buffer. */
export async function maHoa(K, buf, o = {}) { const ds = []; for await (const x of maHoaLuong(K, buf, o)) ds.push(x); return Buffer.concat(ds); }

/** Băm SHA-256 + cỡ bản mã của 1 lượt mã hoá (salt cố định) mà không giữ bản mã trong RAM. */
export async function bamBanMa(K, nguon, o) {
  const h = crypto.createHash("sha256"); let co = 0;
  for await (const x of maHoaLuong(K, nguon, o)) { h.update(x); co += x.length; }
  return { sha: h.digest("hex"), co };
}

/** Giải mã cả tệp (Buffer bản mã) → Buffer bản rõ. Dùng cho QC + công cụ kiểm. */
export function giaiMa(K, ma, khoa) {
  const d = docDau(ma.subarray(0, DAU)); if (ma.length !== d.tong) throw new Error("cỡ bản mã không khớp đầu tệp");
  const kTep = hkdf(K, d.salt, "xm-guong-tep"), ad = aad(ma.subarray(0, DAU), khoa), ra = [];
  for (let i = 0; i < d.n; i++) {
    const tu = DAU + i * (d.doan + THE), coR = Math.min(d.doan, d.coRo - i * d.doan), ct = ma.subarray(tu, tu + coR + THE);
    const g = crypto.createDecipheriv("aes-256-gcm", kTep, nonce(i, i === d.n - 1)); g.setAAD(ad); g.setAuthTag(ct.subarray(coR));
    ra.push(g.update(ct.subarray(0, coR)), g.final());
  }
  return Buffer.concat(ra);
}

/** Kiểm thân bản mã phía máy dự phòng (không có K): đầu đúng định dạng + cỡ khai = cỡ thật. Trả "" nếu đạt. */
export function kiemDauBanMa(dau, coKhai) {
  try { const d = docDau(dau); return d.tong === coKhai ? "" : "cỡ thân không khớp đầu tệp (" + coKhai + " ≠ " + d.tong + ")"; }
  catch (e) { return e.message; }
}
