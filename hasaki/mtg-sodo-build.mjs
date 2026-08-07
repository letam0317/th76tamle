/**
 * mtg-sodo-build.mjs — dựng SƠ ĐỒ MẶT BẰNG từ hình học THẬT của MTG_zigzag.pdf.
 *
 * Bản vẽ đã đo xác minh thực tế nên kích thước / nét kẻ / khoảng cách dãy–vật thể phải bê y
 * nguyên: không vẽ lại bằng lưới HTML gần đúng. Script này chạy 4 bước.
 *
 * 1. Đọc .exports/mtg-zigzag.json (pdf-mtg-boc.mjs bóc: 163 nhãn + 1.865 đoạn thẳng).
 * 2. HƯỚNG HIỂN THỊ: PDF khai /Rotate 270 → xoay 90° ngược chiều kim đồng hồ, ra khổ NGANG
 *    ~2495×1702; dãy kệ thành các HÀNG bên trái, KHU PO/Đồng kiểm + Phòng kiểm soát kho bên phải.
 *    Chứng cứ đây đúng là hướng người vẽ định cho người đọc: mọi chữ trong bản vẽ đặt ở góc −90°,
 *    sau phép xoay này thành nằm ngang (rot=0).
 * 3. DÒ HỘP từng ô kệ bằng tia 4 phía trên tập đoạn thẳng — hộp đến từ chính nét vẽ, không đặt tay.
 * 4. GÁN DÃY bằng hình học: hàng hộp nào có nhãn dãy nằm sát mép trái của hàng thì thuộc dãy đó.
 *    Hàng mang 2 nhãn (509/510, 511/512 — kệ 2 mặt vẽ chung một dải hộp) thì CHIA ĐÔI theo chiều
 *    cao: nửa trên là dãy có nhãn ở trên. Hộp lẻ còn sót được khớp bù theo số cột còn thiếu.
 *
 * SỐ CỘT DO SCRIPT TỰ ĐÁNH LẠI theo thứ tự x, KHÔNG dùng số in trong bản vẽ, vì bản vẽ có lỗi
 * đánh số: dải 509/510 in "01 02 03 04 05 06 07 06 07" — hai ô cuối lặp 06/07 đáng ra là 08/09
 * (dữ liệu kiểm kê thật xác nhận 509 và 510 đều có cột 01–09).
 *
 * Xuất .exports/mtg-sodo.json { W,H, nen, chu, o[] } — dashboard nhúng thẳng để vẽ SVG.
 */
import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url";
import { DAY, TONG_O } from "./mtg-danhmuc.mjs";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const src = JSON.parse(fs.readFileSync(path.join(DIR, ".exports", "mtg-zigzag.json"), "utf8"));
const p2 = (n) => (n < 10 ? "0" : "") + n;

/* ---------- 1+2) sang hệ hiển thị (xoay 90° CCW, y hướng xuống) ---------- */
let X0 = 1e9, Y0 = 1e9, X1 = -1e9, Y1 = -1e9;
const bb = (x, y) => { X0 = Math.min(X0, x); Y0 = Math.min(Y0, y); X1 = Math.max(X1, x); Y1 = Math.max(Y1, y); };
src.lines.forEach((l) => { bb(l.x1, l.y1); bb(l.x2, l.y2); });
src.texts.forEach((t) => bb(t.x, t.y));
const PAD = 14;
const DX = (x, y) => +(Y1 - y + PAD).toFixed(2);
const DY = (x, y) => +(X1 - x + PAD).toFixed(2);
const W = +(Y1 - Y0 + PAD * 2).toFixed(1), H = +(X1 - X0 + PAD * 2).toFixed(1);
const nen = src.lines.map((l) => ({ x1: DX(l.x1, l.y1), y1: DY(l.x1, l.y1), x2: DX(l.x2, l.y2), y2: DY(l.x2, l.y2) }));
const chu = src.texts.map((t) => ({ s: t.s, x: DX(t.x, t.y), y: DY(t.x, t.y), sz: +t.size.toFixed(1), rot: +((t.rot + 90 + 360) % 360).toFixed(1) }));
console.log(`Khổ hiển thị ${W} × ${H} (ngang) · ${nen.length} đoạn · ${chu.length} nhãn`);

/* ---------- 3) dò hộp ---------- */
const EPS = 1.2, T = 1.5;
const ngang = [], doc = [];
nen.forEach((s) => {
  const dx = Math.abs(s.x2 - s.x1), dy = Math.abs(s.y2 - s.y1);
  if (dy <= EPS && dx > EPS) ngang.push({ y: (s.y1 + s.y2) / 2, a: Math.min(s.x1, s.x2), b: Math.max(s.x1, s.x2) });
  else if (dx <= EPS && dy > EPS) doc.push({ x: (s.x1 + s.x2) / 2, a: Math.min(s.y1, s.y2), b: Math.max(s.y1, s.y2) });
});
function hop(px, py) {
  let L = -1e9, R = 1e9, U = -1e9, D = 1e9;
  for (const d of doc) { if (py < d.a - T || py > d.b + T) continue; if (d.x <= px && d.x > L) L = d.x; if (d.x >= px && d.x < R) R = d.x; }
  for (const h of ngang) { if (px < h.a - T || px > h.b + T) continue; if (h.y <= py && h.y > U) U = h.y; if (h.y >= py && h.y < D) D = h.y; }
  if (L < -1e8 || R > 1e8 || U < -1e8 || D > 1e8) return null;
  return { x: +L.toFixed(2), y: +U.toFixed(2), w: +(R - L).toFixed(2), h: +(D - U).toFixed(2) };
}
const nhanDay = chu.filter((t) => /^F0-KHO/.test(t.s)).map((t) => ({ d: (t.s.match(/F0-KHO-([0-9A-Za-z]+)-/) || [])[1], x: t.x, y: t.y }));
const oVe = [];
chu.filter((t) => /^\d{2}$/.test(t.s.trim())).forEach((t) => { const b = hop(t.x, t.y); if (b) oVe.push({ ve: t.s.trim(), ...b }); });
console.log(`  dò được ${oVe.length} hộp từ nét vẽ`);

/* ---------- 4) gom hàng rồi gán dãy ---------- */
const hang = [];
oVe.forEach((b) => {
  const cy = b.y + b.h / 2;
  let h = hang.find((h) => Math.abs(h.cy - cy) <= 8 && Math.abs(h.h - b.h) <= 8);
  if (!h) hang.push(h = { cy, h: b.h, box: [] });
  h.box.push(b);
});
hang.forEach((h) => { h.box.sort((a, b) => a.x - b.x); h.y = Math.min(...h.box.map((b) => b.y)); h.minX = h.box[0].x; h.cy = h.y + h.h / 2; });
hang.sort((a, b) => a.cy - b.cy);
console.log(`  gom ${hang.length} hàng hộp`);

/* Nhãn dãy thuộc hàng nào: nhãn nằm BÊN TRÁI hàng (label.x < minX) và y phủ vào dải hàng, nới
   22px vì nhãn của dãy dưới trong cặp đặt hơi thấp hơn dải (509 y=389 so với dải 333–385).
   Đã soi từng hàng: với dung sai này mỗi hàng ra đúng 1 nhãn, trừ 2 dải kệ 2 mặt ra đúng 2 nhãn.
   CHẶN NHẦM: 2 ô lẻ 14/15 của dãy 513 vẽ tách hẳn sang phải cũng phủ y của nhãn 511/512 — nên
   chỉ cho phép chia đôi khi hàng đủ DÀI (≥5 hộp, tức cả một dải kệ); hàng 1–2 hộp mà khớp 2 nhãn
   thì để dành cho bước khớp bù theo số cột còn thiếu ở dưới. */
hang.forEach((h) => {
  const m = nhanDay.filter((n) => n.x < h.minX && n.y >= h.y - 22 && n.y <= h.y + h.h + 22)
    .sort((a, b) => a.y - b.y).map((n) => n.d);
  h.day = (m.length > 1 && h.box.length < 5) ? [] : m;
});

const O = [];   // { loc, day, cot, x,y,w,h }
const daDung = new Set();
hang.forEach((h, hi) => {
  if (!h.day.length) return;
  daDung.add(hi);
  if (h.day.length === 1) {
    h.box.forEach((b, i) => O.push({ day: h.day[0], iCot: i, x: b.x, y: b.y, w: b.w, h: b.h, ve: b.ve }));
  } else {
    /* Kệ 2 mặt vẽ chung một dải: chia đôi chiều cao, nửa TRÊN cho dãy có nhãn ở trên */
    h.box.forEach((b, i) => h.day.forEach((d, k) => O.push({
      day: d, iCot: i, x: b.x, y: +(b.y + (b.h / h.day.length) * k).toFixed(2),
      w: b.w, h: +(b.h / h.day.length).toFixed(2), ve: b.ve, doi: true })));
  }
});

/* Đánh số cột theo thứ tự x trong từng dãy (bỏ số in trong bản vẽ — bản vẽ có lỗi lặp 06/07) */
const theoDay = {};
O.forEach((o) => (theoDay[o.day] = theoDay[o.day] || []).push(o));
Object.keys(theoDay).forEach((d) => {
  theoDay[d].sort((a, b) => a.x - b.x || a.y - b.y);
  let i = 0, xTruoc = null;
  theoDay[d].forEach((o) => { if (xTruoc === null || Math.abs(o.x - xTruoc) > 2) { i++; xTruoc = o.x; } o.cot = p2(i); });
});

/* Hộp lẻ chưa gán (dãy 513 có 2 ô 14/15 vẽ tách hẳn sang phải): khớp bù cho dãy đang THIẾU cột,
   theo đúng số in trên bản vẽ — chỉ nhận khi số đó khuyết ở duy nhất 1 dãy. */
hang.forEach((h, hi) => {
  if (daDung.has(hi)) return;
  h.box.forEach((b) => {
    const ung = DAY.filter((r) => Number(b.ve) <= r.soCot && !(theoDay[r.d] || []).some((o) => o.cot === b.ve));
    if (ung.length !== 1) { console.log(`  ⚠ hộp lẻ "${b.ve}" tại (${b.x},${b.y}) khớp được ${ung.length} dãy — BỎ.`); return; }
    const o = { day: ung[0].d, cot: b.ve, x: b.x, y: b.y, w: b.w, h: b.h, ve: b.ve, le: true };
    (theoDay[o.day] = theoDay[o.day] || []).push(o); O.push(o);
    console.log(`  + hộp lẻ "${b.ve}" → dãy ${o.day}`);
  });
});

/* ---------- kiểm tra BẮT BUỘC: khớp danh mục, không thì dừng ---------- */
let loi = 0;
DAY.forEach((r) => {
  const cot = (theoDay[r.d] || []).map((o) => o.cot).sort();
  const can = Array.from({ length: r.soCot }, (_, i) => p2(i + 1));
  if (cot.length !== r.soCot || can.some((c, i) => cot[i] !== c)) {
    loi++; console.log(`  ✗ dãy ${r.d}: dò ${cot.length} ô [${cot.join(",")}] · danh mục ${r.soCot}`);
  }
});
if (loi) { console.error(`\n✗ ${loi} dãy KHÔNG khớp danh mục — không xuất file (sơ đồ sai còn tệ hơn không có).`); process.exit(1); }
console.log(`  ✓ 14/14 dãy khớp danh mục · ${O.length}/${TONG_O} ô`);
DAY.forEach((r) => {
  const bs = theoDay[r.d];
  console.log(`   ${("F0-KHO-" + r.d).padEnd(12)} ${String(bs.length).padStart(2)} ô · rộng ${Math.min(...bs.map((b) => b.w)).toFixed(0)}–${Math.max(...bs.map((b) => b.w)).toFixed(0)} · cao ${Math.min(...bs.map((b) => b.h)).toFixed(0)}–${Math.max(...bs.map((b) => b.h)).toFixed(0)}`);
});

/* ---------- xuất ----------
 * KHÔNG xuất lại nhãn chữ của bản vẽ. Dashboard tự vẽ chữ vì 3 lý do:
 *   · số cột trong bản vẽ có lỗi lặp (509/510) và phải đổi màu theo nền ô đã tô;
 *   · tên dãy trong bản vẽ là "F0-KHO-501-" dài loằng ngoằng — trên dashboard chỉ cần "501";
 *   · chữ phải theo font + màu mực của theme, không phải Times New Roman đỏ của bản in.
 * Thay vào đó xuất MỐC NEO: chỗ đặt nhãn dãy (day[]) và hộp khu chức năng (khu[]). */
const o = O.map((x) => ({ loc: "F0-KHO-" + x.day + "-" + x.cot, d: x.day, c: x.cot,
  x: x.x, y: x.y, w: x.w, h: x.h })).sort((a, b) => a.loc.localeCompare(b.loc));

/* Nhãn dãy: neo vào KHỐI TRÁI của dãy (dãy 501–507 có 2 khối cách nhau lối đi ngang; nhãn trong
   bản vẽ luôn nằm cạnh khối trái). lx = mép trái khối, ly = tâm dọc của khối. */
const dayNeo = DAY.map((r) => {
  const bs = theoDay[r.d];
  const minX = Math.min(...bs.map((b) => b.x));
  const khoi = bs.filter((b) => b.x < minX + 40);           // khối trái = các ô sát mép trái nhất
  const y0 = Math.min(...khoi.map((b) => b.y)), y1 = Math.max(...khoi.map((b) => b.y + b.h));
  return { d: r.d, lx: +minX.toFixed(1), ly: +((y0 + y1) / 2).toFixed(1) };
});

/* Khu chức năng: CHỈ xuất mốc đặt nhãn, KHÔNG dò hộp.
 * Đã thử hop() ở tâm chữ: "Phòng kiểm soát kho" ra hộp 156×1623 — ray-cast ăn cả dải trống dọc
 * mép phải chứ không phải cái phòng, vì đoạn đó không có nét ngang nào cắt qua. Tường thật của 2
 * khu này vốn đã nằm trong lớp nền (1.275 đoạn) nên không cần vẽ lại hộp: chỉ cần biết đặt CHỮ
 * ở đâu. doc=1 khi bản vẽ xếp chữ theo chiều DỌC (phòng hẹp và cao) → dashboard quay nhãn 90°. */
const KHU = [
  { lb: "Khu PO · Đồng kiểm", tu: ["KHU PO", "ĐỒNG KIỂM"] },
  { lb: "Phòng kiểm soát kho", tu: ["Phòng", "kiểm", "soát", "kho"] },
];
const khu = KHU.map((k) => {
  const ts = chu.filter((t) => k.tu.indexOf(t.s.trim()) >= 0);
  if (!ts.length) return null;
  const cx = ts.reduce((a, t) => a + t.x, 0) / ts.length, cy = ts.reduce((a, t) => a + t.y, 0) / ts.length;
  const rx = Math.max(...ts.map((t) => t.x)) - Math.min(...ts.map((t) => t.x));
  const ry = Math.max(...ts.map((t) => t.y)) - Math.min(...ts.map((t) => t.y));
  return { lb: k.lb, x: +cx.toFixed(1), y: +cy.toFixed(1), doc: ry > rx * 1.5 ? 1 : 0 };
}).filter(Boolean);
console.log("  khu chức năng: " + khu.map((k) => k.lb + (k.doc ? " (nhãn dọc)" : "")).join(" · "));

fs.writeFileSync(path.join(DIR, ".exports", "mtg-sodo.json"), JSON.stringify({ W, H, nen, o, day: dayNeo, khu }));
const chuGiu = chu.filter((t) => !/^\d{2}$/.test(t.s.trim()));   // chỉ dùng cho bản .svg soi mắt

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
fs.writeFileSync(path.join(DIR, ".exports", "mtg-sodo.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff"/>` +
  `<g stroke="#111" stroke-width="1" fill="none">` + nen.map((s) => `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}"/>`).join("") + `</g>` +
  `<g fill="rgba(5,150,105,.18)" stroke="#059669" stroke-width=".7">` + o.map((c) => `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}"/>`).join("") + `</g>` +
  `<g fill="#0f172a" font-family="Arial" font-weight="700" text-anchor="middle" dominant-baseline="central">` +
  o.map((c) => `<text x="${(c.x + c.w / 2).toFixed(1)}" y="${(c.y + c.h / 2).toFixed(1)}" font-size="${Math.min(26, c.h * .5).toFixed(1)}">${c.c}</text>`).join("") + `</g>` +
  chuGiu.map((t) => `<text x="${t.x}" y="${t.y}" font-size="${Math.max(8, t.sz)}" fill="#c00" font-family="Times New Roman" font-weight="bold" dominant-baseline="middle">${esc(t.s)}</text>`).join("") +
  `</svg>`);
console.log("Đã lưu .exports/mtg-sodo.json + .svg");

/* ---------- 5) bản NÉN để nhúng thẳng vào factory/index.html ----------
 * Toạ độ làm tròn về SỐ NGUYÊN: khổ vẽ ~2495 đơn vị nên sai số ≤0,02% — mắt không thấy, mà chuỗi
 * ngắn đi một nửa. Sau khi tròn thì các nét vẽ trùng nhau (bản vẽ CAD vẽ đè nhiều lần) gộp lại
 * còn ~1.275/1.865 đoạn. Đóng thành CHUỖI thay vì mảng JSON lồng: 26KB thay vì 108KB.
 * Dashboard tự tách chuỗi lúc dựng SVG (plgGeo()). */
const R = (n) => Math.round(n);
{
  const seen = new Set(), L = [];
  nen.forEach((s) => {
    let a = [R(s.x1), R(s.y1), R(s.x2), R(s.y2)];
    if (a[0] > a[2] || (a[0] === a[2] && a[1] > a[3])) a = [a[2], a[3], a[0], a[1]];
    if (a[0] === a[2] && a[1] === a[3]) return;             // đoạn dài 0 sau khi tròn
    const k = a.join(","); if (seen.has(k)) return; seen.add(k);
    L.push(a.join(" "));
  });
  const js = "var PLG_GEO={W:" + R(W) + ",H:" + R(H) + ",nen:\"" + L.join(",") + "\"," +
    "o:\"" + o.map((c) => [c.d, c.c, R(c.x), R(c.y), R(c.w), R(c.h)].join(" ")).join(",") + "\"," +
    "day:\"" + dayNeo.map((d) => [d.d, R(d.lx), R(d.ly)].join(" ")).join(",") + "\"," +
    "khu:\"" + khu.map((k) => [k.lb, R(k.x), R(k.y), k.doc].join("|")).join(",") + "\"};";
  fs.writeFileSync(path.join(DIR, ".exports", "plg-geo.js"), js);
  console.log(`Snippet nhúng: .exports/plg-geo.js — ${(js.length / 1024).toFixed(1)}KB · ${L.length} đoạn (gộp từ ${nen.length})`);
}
