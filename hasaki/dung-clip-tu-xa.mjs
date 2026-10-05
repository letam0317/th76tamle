/**
 * dung-clip-tu-xa.mjs — LAPTOP GỬI VIỆC DỰNG CLIP sang máy in (Desktop-JE75K38) qua hàng đợi Apps Script · 05/10/2026
 *  Cấu hình giống _clip-noi.mjs nhưng nguồn là TOẠ ĐỘ CAMERA thay vì file trên laptop (máy in tự tải từ top-review):
 *    { ra, tieuDe, kbps?, nguonCam: { a: { host, kenh, tu: "YYYY-MM-DDTHH:MM:SS", giay, bd: "HH:MM:SS" } }, doan: [...] }
 *  node dung-clip-tu-xa.mjs <cau-hinh.json> [--ra=<file ra>] [--cho=60]   # --cho: số phút chờ máy in làm xong (mặc định 60)
 *  node dung-clip-tu-xa.mjs --may                                        # xem máy in có đang nhận việc không + cấu hình máy
 *  Clip tải về xong là XOÁ khỏi Drive (có mặt người).
 */
import fs from "node:fs"; import path from "node:path"; import "dotenv/config";
const GAS = process.env.APPSCRIPT_URL, KEY = process.env.APPSCRIPT_KEY;
const A = process.argv.slice(2), co = (k) => { const x = A.find((a) => a.startsWith("--" + k + "=")); return x ? x.split("=").slice(1).join("=") : null; };
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
const gas = async (b) => { for (let i = 0; i < 3; i++) { try { const r = await fetch(GAS, { method: "POST", body: JSON.stringify({ ...b, key: KEY }), redirect: "follow", signal: AbortSignal.timeout(300000) }); const t = await r.text(); if (t.trim().startsWith("{")) return JSON.parse(t); } catch { /* */ } await new Promise((r) => setTimeout(r, 3000)); } return null; };

if (A.includes("--may")) {
  const t = await gas({ action: "dc_trangthai" });
  if (!t || !t.may) { log("✗ chưa thấy máy in nào báo về (agent chưa cài hoặc chưa chạy)"); process.exit(1); }
  log(`máy báo ${Math.round(t.may.tre / 1000)} s trước:`, t.may.tt); log("hàng đợi:", (t.hang || []).join(", ") || "trống"); process.exit(0);
}
const F = A.find((a) => !a.startsWith("--")); if (!F) { console.log("dùng: node dung-clip-tu-xa.mjs <cau-hinh.json> [--ra=...] | --may"); process.exit(2); }
const C = JSON.parse(fs.readFileSync(F, "utf8")); if (!C.nguonCam) { log("✗ cấu hình thiếu nguonCam (toạ độ camera)"); process.exit(2); }
const id = (co("id") || path.basename(F, ".json")).replace(/[^\w-]/g, "").slice(0, 50) + "-" + Date.now().toString(36);
const ra = co("ra") || path.join(path.dirname(F), path.basename(C.ra || id + ".webm"));
const cfg = JSON.stringify(C); if (cfg.length > 8500) { log("✗ cấu hình", cfg.length, "ký tự > 8500"); process.exit(2); }
const t0 = Date.now(), them = await gas({ action: "dc_them", id, cfg });
if (!them || them.status !== "success") { log("✗ gửi việc lỗi:", JSON.stringify(them)); process.exit(1); }
log("→ đã gửi việc", id, "· chờ máy in…");
const het = Date.now() + Number(co("cho") || 60) * 60e3;
for (;;) {
  await new Promise((r) => setTimeout(r, 20000));
  const t = await gas({ action: "dc_trangthai", id }); const v = t && t.viec;
  if (v && v.tt === "xong") {
    const f = await gas({ action: "dc_tai", id, xoa: 1 }); if (!f || !f.b64) { log("✗ tải file lỗi"); process.exit(1); }
    fs.writeFileSync(ra, Buffer.from(f.b64, "base64")); log(`✓ ${ra} (${(fs.statSync(ra).size / 1048576).toFixed(1)} MB) · tổng ${Math.round((Date.now() - t0) / 1000)} s · ${v.nhatKy}`); process.exit(0);
  }
  if (v && v.tt === "loi") { log("✗ máy in báo lỗi:", v.loi, v.nhatKy ? "· " + v.nhatKy : ""); process.exit(1); }
  if (Date.now() > het) { log("✗ hết giờ chờ — việc vẫn ở trạng thái", v && v.tt, "(máy in tắt/agent chưa chạy?)"); process.exit(3); }
  log("  …", v ? v.tt : "?", t && t.may ? `· máy báo ${Math.round(t.may.tre / 1000)} s trước` : "· chưa thấy máy in báo về");
}
