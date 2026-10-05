/* Tạm 05/10: đo THÓI QUEN theo giờ ở khu phân loại (user: "kiểm tra thói quen phân loại ở khu vực này là từ mấy giờ đến mấy giờ hay
 * khung giờ nào trong ngày để chốt khung giờ đó là giờ kiểm tra"). Mỗi 15' lấy 1 đoạn 5 s (tuần tự, có thử lại lỗi máy chủ cắt),
 * đo CỬ ĐỘNG trong vùng (so khung 0,5 s / 2,5 s / 4,5 s) + có NGƯỜI (COCO-SSD) → .exports/thoi-quen-plg.json
 * node _do-thoi-quen-plg.mjs 2026-10-02,2026-10-03 [06:00-20:00] [15] */
import puppeteer from "puppeteer-core"; import fs from "node:fs"; import path from "node:path"; import http from "node:http";
const [ngays = "2026-10-02,2026-10-03", khung = "06:00-20:00", buoc = "15"] = process.argv.slice(2);
const DIR = process.cwd(), TAM = path.join(DIR, ".exports", ".bai-xe-tam", "thoi-quen"); fs.mkdirSync(TAM, { recursive: true });
const TR = "https://hasaki.top-review.io/api/v1", TOK = JSON.parse(fs.readFileSync(".exports/.tr-token.json", "utf8")).token, H = { authorization: "Bearer " + TOK };
const CAM = [{ ma: "PLR", ten: "Khu phân loại rác", kenh: 30, roi: [0.469, 0.028, 0.797, 0.486] }, { ma: "KGC", ten: "Kho giấy carton", kenh: 31, roi: [0.727, 0.167, 1.0, 0.75] }];
const RA = path.join(DIR, ".exports", "thoi-quen-plg.json"); const KQ = process.argv.includes("--giu") && fs.existsSync(RA) ? JSON.parse(fs.readFileSync(RA, "utf8")) : {};
async function tai(kenh, tu, f) {
  for (let k = 0; k < 4; k++) {
    try { const c = await (await fetch(`${TR}/pickvideo/cat?host=172.16.10.12&kenh=${kenh}&tu=${tu}&den=${tu + 15000}`, { headers: H })).json();
      if (!c?.data?.duong) { if (k < 3) { await new Promise((z) => setTimeout(z, 6000)); continue; } return "khong-co:" + (c?.message || ""); }   // lỗi tạm ở bước cắt — thử lại có chờ (05/10: 105/224 mẫu lỗi đều lấy lại được)
      const r = await fetch(TR + "/pickvideo/video?f=" + encodeURIComponent(c.data.duong), { headers: H, signal: AbortSignal.timeout(120000) });
      if (r.status === 200) { fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); return "ok"; }
      const ly = await r.text(); if (/signal: killed/.test(ly)) { await new Promise((z) => setTimeout(z, 8000)); continue; }
      if (/unexpected EOF/.test(ly)) { tu += 20000; continue; } return "loi:" + ly.slice(0, 60);
    } catch (e) { await new Promise((z) => setTimeout(z, 4000)); }
  }
  return "het-luot-thu";
}
const sv = http.createServer((q, s) => { if (q.url === "/trang") { s.writeHead(200, { "content-type": "text/html" }); return s.end("<!doctype html>" +
  '<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"></script><script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js"></script>'); }
  if (q.url.startsWith("/m/")) { const f = path.join(DIR, ".cache-model", "ssd_mobilenet_v2", path.basename(q.url)); if (!fs.existsSync(f)) { s.writeHead(404); return s.end(); } s.writeHead(200); return fs.createReadStream(f).pipe(s); }
  // PHẢI hỗ trợ tua (Range) — thiếu thì trình duyệt không tua được, mọi khung đều là khung đầu (lượt đo 05/10 lần 1 ra cử động = 0 hết vì lỗi này)
  const f = path.join(TAM, path.basename(decodeURIComponent(q.url))); if (!fs.existsSync(f)) { s.writeHead(404); return s.end(); }
  const st = fs.statSync(f), rg = /bytes=(\d+)-(\d*)/.exec(q.headers.range || "");
  if (rg) { const a = +rg[1], z = rg[2] ? +rg[2] : st.size - 1; s.writeHead(206, { "content-type": "video/mp4", "accept-ranges": "bytes", "content-range": `bytes ${a}-${z}/${st.size}`, "content-length": z - a + 1 }); return fs.createReadStream(f, { start: a, end: z }).pipe(s); }
  s.writeHead(200, { "content-type": "video/mp4", "accept-ranges": "bytes", "content-length": st.size }); fs.createReadStream(f).pipe(s); });
await new Promise((r) => sv.listen(0, "127.0.0.1", r)); const G = "http://127.0.0.1:" + sv.address().port;
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" }); const p = await b.newPage();
await p.goto(G + "/trang", { waitUntil: "networkidle0", timeout: 120000 });
await p.evaluate(async (g) => { window.M = await cocoSsd.load({ base: "mobilenet_v2", modelUrl: g + "/m/model.json" }); }, G);
const do_ = (src, roi) => p.evaluate(async (src, roi) => {
  const v = document.createElement("video"); v.muted = true; v.src = src; await new Promise((r, j) => { v.onloadeddata = r; v.onerror = j; setTimeout(j, 20000); });
  const cv = document.createElement("canvas"); cv.width = 640; cv.height = 360; const g = cv.getContext("2d", { willReadFrequently: true });
  const xam = []; let nguoi = 0;
  for (const t of [0.5, 3.5, 7, 10.5, 14]) { if (t > v.duration) break; await new Promise((r) => { v.onseeked = r; v.currentTime = t; }); g.drawImage(v, 0, 0, 640, 360);
    const [x0, y0, x1, y1] = roi.map((q, i) => q * (i % 2 ? 360 : 640)); const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data; const a = []; for (let i = 0; i < d.length; i += 16) a.push((d[i] + d[i + 1] + d[i + 2]) / 3); xam.push(a);
    const ds = (await window.M.detect(cv, 10, 0.35)).filter((d) => d.class === "person" && (d.bbox[0] + d.bbox[2] / 2) / 640 > roi[0] - 0.05 && (d.bbox[0] + d.bbox[2] / 2) / 640 < roi[2] + 0.05);
    nguoi = Math.max(nguoi, ds.length); }
  let dong = 0; for (let i = 1; i < xam.length; i++) { let s = 0; for (let k = 0; k < xam[i].length; k++) s += Math.abs(xam[i][k] - xam[i - 1][k]); dong = Math.max(dong, s / xam[i].length / 255); }
  return { dong: +dong.toFixed(4), nguoi };
}, src, roi);
const [a0, a1] = khung.split("-"); let dem = 0;
for (const ngay of ngays.split(",")) for (const c of CAM) {
  for (let t = Date.parse(`${ngay}T${a0}:00+07:00`) + 30000; t < Date.parse(`${ngay}T${a1}:00+07:00`); t += Number(buoc) * 60e3) {
    const gio = new Date(t + 7 * 36e5).toISOString().slice(11, 16), k = `${ngay} ${gio} ${c.ma}`; if (KQ[k] && KQ[k].tt === "ok") continue;
    const f = path.join(TAM, `${c.ma}-${ngay}-${gio.replace(":", "")}.mp4`); const tt = fs.existsSync(f) ? "ok" : await tai(c.kenh, t, f);
    KQ[k] = tt === "ok" ? { tt, ...(await do_(G + "/" + path.basename(f), c.roi).catch(() => ({ dong: null, nguoi: null }))) } : { tt };
    if (++dem % 10 === 0) { fs.writeFileSync(RA, JSON.stringify(KQ, null, 1)); console.log(new Date().toTimeString().slice(0, 8), dem, k, JSON.stringify(KQ[k])); }
  }
}
fs.writeFileSync(RA, JSON.stringify(KQ, null, 1)); await b.close(); sv.close();
// tổng hợp theo giờ
const bang = {};
for (const [k, v] of Object.entries(KQ)) { const [ngay, gio, ma] = k.split(" "); if (v.tt !== "ok") continue; const h = gio.slice(0, 2); const o = (bang[ma] ||= {})[h] ||= { n: 0, nguoi: 0, dong: 0 };
  o.n++; if (v.nguoi > 0) o.nguoi++; if (v.dong > 0.03) o.dong++; }
for (const [ma, hs] of Object.entries(bang)) { console.log("\n" + ma + " — giờ: mẫu · có người · có cử động");
  for (const h of Object.keys(hs).sort()) { const o = hs[h]; console.log(`  ${h}h: ${o.n} mẫu · người ${o.nguoi} (${Math.round(o.nguoi / o.n * 100)}%) · cử động ${o.dong} ${"█".repeat(Math.round(o.nguoi / o.n * 10))}`); } }
const thieu = Object.values(KQ).filter((v) => v.tt !== "ok").length; console.log(`\nLấy được ${Object.values(KQ).length - thieu}/${Object.values(KQ).length} mẫu`);
