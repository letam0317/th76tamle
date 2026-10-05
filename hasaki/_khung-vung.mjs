/* 05/10/2026 — chụp khung ĐỘ PHÂN GIẢI GỐC (không thu về 1280) + cắt vùng [x,y,w,h theo tỉ lệ 0..1] → phóng to. Dùng soi vật nhỏ trên góc camera xa.
 * node _khung-vung.mjs <video.mp4> <out tiền tố> <x,y,w,h> <giây...>   → <out>_<i>.jpg */
import puppeteer from "puppeteer"; import fs from "node:fs"; import { EDGE_PATH } from "./token-store.js";
const [file, out, vung, ...ts] = process.argv.slice(2); const [vx, vy, vw, vh] = vung.split(",").map(Number);
const url = "file:///" + file.split(String.fromCharCode(92)).join("/");
const b = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH, args: ["--allow-file-access-from-files"] });
const p = await b.newPage(); await p.goto(url.replace(/[^/]+$/, ""));
await p.setContent('<body style="margin:0;background:#000"><video id=v src="' + url + '" muted></video></body>');
await p.waitForFunction(() => document.getElementById("v").readyState >= 1, { timeout: 180000 });
const [W, H] = await p.evaluate(() => [document.getElementById("v").videoWidth, document.getElementById("v").videoHeight]);
await p.setViewport({ width: W, height: H });
for (const [i, t] of ts.entries()) {
  await p.evaluate((s) => new Promise((r) => { const v = document.getElementById("v"); v.onseeked = () => r(); v.currentTime = s; }), Number(t));
  await new Promise((r) => setTimeout(r, 400));
  fs.writeFileSync(out + "_" + i + ".jpg", await p.screenshot({ type: "jpeg", quality: 90, clip: { x: vx * W, y: vy * H, width: vw * W, height: vh * H } }));
}
console.log("ok", W + "x" + H, ts.length); await b.close();
