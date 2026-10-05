/* Tạm 29/09: dựng CLIP NGẮN có khoanh vùng + chú thích từ video đầu ghi (Edge headless: canvas + MediaRecorder).
 * node _clip-chu-thich.mjs <cau-hinh.json>   — cấu hình: {nguon, ra, tu, den, tieuDe, moc:[{tu,den,khung:[x,y,w,h],chu,toc?,theo?}]} (giây trong file nguồn)
 *  toc: 2 = tua nhanh ×2 cho đoạn chỉ đi lại (01/10); mặc định 1 = tốc độ thật ở thao tác mấu chốt.
 *  theo (01/10 user: "khung phải di chuyển theo người"): MẶC ĐỊNH BẬT — lượt 1 dò NGƯỜI mỗi 0,2 s bằng COCO-SSD
 *  (chỉ phát hiện "người", KHÔNG nhận mặt), đầu mỗi mốc chọn người trùng `khung` nhất rồi bám người đó
 *  khung-sang-khung; mất dấu ≤1,5 s thì giữ chỗ cũ (nét đứt). theo:false = khung đứng yên như cũ. */
import puppeteer from "puppeteer"; import fs from "node:fs"; import http from "node:http"; import path from "node:path"; import { EDGE_PATH } from "./token-store.js"; import { fileURLToPath } from "node:url";
const C = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
/* máy chủ tạm 127.0.0.1: /v = video nguồn, /m = mô hình COCO-SSD tải sẵn (.cache-model) — trang file:// bị chặn tải mô hình */
const MDIR = path.join(path.dirname(fileURLToPath(import.meta.url)), ".cache-model", "ssd_mobilenet_v2");
const sv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split("?")[0]);
  const f = u === "/v" ? C.nguon : u.startsWith("/m/") ? path.join(MDIR, path.basename(u)) : null;
  if (!f || !fs.existsSync(f)) { r.writeHead(u === "/" ? 200 : 404, { "content-type": "text/html" }); return r.end(""); }
  const st = fs.statSync(f), rg = /bytes=(\d+)-(\d*)/.exec(q.headers.range || "");
  const ct = f.endsWith(".json") ? "application/json" : f.endsWith(".mp4") ? "video/mp4" : "application/octet-stream";
  if (rg) { const a = +rg[1], z = rg[2] ? +rg[2] : st.size - 1; r.writeHead(206, { "content-type": ct, "accept-ranges": "bytes", "content-range": `bytes ${a}-${z}/${st.size}`, "content-length": z - a + 1 }); fs.createReadStream(f, { start: a, end: z }).pipe(r); }
  else { r.writeHead(200, { "content-type": ct, "accept-ranges": "bytes", "content-length": st.size }); fs.createReadStream(f).pipe(r); }
});
await new Promise((ok) => sv.listen(0, "127.0.0.1", ok));
const GOC = "http://127.0.0.1:" + sv.address().port;
const url = GOC + "/v";
const b = await puppeteer.launch({ headless: true, protocolTimeout: 1800000, executablePath: EDGE_PATH, args: ["--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required"] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
p.on("console", (m) => { const t = m.text(); if (/^\[theo\]/.test(t)) console.log(t); });
await p.goto(GOC + "/");
await p.setContent('<body style="margin:0"><video id=v src="' + url + '" muted playsinline></video><canvas id=c width=1280 height=720></canvas>' +
  '<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"></script>' +
  '<script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js"></script></body>', { waitUntil: "networkidle0", timeout: 120000 });
const b64 = await p.evaluate(async (C) => {
  const v = document.getElementById("v"), cv = document.getElementById("c"), g = cv.getContext("2d");
  await new Promise((r) => { if (v.readyState >= 1) r(); else v.onloadedmetadata = r; });
  const sx = 1280 / v.videoWidth, sy = 720 / v.videoHeight;
  const seek = (t) => new Promise((r) => { v.onseeked = r; v.currentTime = t; });

  /* ===== LƯỢT 1: dò người + bám theo cho từng mốc theo !== false ===== */
  const BUOC = 0.2;
  const iou = (a, b) => { const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]), x2 = Math.min(a[0] + a[2], b[0] + b[2]), y2 = Math.min(a[1] + a[3], b[1] + b[3]);
    const i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1); return i / (a[2] * a[3] + b[2] * b[3] - i || 1); };
  const tam = (a) => [a[0] + a[2] / 2, a[1] + a[3] / 2];
  const kc = (a, b) => { const [ax, ay] = tam(a), [bx, by] = tam(b); return Math.hypot(ax - bx, ay - by); };
  const canTheo = C.moc.some((m) => m.theo !== false);
  if (canTheo) {
    let model = null;
    try { model = await cocoSsd.load({ base: "mobilenet_v2", modelUrl: location.origin + "/m/model.json" }); } catch (e) { console.log("[theo] không nạp được mô hình: " + e.message + " — dùng khung cố định"); }
    if (model) {
      /* 01/10 lượt 3: camera trên cao → người nhỏ/cúi hay bị sót. (a) dò trên CẢ khung + 2 nửa trái/phải phóng to,
         gộp trùng; (b) khung nào không dò ra thì SO HÌNH (khớp mẫu ảnh xám thu nhỏ 1/4) với chỗ người ở khung trước
         để bám tiếp (nét đứt) — tối đa 6 s, lệch hình quá nhiều thì thôi. */
      const t0 = performance.now();
      const oc = document.createElement("canvas"); oc.width = 1280; oc.height = 720; const og = oc.getContext("2d");
      const tc = document.createElement("canvas"); tc.width = 760; tc.height = 720; const tg = tc.getContext("2d");
      const nc = document.createElement("canvas"); nc.width = 320; nc.height = 180; const ng = nc.getContext("2d", { willReadFrequently: true });
      let RGB = null;
      const xam = () => { ng.drawImage(oc, 0, 0, 320, 180); const d = ng.getImageData(0, 0, 320, 180).data; RGB = d; const a0 = d, a = new Float32Array(320 * 180); void a0;
        for (let i = 0; i < a.length; i++) a[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11; return a; };
      const doNguoi = async () => {
        og.drawImage(v, 0, 0, 1280, 720); const all = [];
        const lay = (ds, ox) => { for (const d of ds) if (d.class === "person" && d.score >= 0.35) all.push({ k: [d.bbox[0] + ox, d.bbox[1], d.bbox[2], d.bbox[3]], s: d.score }); };
        lay(await model.detect(oc, 20, 0.3), 0);
        for (const ox of [0, 520]) { tg.drawImage(oc, ox, 0, 760, 720, 0, 0, 760, 720); lay(await model.detect(tc, 20, 0.3), ox); }
        const kq = []; for (const d of all.sort((a, b) => b.s - a.s)) if (d.k[3] >= 50 && d.k[3] >= 0.6 * d.k[2] && !kq.some((x) => iou(x.k, d.k) > 0.45)) kq.push(d);
        return kq.map((x) => x.k);
      };
      const mau = (img, k) => { const x0 = Math.max(0, Math.round(k[0] / 4)), y0 = Math.max(0, Math.round(k[1] / 4)), w = Math.max(4, Math.min(320 - x0, Math.round(k[2] / 4))), h = Math.max(4, Math.min(180 - y0, Math.round(k[3] / 4)));
        const a = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = img[(y0 + y) * 320 + x0 + x]; return { a, w, h, x0, y0 }; };
      const khop = (img, M) => { let best = { e: 1e9, dx: 0, dy: 0 };
        for (let dy = -14; dy <= 14; dy += 2) for (let dx = -14; dx <= 14; dx += 2) {
          const X = M.x0 + dx, Y = M.y0 + dy; if (X < 0 || Y < 0 || X + M.w > 320 || Y + M.h > 180) continue;
          let e = 0; for (let y = 0; y < M.h; y += 2) for (let x = 0; x < M.w; x += 2) e += Math.abs(img[(Y + y) * 320 + X + x] - M.a[y * M.w + x]);
          e /= Math.ceil(M.h / 2) * Math.ceil(M.w / 2); if (e < best.e) best = { e, dx, dy }; }
        return best; };
      /* 01/10 lượt 5 (13393074 09:55:30): người áo xanh đi sát người áo đen → khung NHẢY NGƯỜI. Ghi nhớ MÀU THÂN TRÊN
         (giữa khung, 20–55 % chiều cao) của người được chọn; ứng viên lệch màu quá xa thì không nhận. */
      const mauAo = (k) => { const x0 = Math.max(0, Math.round((k[0] + k[2] * 0.3) / 4)), x1 = Math.min(320, Math.round((k[0] + k[2] * 0.7) / 4)),
          y0 = Math.max(0, Math.round((k[1] + k[3] * 0.2) / 4)), y1 = Math.min(180, Math.round((k[1] + k[3] * 0.55) / 4));
        let r = 0, g2 = 0, b = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * 320 + x) * 4; r += RGB[i]; g2 += RGB[i + 1]; b += RGB[i + 2]; n++; }
        return n ? [r / n, g2 / n, b / n] : null; };
      const lechMau = (a, b) => (a && b) ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : 0;
      for (const m of C.moc) {
        if (m.theo === false) continue;
        let ao = null;   // màu áo người đang bám
        m.vet = []; let cur = null, M = null, mat = 0, chac = null; const lsu = [];   // lsu = ảnh xám các bước trước (lọc chuyển động)   // chac = chỗ gần nhất DÒ RA người (neo chống trôi)
        for (let t = m.tu; t < m.den; t += BUOC) {
          await seek(t);
          const ds0 = await doNguoi(), img = xam(); lsu.push(img); if (lsu.length > 6) lsu.shift();
          /* 01/10 lượt 4: khe tối giữa pallet trên kệ bị dò thành "người" lặp lại 1 chỗ → bỏ vùng ĐỨNG YÊN suốt ~1 s */
          const cu = lsu.length > 5 ? lsu[0] : null;
          const dong = (k) => { if (!cu) return 99; const x0 = Math.max(0, Math.round(k[0] / 4)), y0 = Math.max(0, Math.round(k[1] / 4)), x1 = Math.min(320, Math.round((k[0] + k[2]) / 4)), y1 = Math.min(180, Math.round((k[1] + k[3]) / 4));
            let e = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { e += Math.abs(img[y * 320 + x] - cu[y * 320 + x]); n++; } return n ? e / n : 0; };
          const ds = ds0.filter((k) => dong(k) >= 2.5);
          let chon = null;
          if (!cur) {
            chon = ds.filter((d) => iou(d, m.khung) > 0.05 || kc(d, m.khung) < 180).sort((a, b) => iou(b, m.khung) - iou(a, m.khung) || kc(a, m.khung) - kc(b, m.khung))[0];
          } else {
            chon = ds.filter((d) => (iou(d, cur) > 0.15 || kc(d, cur) < 110 || kc(d, chac) < 110 + mat * 25) && lechMau(mauAo(d), ao) < 55).sort((a, b) => (Math.max(iou(b, cur), iou(b, chac)) - Math.max(iou(a, cur), iou(a, chac))) || (kc(a, chac) - kc(b, chac)))[0];
          }
          if (chon) { const mc = mauAo(chon); ao = ao ? ao.map((x, i) => x * 0.85 + mc[i] * 0.15) : mc; cur = cur ? cur.map((x, i) => x * 0.2 + chon[i] * 0.8) : chon; M = mau(img, cur); chac = cur.slice(); mat = 0; m.vet.push({ t, k: cur.slice(), ok: true }); continue; }
          if (cur && M && mat * BUOC < 6) {
            const b = khop(img, M); mat++;
            const nx = [cur[0] + b.dx * 4, cur[1] + b.dy * 4, cur[2], cur[3]];
            /* so hình chỉ được trôi ≤120 px quanh chỗ dò ra cuối (09:50:30 từng trôi lên kệ) */
            if (b.e < 22 && kc(nx, chac) < 120) { cur = nx; M = mau(img, cur); m.vet.push({ t, k: cur.slice(), ok: false }); continue; }
          }
          if (cur && mat * BUOC <= 1.5) { m.vet.push({ t, k: cur.slice(), ok: false }); continue; }
          cur = null; M = null; m.vet.push({ t, k: null, ok: false });
        }
        const thay = m.vet.filter((x) => x.ok).length, bam = m.vet.filter((x) => x.k).length;
        console.log("[theo] mốc " + m.tu + "–" + m.den + "s: dò ra người " + thay + "/" + m.vet.length + " · có khung " + bam + "/" + m.vet.length);
      }
      console.log("[theo] dò xong " + ((performance.now() - t0) / 1000).toFixed(0) + " s");
    }
  }
  const khungLuc = (m, t) => {   // nội suy giữa 2 mẫu kề nhau
    if (!m.vet || !m.vet.length) return { k: m.khung, ok: true };
    let i = Math.min(m.vet.length - 1, Math.max(0, Math.floor((t - m.tu) / BUOC)));
    const a = m.vet[i], c = m.vet[i + 1];
    if (!a.k) return { k: m.khung, ok: false, mat: true };
    if (!c || !c.k) return { k: a.k, ok: a.ok };
    const f = Math.min(1, Math.max(0, (t - a.t) / BUOC));
    return { k: a.k.map((x, j) => x + (c.k[j] - x) * f), ok: a.ok || c.ok };
  };

  /* ===== LƯỢT 2: dựng clip ===== */
  await seek(C.tu);
  const rec = new MediaRecorder(cv.captureStream(25), { mimeType: "video/webm;codecs=vp8", videoBitsPerSecond: 2500000 });
  const parts = []; rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
  const xong = new Promise((r) => (rec.onstop = r));
  const ve = () => {
    g.drawImage(v, 0, 0, 1280, 720);
    g.fillStyle = "rgba(0,0,0,.65)"; g.fillRect(0, 0, 1280, 44);
    g.fillStyle = "#fff"; g.font = "bold 22px Arial"; g.fillText(C.tieuDe, 14, 30);
    for (const m of C.moc) if (v.currentTime >= m.tu && v.currentTime < m.den) {
      const toc = m.toc || 1; if (v.playbackRate !== toc) v.playbackRate = toc;
      if (toc !== 1) { g.fillStyle = "rgba(0,0,0,.7)"; g.fillRect(1150, 54, 118, 40); g.fillStyle = "#ffd400"; g.font = "bold 24px Arial"; g.fillText("▶▶ x" + toc, 1162, 82); }
      const kq = khungLuc(m, v.currentTime);
      if (!kq.mat) {
        const pad = m.vet ? 12 : 0; const [x, y, w, h] = kq.k;
        g.lineWidth = 5; g.strokeStyle = "#ff1f1f"; g.setLineDash(kq.ok ? [] : [14, 10]);
        g.strokeRect(x - pad, y - pad, w + 2 * pad, h + 2 * pad); g.setLineDash([]);
        if (m.vet) { g.fillStyle = "#ff1f1f"; g.beginPath(); g.moveTo(x + w / 2 - 14, y - pad - 30); g.lineTo(x + w / 2 + 14, y - pad - 30); g.lineTo(x + w / 2, y - pad - 8); g.closePath(); g.fill(); }
      }
      g.font = "bold 24px Arial"; const tw = g.measureText(m.chu).width + 24;
      g.fillStyle = "rgba(220,20,20,.92)"; g.fillRect(12, 672 - 4, tw, 44);
      g.fillStyle = "#fff"; g.fillText(m.chu, 24, 700);
    }
  };
  rec.start(1000); await v.play();
  await new Promise((r) => { const tick = () => { ve(); if (v.currentTime >= C.den || v.ended) { v.pause(); r(); } else requestAnimationFrame(tick); }; tick(); });
  rec.stop(); await xong;
  const blob = new Blob(parts, { type: "video/webm" }); const buf = new Uint8Array(await blob.arrayBuffer());
  let s = ""; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768));
  return btoa(s);
}, C);
fs.writeFileSync(C.ra, Buffer.from(b64, "base64")); await b.close(); sv.close();
console.log("ok", (fs.statSync(C.ra).size / 1048576).toFixed(1) + " MB →", C.ra);
