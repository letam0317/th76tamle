/* Tạm 29/09: chụp khung hình từ video bằng chứng + ghép 4 ảnh/tấm (Edge headless). Xoá sau khi dùng. */
import puppeteer from "puppeteer"; import fs from "node:fs"; import { EDGE_PATH } from "./token-store.js";
const [file, out, ...ts] = process.argv.slice(2);
const url = "file:///" + file.split(String.fromCharCode(92)).join("/");
const b = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH, args: ["--allow-file-access-from-files"] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
await p.goto(url.replace(/[^/]+$/, ""));
await p.setContent('<body style="margin:0;background:#000"><video id=v src="' + url + '" muted style="width:1280px;height:720px"></video></body>');
await p.waitForFunction(() => document.getElementById("v").readyState >= 1, { timeout: 180000 });
const anh = [];
for (const t of ts) {
  await p.evaluate((s) => new Promise((r) => { const v = document.getElementById("v"); v.onseeked = () => r(); v.currentTime = s; }), Number(t));
  await new Promise((r) => setTimeout(r, 400));
  anh.push(Buffer.from(await p.screenshot({ type: "jpeg", quality: 70 })).toString("base64"));
}
if (process.env.DON) { anh.forEach((s, i) => fs.writeFileSync(out + "_f" + i + ".jpg", Buffer.from(s, "base64"))); await b.close(); process.exit(0); }
for (let i = 0; i < anh.length; i += 4) {
  await p.setContent('<body style="margin:0;display:grid;grid-template-columns:640px 640px;background:#000">' + anh.slice(i, i + 4).map((s) => '<img src="data:image/jpeg;base64,' + s + '" style="width:640px;height:360px">').join("") + "</body>");
  fs.writeFileSync(out + "_" + (i / 4 + 1) + ".jpg", await p.screenshot({ type: "jpeg", quality: 75, fullPage: true }));
}
await b.close(); console.log("ok", anh.length);
