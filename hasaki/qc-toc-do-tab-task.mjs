import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";
const URL0 = process.argv[2] || "https://letam0317.github.io/kiemsoatkho/?company=hasaki&tab=task";
const THROTTLE = process.argv[3] === "3g";
const b = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH, args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setCacheEnabled(false);
const cdp = await p.target().createCDPSession();
await cdp.send("Network.enable");
if (THROTTLE) await cdp.send("Network.emulateNetworkConditions", { offline:false, latency:150, downloadThroughput: 1.6*1024*1024/8, uploadThroughput: 750*1024/8 });
if (THROTTLE) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
const reqs = new Map(); const t0 = Date.now();
cdp.on("Network.requestWillBeSent", e => reqs.set(e.requestId, { url: e.request.url, start: Date.now()-t0, type: e.type }));
cdp.on("Network.loadingFinished", e => { const r = reqs.get(e.requestId); if (r) { r.end = Date.now()-t0; r.bytes = e.encodedDataLength; } });
cdp.on("Network.loadingFailed", e => { const r = reqs.get(e.requestId); if (r) { r.end = Date.now()-t0; r.fail = e.errorText; } });
await p.goto(URL0, { waitUntil: "domcontentloaded", timeout: 90000 });
const tDCL = Date.now()-t0;
// chờ bảng task có dòng
let tRows = null, nRows = 0;
for (let i = 0; i < 600; i++) {
  nRows = await p.evaluate(() => { return (typeof ROWS!=="undefined" && Array.isArray(ROWS)) ? ROWS.length : 0; });
  if (nRows > 0) { tRows = Date.now()-t0; break; }
  await new Promise(r => setTimeout(r, 100));
}
await new Promise(r => setTimeout(r, 4000));
const nav = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return n ? { ttfb: Math.round(n.responseStart), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), transfer: n.transferSize, decoded: n.decodedBodySize } : null; });
const paint = await p.evaluate(() => performance.getEntriesByType('paint').map(x => x.name + '=' + Math.round(x.startTime)).join(' '));
console.log("URL:", URL0, THROTTLE ? "(3G/CPU x4)" : "(mạng thật)");
console.log("navigation:", JSON.stringify(nav), "| paint:", paint);
console.log("DOMContentLoaded @", tDCL, "ms | bảng có dòng @", tRows, "ms (", nRows, "dòng)");
const list = [...reqs.values()].sort((a,b)=>a.start-b.start);
let total = 0;
for (const r of list) { total += r.bytes||0; console.log(String(r.start).padStart(6), "→", String(r.end??'?').padStart(6), String(((r.bytes||0)/1024).toFixed(1)).padStart(8)+"KB", r.type||'', r.fail?("FAIL "+r.fail):'', r.url.replace(/\?v=\d+|responseHandler:[^&]+/g,'').slice(0,140)); }
console.log("TỔNG", list.length, "request,", (total/1024).toFixed(0), "KB");
await b.close();
