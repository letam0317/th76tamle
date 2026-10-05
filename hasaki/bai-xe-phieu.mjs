/**
 * bai-xe-phieu.mjs — làm theo QUYẾT ĐỊNH của bạn trên g-sheet "BÃI XE NCC" (luật BX-01 · mục 25 · 2%).
 *
 *  User 02/10/2026: "t quyết định trên đó và bạn canh quyết định từ tôi để chạy task > chuyển sang b1.1 luôn;
 *  đồng thời xem nếu cắt camera thì đã theo luật khoanh vùng di chuyển theo người chưa, có x2 này kia chưa".
 *
 *  Mỗi dòng «Lập phiếu (NV Hasaki)» + có Mã NV, chưa làm:
 *   1. CH-01: cùng NV đã có phiếu bãi xe trong 7 ngày → bỏ (tránh trừ đúp), ghi lý do.
 *   2. Dựng clip bằng _clip-noi.mjs (CAM-01/CAM-02): khúc không ai tua ×3, khoảng có người tốc độ thật + KHUNG ĐỎ BÁM NGƯỜI
 *      (nhãn = tên NV), khung vàng đứng yên = vùng bãi. Máy chỉ dò "người", KHÔNG nhận mặt. Kèm ảnh 12 khung của clip để soi.
 *   3. Lập phiếu WF591 bằng _tao-phieu-5s.mjs: ảnh = ảnh CHỈ camera (KHÔNG ảnh cổng bảo vệ), clip, mô tả.
 *   4. Đóng B1 → B1.1 cho mã NV bằng auto-complete-single-task.mjs (QLTT tự tra sổ).
 *   5. Ghi .exports/bai-xe-phieu.json → sheet-bai-xe.py --lam hiện «Máy đã làm» + link phiếu.
 *  Lập phiếu mà không đọc được mã phiếu (quá giờ…) → ghi "kiểm tay", KHÔNG tự gửi lại (tránh phiếu đôi).
 *
 *  Chạy: python sheet-bai-xe.py --doc && node bai-xe-phieu.mjs [--lam]   (không --lam = diễn tập, chỉ in việc sẽ làm)
 */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { spawnSync } from "node:child_process";
import { mayDuocChay } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EXP = path.join(DIR, ".exports");
const GOC = process.env.BAIXE_DIR || "C:/Users/lechitam/Videos/5S-bang-chung/bai-xe";
const SO = path.join(EXP, "bai-xe-phieu.json");
const THU = (process.argv.find((x) => x.startsWith("--thuClip=")) || "").split("=")[1];   // chỉ dựng clip thử 1 lượt, không lập phiếu
const LAM = process.argv.includes("--lam") || !!THU;
const QD_LAP = "Lập phiếu (NV Hasaki)";
const TYPE00 = "Không trữ hay trưng bày hàng hóa  công cụ  văn phòng phẩm ... chắn lối đi hoặc tại khu vực không được phép"; // mục 25 (chuỗi option đã bỏ dấu phẩy)
const VUNG = { AIBV: "Bãi xe bảo vệ/NCC (camera AI Bao Ve)", BXM: "Bãi xe NCC - đối tác (camera Bai Xe May)",
  PLR: "Khu phân loại rác - phòng cắt giấy (camera PHONG CAT GIAY 1)", KGC: "Kho giấy carton - phòng cắt giấy (camera PHONG CAT GIAY 2)" };
// khu phân loại giấy (02/10): QUY-ĐỊNH mục 8 "…thùng rác, rác phải phân loại…" (2%) — chuỗi option đã bỏ dấu phẩy, lấy nguyên từ board
const TYPE00_PL = "CCDC  VPP (pallet  xe soạn hàng  các loại rổ  thùng đóng đơn  thùng giấy tái chế  thùng rác  rác phải phân loại...)  vật dụng cá nhân (chai/ly nước uống  balo  túi ...) đặt đúng vị trí lưu trữ  trả về đúng nơi quy định sau khi sử dụng. Vệ sinh và dọn rác sạch sẽ sau khi sử dụng.";
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const docJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const giay = (s) => { const [h, m, x] = s.split(":").map(Number); return h * 3600 + m * 60 + x; };
const hms = (n) => [Math.floor(n / 3600), Math.floor(n / 60) % 60, Math.floor(n) % 60].map((v) => String(v).padStart(2, "0")).join(":");
const chay = (args, ms = 3600e3) => { const r = spawnSync("node", args, { cwd: DIR, encoding: "utf8", timeout: ms, maxBuffer: 64 << 20 }); return { code: r.status, out: (r.stdout || "") + (r.stderr || "") }; };

if (LAM && !mayDuocChay(log)) process.exit(0);
const KHOA = path.join(EXP, ".bai-xe-phieu.lock");
try { if (Date.now() - fs.statSync(KHOA).mtimeMs < 60 * 60e3) { log("⏸ đang có lượt khác (khoá)"); process.exit(0); } } catch { /* */ }
fs.writeFileSync(KHOA, String(process.pid));
const thoat = (c) => { try { fs.unlinkSync(KHOA); } catch { /* */ } process.exit(c); };

// quyết định: g-sheet + dashboard bang-591 (dashboard ghi sau thì thắng — sheet không có mốc giờ)
const QD = { ...docJ(path.join(EXP, "bai-xe-quyet-dinh.json"), {}) };
for (const [id, w] of Object.entries(docJ(path.join(EXP, "bang-591-quyet-dinh.json"), {}))) QD[id] = { qd: w.qd, ma: w.ma, nguoi: w.nguoi || null, gc: w.gc };
const so = docJ(SO, {});
const LUOT = {};
for (const d of fs.existsSync(GOC) ? fs.readdirSync(GOC) : []) {
  const k = docJ(path.join(GOC, d, "ket-qua.json"), null);
  for (const l of k?.luot || []) if (l.id) LUOT[l.id] = { ...l, ngay: k.ngay, thu: path.join(GOC, d) };
}
const viec = THU ? [[THU, { qd: QD_LAP, ma: "000000" }]] : Object.entries(QD).filter(([id, q]) => q.qd === QD_LAP && !["xong", "bỏ", "kiểm tay"].includes(so[id]?.trangThai));
log(`${Object.keys(QD).length} dòng trên sheet · ${viec.length} dòng cần lập phiếu`);
let doi = false;
const ghiSo = (id, v) => { so[id] = { ...(so[id] || {}), ...v, luc: new Date().toISOString() }; fs.writeFileSync(SO, JSON.stringify(so, null, 1)); doi = true; };

// ảnh bằng chứng có ghi chú "ai · vi phạm gì · ở đâu · lúc" (user 02/10: "ghi chú nv vi phạm là ai, vi phạm gì ở đâu") — vẽ bằng Edge headless
async function veBangChung(l, nhom, ra) {
  const b = (l.buocAnh || []).filter((x) => x.doNguoi && x.kieu).sort((p, q) => (q.hop || []).length - (p.hop || []).length)[0] || (l.buocAnh || []).find((x) => x.doNguoi) || (l.buocAnh || [])[0];
  if (!b) return null;
  const goc = path.join(l.thu, b.file.replace(".jpg", "-goc.jpg")), f = fs.existsSync(goc) ? goc : path.join(l.thu, b.file); if (!fs.existsSync(f)) return null;
  const { default: puppeteer } = await import("puppeteer-core");
  const br = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
  try {
    const p = await br.newPage();
    const data = "data:image/jpeg;base64," + fs.readFileSync(f).toString("base64");
    const out = await p.evaluate(async (o) => {
      const im = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = o.data; });
      const W = 1280, H = 720, cv = document.createElement("canvas"); const g = cv.getContext("2d");
      g.font = "22px Arial"; const ngat = (t) => { const tu = String(t).split(" "), ra = []; let d = ""; for (const w of tu) { if (g.measureText(d + w).width > W - 40 && d) { ra.push(d.trim()); d = ""; } d += w + " "; } if (d.trim()) ra.push(d.trim()); return ra; };
      const dong = o.dong.flatMap(ngat), cH = 46 + dong.length * 32 + 14; cv.width = W; cv.height = H + cH;
      g.drawImage(im, 0, 0, W, H);
      (o.hop || []).forEach((h, i) => { const ng = o.nguoi.find((x) => x.so === i + 1); if (!ng) return;
        const [x0, y0, x1, y1] = [h[0] * W, h[1] * H, h[2] * W, h[3] * H]; g.strokeStyle = "#e74c3c"; g.lineWidth = 6; g.setLineDash([]); g.strokeRect(x0 - 6, y0 - 6, x1 - x0 + 12, y1 - y0 + 12);
        g.font = "bold 28px Arial"; const t = ng.ten; const tw = g.measureText(t).width + 20, ty = Math.max(0, y0 - 46 - i * 42);   // so le theo thứ tự để 2 người sát nhau không chồng nhãn
        g.fillStyle = "#e74c3c"; g.fillRect(x0 - 6, ty, tw, 38); g.fillStyle = "#fff"; g.fillText(t, x0 + 4, ty + 28); });
      g.fillStyle = "#1f2937"; g.fillRect(0, H, W, cH); g.fillStyle = "#ffd54a"; g.font = "bold 26px Arial"; g.fillText(o.tieuDe, 18, H + 36);
      g.fillStyle = "#fff"; g.font = "22px Arial"; dong.forEach((d, i) => g.fillText(d, 18, H + 36 + 32 * (i + 1)));
      return cv.toDataURL("image/jpeg", 0.88);
    }, { data, hop: b.hop || [], nguoi: nhom.ds.map((x) => ({ so: x.so, ten: x.ten })),
      tieuDe: `${l.camera} · ${l.ngay} ${b.luc || l.gioNguoi || ""} · bằng chứng 5S`,
      dong: [`Ai: ${nhom.ds.map((x) => `${x.ten} (${x.ma})`).join(", ")}`, `Vi phạm: mục ${nhom.muc} — ${nhom.cau}`, `Ở đâu: ${nhom.viTri}`] });
    fs.writeFileSync(ra, Buffer.from(out.split(",")[1], "base64")); return ra;
  } finally { await br.close(); }
}

for (const [id, q] of viec) {
  const l = LUOT[id];
  if (!l) { log(`✗ ${id}: không còn dữ liệu lượt (quá 14 ngày?)`); if (LAM) ghiSo(id, { trangThai: "lỗi", loi: "không còn dữ liệu lượt" }); continue; }
  const PL = l.loai === "phan-loai";
  // ---- người vi phạm: bản 2 (dashboard) = từng "Người nghi" kèm hạng mục + vị trí; bản 1 (sheet) = 1 ô mã NV, có thể dán nguyên dòng ứng viên ----
  const tachMa = (s) => (String(s || "").match(/(?:^|[^\d:])(\d{5,7})(?![\d:])/) || [])[1] || String(s || "").trim();
  let ds = (q.nguoi && q.nguoi.length ? q.nguoi.filter((x) => !x.khong) : [{ so: 1, ma: tachMa(q.ma) }]).map((x) => ({ ...x, ma: tachMa(x.ma) }));
  if (!ds.length || ds.some((x) => !/^\d{4,7}$/.test(x.ma))) { log(`… ${id}: chờ bạn chọn đủ NV (đang là «${ds.map((x) => x.ma).join(",")}»)`); continue; }
  let db = []; try { db = JSON.parse(fs.readFileSync(path.join(DIR, ".cache-nv170.json"), "utf8")).data || []; } catch { /* */ }
  ds = ds.map((x) => ({ ...x, ten: x.ten || db.find((d) => String(d.code) === x.ma)?.staff_name || x.ma }));
  // gom theo HẠNG MỤC: mỗi hạng mục 1 phiếu (1 phiếu chỉ có 1 TYPE00); cùng hạng mục nhiều người → 1 phiếu, B1.1 «mỗi thành viên»
  const macDinh = PL ? { muc: 8, cau: "CCDC, VPP (pallet, xe soạn hàng, các loại rổ, thùng đóng đơn, thùng giấy tái chế, thùng rác, rác phải phân loại...), vật dụng cá nhân (chai/ly nước uống, balo, túi ...) đặt đúng vị trí lưu trữ, trả về đúng nơi quy định sau khi sử dụng. Vệ sinh và dọn rác sạch sẽ sau khi sử dụng.", type00: TYPE00_PL }
    : { muc: 25, cau: "Không trữ hay trưng bày hàng hóa, công cụ, văn phòng phẩm,... chắn lối đi hoặc tại khu vực không được phép", type00: TYPE00 };
  const nhomMap = new Map();
  for (const x of ds) { const muc = Number(x.muc) || macDinh.muc; const k = String(muc);
    if (!nhomMap.has(k)) nhomMap.set(k, { muc, cau: x.cau || (muc === macDinh.muc ? macDinh.cau : ""), viTri: x.viTri || VUNG[l.ma] || (PL ? "Khu phân loại giấy" : "Bãi xe NCC/bảo vệ"), ds: [] });
    nhomMap.get(k).ds.push(x); }
  const nhom = [...nhomMap.values()];
  // CH-01: 1 người · 1 lỗi chỉ ghi 1 lần / 7 ngày (so cả sổ cũ 1 mã lẫn sổ mới nhiều mã)
  if (!THU) for (const n of nhom) n.ds = n.ds.filter((x) => { const t = Object.entries(so).find(([k, v]) => k !== id && v.trangThai === "xong" && String(v.nv || "").split(",").includes(x.ma) && String(v.muc || macDinh.muc).split(",").includes(String(n.muc)) && Math.abs(new Date(v.ngayVP) - new Date(l.ngay)) < 7 * 864e5);
    if (t) log(`↷ ${id}: ${x.ten} (${x.ma}) đã có phiếu ${t[1].phieu} cùng mục ${n.muc} trong 7 ngày (CH-01) → bỏ người này`); return !t; });
  const nhomLam = nhom.filter((n) => n.ds.length);
  if (!nhomLam.length) { if (LAM) ghiSo(id, { trangThai: "bỏ", loi: "CH-01: mọi người đã có phiếu cùng lỗi trong 7 ngày" }); continue; }

  // ---- 1) clip có khung bám người + tua nhanh (dựng 1 lần, dùng cho mọi phiếu của lượt) ----
  const nguoiT = (l.khungNguoi || []).map(giay); const p0 = nguoiT.length ? Math.min(...nguoiT) : giay(l.gioNguoi || l.den), p1 = nguoiT.length ? Math.max(...nguoiT) : p0;
  const ng = (l.nguon || []).filter((n) => fs.existsSync(n.file));
  const nIdx = Math.max(0, ng.findIndex((n, i) => giay(n.bd) <= p0 && (i + 1 >= ng.length || giay(ng[i + 1].bd) > p0)));
  const src = ng[nIdx];
  if (!src) { log(`✗ ${id}: mất video nguồn`); if (LAM) ghiSo(id, { trangThai: "lỗi", loi: "mất video nguồn" }); continue; }
  let S = giay(src.bd), E = ng[nIdx + 1] ? giay(ng[nIdx + 1].bd) - 1 : giay(l.den);
  /* 05/10 user (phiếu 14050115: chờ 4,5′ tua ×3 mới tới người): lỗi HÀNH VI TỨC THỜI (gửi xe, đổ rác) — clip chỉ ôm
     lúc có người: vào khung −8 s → rời khung +8 s (luật CAM-07). Không dựng đoạn chờ trước/sau. */
  { const ds0 = (l.doanNguoi?.length ? l.doanNguoi.map(([x, y]) => [giay(x), giay(y)]) : [[p0, p1]]);
    S = Math.max(S, Math.min(...ds0.map((d) => d[0])) - 8); E = Math.min(E, Math.max(...ds0.map((d) => d[1])) + 8); }
  const [x0, y0, x1, y1] = l.roiPx; const roi = [x0, y0, x1 - x0, y1 - y0];
  // CAM-01/02: chỉ KHOẢNG CÓ NGƯỜI chạy tốc độ thật + khung bám người (−4 s…+10 s, nối khi cách <30 s); khúc không ai tua ×3
  const kn = (l.doanNguoi?.length ? l.doanNguoi.map(([x, y]) => [giay(x), giay(y)]) : [[p0, p1]])
    .map(([x, y]) => [Math.max(S, x - 4), Math.min(E, y + 10)]).filter(([x, y]) => y > x)
    .reduce((m, d) => { const z = m[m.length - 1]; if (z && d[0] - z[1] < 30) z[1] = Math.max(z[1], d[1]); else m.push([...d]); return m; }, []);
  const tenNV = ds.map((x) => `${x.ten} (${x.ma})`).join(", ");
  const nhanVP = nhomLam.map((n) => `mục ${n.muc}`).join(" + ");
  const doan = []; let c = S;
  const tua = (x, y, chu) => { if (y - x >= 12) doan.push({ n: "v", tu: hms(x), den: hms(y), toc: 3, khung: roi, chu }); else if (y - x >= 1) doan.push({ n: "v", tu: hms(x), den: hms(y), toc: 1, khung: roi, chu: chu.replace(/ \(tua ×3\)/, "") }); };
  for (const [x, y] of kn) {
    tua(c, x, c === S ? (PL ? "Khu phân loại (khung vàng)" : "Bãi xe NCC/bảo vệ (khung vàng)") : "Khúc giữa (tua ×3)");
    doan.push({ n: "v", tu: hms(x), den: hms(y), toc: 1, khung: roi, theo: roi, nhan: tenNV, chu: `${tenNV} · ${nhomLam[0].viTri}` });   // 05/10: bỏ mã mục + chú giải kỹ thuật (chữ gửi NV phải gọn)
    c = y;
  }
  tua(c, E, PL ? "Sau: người đã rời khu (tua ×3)" : "Sau: xe đứng lại trong bãi (tua ×3)");
  const a = kn.length ? kn[0][0] : p0;
  const clip = path.join(l.thu, `${id}-clip.webm`);
  const cfgClip = { ra: clip, tieuDe: `${tenNV} · ${nhomLam[0].viTri} · ${l.ngay.split("-").reverse().join("/")} ${hms(a).slice(0, 5)}`, nguon: { v: { file: src.file, bd: src.bd } }, doan };
  log(`▶ ${id}: ${tenNV} · ${nhanVP} · clip ${doan.map((d) => `${d.tu.slice(3)}–${d.den.slice(3)}×${d.toc}`).join(" | ")}`);
  if (!LAM) continue;
  const fClip = path.join(EXP, `.bai-xe-tam/clip-${id}.json`); fs.writeFileSync(fClip, JSON.stringify(cfgClip, null, 1));
  // RAM: không dựng 2 clip cùng lúc (new-folder-47 02/10: máy từng bị dừng vì thiếu bộ nhớ) — khoá chung .dung-clip.lock
  const KC = path.join(EXP, ".dung-clip.lock"); for (let i = 0; i < 60 && fs.existsSync(KC) && Date.now() - fs.statSync(KC).mtimeMs < 40 * 60e3; i++) await new Promise((r) => setTimeout(r, 30e3));
  fs.writeFileSync(KC, "bai-xe-phieu " + id);
  const rc = chay(["_clip-noi.mjs", fClip], 40 * 60e3); try { fs.unlinkSync(KC); } catch { /* */ }
  if (!fs.existsSync(clip) || fs.statSync(clip).size < 50e3) { log(`✗ ${id}: dựng clip trượt\n${rc.out.slice(-400)}`); ghiSo(id, { trangThai: "lỗi", loi: "dựng clip trượt" }); continue; }
  if (THU) { log(`✓ clip thử: ${clip} (${(fs.statSync(clip).size / 1048576).toFixed(1)} MB) — không lập phiếu`); thoat(0); }

  // ---- 2) mỗi hạng mục 1 phiếu: ảnh bằng chứng ghi "ai · vi phạm gì · ở đâu", clip, mô tả; rồi B1 → B1.1 ----
  const phieu = [], nvXong = [], mucXong = []; let loi = "";
  for (const n of nhomLam) {
    const anhBC = await veBangChung(l, n, path.join(l.thu, `${id}-m${n.muc}-bang-chung.jpg`)).catch((e) => { log("⚠ vẽ ảnh bằng chứng lỗi:", e.message); return null; });
    const type00 = n.muc === macDinh.muc && !n.cau ? macDinh.type00 : String(n.cau || macDinh.cau).replace(/,/g, " ");   // option TYPE00 = câu QUY-ĐỊNH đã bỏ dấu phẩy
    const cfgP = { ngay: `${l.ngay} ${l.gioNguoi || hms(p0)}`, bin: n.viTri, type00, tenNgan: String(n.cau || "").split(/[,.(:]/)[0].trim().slice(0, 50) || (PL ? "Rác không phân loại" : "Gửi xe sai bãi"),
      anh: [anhBC || path.join(l.thu, l.anhCam)], video: [clip],
      /* 05/10 user: mô tả CHỈ thông tin người vi phạm cần để xác minh — không mã mục, không tên camera, không cách dựng clip, không ghi chú nội bộ */
      moTa: [`Ai: ${n.ds.map((x) => `${x.ten} (${x.ma})`).join(", ")}.`,
        `Vi phạm: ${n.cau || macDinh.cau}.`,
        `Ở đâu, lúc nào: ${String(n.viTri).replace(/\s*\(camera[^)]*\)/i, "")} · ${l.ngay.split("-").reverse().join("/")} ${l.gioNguoi || ""}.`.replace(/ \.$/, "."),
        `Bằng chứng: ảnh + clip đính kèm.`] };
    const fP = path.join(EXP, `.bai-xe-tam/phieu-${id}-m${n.muc}.json`); fs.writeFileSync(fP, JSON.stringify(cfgP, null, 1));
    const rp = chay(["_tao-phieu-5s.mjs", fP, "--lam"], 25 * 60e3);
    const tid = (rp.out.match(/✓ phiếu (\d+)/) || [])[1];
    if (!tid) { log(`✗ ${id} mục ${n.muc}: lập phiếu không đọc được mã — KIỂM board trước khi làm lại\n${rp.out.slice(-400)}`); loi = "lập phiếu không rõ kết quả — kiểm board"; break; }
    phieu.push(tid); log(`✓ ${id} mục ${n.muc}: phiếu ${tid}`);
    ghiSo(id, { trangThai: "đã lập phiếu", phieu: phieu.join(","), nv: ds.map((x) => x.ma).join(","), muc: nhomLam.map((x) => x.muc).join(","), ngayVP: l.ngay });
    let ok = false, out = "";
    for (let k = 0; k < 4 && !ok; k++) {
      await new Promise((r) => setTimeout(r, 20e3));
      const r = chay(["auto-complete-single-task.mjs", `--task=${tid}`, `--nv=${n.ds.map((x) => x.ma).join(",")}`, "--lam"], 5 * 60e3); out = r.out;
      ok = r.code === 0 && !/✗/.test(r.out);
      if (r.code === 3) break;   // không có NV trong danh bạ → không thử lại
    }
    if (!ok) { loi = "đóng B1 phiếu " + tid + ": " + (out.match(/✗[^\n]*/) || ["trượt"])[0].slice(0, 140); log(`✗ ${id}: ${loi}`); break; }
    nvXong.push(...n.ds.map((x) => x.ma)); mucXong.push(n.muc); log(`✓ ${id}: phiếu ${tid} B1 → B1.1 ${n.ds.map((x) => x.ma).join(",")}`);
  }
  if (loi) ghiSo(id, { trangThai: /kiểm board/.test(loi) ? "kiểm tay" : "lỗi B1", loi });
  else ghiSo(id, { trangThai: "xong", phieu: phieu.join(","), nv: nvXong.join(","), muc: mucXong.join(","), ngayVP: l.ngay });
}

if (doi && LAM) { const r = spawnSync("python", ["sheet-bai-xe.py", "--lam"], { cwd: DIR, encoding: "utf8", timeout: 10 * 60e3 }); log((r.stdout || "").trim().split("\n").slice(-2).join(" · ")); }
thoat(0);
