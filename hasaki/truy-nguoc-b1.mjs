/**
 * truy-nguoc-b1.mjs — MÁY LÙI THỜI GIAN TRÊN CAMERA ĐỂ TÌM LÚC ĐỒ VẬT XUẤT HIỆN (ai tác động) · 05/10/2026
 * ============================================================================================
 *  User 05/10: "camera lúc người kiểm chụp ảnh — các loại này phải truy ra được ai tác động/vi phạm, chứ tìm ra
 *  người chụp ảnh lúc đó thì sao gọi là bằng chứng xác minh". Theo SOP-XAC-MINH-CAMERA (ảnh vi phạm → đồ vật →
 *  kẹp mốc → lúc thay đổi → người), KHÔNG AI nhìn ảnh — chỉ dò "người" (COCO-SSD) + so điểm ảnh:
 *   ① ĐỊNH VỊ chỗ vi phạm trên khung camera = nơi NGƯỜI KIỂM đứng đúng giây chụp ảnh (họ chụp ngay trước mặt)
 *   ② MỐC hiện trạng R = khung ngay trước khi người kiểm tới (vùng không có người)
 *   ③ LÙI 10', 30', 1h … 72h: so vùng với R (chuẩn hoá sáng-tối) — mốc đầu tiên KHÁC ⇒ đồ vật chưa có lúc đó
 *   ④ CHIA ĐÔI giữa mốc "khác" và mốc "giống" tới khi còn ≤ 60 s
 *   ⑤ CẮT CLIP quanh lúc đổi + ảnh trước/sau (khoanh vùng) ⇒ người trong clip là người tác động
 *  Ra: Videos/5S-bang-chung/may/<id>_TRUY-*.mp4/.jpg + .exports/truy-nguoc-b1.json — dashboard coi là BẰNG CHỨNG
 *  (mở khoá Quyết định). Không gắn lên phiếu (gắn phiếu phải dựng clip chuẩn qua _clip-noi.mjs).
 *
 *  node truy-nguoc-b1.mjs [--id=13080015] [--max=3] [--lam-lai]
 *  Tải: ~20–30 đoạn 15 s / phiếu, chỉ đầu ghi top-review (0 lượt work/wms/hr), tuần tự, nghỉ giữa lượt.
 */
import fs from "node:fs"; import path from "node:path"; import http from "node:http"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core"; import { EDGE_PATH } from "./token-store.js";
const DIR = path.dirname(fileURLToPath(import.meta.url)); process.chdir(DIR);
const A = Object.fromEntries(process.argv.slice(2).map((x) => { const [k, v] = x.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const MAX = Number(A.max || 3), TAM = path.join(DIR, ".exports", ".truy-tam"), F_RA = path.join(DIR, ".exports", "truy-nguoc-b1.json");
const GOC_BC = "C:/Users/lechitam/Videos/5S-bang-chung/may";
fs.mkdirSync(TAM, { recursive: true }); fs.mkdirSync(GOC_BC, { recursive: true });
const log = (...a) => console.log(new Date(Date.now() + 7 * 36e5).toISOString().slice(11, 19), ...a);
const doc = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const iso = (ms) => new Date(ms + 7 * 36e5).toISOString().slice(0, 19), hm = (ms) => iso(ms).slice(5, 16).replace("T", " ");
const so = doc(F_RA, {}), bc = doc(path.join(DIR, ".exports", "bang-chung-b1.json"), {});

/* ---- máy chủ tạm + trình duyệt (đọc khung qua canvas cùng gốc; Range bắt buộc để tua) ---- */
const sv = http.createServer((q, s) => {
  const u = decodeURIComponent(q.url.split("?")[0]);
  if (u === "/t") { s.writeHead(200, { "content-type": "text/html" }); return s.end("<!doctype html><body></body>"); }
  const f = u.startsWith("/m/") ? path.join(DIR, ".cache-model", "ssd_mobilenet_v2", path.basename(u)) : path.join(TAM, path.basename(u));
  if (!fs.existsSync(f)) { s.writeHead(404); return s.end(); }
  const st = fs.statSync(f), rg = /bytes=(\d+)-(\d*)/.exec(q.headers.range || "");
  if (rg) { const a = +rg[1], z = rg[2] ? +rg[2] : st.size - 1; s.writeHead(206, { "content-type": "video/mp4", "accept-ranges": "bytes", "content-range": `bytes ${a}-${z}/${st.size}`, "content-length": z - a + 1 }); return fs.createReadStream(f, { start: a, end: z }).pipe(s); }
  s.writeHead(200, { "content-type": f.endsWith(".json") ? "application/json" : "application/octet-stream", "accept-ranges": "bytes", "content-length": st.size }); fs.createReadStream(f).pipe(s);
});
await new Promise((r) => sv.listen(0, "127.0.0.1", r)); const G = "http://127.0.0.1:" + sv.address().port;
const br = await puppeteer.launch({ executablePath: EDGE_PATH, headless: "new" }); const pg = await br.newPage();
await pg.goto(G + "/t");
await pg.addScriptTag({ url: "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js" });
await pg.addScriptTag({ url: "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js" });
await pg.evaluate(async (g) => { window.M = await cocoSsd.load({ base: "mobilenet_v2", modelUrl: g + "/m/model.json" }); }, G);
/* đọc các mốc giây trong 1 đoạn: khung xám 160×90 + hộp người (tỉ lệ 0–1) */
const docKhung = (file, ts) => pg.evaluate(async (src, ts) => {
  const v = document.createElement("video"); v.muted = true; v.src = src; await new Promise((r, j) => { v.onloadeddata = r; v.onerror = () => j("lỗi video"); setTimeout(() => j("hết giờ"), 30000); });
  const cv = document.createElement("canvas"); cv.width = 640; cv.height = 360; const g = cv.getContext("2d", { willReadFrequently: true });
  const nh = document.createElement("canvas"); nh.width = 160; nh.height = 90; const gn = nh.getContext("2d", { willReadFrequently: true }); const ra = [];
  for (const t of ts) { if (t > v.duration - 0.2) continue; await new Promise((r) => { v.onseeked = r; v.currentTime = t; }); g.drawImage(v, 0, 0, 640, 360);
    gn.drawImage(cv, 0, 0, 160, 90); const d = gn.getImageData(0, 0, 160, 90).data, x = []; for (let i = 0; i < d.length; i += 4) x.push(Math.round((d[i] + d[i + 1] + d[i + 2]) / 3));
    const cl = document.createElement("canvas"); cl.width = 1280; cl.height = 720; cl.getContext("2d").drawImage(v, 0, 0, 1280, 720);   // 05/10 KIỂM: 640×360 bỏ sót người ngồi xổm xa khung (14049211) → dò ở 1280×720, ngưỡng 0,25
    const ng = (await window.M.detect(cl, 15, 0.25)).filter((o) => o.class === "person").map((o) => [o.bbox[0] / 1280, o.bbox[1] / 720, (o.bbox[0] + o.bbox[2]) / 1280, (o.bbox[1] + o.bbox[3]) / 720]);
    ra.push({ t, x, ng }); }
  return ra;
}, G + "/" + path.basename(file), ts);
/* cắt 1 đoạn — đầu ghi trả 400 cho riêng vài cửa sổ / ghi theo chuyển động ⇒ thử lệch điểm đầu */
function cat(host, ch, tu, giay, ten) {
  const f = path.join(TAM, ten); try { fs.unlinkSync(f); } catch { /* */ }
  for (const lech of [0, 20, -20, 45]) {
    try { execFileSync(process.execPath, ["_cat-doan.mjs", host, ch, iso(tu + lech * 1000), String(giay), f], { stdio: "ignore", windowsHide: true, timeout: 240000 }); } catch { /* thử lệch */ }
    if (fs.existsSync(f) && fs.statSync(f).size > 30e3) return { f, tu: tu + lech * 1000 };
  }
  return null;
}
const giao = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
const vung = (x, r) => { const o = []; for (let y = Math.floor(r[1] * 90); y < Math.ceil(r[3] * 90); y++) for (let k = Math.floor(r[0] * 160); k < Math.ceil(r[2] * 160); k++) o.push(x[y * 160 + k]); return o; };
const chuan = (a) => { const m = a.reduce((s, v) => s + v, 0) / a.length, sd = Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length) || 1; return a.map((v) => (v - m) / sd); };
/* 05/10 KIỂM trên phiếu biết đáp án 13393784: máy báo "đổi" lúc 06:03 21/08 = ĐÈN KHO BẬT, không phải lúc đặt pallet (14:07 19/08)
   ⇒ chỉ so 2 khung cùng độ sáng toàn khung (lệch > 14 mức xám = khác ánh sáng, bỏ qua, lùi tiếp) */
const cungSang = (a, b) => Math.abs(a.sang - b.sang) <= 14;
const khac = (x1, x2, r) => { const a = chuan(vung(x1, r)), b = chuan(vung(x2, r)); let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
/* lấy 1 khung "sạch" (không người đè vùng) tại mốc t (ms) */
async function mau(host, ch, t, r, ten) {
  const c = cat(host, ch, t - 2000, 15, ten); if (!c) return { tt: "khong-hinh" };
  const ks = await docKhung(c.f, [1, 4, 7, 10, 13]).catch(() => []); fs.unlinkSync(c.f);
  const sach = ks.find((k) => !k.ng.some((n) => giao(n, r) > 0.15 * (r[2] - r[0]) * (r[3] - r[1])));
  return sach ? { tt: "ok", x: sach.x, sang: sach.x.reduce((a, v) => a + v, 0) / sach.x.length, luc: c.tu + sach.t * 1000 } : { tt: "nguoi", luc: c.tu + 7000, ng: ks.map((k) => k.ng).flat() };
}

async function truy(id, e) {
  const kj = doc(path.join(DIR, ".exports", "kenh-luc-chup", id + ".json"), {}), T = Date.parse(e.luc.replace(" ", "T") + "+07:00");
  const kenh = (kj.kenh || []).filter((k) => fs.existsSync(path.join(DIR, ".exports", "kenh-luc-chup", `${id}_${k.split("/")[1]}_${k.split("/")[0].split(".").pop()}_f0.jpg`)));
  const nk = []; const ghi = (k) => { so[id] = { ...k, nk, luc: e.luc, taiLuc: new Date().toISOString() }; fs.writeFileSync(F_RA, JSON.stringify(so, null, 1)); };
  for (const k of kenh) {
    const [host, ch] = k.split("/");
    // ① định vị: người kiểm lúc chụp (−5…+10 s)
    const c0 = cat(host, ch, T - 5000, 15, id + "_0.mp4"); if (!c0) { nk.push(`kênh ${ch}: không cắt được lúc chụp`); continue; }
    const k0 = await docKhung(c0.f, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).catch(() => []); fs.unlinkSync(c0.f);
    /* 05/10 KIỂM 14049211: COCO-SSD bỏ sót người kiểm ngồi xổm bị thùng che ⇒ định vị bằng CHỖ CỬ ĐỘNG lúc chụp:
       ô 8×8 (lưới 20×11 trên khung 160×90) đổi > 25 mức xám giữa 2 khung liền nhau ≥ 20% điểm → cụm lớn nhất; có hộp người thì ưu tiên hộp người. */
    let r = null; const hop = k0.map((x) => x.ng).flat();
    if (hop.length) { const to = hop.sort((a, b) => (b[2] - b[0]) * (b[3] - b[1]) - (a[2] - a[0]) * (a[3] - a[1]))[0], w = to[2] - to[0], h = to[3] - to[1];
      r = [Math.max(0, to[0] - 0.6 * w), Math.max(0, to[1] - 0.2 * h), Math.min(1, to[2] + 0.6 * w), Math.min(1, to[3] + 0.3 * h)]; }
    else if (k0.length >= 3) {
      const on = new Uint8Array(20 * 12);
      for (let i = 1; i < k0.length; i++) for (let by = 0; by < 11; by++) for (let bx = 0; bx < 20; bx++) { let n = 0;
        for (let y = by * 8; y < Math.min(90, by * 8 + 8); y++) for (let x = bx * 8; x < bx * 8 + 8; x++) if (Math.abs(k0[i].x[y * 160 + x] - k0[i - 1].x[y * 160 + x]) > 25) n++;
        if (n >= 13) on[by * 20 + bx] = 1; }
      on.fill(0, 0, 20);   // hàng trên cùng = chữ giờ camera nhảy mỗi giây
      const xem = new Uint8Array(on.length); let tot = [];
      for (let i = 0; i < on.length; i++) { if (!on[i] || xem[i]) continue; const cum = [], q = [i]; xem[i] = 1;
        while (q.length) { const c = q.pop(); cum.push(c); const cx = c % 20, cy = (c / 20) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const nx = cx + dx, ny = cy + dy, j = ny * 20 + nx;
            if (nx >= 0 && nx < 20 && ny >= 0 && ny < 11 && on[j] && !xem[j]) { xem[j] = 1; q.push(j); } } }
        if (cum.length > tot.length) tot = cum; }
      if (tot.length >= 2) { const xs = tot.map((c) => c % 20), ys = tot.map((c) => (c / 20) | 0);
        const x0 = Math.min(...xs) / 20, x1 = (Math.max(...xs) + 1) / 20, y0 = Math.min(...ys) / 11.25, y1 = (Math.max(...ys) + 1) / 11.25, w = x1 - x0, h = y1 - y0;
        r = [Math.max(0, x0 - 0.5 * w), Math.max(0, y0 - 0.3 * h), Math.min(1, x1 + 0.5 * w), Math.min(1, y1 + 0.4 * h)]; }
    }
    if (!r) { nk.push(`kênh ${ch}: lúc chụp không thấy người cũng không thấy cử động — camera này không nhìn thấy chỗ đó`); continue; }
    nk.push(`kênh ${ch}: người kiểm ở (${r.map((v) => v.toFixed(2)).join(",")})`);
    // ② mốc hiện trạng ngay trước khi người kiểm tới
    let R = null; for (const lui of [60, 120, 240]) { const m = await mau(host, ch, T - lui * 1000, r, id + "_r.mp4"); if (m.tt === "ok") { R = m; break; } }
    if (!R) { nk.push(`kênh ${ch}: không lấy được hiện trạng trước lúc chụp`); continue; }
    const R2 = await mau(host, ch, R.luc - 20000, r, id + "_r2.mp4"); const nen = R2.tt === "ok" ? khac(R.x, R2.x, r) : 0.2;
    const NG = Math.max(0.45, 3 * nen); nk.push(`ngưỡng khác ${NG.toFixed(2)} (nhiễu ${nen.toFixed(2)})`);
    // ③ lùi
    let hi = R.luc, lo = null, xLo = null;
    for (const lui of [10, 30, 60, 120, 240, 480, 960, 1440, 2160, 2880, 4320]) {
      const m = await mau(host, ch, R.luc - lui * 60e3, r, id + "_l.mp4");
      if (m.tt === "khong-hinh") { nk.push(`−${lui}': không có hình`); continue; }
      if (m.tt === "nguoi") { nk.push(`−${lui}': có người đè vùng`); continue; }
      if (!cungSang(R, m)) { nk.push(`−${lui}': khác ánh sáng (${m.sang.toFixed(0)} vs ${R.sang.toFixed(0)}) — bỏ qua`); continue; }
      const d = khac(R.x, m.x, r); nk.push(`−${lui}' ${d.toFixed(2)}`);
      if (d > NG) { lo = m.luc; xLo = m.x; break; } hi = m.luc;
    }
    if (!lo) { nk.push("72 giờ không đổi"); ghi({ tt: "khong-doi", kenh: "kênh " + ch, roi: r }); return; }
    // ④ chia đôi
    let buoc = 0;
    while (hi - lo > 60e3 && buoc++ < 14) {
      const mid = Math.round((lo + hi) / 2), m = await mau(host, ch, mid, r, id + "_b.mp4");
      if (m.tt !== "ok") { lo = mid; continue; }
      if (!cungSang(R, m)) { const m2 = await mau(host, ch, mid + 10 * 60e3, r, id + "_b2.mp4"); if (m2.tt === "ok" && cungSang(R, m2)) { if (khac(R.x, m2.x, r) > NG) lo = m2.luc; else hi = m2.luc; } else lo = mid; continue; }   // có người đè vùng / không hình đúng lúc giữa ⇒ coi như đang thay đổi, dồn về phía mới
      if (khac(R.x, m.x, r) > NG) lo = m.luc; else hi = m.luc;
    }
    nk.push(`đổi trong ${hm(lo)}–${hm(hi).slice(6)}`);
    // ⑤ clip quanh lúc đổi (−45 s … +45 s) + ảnh trước/sau khoanh vùng
    const t0 = lo - 45000, dai = Math.min(150, Math.round((hi - lo) / 1000) + 90), ten = `${id}_TRUY-${iso(lo).replace(/[^0-9]/g, "").slice(4, 12)}_ch${ch}`;
    const cc = cat(host, ch, t0, dai, ten + ".mp4"); if (!cc) { nk.push("cắt clip lúc đổi hỏng"); ghi({ tt: "loi-clip", kenh: "kênh " + ch, roi: r, tu: iso(lo), den: iso(hi) }); return; }
    fs.copyFileSync(cc.f, path.join(GOC_BC, ten + ".mp4"));
    const kc = await docKhung(cc.f, Array.from({ length: Math.floor(dai / 3) }, (_, i) => 1 + i * 3)).catch(() => []);
    const coNguoi = kc.filter((k) => k.ng.some((n) => giao(n, r) > 0)).map((k) => iso(cc.tu + k.t * 1000).slice(11));
    const jp = await pg.evaluate(async (src, r, ts) => {   // ảnh ghép: TRƯỚC (lúc chưa đổi) · SAU (lúc đã đổi) · khoanh vùng vàng
      const v = document.createElement("video"); v.muted = true; v.src = src; await new Promise((ok) => { v.onloadeddata = ok; });
      const cv = document.createElement("canvas"); cv.width = 1280; cv.height = 400; const g = cv.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, 1280, 400);
      for (const [i, t] of ts.entries()) { await new Promise((ok) => { v.onseeked = ok; v.currentTime = Math.min(t, v.duration - 0.2); }); g.drawImage(v, i * 640, 40, 640, 360);
        g.strokeStyle = "#f1c40f"; g.lineWidth = 3; g.strokeRect(i * 640 + r[0] * 640, 40 + r[1] * 360, (r[2] - r[0]) * 640, (r[3] - r[1]) * 360);
        g.fillStyle = "#ff0"; g.font = "bold 22px Arial"; g.fillText(i ? "SAU — đã đổi" : "TRƯỚC — chưa đổi", i * 640 + 10, 28); }
      return cv.toDataURL("image/jpeg", 0.8);
    }, G + "/" + path.basename(cc.f), r, [Math.max(0.5, (lo - 30000 - cc.tu) / 1000), Math.min(dai - 1, (hi + 15000 - cc.tu) / 1000)]).catch(() => null);
    if (jp) fs.writeFileSync(path.join(GOC_BC, ten + ".jpg"), Buffer.from(jp.split(",")[1], "base64"));
    fs.unlinkSync(cc.f);
    nk.push(coNguoi.length ? `có người trong vùng lúc ${coNguoi.slice(0, 4).join(", ")}` : "không dò thấy người trong vùng quanh lúc đổi");
    ghi({ tt: "ok", kenh: "kênh " + ch, roi: r, tu: iso(lo), den: iso(hi), clip: ten + ".mp4", anh: jp ? [ten + ".jpg"] : [], nguoiLuc: coNguoi,
      chu: `Vùng đổi trong ${hm(lo)}–${hm(hi).slice(6)} (kênh ${ch})` + (coNguoi.length ? ` · có người trong vùng lúc ${coNguoi[0]}` : "") });
    return;
  }
  ghi({ tt: "khong-dinh-vi", kenh: kenh.map((k) => "kênh " + k.split("/")[1]).join(", ") });
}

if (A.dbg) { const k = await docKhung(path.join(TAM, "dbg.mp4"), [1, 3, 5, 7, 9, 11, 13]).catch((e) => { console.log("LỖI", e); return []; }); for (const x of k) console.log(x.t + "s: " + x.ng.length + " người " + JSON.stringify(x.ng.map((n) => n.map((v) => v.toFixed(2))))); await br.close(); sv.close(); process.exit(0); }
if (A.luc && A.id) bc[A.id] = { ...(bc[A.id] || {}), loai: "chup", anh: ["thu"], luc: String(A.luc).replace("T", " "), kenh: "thử" };   // thử trên phiếu đã biết đáp án
const viec = Object.entries(bc).filter(([id, e]) => e.loai === "chup" && (e.anh || []).length && (!A.id || A.id === id) && (A["lam-lai"] || !so[id]));
log(`${viec.length} phiếu cần lùi thời gian (chạy ${Math.min(MAX, viec.length)})`);
for (const [id, e] of viec.slice(0, MAX)) {
  log(`▶ ${id} · lúc chụp ${e.luc} · ${e.kenh}`);
  try { await truy(id, e); } catch (err) { log("  ✗", err.message); }
  log(`  → ${so[id] ? so[id].tt : "?"} · ${(so[id]?.nk || []).slice(-4).join(" | ")}`);
}
await br.close(); sv.close();
