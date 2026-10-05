/* Tạm 02/10: NỐI nhiều đoạn (nhiều file đầu ghi) thành 1 clip webm có chú thích + tua nhanh (Edge headless: canvas + MediaRecorder).
 * node _clip-noi.mjs <cau-hinh.json>
 * cấu hình: {ra, tieuDe, kbps?, nguon:{ten:{file, bd:"HH:MM:SS"}}, doan:[{n:ten, tu:"HH:MM:SS", den:"HH:MM:SS", toc?, chu, khung?, theo?, nhan?}]}
 *  giờ theo đồng hồ camera; bd = giờ đầu file. toc 1 = tốc độ thật (thao tác mấu chốt), 2–3 = đoạn đi lại, 10 = đoạn không ai tới gần.
 *  khung:[x,y,w,h] = ô VÀNG đứng yên (vật dụng). theo:[x,y,w,h] = khung ĐỎ nét đứt chạy, BÁM NGƯỜI vi phạm/nghi vi phạm (02/10 user: "khung phải di chuyển theo người"):
 *  đầu đoạn chọn người gần ô này nhất rồi bám theo vị trí + màu áo; nhan = chữ trên đầu người. Chỉ dò "người" (COCO-SSD), KHÔNG nhận mặt. */
import puppeteer from "puppeteer"; import fs from "node:fs"; import http from "node:http"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { EDGE_PATH } from "./token-store.js";
import { chuanTuSau } from "./tu-ngu.mjs";
const MDIR = path.join(path.dirname(fileURLToPath(import.meta.url)), ".cache-model", "ssd_mobilenet_v2");
const C = chuanTuSau(JSON.parse(fs.readFileSync(process.argv[2], "utf8")));   // TU-01: chú thích/bình luận qua bộ lọc từ ngữ
const giay = (s) => { const [h, m, x] = s.split(":").map(Number); return h * 3600 + m * 60 + x; };
const doan = C.doan.map((d) => { const n = C.nguon[d.n]; return { ...d, a: giay(d.tu) - giay(n.bd), z: giay(d.den) - giay(n.bd),
  neoS: d.neo ? d.neo.map(([h, k]) => ({ s: giay(h) - giay(n.bd), k })).sort((x, y) => x.s - y.s) : null }; });
const sv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split("?")[0]); const ten = u.slice(3);
  const f = u.startsWith("/v/") && C.nguon[ten] ? C.nguon[ten].file : u.startsWith("/m/") ? path.join(MDIR, path.basename(u)) : null;
  if (!f || !fs.existsSync(f)) { r.writeHead(u === "/" ? 200 : 404, { "content-type": "text/html" }); return r.end(""); }
  const st = fs.statSync(f), rg = /bytes=(\d+)-(\d*)/.exec(q.headers.range || "");
  const ct = f.endsWith(".json") ? "application/json" : f.endsWith(".mp4") ? "video/mp4" : "application/octet-stream";
  if (rg) { const a = +rg[1], z = rg[2] ? +rg[2] : st.size - 1; r.writeHead(206, { "content-type": ct, "accept-ranges": "bytes", "content-range": `bytes ${a}-${z}/${st.size}`, "content-length": z - a + 1 }); fs.createReadStream(f, { start: a, end: z }).pipe(r); }
  else { r.writeHead(200, { "content-type": ct, "accept-ranges": "bytes", "content-length": st.size }); fs.createReadStream(f).pipe(r); }
});
await new Promise((ok) => sv.listen(0, "127.0.0.1", ok));
const GOC = "http://127.0.0.1:" + sv.address().port;
const b = await puppeteer.launch({ headless: true, protocolTimeout: 7200000, executablePath: EDGE_PATH, args: ["--autoplay-policy=no-user-gesture-required"] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
p.on("console", (m) => console.log(m.text()));
await p.goto(GOC + "/");
await p.setContent('<body style="margin:0"><video id=v muted playsinline preload=auto></video><canvas id=c width=1280 height=720></canvas>' +
  (C.doan.some((d) => d.theo && !(C.chiNeo || d.chiNeo)) ? '<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"></script><script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js"></script>' : "") +
  "</body>", { waitUntil: "networkidle0", timeout: 120000 });
const b64 = await p.evaluate(async (C, doan) => {
  const v = document.getElementById("v"), cv = document.getElementById("c"), g = cv.getContext("2d");
  /* ===== LƯỢT 1: dò người mỗi 0,2 s cho các đoạn có theo (rút gọn từ _clip-chu-thich.mjs) ===== */
  const BUOC = C.buoc || 0.25;   // 02/10: 0,2→0,25 s cho nhẹ máy (bám chuyển động + neo bù)
  const iou = (a, c) => { const x1 = Math.max(a[0], c[0]), y1 = Math.max(a[1], c[1]), x2 = Math.min(a[0] + a[2], c[0] + c[2]), y2 = Math.min(a[1] + a[3], c[1] + c[3]);
    const i = Math.max(0, x2 - x1) * Math.max(0, y2 - y1); return i / (a[2] * a[3] + c[2] * c[3] - i || 1); };
  const tam = (a) => [a[0] + a[2] / 2, a[1] + a[3] / 2]; const kc = (a, c) => { const [ax, ay] = tam(a), [bx, by] = tam(c); return Math.hypot(ax - bx, ay - by); };
  const seek = (t) => new Promise((r) => { v.onseeked = r; v.currentTime = t; });
  let srcCu = null;
  const doiSrc = async (n) => { if (srcCu !== n) { srcCu = n; v.src = "/v/" + encodeURIComponent(n); await new Promise((r) => { v.onloadedmetadata = r; }); } };
  if (doan.some((d) => d.theo)) {
    let model = null; const canModel = doan.some((d) => d.theo && !(C.chiNeo || d.chiNeo));
    if (canModel) try { model = await cocoSsd.load({ base: "mobilenet_v2", modelUrl: location.origin + "/m/model.json" }); } catch (e) { console.log("[theo] không nạp được mô hình: " + e.message); }
    const oc = document.createElement("canvas"); oc.width = 1280; oc.height = 720; const og = oc.getContext("2d", { willReadFrequently: true });
    const tc = document.createElement("canvas"); tc.width = 760; tc.height = 720; const tg = tc.getContext("2d");
    const mauAo = (k) => { const x0 = Math.max(0, Math.round(k[0] + k[2] * 0.3)), y0 = Math.max(0, Math.round(k[1] + k[3] * 0.2));
      const w = Math.max(2, Math.min(1280 - x0, Math.round(k[2] * 0.4))), h = Math.max(2, Math.min(720 - y0, Math.round(k[3] * 0.35)));
      const dd = og.getImageData(x0, y0, w, h).data; let r = 0, g2 = 0, bb = 0, n = 0; for (let i = 0; i < dd.length; i += 16) { r += dd[i]; g2 += dd[i + 1]; bb += dd[i + 2]; n++; } return n ? [r / n, g2 / n, bb / n] : null; };
    const lech = (a, c) => (a && c) ? Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]) : 0;
    /* 05/10: chiNeo = khung đỏ chỉ NỘI SUY giữa các điểm neo người soi tay — không chạy mô hình (nhanh ~như phát clip) */
    for (const d of doan) if (d.theo && (C.chiNeo || d.chiNeo) && d.neoS && d.neoS.length) {
      d.vet = []; const N = d.neoS;
      for (let t = Math.max(0, d.a); t < d.z; t += BUOC) { const a0 = [...N].reverse().find((x) => x.s <= t) || N[0], a1 = N.find((x) => x.s > t);
        const k = a1 ? a0.k.map((x, i) => x + (a1.k[i] - x) * Math.min(1, Math.max(0, (t - a0.s) / (a1.s - a0.s || 1)))) : a0.k.slice(); d.vet.push({ t, k, ok: true }); }
      d.xong = true;
    }
    for (const d of model ? doan : []) {
      if (!d.theo || d.xong) continue;
      await doiSrc(d.n);
      /* 02/10 lượt 2: camera mắt cá nhìn từ trên (phòng cắt giấy) → mô hình chỉ dò ra 0–40 % khung. Dự phòng: bám VÙNG
         CHUYỂN ĐỘNG (so ảnh xám 1/4 với 0,4 s trước) quanh chỗ cũ — người là vật chuyển động chính; chỉ khi cả hai đều mất
         quá 3 s mới bỏ khung. ok=true: mô hình thấy người (nét liền) · ok=false: bám chuyển động/giữ chỗ (nét đứt). */
      const xc = document.createElement("canvas"); xc.width = 320; xc.height = 180; const xg = xc.getContext("2d", { willReadFrequently: true });
      let RGB = null;
      const xam = () => { xg.drawImage(oc, 0, 0, 320, 180); const dd = xg.getImageData(0, 0, 320, 180).data, a = new Float32Array(320 * 180); RGB = dd; for (let i = 0; i < a.length; i++) a[i] = dd[i * 4] * 0.3 + dd[i * 4 + 1] * 0.59 + dd[i * 4 + 2] * 0.11; return a; };
      const lsu = [];
      d.vet = []; let cur = d.theo.slice(), ao = null, mat = 0, daThay = false; const t0 = performance.now(); let nDo = 0, nDong = 0;
      for (let t = Math.max(0, d.a); t < Math.min(d.z, v.duration - 0.05); t += BUOC) {
        await seek(t); og.drawImage(v, 0, 0, 1280, 720); const img = xam(); lsu.push(img); if (lsu.length > 3) lsu.shift(); const all = [];
        const keo = () => { if (d._ky) cur = cur.map((x, i) => x * 0.5 + d._ky[i] * 0.5); };
        if (!ao) ao = mauAo(cur);   // màu áo mồi từ ô theo (đặt ô theo đúng thân người)
        /* điểm NEO (người soi tay): tới mốc thì đặt lại khung đúng người; giữa 2 neo kéo khung về đường nối 2 neo (chống trôi sang xe đẩy) */
        if (d.neoS) {
          const qua = d.neoS.find((x) => x.s > t - BUOC && x.s <= t); if (qua) { cur = qua.k.slice(); ao = mauAo(cur); daThay = true; mat = 0; }
          const a0 = [...d.neoS].reverse().find((x) => x.s <= t), a1 = d.neoS.find((x) => x.s > t);
          if (a0 && a1) { const f = (t - a0.s) / (a1.s - a0.s); d._ky = a0.k.map((x, i) => x + (a1.k[i] - x) * f); } else d._ky = null;
        }
        const lay = (ds, ox) => { for (const x of ds) if (x.class === "person" && x.score >= 0.25) all.push({ k: [x.bbox[0] + ox, x.bbox[1], x.bbox[2], x.bbox[3]], s: x.score }); };
        lay(await model.detect(oc, 20, 0.2), 0);
        for (const ox of [0, 520]) { tg.drawImage(oc, ox, 0, 760, 720, 0, 0, 760, 720); lay(await model.detect(tc, 20, 0.2), ox); }
        const ds = []; for (const x of all.sort((a, c) => c.s - a.s)) if (x.k[3] >= 40 && !ds.some((y) => iou(y, x.k) > 0.45)) ds.push(x.k);
        const chon = ds.filter((k) => (iou(k, cur) > 0.05 || kc(k, cur) < (daThay ? 130 + mat * 20 : 240)) && (!ao || lech(mauAo(k), ao) < 70))
          .sort((a, c) => iou(c, cur) - iou(a, cur) || kc(a, cur) - kc(c, cur))[0];
        if (chon) { const mc = mauAo(chon); ao = ao ? ao.map((x, i) => x * 0.85 + mc[i] * 0.15) : mc; cur = daThay ? cur.map((x, i) => x * 0.25 + chon[i] * 0.75) : chon.slice(); daThay = true; mat = 0; nDo++; keo(); d.vet.push({ t, k: cur.slice(), ok: true }); continue; }
        /* dự phòng chuyển động: trọng tâm điểm ảnh đổi >22 trong cửa sổ quanh khung (nới rộng 45 px ảnh nhỏ = 180 px thật) */
        if (lsu.length >= 3) {
          const cu = lsu[0], x0 = Math.max(0, Math.floor(cur[0] / 4) - 45), y0 = Math.max(0, Math.floor(cur[1] / 4) - 45), x1 = Math.min(320, Math.ceil((cur[0] + cur[2]) / 4) + 45), y1 = Math.min(180, Math.ceil((cur[1] + cur[3]) / 4) + 45);
          /* chỉ tính điểm vừa ĐỔI vừa GẦN MÀU ÁO (xe pallet chở carton cũng chuyển động — 16:57:50 khung từng trôi sang xe) */
          let sx = 0, sy = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * 320 + x;
            if (Math.abs(img[i] - cu[i]) > 22 && (!ao || Math.hypot(RGB[i * 4] - ao[0], RGB[i * 4 + 1] - ao[1], RGB[i * 4 + 2] - ao[2]) < 55)) { sx += x; sy += y; n++; } }
          if (n >= 12) { const cx = sx / n * 4, cy = sy / n * 4; const nx = [cx - cur[2] / 2, cy - cur[3] / 2, cur[2], cur[3]];
            cur = cur.map((x, i) => x * 0.6 + nx[i] * 0.4); mat = 0; nDong++; keo(); d.vet.push({ t, k: cur.slice(), ok: false }); continue; }
        }
        mat++; if (d._ky) { cur = d._ky.slice(); d.vet.push({ t, k: cur.slice(), ok: false }); continue; }
        if (mat * BUOC <= 3) { d.vet.push({ t, k: cur.slice(), ok: false }); continue; }
        d.vet.push({ t, k: null, ok: false });
      }
      console.log("[theo] " + d.tu + "–" + d.den + ": mô hình thấy " + nDo + " · bám chuyển động " + nDong + " · tổng " + d.vet.length + " · có khung " + d.vet.filter((x) => x.k).length + " · " + ((performance.now() - t0) / 1000).toFixed(0) + " s");
    }
  }
  const khungNguoi = (d, t) => { if (!d.vet || !d.vet.length) return null; const i = Math.min(d.vet.length - 1, Math.max(0, Math.floor((t - Math.max(0, d.a)) / BUOC)));
    const a = d.vet[i], c = d.vet[i + 1]; if (!a.k) return null; if (!c || !c.k) return { k: a.k, ok: a.ok };
    const f = Math.min(1, Math.max(0, (t - a.t) / BUOC)); return { k: a.k.map((x, j) => x + (c.k[j] - x) * f), ok: a.ok || c.ok }; };

  /* ===== LƯỢT 2: dựng clip ===== */
  const rec = new MediaRecorder(cv.captureStream(25), { mimeType: "video/webm;codecs=vp8", videoBitsPerSecond: (C.kbps || 1800) * 1000 });
  const parts = []; rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
  const xong = new Promise((r) => (rec.onstop = r));
  let d = null;
  const hc = document.createElement("canvas"); hc.width = 1280; hc.height = 720; const hg = hc.getContext("2d");   // khung hình cuối — đổi nguồn không để vệt khung cũ
  const ve = () => {
    if (v.readyState >= 2) hg.drawImage(v, 0, 0, 1280, 720);
    g.drawImage(hc, 0, 0);
    g.fillStyle = "rgba(0,0,0,.65)"; g.fillRect(0, 0, 1280, 44);
    g.fillStyle = "#fff"; g.font = "bold 21px Arial"; g.fillText(C.tieuDe, 14, 30);
    if (!d) return;
    if (d.toc && d.toc !== 1) { g.fillStyle = "rgba(0,0,0,.75)"; g.fillRect(1140, 54, 128, 42); g.fillStyle = "#ffd400"; g.font = "bold 26px Arial"; g.fillText("▶▶ x" + d.toc, 1152, 84); }
    /* 02/10 user: vật dụng = khung VÀNG; người vi phạm/nghi vi phạm = khung ĐỎ nét đứt CHẠY liên tục, nhãn = tên NV (không định danh được thì ghi rõ); NV không liên quan KHÔNG khoanh */
    if (d.khung) { const [x, y, w, h] = d.khung; g.lineWidth = 5; g.strokeStyle = "#ffd400"; g.strokeRect(x, y, w, h); }
    const kn = khungNguoi(d, v.currentTime);
    if (kn) { const [x, y, w, h] = kn.k, pad = 10; g.lineWidth = 5; g.strokeStyle = "#ff1f1f"; g.setLineDash([16, 10]); g.lineDashOffset = -((performance.now() / 25) % 26); g.strokeRect(x - pad, y - pad, w + 2 * pad, h + 2 * pad); g.setLineDash([]); g.lineDashOffset = 0;
      g.fillStyle = "#ff1f1f"; g.beginPath(); g.moveTo(x + w / 2 - 14, y - pad - 30); g.lineTo(x + w / 2 + 14, y - pad - 30); g.lineTo(x + w / 2, y - pad - 8); g.closePath(); g.fill();
      if (d.nhan) { g.font = "bold 20px Arial"; const tw = g.measureText(d.nhan).width + 14; const lx = Math.min(1270 - tw, Math.max(4, x + w / 2 - tw / 2)), ly = Math.max(48, y - pad - 62);
        g.fillStyle = "rgba(200,20,20,.92)"; g.fillRect(lx, ly, tw, 28); g.fillStyle = "#fff"; g.fillText(d.nhan, lx + 7, ly + 21); } }
    const dong = String(d.chu).split("\n"); g.font = "bold 23px Arial";
    dong.forEach((s, i) => { const y0 = 720 - 46 * (dong.length - i); const tw = g.measureText(s).width + 24;
      g.fillStyle = "rgba(200,20,20,.92)"; g.fillRect(12, y0, tw, 42); g.fillStyle = "#fff"; g.fillText(s, 24, y0 + 29); });
  };
  let chay = true; const loop = () => { ve(); if (chay) requestAnimationFrame(loop); };
  rec.start(1000); loop();
  for (const x of doan) {
    await doiSrc(x.n);
    await seek(Math.max(0, x.a));
    d = x; v.playbackRate = x.toc || 1; await v.play();
    const het = Math.min(x.z, v.duration - 0.05);
    await new Promise((r) => { const t = () => { if (v.currentTime >= het || v.ended) { v.pause(); r(); } else requestAnimationFrame(t); }; t(); });
    console.log("đoạn " + x.tu + "–" + x.den + " x" + (x.toc || 1) + " xong");
  }
  chay = false; await new Promise((r) => setTimeout(r, 300)); rec.stop(); await xong;
  const buf = new Uint8Array(await new Blob(parts, { type: "video/webm" }).arrayBuffer());
  let s = ""; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768));
  return btoa(s);
}, C, doan);
fs.writeFileSync(C.ra, Buffer.from(b64, "base64")); await b.close(); sv.close();
console.log("ok", (fs.statSync(C.ra).size / 1048576).toFixed(1) + " MB →", C.ra);
