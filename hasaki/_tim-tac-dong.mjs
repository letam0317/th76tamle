/* Tạm 01/10 (user: "tìm đối tượng tác động đến thùng gần nhất trước thời gian ghi nhận"): quét video ngược mốc ghi nhận,
 * mỗi BUOC giây: (1) người (COCO-SSD, KHÔNG nhận mặt) nào CHẠM vùng đồ vật `vung`, (2) vùng đồ vật ĐỔI so với ảnh lúc ghi nhận.
 * node _tim-tac-dong.mjs <cau-hinh.json>  — {doan:[{file, batDau:"HH:MM:SS"}], vung:[x,y,w,h] (khung 1280×720), buoc:0.5, ra:"kq.json"}
 * Ra: dòng thời gian {gio, nguoi:[[x,y,w,h]...], cham:[...], doi} → đọc ngược để thấy ai/lúc nào động vào đồ vật lần cuối. */
import puppeteer from "puppeteer"; import fs from "node:fs"; import http from "node:http"; import path from "node:path";
import { fileURLToPath } from "node:url"; import { EDGE_PATH } from "./token-store.js";
const C = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const MDIR = path.join(path.dirname(fileURLToPath(import.meta.url)), ".cache-model", "ssd_mobilenet_v2");
const sv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split("?")[0]); let f = null;
  if (u.startsWith("/v/")) f = C.doan[Number(u.slice(3))]?.file; else if (u.startsWith("/m/")) f = path.join(MDIR, path.basename(u));
  if (!f || !fs.existsSync(f)) { r.writeHead(u === "/" ? 200 : 404, { "content-type": "text/html" }); return r.end(""); }
  const st = fs.statSync(f), rg = /bytes=(\d+)-(\d*)/.exec(q.headers.range || ""), ct = f.endsWith(".json") ? "application/json" : f.endsWith(".mp4") ? "video/mp4" : "application/octet-stream";
  if (rg) { const a = +rg[1], z = rg[2] ? +rg[2] : st.size - 1; r.writeHead(206, { "content-type": ct, "accept-ranges": "bytes", "content-range": `bytes ${a}-${z}/${st.size}`, "content-length": z - a + 1 }); fs.createReadStream(f, { start: a, end: z }).pipe(r); }
  else { r.writeHead(200, { "content-type": ct, "accept-ranges": "bytes", "content-length": st.size }); fs.createReadStream(f).pipe(r); }
});
await new Promise((ok) => sv.listen(0, "127.0.0.1", ok)); const GOC = "http://127.0.0.1:" + sv.address().port;
const b = await puppeteer.launch({ headless: true, protocolTimeout: 3600000, executablePath: EDGE_PATH });
const p = await b.newPage(); p.on("console", (m) => { if (/^\[q\]/.test(m.text())) console.log(m.text()); });
await p.goto(GOC + "/");
await p.setContent('<body><video id=v muted></video><script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"></script><script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js"></script></body>', { waitUntil: "networkidle0", timeout: 120000 });
/* 01/10 lượt 2 (user: "1 ngày xử lý 20 task được không"): CHỈ CHẠY AI KHI VÙNG ĐỒ VẬT ĐỔI — mỗi giây so vùng (mở rộng)
   với giây trước, rẻ; đổi ≥ NGUONG_DOI mới dò người, và chỉ dò trong ô vuông quanh vùng (1 lượt thay vì 3).
   Ghi từng mẫu ra console "[r]" → tiến trình sập giữa chừng không mất kết quả. */
const kq = [];
p.on("console", (m) => { const t = m.text(); if (t.startsWith("[r]")) kq.push(JSON.parse(t.slice(3))); });
await p.evaluate(async (C) => {
  const model = await cocoSsd.load({ base: "mobilenet_v2", modelUrl: location.origin + "/m/model.json" });
  const v = document.getElementById("v"), oc = document.createElement("canvas"); oc.width = 1280; oc.height = 720; const og = oc.getContext("2d", { willReadFrequently: true });
  const [vx, vy, vw, vh] = C.vung, BUOC = C.buoc || 1, NG = C.nguongDoi || 4;
  const pad = 220, cx = Math.max(0, vx - pad), cy = Math.max(0, vy - pad), cw = Math.min(1280 - cx, vw + 2 * pad), ch = Math.min(720 - cy, vh + 2 * pad);
  const tc = document.createElement("canvas"); tc.width = cw; tc.height = ch; const tg = tc.getContext("2d");
  const iou = (a, k) => { const x1 = Math.max(a[0], k[0]), y1 = Math.max(a[1], k[1]), x2 = Math.min(a[0] + a[2], k[0] + k[2]), y2 = Math.min(a[1] + a[3], k[1] + k[3]); return Math.max(0, x2 - x1) * Math.max(0, y2 - y1); };
  const vung = (x, y, w, h) => og.getImageData(x, y, w, h).data;
  const lech = (a, b) => { let e = 0; for (let j = 0; j < a.length; j += 16) e += Math.abs(a[j] - b[j]) + Math.abs(a[j + 1] - b[j + 1]) + Math.abs(a[j + 2] - b[j + 2]); return e / (a.length / 16) / 3; };
  const nap = (i) => new Promise((r) => { v.onloadedmetadata = r; v.src = location.origin + "/v/" + i; });
  const seek = (t) => new Promise((r) => { v.onseeked = r; v.currentTime = t; });
  const giay = (s) => { const [h, m, x] = s.split(":").map(Number); return h * 3600 + m * 60 + x; };
  const hms = (t) => [Math.floor(t / 3600), Math.floor(t / 60) % 60, Math.floor(t % 60)].map((x) => String(x).padStart(2, "0")).join(":");
  await nap(C.doan.length - 1); await seek(C.gocGiay); og.drawImage(v, 0, 0, 1280, 720); const goc = vung(vx, vy, vw, vh);
  let truoc = null, nAI = 0, n = 0; const t0all = performance.now();
  for (let i = 0; i < C.doan.length; i++) {
    await nap(i); const t0 = giay(C.doan[i].batDau);
    for (let t = 0; t < v.duration - 0.2; t += BUOC) {
      await seek(t); og.drawImage(v, 0, 0, 1280, 720); n++;
      const rong = vung(cx, cy, cw, ch), dong = truoc ? lech(rong, truoc) : 99; truoc = rong;
      const doi = Math.round(lech(vung(vx, vy, vw, vh), goc));
      let cham = [], nguoi = 0;
      if (dong >= NG) {
        nAI++; tg.drawImage(oc, cx, cy, cw, ch, 0, 0, cw, ch);
        const ds = (await model.detect(tc, 10, 0.3)).filter((d) => d.class === "person" && d.score >= 0.35).map((d) => [d.bbox[0] + cx, d.bbox[1] + cy, d.bbox[2], d.bbox[3]].map(Math.round));
        nguoi = ds.length; cham = ds.filter((d) => iou(d, C.vung) > 0);
      }
      console.log("[r]" + JSON.stringify({ gio: hms(t0 + t), dong: Math.round(dong), doi, nguoi, cham }));
    }
  }
  console.log("[q] " + n + " giây quét, chạy AI " + nAI + " lần, " + ((performance.now() - t0all) / 1000).toFixed(0) + " s");
}, C);
fs.writeFileSync(C.ra, JSON.stringify(kq)); await b.close(); sv.close();
console.log("ok", kq.length, "mẫu →", C.ra);
