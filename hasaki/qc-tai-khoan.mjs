/* QC tài khoản + phân quyền audit-dc (14/10/2026) — gọi Apps Script lệnh tk_* .
 *   node qc-tai-khoan.mjs            → thử trên HEAD (bản thử, gọi bằng token clasp của chủ) — mặc định
 *   node qc-tai-khoan.mjs --that     → thử trên bản thật (APPSCRIPT_URL)
 *   TK_MK='…' node qc-tai-khoan.mjs --khoitao=tamlc   → tạo/đặt lại tài khoản QUẢN TRỊ (mật khẩu chỉ qua biến môi trường, không ghi tệp)
 * Ca thử dùng tài khoản tạm «qc-tk-<giờ>» rồi XOÁ; KHÔNG đụng tài khoản thật nào khác. Quyền khách đọc trước, ghi lại y nguyên.
 */
import "dotenv/config";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const A = Object.fromEntries(process.argv.slice(2).map((x) => { const m = /^--([^=]+)=?(.*)$/.exec(x); return m ? [m[1], m[2] || true] : [x, true]; }));
const HEAD = "https://script.google.com/macros/s/AKfycbwRdzYMDJ_UPjWSZ6AdpmOiuAagwEk8x36pdH4Nl_lA/exec";
const URL_ = A.that ? process.env.APPSCRIPT_URL : HEAD;
let tok = "";
async function tokenChu() {
  if (tok) return tok;
  const rc = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".clasprc.json"), "utf8")), t = rc.tokens ? rc.tokens.default : rc.token;
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: t.client_id || rc.oauth2ClientSettings?.clientId, client_secret: t.client_secret || rc.oauth2ClientSettings?.clientSecret, refresh_token: t.refresh_token, grant_type: "refresh_token" }) });
  const j = await r.json(); if (!j.access_token) throw new Error("không làm tươi được token clasp"); return (tok = j.access_token);
}
async function goi(d) {
  const h = { "Content-Type": "text/plain" }; if (!A.that) h.Authorization = "Bearer " + await tokenChu();
  const r = await fetch(URL_, { method: "POST", headers: h, body: JSON.stringify(d), redirect: "follow" });
  const t = await r.text(); try { return JSON.parse(t); } catch { throw new Error("không phải JSON: " + t.slice(0, 120)); }
}
let dat = 0; const loi = []; const ok = (dk, ten) => { if (dk) dat++; else loi.push(ten); console.log((dk ? "  ✓ " : "  ✗ ") + ten); };

if (A.khoitao) {
  if (!process.env.TK_MK) { console.error("✗ thiếu TK_MK"); process.exit(2); }
  const j = await goi({ action: "tk_khoitao", key: process.env.APPSCRIPT_KEY, id: A.khoitao, ten: A.ten || A.khoitao, mk: process.env.TK_MK });
  console.log(j.status === "success" ? "✓ tài khoản quản trị «" + j.id + "» sẵn sàng (mật khẩu chỉ lưu dạng băm)" : "✗ " + j.message); process.exit(j.status === "success" ? 0 : 1);
}

console.log("── QC tài khoản trên " + (A.that ? "BẢN THẬT" : "HEAD"));
const khach0 = await goi({ action: "tk_khach" });
ok(khach0.status === "success" && khach0.quyen && khach0.quyen["r.xacminh"] === "khong" || khach0.quyen, "T1 tk_khach trả quyền khách (" + Object.keys(khach0.quyen || {}).length + " mục)");
const qcAdmin = "qc-ad-" + Date.now().toString(36), mkAd = "Qc" + Math.random().toString(36).slice(2, 10);
let j = await goi({ action: "tk_khoitao", key: process.env.APPSCRIPT_KEY, id: qcAdmin, mk: mkAd });
ok(j.status === "success", "T2 khởi tạo quản trị tạm bằng SECRET");
j = await goi({ action: "tk_khoitao", key: "sai", id: "x", mk: "1234" });
ok(j.status === "error", "T3 khởi tạo SAI key bị chặn");
const t0 = Date.now(); const dnAd = await goi({ action: "tk_dangnhap", id: qcAdmin.toUpperCase() + "@hasaki.vn", mk: mkAd });
ok(dnAd.status === "success" && dnAd.phien && dnAd.nguoi.vaiTro === "quantri", "T4 đăng nhập bằng ID viết hoa + @hasaki.vn vẫn nhận (" + (Date.now() - t0) + " ms)");
const P = dnAd.phien;
const nd = "qc-nd-" + Date.now().toString(36), mkNd = "Nd" + Math.random().toString(36).slice(2, 10);
j = await goi({ action: "tk_luu", phien: P, tk: { id: nd, ten: "QC người dùng", mk: mkNd, vaiTro: "nguoidung", quyen: { "r.task": "xem", "f.kk": "lam", "r.xacminh": "khong" } } });
ok(j.status === "success", "T5 quản trị tạo người dùng");
const dnNd = await goi({ action: "tk_dangnhap", id: nd, mk: mkNd });
ok(dnNd.status === "success" && dnNd.nguoi.quyen["r.task"] === "xem" && dnNd.nguoi.quyen["f.kk"] === "lam" && dnNd.nguoi.quyen["r.tong"] === "khong", "T6 người dùng nhận đúng quyền (Vi phạm=xem · Kiểm kê F=thao tác · mục không cấp=không)");
j = await goi({ action: "tk_ds", phien: dnNd.phien });
ok(j.status === "error" && j.code === 403, "T7 người dùng KHÔNG xem được danh sách tài khoản");
j = await goi({ action: "tk_luu", phien: dnNd.phien, tk: { id: nd, vaiTro: "quantri" } });
ok(j.status === "error", "T8 người dùng KHÔNG tự nâng quyền");
j = await goi({ action: "tk_dangnhap", id: nd, mk: "sai-mat-khau" });
ok(j.status === "error" && j.code === 401, "T9 sai mật khẩu bị từ chối");
j = await goi({ action: "tk_toi", phien: dnNd.phien });
ok(j.status === "success" && j.nguoi.id === nd, "T10 tk_toi (máy chủ 8591 dùng) trả đúng người");
j = await goi({ action: "tk_doimk", phien: dnNd.phien, mkCu: mkNd, mkMoi: mkNd + "x" });
const dnMoi = await goi({ action: "tk_dangnhap", id: nd, mk: mkNd + "x" });
ok(j.status === "success" && dnMoi.status === "success", "T11 đổi mật khẩu rồi đăng nhập bằng mật khẩu mới");
j = await goi({ action: "tk_luu", phien: P, tk: { id: nd, ten: "QC", vaiTro: "nguoidung", quyen: {}, khoa: true } });
const dnKhoa = await goi({ action: "tk_dangnhap", id: nd, mk: mkNd + "x" });
const toiKhoa = await goi({ action: "tk_toi", phien: dnMoi.phien });
ok(dnKhoa.status === "error" && toiKhoa.status === "error", "T12 khoá tài khoản: không đăng nhập được, phiên cũ mất hiệu lực");
j = await goi({ action: "tk_luu", phien: P, tk: { id: qcAdmin, vaiTro: "nguoidung", quyen: {} } });
ok(j.status === "error", "T13 quản trị không tự hạ quyền chính mình");
j = await goi({ action: "tk_dangxuat", phien: dnNd.phien }); const sauDx = await goi({ action: "tk_toi", phien: dnNd.phien });
ok(sauDx.status === "error", "T14 đăng xuất: phiên hết hiệu lực");
/* dọn: xoá người dùng tạm, đăng xuất + xoá quản trị tạm bằng chính nó → cần 1 quản trị khác: xoá bằng khoitao rồi tk_xoa từ… dùng SECRET: không có lệnh xoá bằng SECRET ⇒ quản trị tạm tự xoá người dùng, rồi một quản trị tạm thứ 2 xoá quản trị tạm 1 */
await goi({ action: "tk_xoa", phien: P, id: nd });
const qc2 = qcAdmin + "b"; await goi({ action: "tk_khoitao", key: process.env.APPSCRIPT_KEY, id: qc2, mk: mkAd });
const p2 = (await goi({ action: "tk_dangnhap", id: qc2, mk: mkAd })).phien;
await goi({ action: "tk_xoa", phien: p2, id: qcAdmin });
const ds = await goi({ action: "tk_ds", phien: p2 });
await goi({ action: "tk_dangxuat", phien: P });
/* quản trị tạm 2 không tự xoá được → để lại cờ dọn: xoá bằng tài khoản quản trị thật (tamlc) nếu có TK_MK, không thì báo */
let conLai = (ds.ds || []).filter((x) => /^qc-/.test(x.id)).map((x) => x.id);
if (process.env.TK_MK_TAMLC) {
  const pt = (await goi({ action: "tk_dangnhap", id: "tamlc", mk: process.env.TK_MK_TAMLC })).phien;
  for (const id of conLai) await goi({ action: "tk_xoa", phien: pt, id });
  conLai = ((await goi({ action: "tk_ds", phien: pt })).ds || []).filter((x) => /^qc-/.test(x.id)).map((x) => x.id);
  await goi({ action: "tk_dangxuat", phien: pt });
}
ok(!conLai.length, "T15 dọn sạch tài khoản thử" + (conLai.length ? " — còn " + conLai.join(", ") : ""));
console.log(loi.length ? "✗ " + loi.length + " lỗi / " + (dat + loi.length) + " ca" : "✓ tài khoản: đạt " + dat + " ca");
process.exit(loi.length ? 1 : 0);
