/* 05/10/2026 — bước 2–3 khuôn PALLET-NGOAI-O / CAM-03, KHÔNG AI: phiếu WF591 → ứng viên kênh camera theo mã ô
 * (tên kênh SmartPSS trong ban-do-camera-o.json tenKenh) → lấy 1 khung ĐÚNG GIỜ CHỤP ẢNH trên từng kênh → ghép lưới
 * cùng ảnh ghi nhận để chọn góc thấy người kiểm đang chụp (người/máy so sau).
 * node _kenh-luc-chup.mjs <task id> [--them=ip/kênh,...]   → .exports/kenh-luc-chup/<id>.jpg + .json
 * Luật chọn kênh: A1 "<dãy>_<tủ a>-<tủ b>" (5L1/5L2/5L3 đọc thẳng); A2 "KE <dãy> ..." / "A2 - <dãy>"; chữ tự do → khớp từ khoá tên kênh. */
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process"; import sharp from "sharp";
const [ID] = process.argv.slice(2).filter((x) => !x.startsWith("--"));
const THEM = ((process.argv.find((x) => x.startsWith("--them=")) || "").slice(7)).split(",").filter(Boolean);
const BD = JSON.parse(fs.readFileSync("ban-do-camera-o.json", "utf8")); const TK = BD.tenKenh || {};
const board = JSON.parse(fs.readFileSync(fs.existsSync(".exports/board591-live-0510.json") ? ".exports/board591-live-0510.json" : ".exports/board591-live-0210.json", "utf8"));
const x = board.find((r) => String(r.id) === String(ID)); if (!x) { console.log("✗ không có phiếu trong board cache"); process.exit(1); }
const LUC = (process.argv.find((v) => v.startsWith("--luc=")) || "").slice(6).replace("T", " ");   // 05/10: giờ khác giờ chụp (vd giờ lệnh WMS)
const c = x.data.configs, bin = String(c.BIN00 || "").trim(), luc = LUC || String(c.DATE00 || "");
const kd = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();
const ds = new Set(THEM);
const m = bin.toUpperCase().match(/(?:F0-)?(?:(A\d+)-)?(5L\d|\d{3})-?(\d{2})?/);
if (m) {
  const khu = m[1] || "A1", day = m[2], tu = Number(m[3] || 0);
  for (const [k, t] of Object.entries(TK)) {
    if (k.startsWith("_") || k === "dauGhi") continue; const T = t.toUpperCase();
    if (khu === "A1") {
      const r = T.match(/^([0-9L-]+)_(\d+)-(\d+)$/); if (!r) continue;
      if (r[1].split("-").includes(day) && (!tu || (tu >= +r[2] && tu <= +r[3]))) ds.add(k);
    } else if (/^(KE|A2)\b/.test(T) && (T.match(/\d{3}/g) || []).includes(day)) ds.add(k);   // A2: "KE 506 - 507 Sau", "A2 - 501"
  }
}
/* chữ tự do: khớp từ ≥4 ký tự với tên kênh (vd "Tủ locked" → "Tu Loked", "băng chuyền in nhãn") */
if (!ds.size && !m) { const tu = kd(bin).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  for (const [k, t] of Object.entries(TK)) { if (k.startsWith("_") || k === "dauGhi") continue; const n = kd(t); if (tu.filter((w) => n.includes(w)).length >= Math.min(2, tu.length)) ds.add(k); } }
const kenh = [...ds].slice(0, 16);   // 05/10: dò khu mới cần nhiều kênh
console.log(ID, "·", bin, "·", luc, "→", kenh.length, "kênh:", kenh.map((k) => k + " " + (TK[k] || "")).join(" | ") || "(không đoán được — dùng --them=)");
if (!kenh.length) process.exit(2);
const OUT = path.join(".exports", "kenh-luc-chup"); fs.mkdirSync(OUT, { recursive: true });
const t0 = new Date(luc.replace(" ", "T") + "+07:00").getTime() - 20e3, iso = new Date(t0 + 7 * 36e5).toISOString().slice(0, 19);
const tiles = [];
const anh = [].concat(c.IMA00 || [])[0];
if (anh) tiles.push({ ten: "ẢNH GHI NHẬN", buf: Buffer.from(await (await fetch("https://hr-media.hasaki.vn/production/hr/" + anh)).arrayBuffer()) });
for (const k of kenh) {
  const [host, ch] = k.split("/"), mp4 = path.join(OUT, ID + "_" + ch + "_" + host.split(".").pop() + ".mp4"), jp = mp4.replace(".mp4", "");
  try { execFileSync(process.execPath, ["_cat-doan.mjs", host, ch, iso, "40", mp4], { stdio: "ignore", windowsHide: true, timeout: 240000 }); } catch { tiles.push({ ten: k + " " + TK[k] + " — không có hình" }); continue; }
  try { execFileSync(process.execPath, ["_khung.mjs", path.resolve(mp4), path.resolve(jp), "20"], { stdio: "ignore", windowsHide: true, timeout: 120000, env: { ...process.env, DON: "1" } }); } catch { }
  if (fs.existsSync(jp + "_f0.jpg")) tiles.push({ ten: k + " " + TK[k], buf: fs.readFileSync(jp + "_f0.jpg") });
  try { fs.unlinkSync(mp4); } catch { } await new Promise((r) => setTimeout(r, 2000));
}
if (!tiles.some((t) => t.buf && t.ten !== "ẢNH GHI NHẬN")) { console.log("✗ 0 kênh ra hình — không ghi lưới"); process.exit(4); }   // 05/10: peer lọc lưới rỗng
const W = 640, Hh = 360, cols = 3, rows = Math.ceil(tiles.length / cols);
const comp = []; for (const [i, t] of tiles.entries()) {
  const svg = Buffer.from(`<svg width="${W}" height="28"><rect width="${W}" height="28" fill="black"/><text x="6" y="20" font-size="18" font-family="Arial" fill="yellow">${(t.ten || "").replace(/[<&]/g, "")}</text></svg>`);
  const img = t.buf ? await sharp(t.buf).resize(W, Hh, { fit: "contain", background: "#000" }).toBuffer() : await sharp({ create: { width: W, height: Hh, channels: 3, background: "#222" } }).png().toBuffer();
  comp.push({ input: img, left: (i % cols) * W, top: Math.floor(i / cols) * (Hh + 28) + 28 }, { input: svg, left: (i % cols) * W, top: Math.floor(i / cols) * (Hh + 28) });
}
const f = path.join(OUT, ID + (LUC ? "_" + LUC.replace(/[^0-9]/g, "").slice(4, 12) : "") + ".jpg");
await sharp({ create: { width: W * cols, height: rows * (Hh + 28), channels: 3, background: "#000" } }).composite(comp).jpeg({ quality: 78 }).toFile(f);
fs.writeFileSync(path.join(OUT, ID + ".json"), JSON.stringify({ id: ID, bin, luc, kenh }, null, 1)); console.log("→", f);
