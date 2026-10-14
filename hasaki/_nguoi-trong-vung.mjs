/* 07/10/2026 — ĐẾM NGƯỜI TRONG VÙNG theo thời gian (COCO-SSD, KHÔNG nhận mặt) cho camera-bao-cao.mjs.
 * Bài học 14079520: so điểm ảnh với nền trung vị đếm cả xe đẩy/thùng/pallet đổi chỗ → "có mặt" giả; phải đếm NGƯỜI thật.
 * node _nguoi-trong-vung.mjs <cau-hinh.json>
 *   {doan:[{file, batDau:"HH:MM:SS"}], vung:[x,y,w,h] (khung 1280×720), buoc:2, noi:40, ra:"kq.json"}
 * Ra: [{gio:"HH:MM:SS", ms, nguoi:[[x,y,w,h,diem]…], trong:[[x,y,w,h]…]}] — trong = người có điểm thân (x+w/2, y+0,6h) nằm trong vùng nới `noi` px. */
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
const giay = (s) => { const [h, m, x] = s.split(":").map(Number); return h * 3600 + m * 60 + x; };
const kq = await p.evaluate(async (C) => {
  const v = document.getElementById("v"); const BUOC = C.buoc || 2, NOI = C.noi == null ? 40 : C.noi; const [rx, ry, rw, rh] = C.vung;
  const model = await cocoSsd.load({ base: "mobilenet_v2", modelUrl: location.origin + "/m/model.json" });
  const oc = document.createElement("canvas"); oc.width = 1280; oc.height = 720; const og = oc.getContext("2d", { willReadFrequently: true });
  const tc = document.createElement("canvas"); tc.width = 760; tc.height = 720; const tg = tc.getContext("2d");
  const iou = (a, c) => { const x1 = Math.max(a[0], c[0]), y1 = Math.max(a[1], c[1]), x2 = Math.min(a[0] + a[2], c[0] + c[2]), y2 = Math.min(a[1] + a[3], c[1] + c[3]);
    const i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1); return i / (a[2] * a[3] + c[2] * c[3] - i || 1); };
  const seek = (t) => new Promise((r) => { v.onseeked = r; v.currentTime = t; });
  const ra = []; const t00 = performance.now();
  for (const [i, d] of C.doan.entries()) {
    v.src = "/v/" + i; await new Promise((r) => { v.onloadedmetadata = r; });
    for (let t = 0; t < v.duration - 0.05; t += BUOC) {
      await seek(t); og.drawImage(v, 0, 0, 1280, 720); const all = [];
      const lay = (ds, ox) => { for (const x of ds) if (x.class === "person" && x.score >= 0.3) all.push({ k: [x.bbox[0] + ox, x.bbox[1], x.bbox[2], x.bbox[3]], s: x.score }); };
      lay(await model.detect(oc, 20, 0.2), 0);
      for (const ox of [0, 520]) { tg.drawImage(oc, ox, 0, 760, 720, 0, 0, 760, 720); lay(await model.detect(tc, 20, 0.2), ox); }
      const ds = []; for (const x of all.sort((a, c) => c.s - a.s)) if (x.k[3] >= 40 && !ds.some((y) => iou(y.k, x.k) > 0.45)) ds.push(x);
      const trong = ds.filter((x) => { const cx = x.k[0] + x.k[2] / 2, cy = x.k[1] + x.k[3] * 0.6; return cx >= rx - NOI && cx <= rx + rw + NOI && cy >= ry - NOI && cy <= ry + rh + NOI; }).map((x) => x.k.map(Math.round));
      ra.push({ doan: i, t, nguoi: ds.map((x) => [...x.k.map(Math.round), Math.round(x.s * 100) / 100]), trong });
    }
    console.log("[q] đoạn " + i + " xong · " + ((performance.now() - t00) / 1000).toFixed(0) + " s");
  }
  return ra;
}, C);
for (const x of kq) { const d = C.doan[x.doan]; const s = giay(d.batDau) + x.t; x.gio = [s / 3600 | 0, (s % 3600) / 60 | 0, s % 60 | 0].map((n) => String(n).padStart(2, "0")).join(":"); x.ms = Math.round(x.t * 1000); }
fs.writeFileSync(C.ra, JSON.stringify(kq)); await b.close(); sv.close();
console.log("ok", kq.length, "khung ·", kq.filter((x) => x.trong.length).length, "khung có người trong vùng →", C.ra);
