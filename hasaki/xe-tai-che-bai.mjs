// xe-tai-che-bai.mjs — LUẬT «XE TẢI CHE BÃI» cho lượt bãi xe · 20/10/2026
// Ghi chú cải tiến của user 14/10 (lượt 2026-10-13_AIBV_133232): «xe tải đã che bãi xe rồi». Soi ảnh: xe tải NCC đỗ đè kín khung vàng,
//   công nhân bốc hàng ⇒ «có người cử động trong bãi» là bốc hàng, KHÔNG phải gửi xe. Máy cũ hỏi bạn từng lượt như vậy.
// Luật: khung ① TRƯỚC hoặc khung SAU (cuối) có «truck»/«bus» (bộ dò vật thể COCO sẵn có, không nhận mặt) rộng ≥ 40% khung hình và đè
//   ≥ 30% khung vàng → lượt.xeTaiChe = {khung, rong, de} → bảng Xác minh xếp «Chỉ lưu vết · xe tải che bãi» (vẫn mở xem được, không bắt quyết).
// KHÔNG dùng «đông người» làm dấu hiệu: 07/10 05:49 đông người đi bộ đầu ca mà trong bãi có xe đạp thật (đo 20/10 trên 62 lượt chờ).
//   node xe-tai-che-bai.mjs [--ngay=YYYY-MM-DD] [--thu] [--ca-da-quyet]   (mặc định mọi ngày ≤14 ngày, lượt bãi xe chưa quyết; --thu = chỉ in)
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { ghiJson } from "./so-ghi.mjs";   // 20/10 ghi sổ JSON an toàn (ghi tạm → đổi tên) + nhật ký ai ghi

const DIR = path.dirname(fileURLToPath(import.meta.url));
export const NGUONG = { rong: 0.4, de: 0.3, diem: 0.3 };
/** dets: [{c, s, b:[x,y,w,h]}] khung 1280×720 · roi: [x0,y0,x1,y1] tỉ lệ 0–1 → null hoặc {rong, de} */
export function xeTaiChe(dets, roi) {
  const [r0, r1, r2, r3] = roi.map((v, i) => v * (i % 2 ? 720 : 1280)), dtR = Math.max(1, (r2 - r0) * (r3 - r1));
  let tot = null;
  for (const d of dets || []) {
    if (!(d.c === "truck" || d.c === "bus") || d.s < NGUONG.diem) continue;
    const [x, y, w, h] = d.b, ix = Math.max(0, Math.min(x + w, r2) - Math.max(x, r0)), iy = Math.max(0, Math.min(y + h, r3) - Math.max(y, r1));
    const rong = w / 1280, de = (ix * iy) / dtR;
    if (rong >= NGUONG.rong && de >= NGUONG.de && (!tot || de > tot.de)) tot = { rong: +rong.toFixed(2), de: +de.toFixed(2) };
  }
  return tot;
}

if (process.argv[1] && path.basename(process.argv[1]) === "xe-tai-che-bai.mjs") {
  const A = Object.fromEntries(process.argv.slice(2).filter((x) => x.startsWith("--")).map((x) => { const [k, v] = x.slice(2).split("="); return [k, v ?? "1"]; }));
  const GOC = process.env.BAIXE_DIR || "C:/Users/lechitam/Videos/5S-bang-chung/bai-xe";
  const docJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
  const QD = docJ(path.join(DIR, ".exports", "bai-xe-quyet-dinh.json"), {});
  const han = new Date(Date.now() + 7 * 36e5 - 14 * 864e5).toISOString().slice(0, 10);
  const ngays = A.ngay ? [A.ngay] : fs.readdirSync(GOC).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= han);
  const viec = [];   // {ngay, l, anh:[đầu, cuối]}
  for (const ngay of ngays) for (const l of docJ(path.join(GOC, ngay, "ket-qua.json"), {}).luot || []) {
    if ((l.loai || "bai-xe") !== "bai-xe" || l.xeTaiChe || !l.roiPx) continue;
    if (!A["ca-da-quyet"] && QD[l.id]?.qd) continue;
    const b = l.buocAnh || []; if (b.length < 2) continue;
    viec.push({ ngay, l, anh: [b[0], b[b.length - 1]].map((x) => path.join(GOC, ngay, x.file)) });
  }
  if (!viec.length) { console.log("0 lượt cần soi"); process.exit(0); }
  const anh = viec.flatMap((v) => v.anh);
  const sv = http.createServer((q, s) => {
    if (q.url === "/trang") { s.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); return s.end('<!doctype html><title>xe-tai</title><script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"></script><script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js"></script>'); }
    if (q.url.startsWith("/m/")) { const mf = path.join(DIR, ".cache-model", "ssd_mobilenet_v2", path.basename(q.url.split("?")[0])); if (!fs.existsSync(mf)) { s.writeHead(404); return s.end(); } s.writeHead(200); return fs.createReadStream(mf).pipe(s); }
    const f = anh[Number(q.url.slice(3))]; if (!f || !fs.existsSync(f)) { s.writeHead(404); return s.end(); } s.writeHead(200, { "Content-Type": "image/jpeg" }); fs.createReadStream(f).pipe(s);
  });
  await new Promise((r) => sv.listen(0, "127.0.0.1", r));
  const G = "http://127.0.0.1:" + sv.address().port, { default: puppeteer } = await import("puppeteer-core");
  const br = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new", protocolTimeout: 600000 });
  const pg = await br.newPage(); await pg.goto(G + "/trang", { waitUntil: "networkidle0", timeout: 120000 });
  const doTim = (u) => pg.evaluate(async (u) => { const m = window.__m ||= await cocoSsd.load({ base: "mobilenet_v2", modelUrl: location.origin + "/m/model.json" });
    const im = await new Promise((ok) => { const x = new Image(); x.onload = () => ok(x); x.onerror = () => ok(null); x.src = u; }); if (!im) return null;
    const c = document.createElement("canvas"); c.width = 1280; c.height = 720; c.getContext("2d").drawImage(im, 0, 0, 1280, 720);
    return (await m.detect(c, 30, 0.3)).map((d) => ({ c: d.class, s: +d.score.toFixed(2), b: d.bbox.map(Math.round) })); }, u);
  const doi = new Map(); let i = 0, n = 0;
  for (const v of viec) {
    const roi = v.l.roiPx.map((x, k) => x / (k % 2 ? 720 : 1280));
    const kq = [await doTim(G + "/a/" + i++), await doTim(G + "/a/" + i++)].map((d) => xeTaiChe(d, roi));
    const k = kq[0] ? 0 : kq[1] ? 1 : -1; if (k < 0) continue;
    n++; console.log(`${A.thu ? "(thử) " : ""}xe tải che bãi: ${v.l.id} · khung ${k ? "sau" : "trước"} · rộng ${kq[k].rong} · đè ${kq[k].de}`);
    if (!A.thu) { v.l.xeTaiChe = { khung: k ? "sau" : "truoc", ...kq[k], luc: new Date().toISOString() }; doi.set(v.ngay, true); }
  }
  await br.close(); sv.close();
  for (const ngay of doi.keys()) {   // đọc lại tệp mới nhất rồi chỉ gắn khoá xeTaiChe (không đè thay đổi khác trong lúc soi)
    const F = path.join(GOC, ngay, "ket-qua.json"), k = docJ(F, null); if (!k) continue;
    for (const l of k.luot || []) { const v = viec.find((x) => x.l.id === l.id && x.l.xeTaiChe); if (v) l.xeTaiChe = v.l.xeTaiChe; }
    const tam = F + ".tam"; ghiJson(tam, k, { thut: 1 }); fs.renameSync(tam, F);
  }
  console.log(`xong: ${n}/${viec.length} lượt xe tải che bãi${A.thu ? " (thử, không ghi)" : ""}`);
}
