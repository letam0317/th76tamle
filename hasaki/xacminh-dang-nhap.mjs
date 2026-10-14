/**
 * xacminh-dang-nhap.mjs — TÀI KHOẢN + PHIÊN cho phần Xác minh (máy chủ bang-591, 12/10/2026).
 *
 *  User 12/10: "riêng phần xác minh cần cấp id và mật khẩu mới vô được".
 *  · Mật khẩu KHÔNG lưu dạng chữ ở đâu cả: chỉ lưu muối + băm scrypt trong .exports/xacminh-tai-khoan.json (.exports đã gitignore —
 *    repo là PUBLIC, cấm đưa mật khẩu/băm lên).
 *  · Phiên = chuỗi ngẫu nhiên 32 byte trả cho trình duyệt; máy chủ chỉ giữ BĂM sha256 của phiên (.exports/xacminh-phien.json)
 *    để khởi động lại máy chủ không bắt đăng nhập lại, mà lộ tệp cũng không dùng lại được phiên.
 *  · Sai 5 lần trong 10 phút → khoá đăng nhập 10 phút (theo email).
 *
 *  Tạo / đổi tài khoản (mật khẩu đưa qua biến môi trường, không đưa qua tham số để khỏi lộ trong danh sách tiến trình):
 *    HX_MATKHAU='...' node xacminh-dang-nhap.mjs --tao=<email>
 *    node xacminh-dang-nhap.mjs --ds            (liệt kê email đã có)
 *    node xacminh-dang-nhap.mjs --xoa=<email>
 */
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const TK = path.join(DIR, ".exports", "xacminh-tai-khoan.json");
const PH = path.join(DIR, ".exports", "xacminh-phien.json");
const HAN_PHIEN = 12 * 3600e3;          // 12 giờ — một ngày làm việc đăng nhập 1 lần
const SAI_TOI_DA = 5, CUA_SAI = 10 * 60e3;

const doc = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const ghi = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + ".tmp", JSON.stringify(o, null, 1)); fs.renameSync(f + ".tmp", f); };
const bam = (t) => crypto.createHash("sha256").update(t).digest("hex");
/* 14/10 user: «không cần @hasaki.vn — theo dạng "tamlc" là được» ⇒ ID = phần trước @, chữ thường. Tệp cũ khoá theo email → tự đổi khoá 1 lần. */
const chuan = (e) => String(e || "").trim().toLowerCase().replace(/@.*$/, "");
{ const ds = doc(TK, null); if (ds && Object.keys(ds).some((k) => k.includes("@"))) { const moi = {}; for (const [k, v] of Object.entries(ds)) moi[chuan(k)] = moi[chuan(k)] || v; ghi(TK, moi); } }

function bamMatKhau(mk, muoi) { return crypto.scryptSync(String(mk), Buffer.from(muoi, "hex"), 64, { N: 16384, r: 8, p: 1 }).toString("hex"); }

export function taoTaiKhoan(email, mk) {
  email = chuan(email);
  if (!/^[a-z0-9._-]+$/.test(email)) throw new Error("ID không hợp lệ (chữ thường, số, . _ -)");
  if (String(mk || "").length < 4) throw new Error("mật khẩu cần ít nhất 4 ký tự");   // 14/10 khớp tài khoản chung (Apps Script) — user tự chọn mật khẩu
  const ds = doc(TK, {}); const muoi = crypto.randomBytes(16).toString("hex");
  ds[email] = { muoi, bam: bamMatKhau(mk, muoi), luc: new Date().toISOString() };
  ghi(TK, ds);
  // đổi mật khẩu = thu hồi mọi phiên cũ của email đó
  const p = doc(PH, {}); for (const k of Object.keys(p)) if (p[k].email === email) delete p[k]; ghi(PH, p);
}

const SAI = new Map();   // email → [mốc sai]
export function dangNhap(email, mk) {
  email = chuan(email);
  const now = Date.now(), sai = (SAI.get(email) || []).filter((t) => now - t < CUA_SAI);
  if (sai.length >= SAI_TOI_DA) return { loi: "Sai quá " + SAI_TOI_DA + " lần — thử lại sau " + Math.ceil((CUA_SAI - (now - sai[0])) / 60e3) + " phút", code: 429 };
  const tk = doc(TK, {})[email];
  const dung = tk && crypto.timingSafeEqual(Buffer.from(bamMatKhau(mk, tk.muoi), "hex"), Buffer.from(tk.bam, "hex"));
  if (!dung) { sai.push(now); SAI.set(email, sai); return { loi: "Sai tài khoản hoặc mật khẩu", code: 401 }; }
  SAI.delete(email);
  const phien = crypto.randomBytes(32).toString("hex");
  const p = doc(PH, {}); for (const k of Object.keys(p)) if (p[k].het < now) delete p[k];
  p[bam(phien)] = { email, het: now + HAN_PHIEN }; ghi(PH, p);
  return { phien, email, het: now + HAN_PHIEN };
}

let DEM = null;   // đệm tệp phiên 5 s — mỗi ảnh nhỏ trong bảng đều đi qua cổng này
export function kiemPhien(phien) {
  if (!phien || !/^[0-9a-f]{64}$/.test(phien)) return null;
  if (!DEM || Date.now() - DEM.at > 5e3) DEM = { at: Date.now(), p: doc(PH, {}) };
  const x = DEM.p[bam(phien)];
  return x && x.het > Date.now() ? x : null;
}

/* Bộ đo (qc-*.mjs) chạy trên chính máy này: cấp phiên 1 giờ cho tài khoản đầu tiên, không cần mật khẩu — tiến trình nội bộ vốn
   đọc được tệp tài khoản/phiên trên đĩa, nên đây không mở thêm lối nào. Trả "" khi chưa có tài khoản. */
export function phienQC() {
  const email = Object.keys(doc(TK, {}))[0]; if (!email) return "";
  const phien = crypto.randomBytes(32).toString("hex"), now = Date.now();
  const p = doc(PH, {}); for (const k of Object.keys(p)) if (p[k].het < now) delete p[k];
  p[bam(phien)] = { email, het: now + 3600e3, qc: 1 }; ghi(PH, p); DEM = null;
  return phien;
}

/* 14/10 tài khoản chung audit-dc (Apps Script tk_*): bang-591 hỏi tk_toi xong thì cấp phiên máy chủ cho ID đó.
   chiXem = quyền Xác minh «chỉ xem» → bang-591 chặn mọi lệnh ghi (POST) của phiên này. */
export function taoPhienTk(id, chiXem) {
  const phien = crypto.randomBytes(32).toString("hex"), now = Date.now();
  const p = doc(PH, {}); for (const k of Object.keys(p)) if (p[k].het < now) delete p[k];
  p[bam(phien)] = { email: chuan(id), het: now + HAN_PHIEN, tk: 1, chiXem: !!chiXem }; ghi(PH, p); DEM = null;
  return { phien, email: chuan(id), het: now + HAN_PHIEN };
}

export function dangXuat(phien) {
  if (!phien) return; const p = doc(PH, {}); delete p[bam(phien)]; ghi(PH, p); DEM = null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const A = Object.fromEntries(process.argv.slice(2).map((x) => { const m = /^--([^=]+)=?(.*)$/.exec(x); return m ? [m[1], m[2] || true] : [x, true]; }));
  if (A.tao) { taoTaiKhoan(A.tao, process.env.HX_MATKHAU); console.log("✓ đã tạo/đổi tài khoản " + chuan(A.tao) + " (mật khẩu chỉ lưu dạng băm)"); }
  else if (A.xoa) { const ds = doc(TK, {}); delete ds[chuan(A.xoa)]; ghi(TK, ds); console.log("✓ đã xoá " + chuan(A.xoa)); }
  else console.log(Object.keys(doc(TK, {})).join("\n") || "(chưa có tài khoản)");
}
