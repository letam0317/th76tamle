/**
 * kho170-sodo-build.mjs — dựng SƠ ĐỒ MẶT BẰNG KHO 170 từ hình học THẬT của bản vẽ AutoCAD.
 *
 * Nguồn: DCMTG1.dwg (25/08/2026) — bản vẽ gốc của kho, đơn vị MÉT. Trong bản vẽ có 2 mặt bằng
 * nằm cạnh nhau trên trục X: kho 170 ở X 40…160, nhà máy Garment (F0-KHO) ở X 220…280.
 * Script này CHỈ lấy phần kho 170; phần nhà máy đã có sơ đồ riêng (mtg-sodo-build.mjs).
 *
 * Vì sao bê hình học thật thay vì vẽ lưới HTML gần đúng: sơ đồ trong tab Planogram đang giả định
 * A1 = 16 dãy × 10 kệ đều tăm tắp. Bản vẽ cho thấy lưới đó KHÔNG đều (lối đi cắt ngang giữa tủ
 * 05 và 06, A2 thiếu tủ 05, dãy 517-522 lệch hẳn sang phải) — vẽ đúng thì người đứng trong kho
 * mới đối chiếu được sơ đồ với chỗ mình đang đứng.
 *
 * 4 bước:
 *   1. Đọc DXF (xuất từ DWG bằng hasaki/doc-ban-ve-dwg.mjs — cần AutoCAD trên máy).
 *   2. Cắt vùng kho 170, đổi sang hệ toạ độ màn hình (DXF y hướng LÊN, SVG y hướng XUỐNG).
 *   3. Dò hộp từng ô kệ bằng tia 4 phía trên tập đoạn thẳng — hộp đến từ chính nét vẽ.
 *   4. Gán mã vị trí theo LƯỚI NHÃN của bản vẽ: nhãn dãy (501…522) nằm thành hàng tiêu đề phía
 *      trên, nhãn tủ (501-01…501-10) nằm thành cột bên trái ⇒ ô nào rơi vào cột X của dãy nào và
 *      hàng Y của tủ nào thì mang mã đó. Ô không khớp lưới được giữ lại dạng "nền", không bịa mã.
 *
 * Chạy:  node hasaki/kho170-sodo-build.mjs <duong-dan.dxf|.dwg> [--svg]
 * Xuất:  hasaki/.exports/kho170-sodo.json  { W, H, nen[], chu[], o[], khu[] }
 *        (--svg xuất thêm .exports/kho170-sodo.svg để soi bằng mắt)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const RA = path.join(DIR, ".exports");

/* Vùng kho 170 trong bản vẽ (đơn vị mét, hệ toạ độ gốc của DXF).
   Dãy kệ nhà máy nằm ở X 225…265, nhưng khu chức năng của nhà máy (KHU PO ĐỒNG KIỂM, KHU PO
   CHỜ QC, KHU TRỮ VẢI ĐẦU KHÚC, Phòng kiểm soát kho) lại lấn sang X 130…165 ở phần Y ÂM —
   nên phải chặn cả hai chiều, không chỉ cắt theo X. Kho 170 nằm trọn ở Y > 5. */
const VUNG = { x0: 30, x1: 200, y0: 5, y1: 80 };
const PAD = 2;                       // lề quanh mặt bằng, mét
/* Nét ngắn hơn ngưỡng này là nội thất/trang trí (bàn ghế, xe nâng, hình người trong bản vẽ) —
   bỏ đi thì sơ đồ nhẹ hơn ~50 lần mà tường + khung kệ vẫn đủ để định vị. */
const NET_TOI_THIEU = Number((process.argv.find((a) => a.startsWith("--net=")) || "--net=1.2").slice(6));

/* ---------- 1) đọc DXF ---------- */
function docDxf(file) {
  const d = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const doan = [], chu = [];
  let cur = null;

  const chot = () => {
    if (!cur) return;
    if (cur.t === "LINE" && cur.xs.length >= 2)
      doan.push({ x1: cur.xs[0], y1: cur.ys[0], x2: cur.xs[1], y2: cur.ys[1], lay: cur.layer });
    else if ((cur.t === "LWPOLYLINE" || cur.t === "POLYLINE") && cur.xs.length >= 2) {
      for (let i = 1; i < cur.xs.length; i++)
        doan.push({ x1: cur.xs[i - 1], y1: cur.ys[i - 1], x2: cur.xs[i], y2: cur.ys[i], lay: cur.layer });
      if (cur.kin && cur.xs.length > 2)
        doan.push({ x1: cur.xs.at(-1), y1: cur.ys.at(-1), x2: cur.xs[0], y2: cur.ys[0], lay: cur.layer });
    } else if ((cur.t === "TEXT" || cur.t === "MTEXT") && cur.s.trim())
      chu.push({ s: cur.s, x: cur.xs[0], y: cur.ys[0], cao: cur.cao || 0.3, xoay: cur.xoay || 0, layer: cur.layer });
    cur = null;
  };

  for (let i = 0; i + 1 < d.length; i += 2) {
    const ma = d[i].trim(), gt = d[i + 1];
    if (ma === "0") {
      chot();
      if (["LINE", "LWPOLYLINE", "POLYLINE", "TEXT", "MTEXT"].includes(gt))
        cur = { t: gt, xs: [], ys: [], s: "", layer: "", cao: 0, xoay: 0, kin: false };
      continue;
    }
    if (!cur) continue;
    if (ma === "8") cur.layer = gt;
    else if (ma === "10" || ma === "11") cur.xs.push(+gt);
    else if (ma === "20" || ma === "21") cur.ys.push(+gt);
    else if (ma === "1" || ma === "3") cur.s += gt;
    else if (ma === "40" && !cur.cao) cur.cao = +gt;
    else if (ma === "50") cur.xoay = +gt;
    else if (ma === "70" && cur.t === "LWPOLYLINE") cur.kin = (+gt & 1) === 1;
  }
  chot();
  return { doan, chu };
}

/* Gỡ mã định dạng nhúng trong chuỗi MTEXT (\fArial|b1|i0;  \pxqc;  \P …) */
function bocChu(s) {
  return s.replace(/\\P/g, " ").replace(/\^J/g, " ").replace(/\\f[^;]*;/g, "")
    .replace(/\\[AaCcFfHhLlOoQqTtWwpe][^;\\]*;/g, "").replace(/\\[LlOoKkNn]/g, "")
    .replace(/[{}]/g, "").replace(/\\~/g, " ").replace(/\\\\/g, "")
    .replace(/\s+/g, " ").trim();
}

/* ---------- vào việc ---------- */
let src = process.argv.find((a) => !a.startsWith("--") && /\.(dxf|dwg)$/i.test(a));
if (!src) { console.error("Thiếu đường dẫn .dxf (hoặc .dwg).\n  node hasaki/kho170-sodo-build.mjs <file> [--svg]"); process.exit(2); }
if (/\.dwg$/i.test(src)) {
  console.log("• Là .dwg — gọi doc-ban-ve-dwg.mjs để xuất DXF trước…");
  execFileSync(process.execPath, [path.join(DIR, "doc-ban-ve-dwg.mjs"), src, "--ra", RA, "--giu-dxf"], { stdio: "inherit" });
  src = path.join(RA, path.basename(src).replace(/\.dwg$/i, ".dxf"));
}
fs.mkdirSync(RA, { recursive: true });

const raw = docDxf(src);
const trong = (x, y) => x >= VUNG.x0 && x <= VUNG.x1 && y >= VUNG.y0 && y <= VUNG.y1;
/* Layer khung bản in (khung tên, dấu mốc) không thuộc mặt bằng — bỏ khi XUẤT nền.
   KHÔNG bỏ sớm ở đây: layer Defpoints có nét khép cạnh 1 ô PACK, lọc trước khi dò hộp là mất ô. */
const LAYER_BO = new Set(["20 khungbanve", "Title Block", "Defpoints"]);
const doan0 = raw.doan.filter((s) => trong(s.x1, s.y1) && trong(s.x2, s.y2));
const chu0 = raw.chu.map((t) => ({ ...t, s: bocChu(t.s) })).filter((t) => t.s && trong(t.x, t.y));
console.log(`Đọc: ${raw.doan.length} đoạn / ${raw.chu.length} nhãn → trong vùng kho 170: ${doan0.length} đoạn / ${chu0.length} nhãn`);
if (!doan0.length) { console.error("Không có nét vẽ nào trong vùng — xem lại hằng VUNG."); process.exit(1); }

/* ---------- 2) sang hệ màn hình ---------- */
let X0 = 1e9, Y0 = 1e9, X1 = -1e9, Y1 = -1e9;
const bb = (x, y) => { X0 = Math.min(X0, x); Y0 = Math.min(Y0, y); X1 = Math.max(X1, x); Y1 = Math.max(Y1, y); };
doan0.forEach((s) => { bb(s.x1, s.y1); bb(s.x2, s.y2); });
chu0.forEach((t) => bb(t.x, t.y));
const MX = (x) => +(x - X0 + PAD).toFixed(3);
const MY = (y) => +(Y1 - y + PAD).toFixed(3);          // lật trục y
const W = +(X1 - X0 + PAD * 2).toFixed(2), H = +(Y1 - Y0 + PAD * 2).toFixed(2);

const nen = doan0.map((s) => ({ x1: MX(s.x1), y1: MY(s.y1), x2: MX(s.x2), y2: MY(s.y2), lay: s.lay }));
const chu = chu0.map((t) => ({ s: t.s, x: MX(t.x), y: MY(t.y), c: +t.cao.toFixed(2) }));
console.log(`Khổ hiển thị ${W} × ${H} m`);

/* ---------- 3) dò hộp ô kệ ---------- */
const EPS = 0.02, T = 0.03;                              // mét: nét coi là thẳng / dung sai chạm
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
  return { x: +L.toFixed(3), y: +U.toFixed(3), w: +(R - L).toFixed(3), h: +(D - U).toFixed(3) };
}

/* 3a) Ô KHU LÀM VIỆC — nhận ra bằng CHỮ BÊN TRONG ô: pallet / PICK / PACK.
   Đây là các ô bản vẽ có ghi công năng: chỗ đặt pallet hai bên băng chuyền, chỗ đỗ xe soạn
   hàng (PICK) và bàn đóng gói (PACK). */
const LOAI = { pallet: "pallet", PICK: "pick", PACK: "pack" };
const oVe = [];
chu.forEach((t) => {
  const k = LOAI[t.s]; if (!k) return;
  const b = hop(t.x, t.y); if (!b) return;
  if (b.w > 12 || b.h > 12 || b.w < 0.15 || b.h < 0.15) return;   // hộp quá to = bắt nhầm cả gian nhà
  oVe.push({ k, ...b });
});
console.log(`Ô công năng (chữ trong ô): ${oVe.length} — pallet ${oVe.filter((o) => o.k === "pallet").length} · pick ${oVe.filter((o) => o.k === "pick").length} · pack ${oVe.filter((o) => o.k === "pack").length}`);

/* ---------- 4) ô kệ A1/A2 — dựng từ LƯỚI NHÃN ---------- */
/* ĐÃ THỬ VÀ BÁC: dò hộp bằng tia như khu công năng KHÔNG dùng được ở đây, vì bản vẽ chỉ vẽ
   ĐƯỜNG BAO cả khối kệ chứ không kẻ ô từng tủ (bắn tia ra hộp 26×36 m = trọn khối).
   Cách đúng: bản vẽ đánh nhãn kiểu bảng — nhãn dãy ("501".."522") xếp thành hàng tiêu đề phía
   trên, mỗi nhãn nằm ĐÚNG trục X của dãy đó; nhãn tủ ("501-01".."501-10") xếp thành cột bên
   trái, mỗi nhãn nằm ĐÚNG trục Y của tủ đó. Ô = giao của hai trục, bề rộng/cao lấy BƯỚC NHỎ
   NHẤT giữa các nhãn kề nhau. Lấy bước nhỏ nhất (không lấy khoảng cách tới nhãn kế) để lối đi
   hiện ra thành khoảng trống thật thay vì bị ô nuốt mất.
   Kiểm chứng số đo với SO-DO-KHO-170.md: A1 bước dãy 1,18 m, bước tủ 2,39 m, riêng tủ 05→06
   cách 5,68 m ⇒ lối đi ngang 3,29 m (tài liệu đo 3,30 m) — khớp. */
const nhanKhoi = chu.filter((t) => /^A[12]-?$/.test(t.s)).map((t) => ({ k: t.s.replace(/-$/, ""), x: t.x, y: t.y }));
const nhanDay = chu.filter((t) => /^\d{3}$/.test(t.s)).map((t) => ({ d: t.s, x: t.x, y: t.y }));
const nhanTu = chu.filter((t) => /^\d{3}-\d{2}$/.test(t.s)).map((t) => ({ tu: t.s.slice(4), x: t.x, y: t.y }));
console.log(`Nhãn lưới: khối ${nhanKhoi.length} · dãy ${nhanDay.length} · tủ ${nhanTu.length}`);

/* Mỗi khối (A1, A2) có bộ nhãn riêng. Gán nhãn về khối theo X: khối nào có nhãn khối gần
   nhất VỀ PHÍA TRÁI thì nhãn thuộc khối đó. */
nhanKhoi.sort((a, b) => a.x - b.x);
function khoiCua(x) {
  let ten = nhanKhoi[0]?.k || "";
  for (const k of nhanKhoi) if (x >= k.x - 2) ten = k.k;
  return ten;
}
/* Cột nhãn tủ dùng cho 1 dãy = cột nhãn tủ gần nhất về phía TRÁI của dãy đó (bản vẽ đặt
   nhiều cột nhãn tủ: một cột cho A1, một cho A2, thêm cột cho cụm 517-521 và 522). */
const cotTu = {};
nhanTu.forEach((t) => { const c = t.x.toFixed(1); (cotTu[c] = cotTu[c] || []).push(t); });
const dsCot = Object.keys(cotTu).map(Number).sort((a, b) => a - b);
function tuCuaDay(x) {
  let c = dsCot[0];
  for (const v of dsCot) if (x >= v - 1.5) c = v;
  return cotTu[c.toFixed(1)] || [];
}

/* Bước nhỏ nhất giữa các mốc liền kề trên một trục (bỏ qua mốc trùng chỗ) */
function buoc(ds) {
  const v = [...new Set(ds.map((n) => +n.toFixed(2)))].sort((a, b) => a - b);
  let m = Infinity;
  for (let i = 1; i < v.length; i++) m = Math.min(m, v[i] - v[i - 1]);
  return Number.isFinite(m) ? m : 1;
}
/* Nhóm nhãn dãy theo cột nhãn tủ mà nó dùng ⇒ mỗi nhóm là một KHỐI KỆ riêng, tính bước riêng
   (A1 dày 1,18 m/dãy, cụm 517-521 thưa 2,3 m/dãy — dùng chung một bước là méo sơ đồ). */
const nhom = new Map();
for (const d of nhanDay) {
  const ds = tuCuaDay(d.x); if (!ds.length) continue;
  const key = ds[0].x.toFixed(1);
  if (!nhom.has(key)) nhom.set(key, { tu: ds, day: [] });
  nhom.get(key).day.push(d);
}
const oKe = [];
for (const [, g] of nhom) {
  const bw = buoc(g.day.map((d) => d.x)), bh = buoc(g.tu.map((t) => t.y));
  for (const d of g.day) {
    const khoi = khoiCua(d.x);
    for (const t of g.tu)
      oKe.push({
        k: "ke", khoi, day: d.d, tu: t.tu, loc: `F0-${khoi}-${d.d}-${t.tu}`,
        x: +(d.x - bw / 2).toFixed(3), y: +(t.y - bh / 2).toFixed(3), w: +bw.toFixed(3), h: +bh.toFixed(3)
      });
  }
}
const oKe2 = oKe;
const theoKhoi = {};
oKe2.forEach((v) => { theoKhoi[v.khoi] = (theoKhoi[v.khoi] || 0) + 1; });
console.log(`Ô kệ dựng theo lưới nhãn: ${oKe2.length} (${Object.entries(theoKhoi).map(([k, v]) => k + "=" + v).join(" · ")})`);
[...nhom].forEach(([k, g]) => console.log(`   khối tại cột nhãn X=${k}: ${g.day.length} dãy (${g.day[0].d}…${g.day.at(-1).d}) × ${g.tu.length} tủ · bước ${buoc(g.day.map((d) => d.x)).toFixed(2)} × ${buoc(g.tu.map((t) => t.y)).toFixed(2)} m`));

const o = [...oKe2, ...oVe].map((v) => ({
  k: v.k, x: v.x, y: v.y, w: v.w, h: v.h,
  ...(v.loc ? { loc: v.loc, khoi: v.khoi, day: v.day, tu: v.tu } : {})
}));

/* Khu chức năng = nhãn chữ dài (tên phòng/khu) để vẽ chú thích trên sơ đồ */
/* Khu chức năng = nhãn chữ dài. Bản vẽ giấy in được cả cụm nhãn chen nhau vì khổ A0; trên màn
   hình 900px thì chúng đè lên nhau không đọc nổi — giữ nhãn DÀI HƠN khi hai nhãn cách < 2,5 m. */
const khu = chu.filter((t) => /[A-Za-zÀ-ỹ]/.test(t.s) && t.s.length > 3 && !LOAI[t.s] && !/^\d/.test(t.s))
  .map((t) => ({ s: t.s, x: t.x, y: t.y }))
  .sort((a, b) => b.s.length - a.s.length)
  .filter((t, i, ds) => !ds.some((u, j) => j < i && Math.abs(u.x - t.x) < 2.5 && Math.abs(u.y - t.y) < 1.2));

/* Nét nền xuất ra CHỈ giữ đoạn đủ dài — hộp ô đã dò xong bằng tập nét đầy đủ ở trên, nên bỏ
   nét vụn không làm mất ô nào, chỉ bỏ bàn ghế/xe nâng/hình người vẽ trang trí. */
const r2 = (n) => +n.toFixed(2);       // 1 cm là đủ: sơ đồ vẽ ở tỉ lệ vài px/m
const nenGon = nen.filter((s) => !LAYER_BO.has(s.lay) && Math.hypot(s.x2 - s.x1, s.y2 - s.y1) >= NET_TOI_THIEU)
  .map((s) => [r2(s.x1), r2(s.y1), r2(s.x2), r2(s.y2)]);   // mảng 4 số gọn hơn object 4 khoá
console.log(`Nét nền: ${nen.length} → ${nenGon.length} (giữ đoạn ≥ ${NET_TOI_THIEU} m)`);

const oGon = o.map((v) => ({ k: v.k, x: r2(v.x), y: r2(v.y), w: r2(v.w), h: r2(v.h), ...(v.loc ? { loc: v.loc } : {}) }));
const khuGon = khu.map((t) => ({ s: t.s, x: r2(t.x), y: r2(t.y) }));
const out = { nguon: path.basename(src), ngay: new Date().toISOString().slice(0, 10), W, H, nen: nenGon, o: oGon, khu: khuGon };
fs.writeFileSync(path.join(RA, "kho170-sodo.json"), JSON.stringify(out), "utf8");
console.log(`→ ${path.join(RA, "kho170-sodo.json")} (${(fs.statSync(path.join(RA, "kho170-sodo.json")).size / 1024).toFixed(0)} KB)`);

/* ---------- soi bằng mắt ---------- */
if (process.argv.includes("--svg")) {
  const mau = { ke: "#c7d2fe", pallet: "#93c5fd", pick: "#86efac", pack: "#fcd34d" };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${Math.round(W * 12)}" height="${Math.round(H * 12)}">` +
    `<rect width="${W}" height="${H}" fill="#fff"/>` +
    `<g stroke="#94a3b8" stroke-width="0.03" fill="none">` +
    nenGon.map((s) => `<path d="M${s[0]} ${s[1]}L${s[2]} ${s[3]}"/>`).join("") + `</g>` +
    oGon.map((v) => `<rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" fill="${mau[v.k]}" fill-opacity="${v.loc ? 0.85 : 0.35}" stroke="#334155" stroke-width="0.015"/>`).join("") +
    khuGon.map((t) => `<text x="${t.x}" y="${t.y}" font-size="0.5" fill="#0f172a">${t.s.replace(/[<&]/g, "")}</text>`).join("") +
    `</svg>`;
  fs.writeFileSync(path.join(RA, "kho170-sodo.svg"), svg, "utf8");
  console.log(`→ ${path.join(RA, "kho170-sodo.svg")}`);
}
