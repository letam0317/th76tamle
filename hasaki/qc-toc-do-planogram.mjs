/* ĐO HIỆU NĂNG tab Planogram trên LIVE (hoặc URL bất kỳ): timeline request, ảnh vỡ, pop-up ô, lightbox.
   node hasaki/qc-toc-do-planogram.mjs [url] [--mobile] [--3g] */
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const args = process.argv.slice(2);
const URL = args.find(a => /^https?:|^file:/.test(a)) || "https://letam0317.github.io/kiemsoatkho/?company=hasaki&tab=planogram";
const MOBILE = args.includes("--mobile"), G3 = args.includes("--3g");
const OUT = path.dirname(fileURLToPath(import.meta.url));
const ms = (a, b) => Math.round((b - a) * 1000);
const kb = n => (n / 1024).toFixed(0) + "KB";
const ngan = u => {
  try {
    const x = new globalThis.URL(u);
    if (/script\.google/.test(x.host) || /googleusercontent/.test(x.host)) {
      const a = x.searchParams.get("action") || "", t = x.searchParams.get("tab") || "";
      return "GAS " + (a ? a + " " + t : x.pathname.slice(-24));
    }
    if (/docs\.google/.test(x.host)) return "gviz " + (x.searchParams.get("sheet") || "");
    if (/cdn-media-wms|wms-gw/.test(x.host)) return x.host.split(".")[0] + " " + x.pathname.split("/").pop().slice(0, 40);
    return x.host.replace("letam0317.github.io", "pages") + x.pathname.slice(0, 60) + (x.search ? x.search.slice(0, 20) : "");
  } catch (e) { return u.slice(0, 80); }
};

const b = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH, args: ["--window-size=1440,900", "--no-sandbox"] });
const p = await b.newPage();
if (MOBILE) await p.emulate(puppeteer.KnownDevices["Pixel 5"]); else await p.setViewport({ width: 1440, height: 900 });
p.on("dialog", d => d.dismiss().catch(() => {}));
const loi = [];
p.on("pageerror", e => loi.push("PAGEERROR: " + e.message));
p.on("console", m => { if (m.type() === "error") loi.push("CONSOLE: " + m.text().slice(0, 200)); });
const cdp = await p.target().createCDPSession();
await cdp.send("Network.enable");
if (G3) await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
const R = new Map(); let T0 = 0;
cdp.on("Network.requestWillBeSent", e => {
  if (!T0) T0 = e.timestamp;
  const r = R.get(e.requestId);
  if (r) { r.redirects = (r.redirects || 0) + 1; r.url = e.request.url; return; }
  R.set(e.requestId, { url: e.request.url, type: e.type, start: e.timestamp, redirects: 0 });
});
cdp.on("Network.responseReceived", e => { const r = R.get(e.requestId); if (!r) return; r.status = e.response.status; r.mime = e.response.mimeType; r.cache = !!(e.response.fromDiskCache || e.response.fromMemoryCache); r.cc = e.response.headers["cache-control"] || e.response.headers["Cache-Control"] || ""; });
cdp.on("Network.loadingFinished", e => { const r = R.get(e.requestId); if (!r) return; r.end = e.timestamp; r.bytes = e.encodedDataLength; });
cdp.on("Network.loadingFailed", e => { const r = R.get(e.requestId); if (!r) return; r.end = e.timestamp; r.failed = e.errorText; r.canceled = e.canceled; });

const t0 = Date.now();
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 120000 });
const tDCL = Date.now() - t0;
let tTile = -1;
try { await p.waitForSelector("#hpToday .hp-tile", { timeout: 90000 }); tTile = Date.now() - t0; } catch (e) { loi.push("KHÔNG thấy .hp-tile sau 90s"); }
let tSoDo = -1;
try { await p.waitForFunction(() => document.querySelectorAll("#hpMap .hp-cell, #hpMap [class*=hp-o], #hpMap .hp-ke").length > 20, { timeout: 60000 }); tSoDo = Date.now() - t0; } catch (e) {}
await new Promise(r => setTimeout(r, 10000));
const tNen = Date.now() - t0;
console.log(`\n=== TẢI TRANG ${MOBILE ? "(Pixel 5)" : "(desktop 1440)"}${G3 ? " mạng 3G giả lập" : ""} ===`);
console.log(`DOMContentLoaded ${tDCL}ms · thẻ KPI hiện ${tTile}ms · sơ đồ có ô ${tSoDo}ms · chờ nền tới ${tNen}ms`);

const all = [...R.values()].filter(r => r.start).sort((a, b) => a.start - b.start);
const laAnh = r => r.type === "Image" || /cdn-media-wms|wms-gw-external/.test(r.url);
console.log("\n--- Request KHÔNG phải ảnh (mốc từ request đầu) ---");
for (const r of all.filter(r => !laAnh(r))) {
  const st = r.failed ? "FAIL " + r.failed : (r.status || "?") + (r.cache ? " cache" : "");
  console.log(`+${String(ms(T0, r.start)).padStart(5)}ms  ${String(r.end ? ms(r.start, r.end) : "…").padStart(6)}ms  ${String(st).padEnd(10)} ${String(kb(r.bytes || 0)).padStart(6)}  ${ngan(r.url)}`);
}
const dumpAnh = (ds, nhan) => {
  const ok = ds.filter(r => r.status && r.status < 400 && !r.failed), fail = ds.filter(r => r.failed && !r.canceled), can = ds.filter(r => r.canceled), bad = ds.filter(r => r.status >= 400);
  const bytes = ds.reduce((s, r) => s + (r.bytes || 0), 0);
  const dur = ok.map(r => r.end ? ms(r.start, r.end) : 0).filter(Boolean).sort((a, b) => a - b);
  const q = i => dur.length ? dur[Math.min(dur.length - 1, Math.floor(dur.length * i))] : 0;
  console.log(`\n--- ẢNH ${nhan}: ${ds.length} request · ${ok.length} ok · ${bad.length} lỗi HTTP · ${fail.length} fail · ${can.length} huỷ · ${kb(bytes)} · redirect ${ds.reduce((s, r) => s + (r.redirects || 0), 0)} ---`);
  if (dur.length) console.log(`   thời gian/ảnh: p50 ${q(0.5)}ms · p90 ${q(0.9)}ms · max ${dur[dur.length - 1]}ms · trung bình ${kb(bytes / Math.max(1, ok.length))}/ảnh`);
  const hosts = {}; ds.forEach(r => { try { const h = new globalThis.URL(r.url).host; hosts[h] = (hosts[h] || 0) + 1; } catch (e) {} });
  console.log("   host cuối: " + JSON.stringify(hosts));
  [...bad, ...fail].slice(0, 6).forEach(r => console.log(`   ✗ ${r.status || r.failed} ${r.url.slice(0, 140)}`));
  ok.slice(0, 3).forEach(r => console.log(`   ✓ ${r.status} ${ms(r.start, r.end)}ms ${kb(r.bytes || 0)} cc="${r.cc}" ${r.url.slice(0, 120)}`));
};
const anhTrang = all.filter(laAnh);
dumpAnh(anhTrang, "lúc tải trang");

const demImg = sel => p.evaluate(sel => {
  const im = [...document.querySelectorAll(sel + " img")];
  const thuc = im.filter(i => !/^data:image\/gif/.test(i.currentSrc || i.src));
  return { tong: im.length, cho: im.filter(i => i.classList.contains("hp-lz")).length, xong: thuc.filter(i => i.complete && i.naturalWidth > 0).length, vo: thuc.filter(i => i.complete && i.naturalWidth === 0).length, dangTai: thuc.filter(i => !i.complete).length };
}, sel);
console.log("\nIMG trong tab sau khi tải: " + JSON.stringify(await demImg("#pane-planogram")));

/* Pop-up một ô có ảnh HÔM NAY (không nhét dữ liệu giả — lấy từ chính state) */
const pick = await p.evaluate(() => {
  const H = window.HPLANOGRAM || {}; const S = H._S || H.S || null;
  const rows = (S && S.yc && S.yc.rows) || [];
  const d = new Date(), iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const co = rows.filter(r => r.anh && r.anh.length);
  const hn = co.filter(r => r.ngay === iso);
  const r = hn[0] || co[0];
  return { tongYc: rows.length, coAnh: co.length, coAnhHomNay: hn.length, anhOk: S && S.anh && S.anh.ok, anhDang: S && S.anh && S.anh.dang, loc: r ? r.loc : null, ngay: r ? r.ngay : null, id: r ? r.id : null, soAnh: r ? r.anh.length : 0 };
});
console.log("\nState: " + JSON.stringify(pick));
if (pick.loc) {
  const nBefore = R.size;
  const tp0 = Date.now();
  const isoNay = new Date().toISOString().slice(0, 10);
  if (pick.ngay !== isoNay) { try { await p.evaluate(d => HPLANOGRAM.setNgay(d), pick.ngay); await new Promise(r => setTimeout(r, 1200)); } catch (e) {} }
  await p.evaluate(loc => HPLANOGRAM.openViTri(loc), pick.loc);
  let first = -1, allDone = -1, last = null;
  for (let i = 0; i < 150; i++) {
    await new Promise(r => setTimeout(r, 200));
    last = await demImg("#hpVtBody");
    if (first < 0 && last.xong > 0) first = Date.now() - tp0;
    if (last.tong > 0 && last.dangTai === 0 && last.cho === 0 && (last.xong + last.vo) >= last.tong) { allDone = Date.now() - tp0; break; }
    if (last.tong > 0 && last.dangTai === 0 && Date.now() - tp0 > 4000) { allDone = Date.now() - tp0; break; }
  }
  console.log(`\n=== POP-UP Ô ${pick.loc} (${pick.ngay}, ${pick.soAnh} ảnh) === ảnh đầu hiện ${first}ms · các ảnh bày sẵn xong ${allDone}ms · ${JSON.stringify(last)}`);
  const anhPop = [...R.values()].slice(nBefore).filter(laAnh);
  dumpAnh(anhPop, "khi mở pop-up");
  await p.screenshot({ path: path.join(OUT, ".exports", "_do-pg-popup" + (MOBILE ? "-mobile" : "") + ".png") });

  /* Lightbox ảnh đầu */
  const nB2 = R.size; const tl0 = Date.now();
  await p.evaluate(id => HPLANOGRAM.openAnh(String(id), 0), pick.id);
  let tLb = -1, lbInfo = null;
  for (let i = 0; i < 150; i++) {
    await new Promise(r => setTimeout(r, 200));
    lbInfo = await p.evaluate(() => {
      const i0 = document.querySelector("#lbContent img");
      if (!i0) return null;
      return { w: Math.round(i0.getBoundingClientRect().width), complete: i0.complete, nw: i0.naturalWidth, nh: i0.naturalHeight, src: i0.currentSrc.slice(0, 120) };
    });
    if (lbInfo && lbInfo.complete) { tLb = Date.now() - tl0; break; }
  }
  console.log(`\n=== LIGHTBOX === ảnh lớn hiện sau ${tLb}ms · ${JSON.stringify(lbInfo)}`);
  dumpAnh([...R.values()].slice(nB2).filter(laAnh), "khi mở lightbox");
  await p.screenshot({ path: path.join(OUT, ".exports", "_do-pg-lightbox" + (MOBILE ? "-mobile" : "") + ".png") });
}
console.log(loi.length ? "\n⚠ LỖI TRANG:\n" + loi.slice(0, 12).join("\n") : "\n✓ Không có lỗi JS.");
await b.close();
