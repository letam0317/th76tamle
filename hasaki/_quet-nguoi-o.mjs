/* 05/10/2026 — khuôn BAN-VAN-PHONG bước 3, KHÔNG AI: quét NGƯỜI dừng ở 1 vùng (bàn/ô) trong khoảng thời gian dài.
 * Vật nhỏ (ly nước) không thấy được ở góc xa, nhưng người thì to → lấy 1 khung mỗi N phút, cắt vùng ROI (+ đệm),
 * nền = TRUNG VỊ từng điểm ảnh của mọi khung cùng chế độ (ngày màu / đêm hồng ngoại) ⇒ người qua lại không lọt vào nền;
 * điểm = chênh trung bình so với nền; khung điểm cao = có người/thay đổi → ghép lưới để soi + tinh chỉnh quanh mốc.
 * node _quet-nguoi-o.mjs <khoá ROI ban-do-camera-o.json> <từ ISO> <đến ISO> [--buoc=15] [--dem=40]
 *   → .exports/quet-nguoi/<khoá>/<MMDDHHmm>.jpg + bang.json + luoi-cao.jpg (khung điểm cao nhất, theo giờ) */
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process"; import sharp from "sharp";
const [KHOA, TU, DEN] = process.argv.slice(2);
const opt = (k, d) => Number((process.argv.find((x) => x.startsWith("--" + k + "=")) || "").split("=")[1] || d);
const BUOC = opt("buoc", 15) * 60e3, DEM = opt("dem", 40);
const BD = JSON.parse(fs.readFileSync("ban-do-camera-o.json", "utf8")); const R = BD.roi[KHOA];
if (!R) { console.log("✗ chưa có ROI", KHOA); process.exit(1); }
const [host, kenh] = R.kenh.split("/"); const [rx, ry, rw, rh] = R.khung;   // toạ độ khung 1280×720
const vx = Math.max(0, rx - DEM) / 1280, vy = Math.max(0, ry - DEM) / 720, vw = (rw + 2 * DEM) / 1280, vh = (rh + 2 * DEM) / 720;
const DIR = path.join(".exports", "quet-nguoi", KHOA.replace(/[|]/g, "_")); fs.mkdirSync(DIR, { recursive: true });
const BJ = path.join(DIR, "bang.json"); const bang = fs.existsSync(BJ) ? JSON.parse(fs.readFileSync(BJ, "utf8")) : {};
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const vn = (ms) => new Date(ms + 7 * 3600e3).toISOString().slice(0, 19);
const t0 = new Date(TU + "+07:00").getTime(), t1 = new Date(DEN + "+07:00").getTime();
let loiLienTiep = 0;
for (let t = t0; t <= t1; t += BUOC) {
  const iso = vn(t), n = iso.replace(/[-:T]/g, "").slice(4, 12), jpg = path.join(DIR, n + ".jpg");
  if (fs.existsSync(jpg) || bang[n]?.khongHinh) continue;   // chạy lại thì nối tiếp
  const mp4 = path.join(DIR, "_tam.mp4");
  try { execFileSync(process.execPath, ["_cat-doan.mjs", host, kenh, iso, "6", mp4], { windowsHide: true, stdio: "ignore", timeout: 240000 }); loiLienTiep = 0; }
  catch (e) { if (e.status === 3) { console.log("✗ token top-review hết hạn — chạy node camera-a8.mjs rồi chạy lại (nối tiếp)"); process.exit(3); }
    bang[n] = { khongHinh: 1 }; fs.writeFileSync(BJ, JSON.stringify(bang)); if (++loiLienTiep > 20) { console.log("✗ 20 mốc liền không có hình — dừng"); break; } await ngu(2000); continue; }
  try { execFileSync(process.execPath, ["_khung-vung.mjs", path.resolve(mp4), path.resolve(path.join(DIR, n + "_k")), [vx, vy, vw, vh].join(","), "2"], { windowsHide: true, stdio: "ignore", timeout: 120000 });
    fs.renameSync(path.join(DIR, n + "_k_0.jpg"), jpg); } catch { bang[n] = { khongHinh: 1 }; }
  fs.writeFileSync(BJ, JSON.stringify(bang)); process.stdout.write(n + " "); await ngu(2000);
}
try { fs.unlinkSync(path.join(DIR, "_tam.mp4")); } catch { }
/* chấm điểm: tách chế độ theo độ màu, nền = trung vị */
const ds = fs.readdirSync(DIR).filter((f) => /^\d{8}\.jpg$/.test(f)).sort();
const S = 48, doc = async (f) => { const im = sharp(path.join(DIR, f)); const c = await im.clone().resize(40, 30, { fit: "fill" }).removeAlpha().raw().toBuffer();
  let m = 0; for (let i = 0; i < c.length; i += 3) m += Math.abs(c[i] - c[i + 1]) + Math.abs(c[i + 1] - c[i + 2]);
  const g = await im.resize(S, S, { fit: "fill" }).greyscale().raw().toBuffer(); let a = 0; for (const v of g) a += v; a /= g.length; let sd = 0; for (const v of g) sd += (v - a) ** 2; sd = Math.sqrt(sd / g.length) || 1;
  return { f, dem: m / (c.length / 3) < 6, g: Float32Array.from(g, (v) => 128 + ((v - a) / sd) * 40) }; };
const K = []; for (const f of ds) K.push(await doc(f));
for (const che of [false, true]) {
  const nhom = K.filter((k) => k.dem === che); if (nhom.length < 3) continue;
  const nen = new Float32Array(S * S); for (let i = 0; i < S * S; i++) { const v = nhom.map((k) => k.g[i]).sort((a, b) => a - b); nen[i] = v[v.length >> 1]; }
  for (const k of nhom) { let s = 0; for (let i = 0; i < S * S; i++) s += Math.abs(k.g[i] - nen[i]); k.diem = +(s / (S * S)).toFixed(1); }
}
for (const k of K) bang[k.f.slice(0, 8)] = { ...(bang[k.f.slice(0, 8)] || {}), diem: k.diem, dem: k.dem ? 1 : 0 };
fs.writeFileSync(BJ, JSON.stringify(bang, null, 1));
const diem = K.filter((k) => k.diem != null).map((k) => k.diem).sort((a, b) => a - b); const tv = diem[diem.length >> 1] || 0;
const cao = K.filter((k) => k.diem != null && k.diem > tv * 1.6 + 3).sort((a, b) => a.f.localeCompare(b.f));
console.log("\n" + K.length, "khung · trung vị điểm", tv, "· khung cao (có người/thay đổi):", cao.length);
for (const k of cao) console.log("  ", k.f.replace(/^(\d\d)(\d\d)(\d\d)(\d\d).*/, "$2/$1 $3:$4"), "điểm", k.diem, k.dem ? "(đêm)" : "");
if (cao.length) {
  const W = 320, H = Math.round(W * (vh * 720) / (vw * 1280)), cols = 5, pick = cao.slice(0, 60);
  const comp = []; for (const [i, k] of pick.entries()) {
    comp.push({ input: await sharp(path.join(DIR, k.f)).resize(W, H, { fit: "fill" }).toBuffer(), left: (i % cols) * W, top: Math.floor(i / cols) * (H + 22) + 22 },
      { input: Buffer.from(`<svg width="${W}" height="22"><rect width="${W}" height="22" fill="black"/><text x="4" y="16" font-size="15" font-family="Arial" fill="yellow">${k.f.replace(/^(\d\d)(\d\d)(\d\d)(\d\d).*/, "$2/$1 $3:$4")} · ${k.diem}</text></svg>`), left: (i % cols) * W, top: Math.floor(i / cols) * (H + 22) });
  }
  await sharp({ create: { width: W * cols, height: Math.ceil(pick.length / cols) * (H + 22), channels: 3, background: "#000" } }).composite(comp).jpeg({ quality: 80 }).toFile(path.join(DIR, "luoi-cao.jpg"));
  console.log("→", path.join(DIR, "luoi-cao.jpg"));
}
