/* 02/10/2026 — khuôn PALLET-NGOAI-O bước 4–5, KHÔNG AI: so điểm ảnh vùng ROI theo thời gian để tìm mốc đồ vật xuất hiện.
 * node _roi-moc.mjs <khoá ROI trong ban-do-camera-o.json> <giờ chuẩn ISO (lúc chụp ảnh — vật CÓ)> <giờ lùi xa ISO> [--chia]
 *   Lấy 1 khung/mốc (đoạn 60 s, khung giây 3) ở chuẩn + các mốc lùi dần → điểm = chênh xám trung bình ROI so với chuẩn (0 = giống).
 *   --chia: sau khi thấy mốc đầu tiên "khác hẳn" (VẮNG), chia đôi giữa mốc VẮNG và mốc CÓ kề sau tới khi ≤ 2 phút.
 *   Kết quả + khung ghi vào .exports/roi-moc/<khoá>/ ; in bảng giờ → điểm. Ngưỡng VẮNG mặc định 12 (đo 14007579: có vật 2,6–4 · vắng 16–25) (đổi bằng --nguong=).
 *   --bin=<mã ô>: ghép lệnh WMS châm hàng ±3' quanh mốc (cache .cache-canh-b1.json, 0 lượt gọi).
 *   Camera ghi theo chuyển động: mốc không có hình thì thử +90 s, rồi bỏ qua. Nghỉ 2 s giữa lượt (tránh 401). */
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process"; import sharp from "sharp";
const [KHOA, CHUAN, XA] = process.argv.slice(2); const CHIA = process.argv.includes("--chia");
const NG = Number((process.argv.find((x) => x.startsWith("--nguong=")) || "--nguong=12").slice(9));
const BD = JSON.parse(fs.readFileSync("ban-do-camera-o.json", "utf8")); const R = BD.roi[KHOA];
if (!R) { console.log("✗ chưa có ROI", KHOA, "— soi tay 1 lần rồi ghi vào ban-do-camera-o.json"); process.exit(1); }
const [host, kenh] = R.kenh.split("/"); const [rx, ry, rw, rh] = R.khung;
const DIR = path.join(".exports", "roi-moc", KHOA.replace(/[|]/g, "_")); fs.mkdirSync(DIR, { recursive: true });
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const vn = (ms) => new Date(ms + 7 * 3600e3).toISOString().slice(0, 19);
async function khung(ms) {
  for (const lech of [0, 90e3]) {
    const t = vn(ms + lech), n = t.replace(/[-:]/g, "").slice(4, 13), mp4 = path.join(DIR, n + ".mp4"), jpg = path.join(DIR, n + "_f0.jpg");
    if (!fs.existsSync(jpg)) {
      try { execFileSync(process.execPath, ["_cat-doan.mjs", host, kenh, t, "60", mp4], { windowsHide: true, stdio: "ignore", timeout: 300000 }); } catch { await ngu(2000); continue; }
      try { execFileSync(process.execPath, ["_khung.mjs", path.resolve(mp4), path.resolve(path.join(DIR, n)), "3"], { windowsHide: true, stdio: "ignore", timeout: 120000, env: { ...process.env, DON: "1" } }); } catch { }
      try { fs.unlinkSync(mp4); } catch { }   // khung đã lấy; video gốc cần giữ thì tải riêng bằng _cat-doan
      await ngu(2000);
    }
    if (fs.existsSync(jpg)) return { t, jpg };
  }
  return null;
}
/* 02/10 bài học 14007380: 05:54 camera đổi chế độ ĐÊM (hồng ngoại, đen trắng) → NGÀY ⇒ điểm vọt 50 dù vật còn nguyên.
   (1) khung đen trắng (độ màu toàn khung < 6) KHÁC chế độ với khung chuẩn → "không so được", bỏ qua mốc;
   (2) chuẩn hoá độ sáng/tương phản ROI (trừ trung bình, chia độ lệch) trước khi so — đèn bật/tắt không làm sai. */
const doMau = async (f) => { const d = await sharp(f).resize(80, 45, { fit: "fill" }).removeAlpha().raw().toBuffer(); let s2 = 0; for (let i = 0; i < d.length; i += 3) s2 += Math.abs(d[i] - d[i + 1]) + Math.abs(d[i + 1] - d[i + 2]); return s2 / (d.length / 3); };
const xam = async (f) => { const b2 = await sharp(f).extract({ left: rx, top: ry, width: rw, height: rh }).resize(64, 64, { fit: "fill" }).greyscale().raw().toBuffer();
  let m = 0; for (const v of b2) m += v; m /= b2.length; let sd = 0; for (const v of b2) sd += (v - m) ** 2; sd = Math.sqrt(sd / b2.length) || 1;
  return Float32Array.from(b2, (v) => 128 + ((v - m) / sd) * 40); };
const lech = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
const t0 = new Date(CHUAN + "+07:00").getTime(), tx = new Date(XA + "+07:00").getTime();
const goc = await khung(t0); if (!goc) { console.log("✗ không lấy được khung chuẩn"); process.exit(1); }
const G = await xam(goc.jpg); const demGoc = (await doMau(goc.jpg)) < 6; const bang = [{ t: goc.t, diem: 0 }];
const cungCheDo = async (k) => ((await doMau(k.jpg)) < 6) === demGoc;
/* 02/10 bài học 13883900: 21:11:58 xe nâng chạy sát ống kính CHE cả ROI → điểm 22 dù pallet còn ⇒ "vắng" phải được khung +90 s xác nhận */
const vangThat = async (ms, d) => { if (d < NG) return false; const k2 = await khung(ms + 95e3); if (!k2 || !(await cungCheDo(k2))) return true;
  const d2 = lech(G, await xam(k2.jpg)); if (d2 < NG) { console.log("    (", k2.t, "điểm", d2.toFixed(1), "→ bị CHE khuất thoáng qua, không phải vắng)"); return false; } return true; };
console.log("ROI", KHOA, "· kênh", R.kenh, "· chuẩn", goc.t);
/* lùi dần: 1h, 2h, 4h, 8h... tới mốc xa */
let buoc = 3600e3, t = t0 - buoc, coGanNhat = goc, vang = null;
while (t >= tx) {
  const k = await khung(t);
  if (k && !(await cungCheDo(k))) { console.log(" ", k.t, "khung chế độ ĐÊM (đen trắng) — không so được, bỏ qua"); buoc = Math.min(buoc * 2, 8 * 3600e3); t -= buoc; continue; }
  if (k) { const d = lech(G, await xam(k.jpg)); bang.push({ t: k.t, diem: +d.toFixed(1) }); console.log(" ", k.t, "điểm", d.toFixed(1), d >= NG ? "← KHÁC (vắng?)" : "");
    if (await vangThat(new Date(k.t + "Z").getTime() - 7 * 3600e3, d)) { vang = k; break; } coGanNhat = k; }
  else console.log(" ", vn(t), "không có hình");
  buoc = Math.min(buoc * 2, 8 * 3600e3); t -= buoc;
}
if (!vang) { console.log("→ tới mốc xa vẫn giống chuẩn: vật có từ trước", vn(tx), "— lùi xa hơn"); }
else if (CHIA) {
  let a = new Date(vang.t + "Z").getTime() - 7 * 3600e3, b = new Date(coGanNhat.t + "Z").getTime() - 7 * 3600e3;
  /* mốc không có hình / chế độ đêm = CHƯA BIẾT (không phải vắng) — lỗi 02/10 từng dồn mốc về lúc bật đèn 05:49.
     Gặp mốc chưa biết: thử dịch mốc giữa sớm hơn 30' (tối đa 6 lần); hết cách thì dừng, báo khoảng hiện có. */
  let boQua = 0;
  while (b - a > 120e3) {
    let m = Math.round((a + b) / 2), k = await khung(m);
    /* thử dịch mốc giữa: sớm hơn 30', 60'… rồi MUỘN hơn 30', 60'… (đêm hồng ngoại nằm giữa — 13883900: 23/09 20:25 → 24/09 08:25) */
    const goc2 = m; for (const dx of [-1, 1, -2, 2, -3, 3, -4, 4, -6, 6, -8, 8]) { if (k && (await cungCheDo(k))) break; const m3 = goc2 + dx * 1800e3; if (m3 <= a + 60e3 || m3 >= b - 60e3) continue; boQua++; m = m3; k = await khung(m); }
    if (!k || !(await cungCheDo(k))) { console.log("  không còn khung ban ngày so được giữa 2 mốc — dừng"); break; }
    const d = lech(G, await xam(k.jpg)); bang.push({ t: k.t, diem: +d.toFixed(1) }); console.log("  chia", k.t, "điểm", d.toFixed(1));
    if (await vangThat(m, d)) a = m; else b = m;
  }
  console.log("→ vật XUẤT HIỆN trong khoảng", vn(a), "→", vn(b), "(xem khung trong", DIR + ")");
  /* 05/10 bài học 14007566 + 14007391: điểm "vắng" chỉ nhỉnh hơn ngưỡng (≤ NG+6) = vật CÒN, chỉ đổi dần (bị lấy bớt / nền đổi)
     → mốc YẾU, bắt buộc soi khung trước khi dùng; không tự ghép WMS */
  const ds = bang.filter((x) => x.diem > 0).map((x) => x.diem); const max = Math.max(...ds);
  if (max <= NG + 6) console.log("⚠ MỐC YẾU: điểm lớn nhất", max, "chỉ nhỉnh ngưỡng", NG, "— nhiều khả năng vật có từ trước, chỉ đổi dần. SOI KHUNG trước khi tin.");
  /* bước 6 (không AI): ghép lệnh WMS châm hàng vào ô trong khoảng ±3' — đọc cache WMS của canh-b1 (0 lượt gọi mới) */
  const BIN = (process.argv.find((x) => x.startsWith("--bin=")) || "").slice(6);
  if (BIN) {
    const CA = JSON.parse(fs.readFileSync(".cache-canh-b1.json", "utf8")); const rec = [];
    for (const [k, v] of Object.entries(CA)) if (k.startsWith(BIN + "|")) for (const x of v.rec || []) if (!rec.some((y) => y.at === x.at && y.email === x.email)) rec.push(x);
    /* cache của _roi-moc ghi kèm khoảng phủ [tu,den]; cache canh-b1 phủ 72h trước giờ ảnh. Mốc nằm ngoài mọi khoảng phủ → gọi WMS
       (02/10 bài học: lượt 2 của 13883900 dùng nhầm cache phủ quanh 21:13 cho mốc 13:43 → báo sai "không có lệnh") */
    const phu = Object.entries(CA).some(([k, v]) => k.startsWith(BIN + "|") && ((v.tu && v.tu <= a - 180e3 && v.den >= b + 180e3) ||
      (!v.tu && (() => { const pt = new Date(k.split("|")[1].replace(" ", "T") + "+07:00").getTime(); return pt - 72 * 3600e3 <= a && pt >= b; })())));
    if (!phu) {   /* không có cache phủ mốc → 1 lượt WMS transfer-bins ±6h quanh mốc, lưu cache kèm khoảng phủ */
      const { layTokenSongWork } = await import("./session-rules.js"); const tk = (await layTokenSongWork(process.cwd(), () => {})).replace(/^Bearer /, "");
      const q = new URLSearchParams({ page: 1, size: 100, warehouse_id: /-A2-/.test(BIN) ? 874 : 863, bin_in: BIN, from_date: a - 6 * 3600e3, to_date: b + 6 * 3600e3 });
      const j2 = await (await fetch("https://wms-gw.inshasaki.com/api/v1/wms/transfer-bins?" + q, { headers: { authorization: "Bearer " + tk, "Company-Ids": "1001", "user-agent-type": "web" }, signal: AbortSignal.timeout(150000) })).json();
      for (const x of (j2.records || []).filter((x) => x.bin_in === BIN && Number(x.status) === 3)) rec.push({ at: x.created_at, xong: x.updated_at, loai: x.transfer_type, qty: Number(x.quantity) || 0, email: x.created_user_name });
      CA[BIN + "|roi-moc " + vn(b)] = { rec: rec.filter((x) => { const t2 = new Date(x.at.replace(" ", "T") + "+07:00").getTime(); return t2 >= a - 6 * 3600e3 && t2 <= b + 6 * 3600e3; }), tu: a - 6 * 3600e3, den: b + 6 * 3600e3, luc: new Date().toISOString() }; fs.writeFileSync(".cache-canh-b1.json", JSON.stringify(CA));
      console.log("  (WMS 1 lượt: " + rec.length + " lệnh vào ô ±6h)");
    }
    const ms = (s2) => new Date(s2.replace(" ", "T") + "+07:00").getTime();
    const khop = rec.filter((x) => !/CANCEL/.test(x.loai) && ms(x.at) >= a - 180e3 && ms(x.at) <= b + 180e3);
    console.log(khop.length ? "→ WMS khớp mốc: " + khop.map((x) => x.at + " " + x.email + " " + x.loai + " " + x.qty + " cái").join(" | ")
      : "→ KHÔNG có lệnh WMS châm hàng đúng mốc (" + rec.length + " lệnh trong cache) — xe nâng dời không lệnh? → định danh NV-01");
    bang.push({ wms: khop });
  }
}
fs.writeFileSync(path.join(DIR, "bang.json"), JSON.stringify({ KHOA, R, nguong: NG, bang }, null, 1));
