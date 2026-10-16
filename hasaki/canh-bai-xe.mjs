/**
 * canh-bai-xe.mjs — cò canh "NV Hasaki gửi xe ở bãi của bảo vệ / NCC – đối tác" (luật BX-01, mục 25 QUY-ĐỊNH).
 *
 *  User 02/10/2026: "cần chụp ảnh ghi lại những trường hợp này mỗi ngày để t ra quyết định và nhận diện nhân sự
 *  nếu bạn nghi". Máy KHÔNG kết luận, KHÔNG lập phiếu — chỉ chụp + gợi ý ứng viên, người quyết.
 *
 *  Cách làm (mỗi camera):
 *   1. Lấy mẫu 5 giây mỗi BUOC giây trong các khung giờ (mặc định 05:30–10:00, 12:00–14:30) → 1 khung hình/mẫu.
 *   2. So vùng bãi (ROI) giữa các mẫu ỔN ĐỊNH liền nhau: khác nhiều = có xe vào/ra đứng lại → 1 lượt.
 *      Cả khung đổi mạnh (camera xoay/đổi sáng) → bỏ, đặt lại mốc.
 *   3. Lượt: tải đoạn ≤4 phút trước lúc ổn định, 1 khung/3 s → chọn khung có NGƯỜI trong vùng (khác cả trước lẫn sau).
 *   4. Ứng viên: chấm công HR (check_in −3…+6 phút) + sổ cổng bảo vệ (−1…+10 phút, kèm ảnh — CHỈ nội bộ, cấm đưa lên phiếu).
 *   5. Xuất <BAIXE_DIR>/<ngày>/BAO-CAO.html + ảnh từng lượt + ket-qua.json (ngoài repo: có mặt người).
 *
 *  Chạy:  node canh-bai-xe.mjs [--ngay=YYYY-MM-DD] [--khung=05:30-10:00,12:00-14:30] [--buoc=180] [--cam=AIBV,BXM]
 *  Tải đầu ghi: ~2×(số phút khung/3) đoạn 5 s (~1 MB) + vài đoạn ≤6 phút cho mỗi lượt. Không tốn lượt work/wms;
 *  HR: 3 lượt chấm công + ≤15 trang sổ cổng.
 */
import "dotenv/config";
import fs from "node:fs"; import path from "node:path"; import http from "node:http"; import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { layTokenSongWork, mayDuocChay } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const A = Object.fromEntries(process.argv.slice(2).filter((x) => x.startsWith("--")).map((x) => { const [k, v] = x.slice(2).split("="); return [k, v ?? "1"]; }));
const homNayVN = () => new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
const NGAY = A.ngay || homNayVN();
const KHUNG = (A.khung || "05:30-10:00,12:00-14:30").split(",").map((k) => k.split("-"));
const BUOC = Number(A.buoc || 180);
const T_ROI = Number(A.nguong || 0.045);   // mức khác vùng bãi coi là "có xe vào/ra" (0–1)
const T_ON = T_ROI * 0.6;                   // 2 mẫu liền nhau khác dưới mức này = ổn định
const T_KHUNG = 0.22;                       // cả khung khác hơn mức này = camera xoay/đổi sáng → bỏ
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const TR = (process.env.TOPREVIEW_BASE || "https://hasaki.top-review.io/api/v1").replace(/\/+$/, "");
const OUT = path.join(process.env.BAIXE_DIR || "C:/Users/lechitam/Videos/5S-bang-chung/bai-xe", NGAY);
const TAM = path.join(DIR, ".exports", ".bai-xe-tam", NGAY);
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);

// Vùng bãi NCC/bảo vệ trên từng camera (tỉ lệ khung 0–1: x0,y0,x1,y1) — xác minh trên hình 02/10/2026.
const CAM = [
  { ma: "AIBV", tamDung: "14/10/2026 user: tạm dừng bộ canh bãi xe bảo vệ", ten: "AI Bao Ve", dauGhi: "170 QL1A - 4", host: "172.16.10.16", kenh: 16, roi: [0, 0.10, 0.27, 0.32], nguong: 0.045, vung: "dãy xe góc trên trái (bãi bảo vệ/NCC)" },
  { ma: "BXM", tamDung: "16/10/2026 user: tắt canh bãi xe máy (giữ khu rác/giấy)", ten: "Bai Xe May", dauGhi: "170 QL1A - 3", host: "172.16.10.12", kenh: 32, roi: [0.04, 0.60, 0.38, 1.0], nguong: 0.07, vung:   // ngoài trời: nắng/bóng đổi liên tục → ngưỡng cao hơn
    "cụm xe sát cột cạnh xe tải (bãi NCC/đối tác)" },
  { ma: "PLR", ten: "Khu phân loại rác", dauGhi: "170 QL1A - 3", host: "172.16.10.12", kenh: 30, loai: "phan-loai", roi: [0.469, 0.028, 0.797, 0.486], nguong: 0.06,
    moc: ["12:00", "18:30"], vung: "vách + bao phân loại MÀNG CO · GIẤY IN NHIỆT · BÓNG VỤN · LÕI BĂNG KEO" },
  { ma: "KGC", ten: "Kho giấy carton", dauGhi: "170 QL1A - 3", host: "172.16.10.12", kenh: 31, loai: "phan-loai", roi: [0.727, 0.167, 1.0, 0.75], nguong: 0.06,
    moc: ["12:00", "18:30"], vung: "đống giấy carton — không được lẫn màng co / bọc trắng" },
].map((c) => ({ loai: "bai-xe", ...c })).filter((c) => A.cam ? A.cam.split(",").includes(c.ma) : !c.tamDung);   // tamDung: bỏ khỏi lượt tự chạy, gọi --cam=AIBV vẫn chạy tay được

if (!mayDuocChay(log) ) process.exit(0);
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(TAM, { recursive: true });
const KHOA = path.join(DIR, ".exports", ".canh-bai-xe.lock");
try { const t = fs.statSync(KHOA).mtimeMs; if (Date.now() - t < 90 * 60e3) { log("⏸ đang có lượt khác chạy (khoá)"); process.exit(0); } } catch { /* không khoá */ }
fs.writeFileSync(KHOA, String(process.pid));
const thoat = (c) => { try { fs.unlinkSync(KHOA); } catch { /* */ } process.exit(c); };

// ---- top-review: token cache dùng chung với camera-a8.mjs ----
const TOKF = path.join(DIR, ".exports", ".tr-token.json");
async function trToken(moi = false) {
  if (!moi) try { const c = JSON.parse(fs.readFileSync(TOKF, "utf8")); if (c.token && (!c.exp || c.exp - Date.now() > 120000)) return c.token; } catch { /* */ }
  const r = await fetch(TR + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: process.env.TOPREVIEW_USER, password: process.env.TOPREVIEW_PASS }) });
  const j = await r.json(); const token = j?.data?.token || j?.token; if (!token) throw new Error("top-review đăng nhập lỗi " + r.status);
  let exp = 0; try { exp = JSON.parse(Buffer.from(token.split(".")[1], "base64url")).exp * 1000; } catch { /* */ }
  fs.writeFileSync(TOKF, JSON.stringify({ token, exp })); return token;
}
let TOK = await trToken();
const ms = (hhmmss) => new Date(`${NGAY}T${hhmmss}+07:00`).getTime();
const gio = (t) => new Date(t + 7 * 36e5).toISOString().slice(11, 19);
let soLuotTai = 0, soMB = 0;
/** Tải 1 đoạn [tu, den) — tự cắt ở mốc giờ chẵn (đầu ghi trả 404 khi đoạn vắt qua giờ chẵn). Trả danh sách {file, tu, den}. */
async function taiDoan(cam, tu, den, ten) {
  taiDoan.baoLoi ??= 0;
  const ra = []; let a = tu;
  while (a < den) {
    const hetGio = Math.floor((a + 7 * 36e5) / 36e5) * 36e5 - 7 * 36e5 + 36e5;
    // 05/10 KIỂM THẬT (07:00–07:30 ch30/31/16): đầu ghi GHI LIÊN TỤC; chỗ trống là lỗi máy chủ cắt top-review —
    // "unexpected EOF" khi đoạn bắt đầu sát mốc giờ chẵn, "signal: killed" khi máy chủ quá tải ⇒ không bắt đầu trong 20 s đầu giờ
    if ((a + 7 * 36e5) % 36e5 < 20000) a = Math.floor((a + 7 * 36e5) / 36e5) * 36e5 - 7 * 36e5 + 20000;
    const b = Math.min(den, hetGio - 1000); if (b - a < 5000) { a = hetGio + 20000; continue; }
    const f = path.join(TAM, `${cam.ma}-${ten}-${gio(a).replace(/:/g, "")}-${Math.round((b - a) / 1000)}s.mp4`);
    if (!fs.existsSync(f)) {
      let ok = false, doiDau = false;
      for (let k = 0; k < 4 && !ok; k++) {
        try {
          const c = await (await fetch(`${TR}/pickvideo/cat?host=${cam.host}&kenh=${cam.kenh}&tu=${a}&den=${b}`, { headers: { authorization: "Bearer " + TOK } })).json();
          if (c?.data?.duong) {
            const r = await fetch(TR + "/pickvideo/video?f=" + encodeURIComponent(c.data.duong), { headers: { authorization: "Bearer " + TOK }, signal: AbortSignal.timeout(240000) });
            if (r.status === 401) { TOK = await trToken(true); continue; }
            if (r.status === 200) { const buf = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(f, buf); soLuotTai++; soMB += buf.length / 1048576; ok = true; }
            else if (r.status === 404) {   // máy chủ cắt báo lỗi: quá tải → chờ thử lại; EOF → lùi điểm đầu 20 s; còn lại = trống thật
              const ly = await r.text().catch(() => "");
              if (/signal: killed/.test(ly)) { await new Promise((z) => setTimeout(z, 8000)); continue; }
              if (/unexpected EOF/.test(ly) && b - a > 25000) { doiDau = true; break; }   // lùi điểm đầu ở vòng ngoài (tính lại tên tệp đệm)
              break;
            }
          } else if (c?.code === "unauthorized" || c?.statusCode === 401) TOK = await trToken(true);
          else if (k < 3) { await new Promise((z) => setTimeout(z, 6000)); continue; }   // 05/10 kiểm: lỗi bước cắt ("đầu ghi … không có", 400) là TẠM — thử lại có chờ đều lấy được
          else { if (!taiDoan.baoLoi++) log("⚠ cắt đoạn lỗi:", JSON.stringify(c).slice(0, 200)); break; }
        } catch (e) { if (!taiDoan.baoLoi++) log("⚠ tải đoạn lỗi:", String(e.message || e).slice(0, 160)); await new Promise((r) => setTimeout(r, 3000)); }
      }
      if (!ok && doiDau) { a += 20000; continue; }
      if (!ok) { a = b + 1000; continue; }
    }
    ra.push({ file: path.basename(f), tu: a, den: b }); a = b + 1000;
  }
  return ra;
}

// ---- trình duyệt: đọc khung hình qua máy chủ tạm 127.0.0.1 (file:// làm canvas bị khoá) ----
const sv = http.createServer((q, s) => {
  if (q.url === "/trang") { s.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); return s.end("<!doctype html><title>bai-xe</title>" +   // trang CÙNG nguồn — trang lỗi 404 làm canvas bị khoá
    '<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"></script><script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js"></script>'); }
  if (q.url.startsWith("/m/")) { const mf = path.join(DIR, ".cache-model", "ssd_mobilenet_v2", path.basename(q.url.split("?")[0]));   // mô hình dò "người" (không nhận mặt)
    if (!fs.existsSync(mf)) { s.writeHead(404); return s.end(); } s.writeHead(200, { "Content-Type": mf.endsWith(".json") ? "application/json" : "application/octet-stream" }); return fs.createReadStream(mf).pipe(s); }
  const f = path.join(TAM, decodeURIComponent(q.url.split("?")[0]).replace(/^\/+/, ""));
  if (!f.startsWith(TAM) || !fs.existsSync(f)) { s.writeHead(404); return s.end(); }
  const st = fs.statSync(f), rg = /bytes=(\d+)-(\d*)/.exec(q.headers.range || "");
  if (rg) { const a = +rg[1], b = rg[2] ? +rg[2] : st.size - 1; s.writeHead(206, { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Content-Range": `bytes ${a}-${b}/${st.size}`, "Content-Length": b - a + 1 }); fs.createReadStream(f, { start: a, end: b }).pipe(s); }
  else { s.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": st.size, "Accept-Ranges": "bytes" }); fs.createReadStream(f).pipe(s); }
});
await new Promise((r) => sv.listen(0, "127.0.0.1", r));
const GOC = `http://127.0.0.1:${sv.address().port}`;
const br = await puppeteer.launch({ executablePath: EDGE, headless: "new", protocolTimeout: 600000 });
const pg = await br.newPage();
await pg.goto(GOC + "/trang", { waitUntil: "networkidle0", timeout: 120000 });
await pg.evaluate(() => {
  window.docKhung = async (src, times, roi, luuAnh) => {
    const v = document.createElement("video"); v.muted = true; v.preload = "auto"; v.src = src;
    await new Promise((r, j) => { v.onloadeddata = r; v.onerror = () => j("lỗi video"); setTimeout(() => j("hết giờ"), 30000); });
    const W = 1280, H = 720, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const cx = cv.getContext("2d");
    const nho = document.createElement("canvas"); nho.width = 64; nho.height = 36; const nx = nho.getContext("2d", { willReadFrequently: true });
    const xam = (sx, sy, sw, sh) => { nx.drawImage(cv, sx, sy, sw, sh, 0, 0, 64, 36); const d = nx.getImageData(0, 0, 64, 36).data; const o = []; for (let i = 0; i < d.length; i += 4) o.push((d[i] + d[i + 1] + d[i + 2]) / 3); return o; };
    const kq = [];
    for (const t of times) {
      if (t > v.duration) break;
      await new Promise((r) => { v.onseeked = r; v.currentTime = Math.min(t, v.duration - 0.05); });
      cx.drawImage(v, 0, 0, W, H);
      const [x0, y0, x1, y1] = roi;
      kq.push({ t, roi: xam(x0 * W, y0 * H, (x1 - x0) * W, (y1 - y0) * H), full: xam(0, 0, W, H), anh: luuAnh ? cv.toDataURL("image/jpeg", 0.8) : null });
    }
    v.removeAttribute("src"); v.load(); return kq;
  };
  // 02/10 user: "6 khung mà k có chú thích là nghi ai, ra sao" → ảnh lượt tự giải thích: câu hỏi · ① trước ② lúc gửi xe (khoanh người) ③ sau · ứng viên
  window.phieuXem = async (o) => {
    let model = null; try { model = window.__m ||= await cocoSsd.load({ base: "mobilenet_v2", modelUrl: location.origin + "/m/model.json" }); } catch { /* không có mô hình → không khoanh người */ }
    const nap = (u) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = u; });
    const W = 1800, n = o.buoc.length, cot = Math.min(3, n), hang = Math.ceil(n / cot), fw = Math.floor(W / cot), fh = Math.round(fw * 9 / 16), capH = 40, chuH = 64, oH = capH + fh + chuH;
    const coCong = o.cong.length || o.chamCong.length, ungH = coCong ? 330 : 0, dauH = 128, chanH = 46;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = dauH + hang * oH + ungH + chanH; const g = cv.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, cv.height);
    const chu = (t, x, y, px, mau = "#111", dam = false, rong = 9999) => { g.font = `${dam ? "bold " : ""}${px}px Arial`; g.fillStyle = mau;
      const tu = String(t).split(" "); let d = ""; for (const w of tu) { if (g.measureText(d + w).width > rong && d) { g.fillText(d, x, y); y += px * 1.25; d = ""; } d += w + " "; } g.fillText(d, x, y); return y; };
    g.fillStyle = "#1f4e79"; g.fillRect(0, 0, W, dauH); chu(o.tieuDe, 18, 40, 30, "#fff", true); chu(o.cauHoi, 18, 80, 22, "#ffd54a", true, W - 36);
    const soNguoi = [], anhRieng = [], kieu = [], hopNguoi = [];
    for (let i = 0; i < n; i++) {
      const b = o.buoc[i], x = (i % cot) * fw, y = dauH + Math.floor(i / cot) * oH; const im = await nap(b.anh);
      g.fillStyle = b.doNguoi ? "#c0392b" : "#555"; g.fillRect(x, y, fw - 4, capH); chu(b.nhan, x + 10, y + 28, 22, "#fff", true);
      if (im) g.drawImage(im, x, y + capH, fw - 4, fh);
      const sx = (fw - 4) / 1280, sy = fh / 720, [r0, r1, r2, r3] = o.roi;
      g.strokeStyle = "#f1c40f"; g.lineWidth = 3; g.setLineDash([]); g.strokeRect(x + r0 * (fw - 4), y + capH + r1 * fh, (r2 - r0) * (fw - 4), (r3 - r1) * fh);
      let dem = 0; const hop = []; const rieng = document.createElement("canvas"); rieng.width = 1280; rieng.height = 720; const gr = rieng.getContext("2d");
      if (im) gr.drawImage(im, 0, 0, 1280, 720); gr.strokeStyle = "#f1c40f"; gr.lineWidth = 4; gr.strokeRect(r0 * 1280, r1 * 720, (r2 - r0) * 1280, (r3 - r1) * 720);
      const oDo = (bx, by, bw, bh, t, k) => { gr.strokeStyle = "#e74c3c"; gr.lineWidth = 5; gr.setLineDash([16, 9]); gr.strokeRect(bx - 5, by - 5, bw + 10, bh + 10); gr.setLineDash([]);
        gr.font = "bold 28px Arial"; const tw = gr.measureText(t).width + 18, ty = Math.max(0, by - 42) + k * 38; gr.fillStyle = "#e74c3c"; gr.fillRect(bx - 5, ty, tw, 36); gr.fillStyle = "#fff"; gr.fillText(t, bx + 4, ty + 27); };
      if (b.doNguoi && im && model) {
        const c2 = document.createElement("canvas"); c2.width = 1280; c2.height = 720; c2.getContext("2d").drawImage(im, 0, 0, 1280, 720);
        const ps = (await model.detect(c2, 20, 0.3)).filter((d) => d.class === "person").filter((d) => { const cx = (d.bbox[0] + d.bbox[2] / 2) / 1280, cy = (d.bbox[1] + d.bbox[3] / 2) / 720;
          return cx > r0 - 0.08 && cx < r2 + 0.08 && cy > r1 - 0.15 && cy < r3 + 0.05; });
        for (const d of ps) { dem++; const [bx, by, bw, bh] = d.bbox; g.strokeStyle = "#e74c3c"; g.lineWidth = 4; g.setLineDash([12, 7]);
          g.strokeRect(x + bx * sx - 4, y + capH + by * sy - 4, bw * sx + 8, bh * sy + 8); g.setLineDash([]);
          const t = ps.length > 1 ? `Người nghi ${dem}` : "Người nghi"; g.font = "bold 20px Arial"; const tw = g.measureText(t).width + 14;
          const ty = Math.max(y + capH, y + capH + by * sy - 30) + (dem - 1) * 28;
          g.fillStyle = "#e74c3c"; g.fillRect(x + bx * sx - 4, ty, tw, 26); g.fillStyle = "#fff"; g.fillText(t, x + bx * sx + 3, ty + 20); oDo(bx, by, bw, bh, t, dem - 1); hop.push([bx / 1280, by / 720, (bx + bw) / 1280, (by + bh) / 720].map((v) => +Math.min(1, Math.max(0, v)).toFixed(4))); }
      }
      if (b.doNguoi && !dem && b.vung) { const [v0, v1, v2, v3] = b.vung; g.strokeStyle = "#e74c3c"; g.lineWidth = 4; g.setLineDash([12, 7]);
        g.strokeRect(x + v0 * (fw - 4), y + capH + v1 * fh, (v2 - v0) * (fw - 4), (v3 - v1) * fh); g.setLineDash([]);
        g.font = "bold 20px Arial"; const t = "Chỗ có người cử động"; const tw = g.measureText(t).width + 14, ty = Math.max(y + capH, y + capH + v1 * fh - 28);
        g.fillStyle = "#e74c3c"; g.fillRect(x + v0 * (fw - 4), ty, tw, 26); g.fillStyle = "#fff"; g.fillText(t, x + v0 * (fw - 4) + 7, ty + 20);
        oDo(v0 * 1280, v1 * 720, (v2 - v0) * 1280, (v3 - v1) * 720, t, 0); hop.push([v0, v1, v2, v3].map((v) => +v.toFixed(4))); dem = -1; }
      soNguoi.push(Math.max(dem, 0)); anhRieng.push(rieng.toDataURL("image/jpeg", 0.85)); kieu.push(dem > 0 ? "nguoi" : dem < 0 ? "vung" : ""); hopNguoi.push(hop);
      chu(b.chu + (b.doNguoi && !dem ? " (máy không dò ra người — xem clip)" : ""), x + 10, y + capH + fh + 24, 19, "#333", false, fw - 30);
    }
    let y = dauH + hang * oH;
    if (coCong) {
      g.fillStyle = "#f4f6f8"; g.fillRect(0, y, W, ungH); chu(o.tieuDeUng, 18, y + 32, 22, "#1f4e79", true, W - 36);
      let x = 18;
      for (const c of o.cong) { const im = await nap(c.anh); if (c.goiY) { g.fillStyle = "#ffd54a"; g.fillRect(x - 6, y + 44, 212, 282); }
        if (im) { const k = Math.min(200 / im.width, 196 / im.height); g.drawImage(im, x, y + 50, im.width * k, im.height * k); }
        chu(c.dong1, x, y + 268, 18, "#111", true); chu(c.dong2, x, y + 290, 17, "#333"); chu(c.dong3, x, y + 312, 16, c.goiY ? "#8a6d00" : "#666", !!c.goiY); x += 224; }
      const xc = Math.max(x + 20, 1180); chu("Chấm công gần giờ (−3…+6 phút):", xc, y + 70, 19, "#1f4e79", true);
      o.chamCong.slice(0, 9).forEach((t, i) => chu(t, xc, y + 98 + i * 25, 18, "#333"));
      y += ungH;
    }
    g.fillStyle = "#fff8d6"; g.fillRect(0, y, W, chanH); chu(o.chan, 18, y + 30, 21, "#5c4a00", true);
    return { anh: cv.toDataURL("image/jpeg", 0.85), soNguoi, anhRieng, kieu, hopNguoi };
  };
  window.ghepAnh = async (khung, roi, cong, tieuDe) => {
    const W = 1280, H = 720, w = 512, h = 288, n = khung.length, cot = Math.min(n, 3), hang = Math.ceil(n / cot);
    const congH = cong.length ? 260 : 0, cv = document.createElement("canvas");
    cv.width = cot * w; cv.height = 40 + hang * h + congH; const cx = cv.getContext("2d");
    cx.fillStyle = "#111"; cx.fillRect(0, 0, cv.width, cv.height); cx.fillStyle = "#ffd54a"; cx.font = "bold 22px Arial"; cx.fillText(tieuDe, 10, 28);
    const nap = (u) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = u; });
    for (let i = 0; i < n; i++) {
      const im = await nap(khung[i].anh); const x = (i % cot) * w, y = 40 + Math.floor(i / cot) * h; if (im) cx.drawImage(im, x, y, w, h);
      cx.strokeStyle = "#ff3b30"; cx.lineWidth = 3; cx.setLineDash([8, 5]); cx.strokeRect(x + roi[0] * w, y + roi[1] * h, (roi[2] - roi[0]) * w, (roi[3] - roi[1]) * h); cx.setLineDash([]);
      cx.fillStyle = "rgba(0,0,0,.65)"; cx.fillRect(x, y + h - 30, 150, 30); cx.fillStyle = "#fff"; cx.font = "bold 20px Arial"; cx.fillText(khung[i].nhan, x + 6, y + h - 8);
    }
    let x = 0; const y0 = 40 + hang * h;
    for (const c of cong) { const im = await nap(c.anh); if (im) { const s = Math.min(150 / im.width, 210 / im.height); cx.drawImage(im, x + 4, y0 + 4, im.width * s, im.height * s); }
      cx.fillStyle = "#fff"; cx.font = "14px Arial"; cx.fillText(c.nhan, x + 4, y0 + 232); cx.fillText(c.nhan2 || "", x + 4, y0 + 250); x += 160; }
    return cv.toDataURL("image/jpeg", 0.82);
  };
});
const khac = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length / 255; };
const ghiAnh = (f, data) => fs.writeFileSync(f, Buffer.from(data.split(",")[1], "base64"));

// ---- HR: chấm công + sổ cổng của ngày (đọc 1 lần) ----
let CC = [], CONG = [];
for (let lan = 1; lan <= 3; lan++) { CC = []; CONG = [];
try {
  const token = await layTokenSongWork(DIR, () => {});
  const H = { authorization: token, accept: "application/json", origin: "https://hr.hasaki.vn", referer: "https://hr.hasaki.vn/" };
  const thay = new Set();
  for (const mj of ["", "71", "26"]) for (let off = 0; off < 3000; off += 500) {
    const j = await (await fetch(`https://wshr.hasaki.vn/api/hr/timesheet?location_id=398${mj ? "&department_id=121&major_id=" + mj : ""}&from_date=${NGAY}&to_date=${NGAY}&limit=500&offset=${off}`, { headers: H })).json();
    const r = j.data?.rows || [];
    const ms_ = (v) => (!v ? null : typeof v === "number" ? v * 1000 : Date.parse(v));
    for (const x of r) { if (!x.check_in) continue; const t = ms_(x.check_in); const k = x.staff?.code + "|" + t; if (thay.has(k)) { if (mj) CC.find((c) => c.code + "|" + c.t === k).mj = mj; continue; } thay.add(k);
      CC.push({ code: String(x.staff?.code), ten: x.staff?.staff_name, t, ra: ms_(x.check_out), mj }); }
    if (r.length < 500) break;
  }
  const seen = new Set();
  for (let p = 1; p <= 15; p++) {
    const j = await (await fetch(`https://wshr.hasaki.vn/api/hr/history-location?limit=200&page=${p}&location_id=398&from_date=${NGAY}&to_date=${NGAY}`, { headers: H })).json();
    const r = j.data?.rows || []; let moi = 0;
    for (const x of r) { if (seen.has(x.id)) continue; seen.add(x.id); moi++;
      let u = (x.images_in || [])[0]; if (u && typeof u !== "string") u = u.url || u.path; if (u && !/^http/.test(u)) u = "https://hr-media.hasaki.vn/" + u.replace(/^\//, "");
      CONG.push({ t: Date.parse(x.created_at.replace(" ", "T") + "+07:00"), nv: !!x.staff, code: x.staff ? String(x.staff.code) : "", ten: x.staff ? x.staff.staff_name : (x.customer_name || x.supplier_name || "khách"), anh: u || null }); }
    if (r.length < 200 || !moi) break;
  }
  log(`HR: ${CC.length} lượt chấm công · ${CONG.length} dòng sổ cổng (${CONG.filter((c) => c.nv).length} NV)`); break;
} catch (e) { log(`⚠ đọc HR lỗi (lần ${lan}/3):`, e.message, lan < 3 ? "— thử lại sau 20 s" : "— vẫn chụp ảnh, không có ứng viên"); if (lan < 3) await new Promise((r) => setTimeout(r, 20e3)); }
}

// ---- quét từng camera ----
const LUOT = [], MOC = []; let loiDoc = 0;
for (const cam of CAM) {
  /* 05/10 user chốt A+B+D cho khu giấy/rác: BỎ lấy mẫu cả ngày (≈130 đoạn/khu/ngày; máy không phân biệt được đã/chưa phân loại —
     đo 05/10: ca đúng −3,0 vs ca vi phạm −2,6) → chỉ chụp 2 MỐC 12:00 · 18:30 làm bằng chứng hiện trạng (luật PL-03). */
  /* 09/10 user «chạy bắt khu phân loại rác»: --bat → bật lại lấy mẫu + bắt lượt cho khu giấy/rác; phần phán «bỏ đúng/sai loại» do Gemini (bat-khu-rac.mjs) — thứ máy không làm được (05/10) */
  if (cam.moc && !A.bat) { cam.khungChay = [];
    for (const m of cam.moc) { const t = ms(m + ":00") + 60e3; if (t > Date.now() - 60e3) continue;   // +1 phút: đoạn bắt đầu sát giờ chẵn bị máy chủ cắt báo EOF (05/10: 12:00 hỏng, 18:30 được)
      const f = `${cam.ma}-moc${m.replace(":", "")}.jpg`; if (fs.existsSync(path.join(OUT, f))) { MOC.push({ ma: cam.ma, camera: cam.ten, gio: m, anh: f }); continue; }
      const d = await taiDoan(cam, t, t + 15000, "moc");
      if (!d?.length) { log(`⚠ ${cam.ten} mốc ${m}: không tải được`); continue; }
      try { const [k] = await pg.evaluate((s, r) => window.docKhung(s, [7], r, true), `${GOC}/${d[0].file}`, cam.roi); if (k?.anh) { ghiAnh(path.join(OUT, f), k.anh); MOC.push({ ma: cam.ma, camera: cam.ten, gio: m, anh: f }); log(`${cam.ten}: mốc ${m} ✓`); } }
      catch (e) { log(`⚠ ${cam.ten} mốc ${m}: đọc khung lỗi`, String(e.message || e).slice(0, 120)); } }
    continue; }
  const moc = [];
  const khC = A.khung ? KHUNG : (cam.khung ? cam.khung.split(",").map((k) => k.split("-")) : KHUNG), buC = A.buoc ? BUOC : cam.buoc || BUOC;
  cam.khungChay = khC;
  for (const [a, b] of khC) for (let t = ms(a + ":00"); t < ms(b + ":00") && t < Date.now() - 60e3; t += buC * 1000) moc.push(t);
  // tải song song 3 đoạn/lượt (mỗi đoạn đầu ghi mất ~15 s để cắt) rồi mới đọc khung tuần tự
  const doan = new Array(moc.length);
  for (let i = 0; i < moc.length; i += 3) await Promise.all(moc.slice(i, i + 3).map(async (t, k) => { doan[i + k] = await taiDoan(cam, t, t + 15000, "mau"); /* 05/10 KIỂM: xin 5 s hay hỏng ("không có ghi hình"/400) ở đầu ghi .12, xin 15 s thì 6/6 tải được */ }));
  const mau = [];
  for (const d of doan) {
    if (!d?.length) continue;
    try { const [k] = await pg.evaluate((s, r) => window.docKhung(s, [2], r, false), `${GOC}/${d[0].file}`, cam.roi); if (k) mau.push({ ...k, t: d[0].tu + 2000 }); } catch (e) { if (!loiDoc++) log("⚠ lỗi đọc khung:", String(e.message || e).slice(0, 160)); }
  }
  log(`${cam.ten}: ${mau.length} mẫu`);
  if (A.chiTiet) mau.forEach((m, i) => i && log(`  ${cam.ma} ${gio(m.t)} vùng ${khac(m.roi, mau[i - 1].roi).toFixed(3)} khung ${khac(m.full, mau[i - 1].full).toFixed(3)}`));
  // mẫu ổn định = giống mẫu kế tiếp; so các mẫu ổn định liền nhau
  const tR = Number(A.nguong || cam.nguong || T_ROI), tO = tR * 0.6;
  const on = mau.filter((m, i) => i + 1 < mau.length && khac(m.roi, mau[i + 1].roi) < tO && khac(m.full, mau[i + 1].full) < T_KHUNG);
  for (let i = 1; i < on.length; i++) {
    const p = on[i - 1], q = on[i];
    if (q.t - p.t > 45 * 60e3) continue;                         // khoảng trống ghi hình dài → không so
    if (khac(p.full, q.full) > T_KHUNG) continue;               // camera xoay / đổi sáng
    const d = khac(p.roi, q.roi); if (d < tR) continue;
    // cắt sát lúc đổi: từ mẫu cuối còn giống p tới mẫu đầu tiên khác p (+2,5 phút) — tối đa 6 phút
    const giua = mau.filter((m) => m.t > p.t && m.t <= q.t);
    const k = giua.findIndex((m) => khac(p.roi, m.roi) >= tR);
    const truoc = k > 0 ? giua[k - 1] : p, sau = k >= 0 ? giua[k] : q;
    LUOT.push({ cam, tu: Math.max(truoc.t, sau.t - 360e3), den: Math.min(sau.t + 150e3, q.t + 60e3), muc: +d.toFixed(3) });
  }
}
log(`${LUOT.length} lượt có xe vào/ra đứng lại`);

// ---- từng lượt: tìm khung có người + ứng viên ----
const KQ = [];
for (const [n, L] of LUOT.entries()) {
  const ds = await taiDoan(L.cam, L.tu, L.den + 3000, "luot");
  let khung = [];
  for (const d of ds) {
    const ts = []; for (let s = 0; s < (d.den - d.tu) / 1000; s += 3) ts.push(s);
    try { const k = await pg.evaluate((s, t, r) => window.docKhung(s, t, r, true), `${GOC}/${d.file}`, ts, L.cam.roi); khung.push(...k.map((x) => ({ ...x, tt: d.tu + x.t * 1000 }))); } catch (e) { log("⚠ đọc đoạn lượt lỗi:", String(e.message || e).slice(0, 160)); }
  }
  if (khung.length < 3) { log(`lượt ${n + 1}: không đọc được video (${gio(L.tu)}–${gio(L.den)}, ${ds.length} đoạn, ${khung.length} khung)`); continue; }
  const dau = khung[0], cuoi = khung[khung.length - 1];
  for (const k of khung) k.diem = Math.min(khac(k.roi, dau.roi), khac(k.roi, cuoi.roi));
  const chon = [];
  for (const k of [...khung].sort((a, b) => b.diem - a.diem)) { if (k.diem < T_ON) break; if (chon.every((c) => Math.abs(c.tt - k.tt) >= 9000)) chon.push(k); if (chon.length >= 4) break; }
  chon.sort((a, b) => a.tt - b.tt);
  const tNguoi = chon.length ? chon[0].tt : L.den;
  // các KHOẢNG có người trong vùng bãi (khung 3 s có điểm ≥ ngưỡng ổn định), nối khi cách ≤6 s → clip chỉ chạy tốc độ thật + bám người ở đây
  const tOc = Number(A.nguong || L.cam.nguong || T_ROI) * 0.6, doanNguoi = [];
  // "có người" = CÓ CHUYỂN ĐỘNG trong vùng bãi so với khung 3 s trước/sau (xe đứng yên không tính) — 02/10: so với đầu/cuối đoạn
  // làm 3 xe vào nối tiếp thành 1 khoảng 5 phút liền
  khung.forEach((k, i) => { k.dong = Math.max(i ? khac(k.roi, khung[i - 1].roi) : 0, i + 1 < khung.length ? khac(k.roi, khung[i + 1].roi) : 0); });
  for (const k of khung) if (k.dong >= tOc) { const z = doanNguoi[doanNguoi.length - 1]; if (z && k.tt - z[1] <= 6000) z[1] = k.tt; else doanNguoi.push([k.tt, k.tt]); }
  const PL = L.cam.loai === "phan-loai";
  const cc = PL ? CC.filter((c) => c.mj === "71" && c.t <= tNguoi && (!c.ra || c.ra >= tNguoi)).sort((a, b) => (a.ra || 9e15) - (b.ra || 9e15)).slice(0, 20)
    : CC.filter((c) => c.t >= tNguoi - 3 * 60e3 && c.t <= tNguoi + 6 * 60e3).sort((a, b) => a.t - b.t);
  const cong = PL ? [] : CONG.filter((c) => c.nv && c.t >= tNguoi - 60e3 && c.t <= tNguoi + 10 * 60e3).sort((a, b) => a.t - b.t).slice(0, 6);
  // khung "lúc gửi xe": mỗi khoảng có người lấy 1 khung rõ nhất (khác cả trước lẫn sau nhiều nhất), tối đa 2 khoảng
  const lucGui = doanNguoi.map(([x, y]) => khung.filter((k) => k.tt >= x && k.tt <= y).sort((p, q) => q.diem - p.diem)[0]).filter(Boolean)
    .sort((p, q) => q.diem - p.diem).slice(0, 3).sort((p, q) => p.tt - q.tt);
  if (!lucGui.length && chon.length) lucGui.push(chon[0]);
  const t0 = lucGui.length ? lucGui[0].tt : tNguoi;
  const vungDong = (k) => { const i = khung.indexOf(k), nb = khung[i - 1] || khung[i + 1]; if (!nb) return null; const [r0, r1, r2, r3] = L.cam.roi;
    let a = 64, b = 36, c = -1, d = -1, so = 0;
    for (let y = 0; y < 36; y++) for (let x = 0; x < 64; x++) if (Math.abs(k.roi[y * 64 + x] - nb.roi[y * 64 + x]) > 28) { so++; a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
    if (so < 12) return null;
    return [r0 + (a / 64) * (r2 - r0), r1 + (b / 36) * (r3 - r1), r0 + ((c + 1) / 64) * (r2 - r0), r1 + ((d + 1) / 36) * (r3 - r1)]; };
  const buoc = [{ luc: gio(dau.tt), anh: dau.anh, nhan: `① TRƯỚC · ${gio(dau.tt)}`, chu: PL ? `Khung vàng = ${L.cam.vung} — lúc chưa có lượt này` : "Khung vàng = bãi xe NCC/bảo vệ (NV Hasaki không gửi xe ở đây) — lúc chưa có lượt này" },
    ...lucGui.map((k, i) => ({ luc: gio(k.tt), anh: k.anh, nhan: `${["②", "③", "④"][i]} ${PL ? "LÚC TÁC ĐỘNG" : "LÚC GỬI XE"} · ${gio(k.tt)}`, chu: PL ? "Khung đỏ = người đang bỏ/lấy đồ ở khu này" : "Khung đỏ = người đang dựng xe / đi ra từ bãi", doNguoi: true, vung: vungDong(k) })),
    { luc: gio(cuoi.tt), anh: cuoi.anh, nhan: `${["②", "③", "④", "⑤"][lucGui.length]} SAU · ${gio(cuoi.tt)}`, chu: PL ? "Sau khi người đó rời đi: màng co / bọc trắng có nằm lẫn chỗ không đúng không?" : "Xe đứng lại trong bãi. Không thấy xe mới → có thể xe RA: chọn «Xe ra / không vi phạm»" }];
  const gyCong = cong.filter((c) => c.t >= t0 - 60e3).sort((a, b) => Math.abs(a.t - t0 - 60e3) - Math.abs(b.t - t0 - 60e3))[0];
  const anhCong = [];
  for (const c of cong) { let anh = null; if (c.anh) try { const b = Buffer.from(await (await fetch(c.anh)).arrayBuffer()); anh = "data:image/jpeg;base64," + b.toString("base64"); } catch { /* */ }
    const ph = Math.round((c.t - t0) / 60e3);
    anhCong.push({ anh, dong1: (c.ten || "").split(" ").slice(-3).join(" "), dong2: `Mã ${c.code} · vào cổng ${gio(c.t).slice(0, 5)}`,
      dong3: c === gyCong ? `★ khớp giờ nhất (${ph >= 0 ? "+" : ""}${ph} phút)` : `${ph >= 0 ? "sau" : "trước"} ${Math.abs(ph)} phút`, goiY: c === gyCong }); }
  const tieuDe = `${L.cam.ten} · ${NGAY} · ${gio(L.tu).slice(0, 5)}–${gio(L.den).slice(0, 5)} · ${PL ? "có người tác động khu phân loại" : "có người gửi xe vào bãi NCC/bảo vệ"}`;
  const ten = `${L.cam.ma}-${gio(L.den).replace(/:/g, "")}.jpg`;
  const r1 = await pg.evaluate((o) => window.phieuXem(o), { tieuDe, roi: L.cam.roi, buoc,
    cauHoi: PL ? "Bạn xem: người trong KHUNG ĐỎ có bỏ rác sai bao / đổ cả xe không tách màng co không? Vi phạm → gõ MÃ NV · Không vi phạm → chọn «Không vi phạm»"
      : "Bạn xem: người trong KHUNG ĐỎ có phải NV Hasaki (chính thức/part-time) không? Phải → gõ MÃ NV ở sheet · Không phải / xe ra → chọn ở cột «Bạn quyết»",
    tieuDeUng: PL ? "Ứng viên — NV PTCH đang trong ca lúc đó, ai chấm RA sớm nhất xếp trước (máy KHÔNG nhận mặt)."
      : "Ứng viên — người vào cổng bảo vệ ngay sau lúc gửi xe (máy KHÔNG nhận mặt: bạn so trang phục, khẩu trang, tóc, túi). Ảnh cổng CHỈ để đối chiếu, không lên phiếu.",
    cong: anhCong, chamCong: cc.map((c) => PL ? `${c.code} ${c.ten} · vào ${gio(c.t).slice(0, 5)} · ra ${c.ra ? gio(c.ra).slice(0, 5) : "chưa"}` : `${gio(c.t).slice(0, 5)} · ${c.code} ${c.ten}`),
    chan: anhCong.length || cc.length ? "Không ai giống? → chọn «Không rõ – bỏ qua» hoặc ghi chú tên người bạn nhận ra. Bấm cột «Ảnh to» để phóng to." : "Không có ai chấm công / vào cổng gần giờ này → bạn tự nhận diện hoặc chọn «Không rõ – bỏ qua»." });
  ghiAnh(path.join(OUT, ten), r1.anh);
  const buocAnh = buoc.map((b, i) => { const f = ten.replace(".jpg", `-k${i}.jpg`); ghiAnh(path.join(OUT, f), r1.anhRieng[i]);
    if (b.doNguoi) ghiAnh(path.join(OUT, f.replace(".jpg", "-goc.jpg")), b.anh);   // khung GỐC chưa khoanh → bai-xe-phieu vẽ tên NV lên (không đè nhãn "Người nghi")
    return { file: f, nhan: b.nhan, chu: b.chu, doNguoi: !!b.doNguoi, kieu: r1.kieu[i], hop: r1.hopNguoi[i] || [], luc: b.luc }; });
  const tenCam = ten.replace(".jpg", "-cam.jpg");   // ảnh CHỈ camera → đưa lên phiếu (ảnh cổng bảo vệ cấm đưa lên phiếu)
  const r2 = await pg.evaluate((o) => window.phieuXem(o), { tieuDe, roi: L.cam.roi, buoc, cong: [], chamCong: [], tieuDeUng: "",
    cauHoi: PL ? "Vi phạm: rác / màng co không phân loại đúng bao (QUY-ĐỊNH mục 8) — người trong khung đỏ" : "Vi phạm: gửi xe tại bãi dành cho bảo vệ / nhà cung cấp (QUY-ĐỊNH mục 25) — người trong khung đỏ",
    chan: `Khung vàng = ${PL ? L.cam.vung : "bãi xe NCC/bảo vệ"} · khung đỏ = người do máy dò (không nhận diện khuôn mặt) · clip đi kèm phiếu.` });
  ghiAnh(path.join(OUT, tenCam), r2.anh);
  KQ.push({ id: `${NGAY}_${L.cam.ma}_${gio(L.den).replace(/:/g, "")}`, ma: L.cam.ma, loai: L.cam.loai, anhCam: tenCam,
    nguon: ds.map((d) => ({ file: path.join(TAM, d.file), bd: gio(d.tu) })), khungNguoi: chon.map((k) => gio(k.tt)), doanNguoi: doanNguoi.map(([x, y]) => [gio(x), gio(y)]),
    roiPx: L.cam.roi.map((v, i) => Math.round(v * (i % 2 ? 720 : 1280))),
    stt: KQ.length + 1, camera: L.cam.ten, vung: L.cam.vung, tu: gio(L.tu), den: gio(L.den), mucDoi: L.muc, gioNguoi: lucGui.length ? gio(t0) : chon.length ? gio(tNguoi) : null, soNguoi: r1.soNguoi, goiY: gyCong ? gyCong.code : null, anh: ten,
    buocAnh, khongThayNguoi: !lucGui.length,
    chamCong: cc.map((c) => ({ gio: gio(c.t), ra: c.ra ? gio(c.ra) : null, code: c.code, ten: c.ten })), cong: cong.map((c) => ({ gio: gio(c.t), code: c.code, ten: c.ten, anh: c.anh, phut: Math.round((c.t - t0) / 60e3) })) });
  log(`lượt ${KQ.length}: ${L.cam.ten} ${gio(L.tu)}–${gio(L.den)} · người ${chon.length ? gio(tNguoi) : "—"} · ${cc.length} chấm công · ${cong.length} cổng`);
}
await br.close(); sv.close();

// ---- báo cáo ----
// chạy riêng vài camera (--cam) → GIỮ lượt của camera khác từ lần chạy trước
try { const cu = JSON.parse(fs.readFileSync(path.join(OUT, "ket-qua.json"), "utf8")); const ma = new Set(CAM.map((c) => c.ma));
  const trongKhung = (l) => (CAM.find((c) => c.ma === l.ma)?.khungChay || KHUNG).some(([a, b]) => l.den >= a + ":00" && l.den <= b + ":59");
  const giu = (cu.luot || []).filter((l) => l.ma && (!ma.has(l.ma) || !trongKhung(l))); if (giu.length) { KQ.push(...giu); KQ.sort((x, y) => (x.camera + x.den).localeCompare(y.camera + y.den)); KQ.forEach((k, i) => (k.stt = i + 1)); } } catch { /* chưa có */ }
for (const f of fs.readdirSync(OUT)) if (/^[A-Z0-9]+-\d{6}(-cam|-k\d(-goc)?)?\.jpg$/.test(f) && !KQ.some((k) => k.anh === f || k.anhCam === f || (k.buocAnh || []).some((b) => b.file === f || b.file.replace(".jpg", "-goc.jpg") === f))) fs.rmSync(path.join(OUT, f));   // ảnh của lượt chạy trước không còn trong báo cáo
fs.writeFileSync(path.join(OUT, "ket-qua.json"), JSON.stringify({ ngay: NGAY, khung: KHUNG, buoc: BUOC, luot: KQ, mocChup: MOC, taiDauGhi: { doan: soLuotTai, MB: +soMB.toFixed(0) } }, null, 1));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const dong = (a) => a.length ? a.map((x) => `${esc(x.gio)} · <b>${esc(x.code)}</b> ${esc(x.ten)}`).join("<br>") : "<i>không có</i>";
fs.writeFileSync(path.join(OUT, "BAO-CAO.html"), `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bãi xe NCC ${NGAY}</title><style>body{font:15px/1.5 Arial,sans-serif;margin:16px;background:#f6f7f9;color:#1c1e21}h1{font-size:20px}
.l{background:#fff;border:1px solid #dde;border-radius:10px;padding:12px;margin:14px 0}.l img{max-width:100%;border-radius:6px}
.g{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:700px){.g{grid-template-columns:1fr}}.q{background:#fff8d6;border:1px dashed #c9a300;padding:8px;border-radius:6px}
small{color:#666}</style></head><body><h1>Bãi xe NCC / bảo vệ — ${NGAY}</h1>
<p>${KQ.length} lượt có xe vào/ra đứng lại trong vùng khung đỏ · khung giờ ${KHUNG.map((k) => k.join("–")).join(", ")} · mẫu mỗi ${BUOC / 60} phút.<br>
<small>Máy KHÔNG nhận mặt và KHÔNG lập phiếu. Ứng viên = chấm công −3…+6 phút và sổ cổng −1…+10 phút quanh lúc thấy người. Ảnh cổng chỉ để bạn đối chiếu, KHÔNG đưa lên phiếu. Luật BX-01 · mục 25 (2%).</small></p>
${KQ.map((k) => `<div class="l"><b>#${k.stt} · ${esc(k.camera)}</b> · ${k.tu}–${k.den} · thấy người lúc <b>${k.gioNguoi || "—"}</b> <small>(mức đổi ${k.mucDoi})</small>
<p><img src="${k.anh}" loading="lazy"></p><div class="g"><div><b>Chấm công gần giờ</b><br>${dong(k.chamCong)}</div><div><b>Sổ cổng bảo vệ</b><br>${dong(k.cong)}</div></div>
<p class="q">Bạn quyết: ☐ NV Hasaki — ai: ________ ☐ không phải NV / xe ra ☐ không rõ</p></div>`).join("") || "<p>Không có lượt nào.</p>"}
<p><small>Tải đầu ghi: ${soLuotTai} đoạn · ${soMB.toFixed(0)} MB. Video tạm: ${esc(TAM)}</small></p></body></html>`);
log(`✓ ${KQ.length} lượt → ${path.join(OUT, "BAO-CAO.html")} · tải ${soLuotTai} đoạn ${soMB.toFixed(0)} MB`);
// video tạm: đoạn MẪU chỉ cần trong ngày (giữ để lượt 14:45 dùng lại); đoạn LƯỢT giữ 14 ngày để dựng clip khi bạn quyết
try { const goc = path.dirname(TAM), han = (n) => new Date(Date.now() + 7 * 36e5 - n * 864e5).toISOString().slice(0, 10);
  for (const d of fs.readdirSync(goc)) { const thu = path.join(goc, d);
    if (d < han(14)) { fs.rmSync(thu, { recursive: true, force: true }); continue; }
    if (d < han(0)) for (const f of fs.readdirSync(thu)) if (/-mau-/.test(f)) fs.rmSync(path.join(thu, f), { force: true }); } } catch { /* */ }
thoat(0);
