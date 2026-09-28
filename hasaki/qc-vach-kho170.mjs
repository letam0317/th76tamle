/**
 * qc-vach-kho170.mjs — ĐỐI SOÁT "VÁCH" CỦA MÔ HÌNH 3D KHO 170 VỚI BẢN VẼ MÀU.
 *
 * Mô hình 3D (kiemsoatkho/kho170-3d.html) dựng MỌI nét ≥2 m của bản vẽ DCMTG1 thành vách cao
 * 3,2 m. Nhưng nét bản vẽ gồm cả đường kích thước, mép đồ vật, vạch bãi xe, mũi tên… → vách rác.
 * Bản vẽ màu `DC HASAKI 3d.pdf` (OneDrive Desktop, 28/09/2026) vẽ TƯỜNG THẬT bằng màu hồng
 * (255,0,127). Công cụ này đặt từng nét lên ảnh PDF (đã căn tỉ lệ) và đo phần chiều dài nằm
 * trên vạch hồng:  ≥ 55 % → GIỮ (tường thật) · còn lại → RÁC.
 *
 *   node hasaki/qc-vach-kho170.mjs [--png <ảnh PDF>] [--anh]
 *     --png  ảnh render của PDF (mặc định .exports/dc-hasaki-3d-7k.png — render bằng pdfjs-dist
 *            + @napi-rs/canvas, bề ngang 7000 px; xem SO-DO-KHO-170.md §12)
 *     --anh  xuất thêm .exports/qc-vach-kho170.png (xanh = giữ, đỏ = rác) để soi bằng mắt
 *
 * Ra: kiemsoatkho/kho170-vach.js  → window.KHO170_VACH = { rac: ["x1,z1,x2,z2", …] } (mô hình đọc
 * để bỏ vách rác). Chạy cục bộ, không gọi upstream.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const argv = process.argv.slice(2);
const iP = argv.indexOf("--png");
const PNG = iP >= 0 ? argv[iP + 1] : path.join(DIR, ".exports", "dc-hasaki-3d-7k.png");
const XUAT_ANH = argv.includes("--anh");

/* Căn tỉ lệ PDF ↔ sơ đồ (m), đo trên ảnh 7000 px bằng tâm vạch hồng của 3 tường bao:
   tường trái  x 12,36 ↔ px 293,5 · tường phải x 112,56 ↔ px 6400,5  ⇒ 60,95 px/m
   tường trên  z  2,75 ↔ py 1397  · tường dưới khối trái z 62,95 ↔ py 5063 ⇒ 60,90 px/m   */
const CAN = { x0: 12.36, px0: 293.5, sx: (6400.5 - 293.5) / (112.56 - 12.36),
              z0: 2.75, py0: 1397, sz: (5063 - 1397) / (62.95 - 2.75) };
const RA_PX = 14;          // bán kính dò vạch hồng quanh mỗi điểm (~0,23 m)
const NGUONG_GIU = 0.55;   // 3 nét tường kho giấy/bóng xốp trùng 58–64 % (vạch hồng bị chữ + cửa che một phần)

global.window = {};
require(path.join(DIR, "kiemsoatkho", "kho170-sodo.js"));
const D = window.KHO170_SODO;

const { data, info } = await sharp(PNG, { limitInputPixels: false }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const laHong = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return false;
  const i = (y * W + x) * 3; return data[i] > 220 && data[i + 1] < 90 && data[i + 2] > 90 && data[i + 2] < 190; };
const ganHong = (px, py) => { for (let dy = -RA_PX; dy <= RA_PX; dy += 2) for (let dx = -RA_PX; dx <= RA_PX; dx += 2)
  if (laHong(Math.round(px + dx), Math.round(py + dy))) return true; return false; };
const toPx = (x, z) => [CAN.px0 + (x - CAN.x0) * CAN.sx, CAN.py0 + (z - CAN.z0) * CAN.sz];
const khoa = (s) => s.slice(0, 4).map((v) => (+v).toFixed(2)).join(",");

const ung = D.nen.filter((s) => Math.hypot(s[2] - s[0], s[3] - s[1]) >= 2.0);
const kq = ung.map((s) => {
  const L = Math.hypot(s[2] - s[0], s[3] - s[1]), n = Math.max(4, Math.ceil(L / 0.25));
  let trung = 0;
  for (let i = 0; i <= n; i++) { const f = i / n; const [px, py] = toPx(s[0] + (s[2] - s[0]) * f, s[1] + (s[3] - s[1]) * f); if (ganHong(px, py)) trung++; }
  return { s, L, tl: trung / (n + 1) };
});
const giu = kq.filter((k) => k.tl >= NGUONG_GIU), rac = kq.filter((k) => k.tl < NGUONG_GIU);
const m = (a) => a.reduce((t, k) => t + k.L, 0).toFixed(0);
console.log(`Nét ≥2 m: ${kq.length} · GIỮ (trên tường hồng) ${giu.length} nét / ${m(giu)} m · RÁC ${rac.length} nét / ${m(rac)} m`);
const lo = kq.filter((k) => k.tl >= 0.3 && k.tl < 0.8);
console.log(`Vùng lưng chừng (30–80 % trùng — nên soi ảnh): ${lo.length} nét`);
lo.slice(0, 15).forEach((k) => console.log("  ", khoa(k.s), (k.tl * 100).toFixed(0) + "%", k.L.toFixed(1) + " m"));

const out = `/* kho170-vach.js — SINH TỰ ĐỘNG bởi hasaki/qc-vach-kho170.mjs (${new Date().toISOString().slice(0, 10)}).
 * Nét bản vẽ ≥2 m KHÔNG trùng tường hồng của "DC HASAKI 3d.pdf" ⇒ không dựng thành vách 3,2 m.
 * Khoá = "x1,z1,x2,z2" (m, 2 số lẻ) theo đúng thứ tự trong kho170-sodo.js. ĐỪNG SỬA TAY. */
window.KHO170_VACH = ${JSON.stringify({ nguon: "DC HASAKI 3d.pdf", giu: giu.length, rac: rac.map((k) => khoa(k.s)) })};
`;
fs.writeFileSync(path.join(DIR, "kiemsoatkho", "kho170-vach.js"), out);
console.log("→ kiemsoatkho/kho170-vach.js");

if (XUAT_ANH) {
  const k = 0.35, lines = kq.map((q) => { const [a, b] = toPx(q.s[0], q.s[1]), [c, d] = toPx(q.s[2], q.s[3]);
    return `<line x1="${a * k}" y1="${b * k}" x2="${c * k}" y2="${d * k}" stroke="${q.tl >= NGUONG_GIU ? "#00a03c" : "#e00000"}" stroke-width="3"/>`; }).join("");
  const nen = await sharp(PNG, { limitInputPixels: false }).resize(Math.round(W * k)).modulate({ brightness: 1.25, saturation: 0.35 }).png().toBuffer();
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W * k)}" height="${Math.round(H * k)}">${lines}</svg>`);
  await sharp(nen).composite([{ input: svg }]).png().toFile(path.join(DIR, ".exports", "qc-vach-kho170.png"));
  console.log("→ .exports/qc-vach-kho170.png");
}
