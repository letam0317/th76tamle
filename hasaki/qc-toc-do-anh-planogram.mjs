/* ĐO ẢNH BÁO CÁO tab Planogram: từng pha thời gian của request ảnh (hop gateway WMS → CDN), ảnh vỡ
   ở pop-up ô, panel "Nhân viên hôm nay" và pop-up AI xét duyệt. Chạy trên Pixel-5 giả lập mặc định.
   node hasaki/qc-toc-do-anh-planogram.mjs [url] [--desktop] [--3g] [--cdn]  (--cdn: viết lại URL ảnh thẳng CDN để so) */
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const args = process.argv.slice(2);
const URL = args.find(a => /^https?:|^file:/.test(a)) || "https://letam0317.github.io/kiemsoatkho/?company=hasaki&tab=planogram";
const DESK = args.includes("--desktop"), G3 = args.includes("--3g"), CDN = args.includes("--cdn");
const OUT = path.dirname(fileURLToPath(import.meta.url));
const ms = (a, b) => Math.round((b - a) * 1000);
const kb = n => (n / 1024).toFixed(0) + "KB";
const cho = t => new Promise(r => setTimeout(r, t));

const b = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH, args: ["--window-size=1440,900", "--no-sandbox"] });
const p = await b.newPage();
if (DESK) await p.setViewport({ width: 1440, height: 900 });
else {
  await p.setUserAgent("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36");
  await p.setViewport({ width: 393, height: 851, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true });
}
p.on("dialog", d => d.dismiss().catch(() => {}));
const loi = [];
p.on("pageerror", e => loi.push("PAGEERROR: " + e.message));
p.on("console", m => { if (m.type() === "error") loi.push("CONSOLE: " + m.text().slice(0, 200)); });
const cdp = await p.target().createCDPSession();
await cdp.send("Network.enable");
if (G3) await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
if (CDN) {
  await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*wms-gw-external.hasaki.vn/api/v1/filesmanagement/planogram/standard/*", requestStage: "Request" }] });
  cdp.on("Fetch.requestPaused", e => {
    const f = e.request.url.split("/").pop();
    cdp.send("Fetch.continueRequest", { requestId: e.requestId, url: "https://cdn-media-wms.inshasaki.com/" + f }).catch(() => {});
  });
}
/* Ghi từng request ảnh: hop-1 (redirectResponse của gateway) + hop-2 (CDN) với timing chi tiết */
const R = new Map();
const laAnhUrl = u => /cdn-media-wms|wms-gw-external/.test(u);
cdp.on("Network.requestWillBeSent", e => {
  if (!laAnhUrl(e.request.url) && !(e.redirectResponse && laAnhUrl(e.redirectResponse.url))) return;
  let r = R.get(e.requestId);
  if (!r) { r = { url0: e.request.url, start: e.timestamp, hops: [] }; R.set(e.requestId, r); }
  if (e.redirectResponse) r.hops.push({ url: e.redirectResponse.url, status: e.redirectResponse.status, t: e.redirectResponse.timing, at: e.timestamp, proto: e.redirectResponse.protocol });
  r.url = e.request.url;
});
cdp.on("Network.responseReceived", e => { const r = R.get(e.requestId); if (!r) return; r.status = e.response.status; r.t = e.response.timing; r.proto = e.response.protocol; r.cache = !!(e.response.fromDiskCache || e.response.fromMemoryCache); r.hdrAt = e.timestamp; });
cdp.on("Network.loadingFinished", e => { const r = R.get(e.requestId); if (!r) return; r.end = e.timestamp; r.bytes = e.encodedDataLength; });
cdp.on("Network.loadingFailed", e => { const r = R.get(e.requestId); if (!r) return; r.end = e.timestamp; r.failed = e.errorText; r.canceled = e.canceled; });

const pha = t => t ? `dns ${Math.max(0, Math.round(t.dnsEnd - t.dnsStart))} · kết nối ${Math.max(0, Math.round(t.connectEnd - t.connectStart))} (tls ${Math.max(0, Math.round(t.sslEnd - t.sslStart))}) · chờ máy chủ ${Math.round(t.receiveHeadersEnd - t.sendEnd)}` : "?";
function inAnh(ds, nhan) {
  const ok = ds.filter(r => r.status && r.status < 400 && !r.failed), bad = ds.filter(r => r.status >= 400), fail = ds.filter(r => r.failed && !r.canceled), can = ds.filter(r => r.canceled);
  const tong = ds.reduce((s, r) => s + (r.bytes || 0), 0);
  const dur = ok.filter(r => r.end).map(r => ms(r.start, r.end)).sort((a, b) => a - b);
  const q = i => dur.length ? dur[Math.min(dur.length - 1, Math.floor(dur.length * i))] : 0;
  console.log(`\n--- ẢNH ${nhan}: ${ds.length} req · ${ok.length} ok · ${bad.length} lỗi HTTP · ${fail.length} fail · ${can.length} huỷ · ${kb(tong)} · cache ${ds.filter(r => r.cache).length}`);
  if (dur.length) console.log(`   tổng/ảnh: p50 ${q(0.5)}ms · p90 ${q(0.9)}ms · max ${dur[dur.length - 1]}ms`);
  const hop1 = ok.filter(r => r.hops.length).map(r => ms(r.start, r.hops[0].at)).sort((a, b) => a - b);
  const hop2 = ok.filter(r => r.hops.length && r.end).map(r => ms(r.hops[0].at, r.end)).sort((a, b) => a - b);
  const q2 = (arr, i) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * i))] : 0;
  if (hop1.length) console.log(`   hop-1 gateway WMS (tới khi nhận 302): p50 ${q2(hop1, .5)}ms · max ${hop1[hop1.length - 1]}ms   |   hop-2 CDN (302 → tải xong): p50 ${q2(hop2, .5)}ms · max ${hop2[hop2.length - 1]}ms`);
  ok.slice(0, 4).forEach(r => {
    const h = r.hops[0];
    console.log(`   ✓ ${r.status} ${r.proto || ""} tổng ${r.end ? ms(r.start, r.end) : "…"}ms ${kb(r.bytes || 0)}` + (h ? ` | hop1 ${h.status} ${h.proto || ""} ${ms(r.start, h.at)}ms [${pha(h.t)}]` : "") + ` | hop2 [${pha(r.t)}] ${r.url.replace(/^https?:\/\//, "").slice(0, 60)}`);
  });
  [...bad, ...fail].slice(0, 6).forEach(r => console.log(`   ✗ ${r.status || r.failed} ${r.url.slice(0, 120)}`));
}
const demImg = sel => p.evaluate(sel => {
  const im = [...document.querySelectorAll(sel + " img")];
  const thuc = im.filter(i => !/^data:image\/gif/.test(i.currentSrc || i.src));
  const vo = thuc.filter(i => i.complete && i.naturalWidth === 0);
  return { tong: im.length, choLazy: im.filter(i => i.classList.contains("hp-lz")).length, xong: thuc.filter(i => i.complete && i.naturalWidth > 0).length, vo: vo.length, dangTai: thuc.filter(i => !i.complete).length, voMau: vo.slice(0, 2).map(i => i.src.slice(-50)) };
}, sel);

const t0 = Date.now();
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 120000 });
try { await p.waitForSelector("#hpToday .hp-tile", { timeout: 90000 }); } catch (e) { loi.push("KHÔNG thấy .hp-tile"); }
console.log(`\n=== ${DESK ? "DESKTOP" : "PIXEL 5"}${G3 ? " · 3G" : ""}${CDN ? " · URL ảnh viết lại thẳng CDN" : ""} · KPI hiện sau ${Date.now() - t0}ms ===`);
try { await p.waitForFunction(() => HPLANOGRAM._S.anh.ok === true, { timeout: 60000 }); } catch (e) { loi.push("VESINH-ANH chưa về sau 60s"); }
await cho(1500);

/* 1) Pop-up ô có nhiều ảnh nhất hôm nay */
const pick = await p.evaluate(() => {
  const S = HPLANOGRAM._S, rows = S.yc.rows || [];
  const d = new Date(), iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const co = rows.filter(r => r.anh && r.anh.length && r.ngay === iso).sort((a, b) => b.anh.length - a.anh.length);
  return co[0] ? { loc: co[0].loc, id: co[0].id, n: co[0].anh.length, tongCoAnh: co.length } : null;
});
console.log("Hôm nay có ảnh: " + JSON.stringify(pick));
if (pick) {
  const n0 = R.size, tp = Date.now();
  await p.evaluate(loc => HPLANOGRAM.openViTri(loc), pick.loc);
  let first = -1, done = -1, last = null;
  for (let i = 0; i < 200; i++) {
    await cho(200); last = await demImg("#hpVtBody");
    if (first < 0 && last.xong > 0) first = Date.now() - tp;
    if (last.tong > 0 && last.dangTai === 0 && last.choLazy === 0 && (last.xong + last.vo) >= last.tong) { done = Date.now() - tp; break; }
    if (Date.now() - tp > 30000) { done = -(Date.now() - tp); break; }
  }
  console.log(`\n=== POP-UP Ô ${pick.loc} (${pick.n} ảnh) === ảnh đầu ${first}ms · 4 ảnh bày sẵn xong ${done}ms · ${JSON.stringify(last)}`);
  inAnh([...R.values()].slice(n0), "pop-up ô");
  await p.screenshot({ path: path.join(OUT, ".exports", "_do-anh-popup" + (DESK ? "-desk" : "") + ".png") });
  /* Bấm +N trải hết lưới rồi cuộn xuống đáy pop-up → ảnh lazy vào */
  const n1 = R.size, tm = Date.now();
  await p.evaluate(id => HPLANOGRAM.moAnhHet(String(id)), pick.id);
  await cho(300);
  for (let i = 0; i < 6; i++) { await p.evaluate(() => { const m = document.querySelector("#hpVtModal .hp-modal-body, #hpVtBody"); if (m) m.scrollTop = m.scrollHeight; window.scrollTo(0, document.body.scrollHeight); }); await cho(400); }
  let lastHet = null;
  for (let i = 0; i < 300; i++) { await cho(200); lastHet = await demImg("#hpVtBody"); if (lastHet.dangTai === 0 && lastHet.choLazy === 0 && Date.now() - tm > 2000) break; }
  console.log(`\n=== +N TRẢI HẾT ${pick.n} ảnh === xong sau ${Date.now() - tm}ms · ${JSON.stringify(lastHet)}`);
  inAnh([...R.values()].slice(n1), "trải hết");
  await p.screenshot({ path: path.join(OUT, ".exports", "_do-anh-popup-het" + (DESK ? "-desk" : "") + ".png") });
  await p.evaluate(() => HPLANOGRAM.closeVt());
  await cho(400);
}

/* 2) Panel đáy "Nhân viên hôm nay" — cuộn xuống để thumbnail lazy vào */
{
  const n2 = R.size, tl = Date.now();
  await p.evaluate(() => { const el = document.querySelector("#hpAI"); if (el) el.scrollIntoView({ block: "start" }); });
  for (let i = 0; i < 8; i++) { await p.evaluate(() => window.scrollBy(0, 600)); await cho(500); }
  let lastL = null;
  for (let i = 0; i < 150; i++) { await cho(200); lastL = await demImg("#hpAI"); if (lastL.dangTai === 0 && Date.now() - tl > 3000) break; }
  console.log(`\n=== PANEL "Nhân viên hôm nay" === sau ${Date.now() - tl}ms · ${JSON.stringify(lastL)}`);
  inAnh([...R.values()].slice(n2), "panel NV");
  await p.screenshot({ path: path.join(OUT, ".exports", "_do-anh-panel" + (DESK ? "-desk" : "") + ".png") });
}

/* 3) Pop-up AI xét duyệt ảnh — cuộn 10 lượt */
{
  const n3 = R.size, ta = Date.now();
  await p.evaluate(() => HPLANOGRAM.openAiList && HPLANOGRAM.openAiList(""));
  await cho(800);
  const soThe = await p.evaluate(() => document.querySelectorAll("#hpAiBody .hp-aicard, #hpAiBody tr, #hpAiBody .hp-card").length);
  for (let i = 0; i < 10; i++) { await p.evaluate(() => { const m = document.querySelector("#hpAiModal .hp-modal-body, #hpAiBody"); if (m) m.scrollTop += 900; }); await cho(500); }
  let lastA = null;
  for (let i = 0; i < 150; i++) { await cho(200); lastA = await demImg("#hpAiModal"); if (lastA.dangTai === 0 && Date.now() - ta > 4000) break; }
  console.log(`\n=== POP-UP AI XÉT DUYỆT (${soThe} thẻ/dòng) === sau ${Date.now() - ta}ms · ${JSON.stringify(lastA)}`);
  inAnh([...R.values()].slice(n3), "pop-up AI");
  await p.screenshot({ path: path.join(OUT, ".exports", "_do-anh-ai" + (DESK ? "-desk" : "") + ".png") });
}
/* 4) F5 rồi mở lại pop-up ô → ảnh nhỏ phải về từ IndexedDB (0 lượt mạng ảnh) */
if (pick) {
  await p.reload({ waitUntil: "domcontentloaded" });
  try { await p.waitForSelector("#hpToday .hp-tile", { timeout: 90000 }); } catch (e) {}
  try { await p.waitForFunction(() => HPLANOGRAM._S.anh.ok === true, { timeout: 60000 }); } catch (e) {}
  await cho(800);
  const n4 = R.size, tf = Date.now();
  await p.evaluate(loc => HPLANOGRAM.openViTri(loc), pick.loc);
  let lastF = null, firstF = -1;
  for (let i = 0; i < 100; i++) { await cho(100); lastF = await demImg("#hpVtBody"); if (firstF < 0 && lastF.xong > 0) firstF = Date.now() - tf; if (lastF.tong > 0 && lastF.dangTai === 0 && lastF.choLazy === 0 && Date.now() - tf > 600) break; }
  console.log(`\n=== F5 + MỞ LẠI Ô ${pick.loc} === ảnh đầu ${firstF}ms · ${JSON.stringify(lastF)}`);
  inAnh([...R.values()].slice(n4), "sau F5 (kỳ vọng 0 request)");
}
console.log(loi.length ? "\n⚠ LỖI TRANG:\n" + loi.slice(0, 10).join("\n") : "\n✓ Không có lỗi JS.");
await b.close();
