/* QC TU-01 (từ ngữ chuẩn) — quét MỌI chữ máy viết ra cho người đọc về hàng vào ô; còn "cất" / "không ai lấy hàng ở thùng" = ✗ (thoát 1).
 *   node qc-tu-ngu.mjs
 * Quét: dữ liệu dashboard thật (/api/du-lieu nếu bang-591 đang chạy), tệp kết quả máy dựng, chuỗi trong mã nguồn hiển thị.
 * Chỉ quét chuỗi trong dấu nháy (không quét chú thích mã) — "cất" nghĩa lưu tệp/cache ở mã khác không thuộc phạm vi. */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { CAM } from "./tu-ngu.mjs";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const loi = [];
const quetChuoi = (nguon, s) => { if (CAM.test(s)) loi.push(nguon + " │ " + s.replace(/\s+/g, " ").slice(0, 140)); };
const quetObj = (nguon, o, k = "") => { if (typeof o === "string") return quetChuoi(nguon + (k ? " " + k : ""), o);
  if (o && typeof o === "object") for (const [kk, v] of Object.entries(o)) { if (v && v.ma === "TU-01") continue; quetObj(nguon, v, kk); } };
// 1) tệp máy dựng
for (const f of [".exports/bang-chung-b1.json", ".exports/canh-b1-ketqua.json", "quy-tac-xac-minh-b1.json"]) {
  const p = path.join(DIR, f); if (fs.existsSync(p)) quetObj(f, JSON.parse(fs.readFileSync(p, "utf8"))); }
// 2) chuỗi hiển thị trong mã (nháy kép / đơn / backtick), bỏ dòng chú thích
for (const f of ["bang-591.mjs", "tim-bang-chung-b1.mjs", "dai-lui-thoi-gian-b1.mjs", "canh-b1.mjs", "kiemsoatkho/hasaki-xacminh.js", "_clip-noi.mjs", "_thay-bang-chung-b1.mjs", "bai-xe-phieu.mjs"]) {
  const p = path.join(DIR, f); if (!fs.existsSync(p)) continue;
  fs.readFileSync(p, "utf8").split("\n").forEach((dong, i) => { const ma = dong.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
    if (/^\s*\*/.test(dong)) return;
    for (const m of ma.matchAll(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`/g)) if (!/tu-ngu|TU-01/.test(dong)) quetChuoi(f + ":" + (i + 1), m[0]); }); }
// 3) dữ liệu dashboard đang phục vụ
try { const r = await fetch("http://127.0.0.1:8591/api/du-lieu", { signal: AbortSignal.timeout(8000) }); if (r.ok) quetObj("/api/du-lieu", await r.json()); else console.log("· bang-591 trả " + r.status + " — bỏ qua bước 3"); }
catch { console.log("· bang-591 không chạy — bỏ qua bước 3"); }
if (loi.length) { console.log("✗ TU-01: " + loi.length + " chỗ còn chữ cấm"); loi.slice(0, 40).forEach((x) => console.log("  " + x)); process.exit(1); }
console.log("✓ TU-01: không còn chữ cấm");
