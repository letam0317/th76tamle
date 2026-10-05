import puppeteer from "puppeteer-core";
const OUT = "C:/Users/lechitam/AppData/Local/Temp/claude/C--Users-lechitam-New-folder/9828c331-b633-4237-82c9-e2b2b77168ba/scratchpad/img/";
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new", args: ["--autoplay-policy=no-user-gesture-required"] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
const loi = []; p.on("pageerror", (e) => loi.push(e.message)); p.on("console", (m) => m.type() === "error" && loi.push(m.text()));
await p.goto("http://localhost:8123/kiemsoatkho/?tab=xacminh", { waitUntil: "networkidle2", timeout: 90000 });
await p.waitForFunction(() => window.HXACMINH && HXACMINH.coDuLieu(), { timeout: 30000 });
await p.evaluate(() => HXACMINH.moLuotId("2026-10-02_BXM_085932"));
await new Promise((r) => setTimeout(r, 6000));
const gio = (s) => { const [h, m, x] = s.split(":").map(Number); return h * 3600 + m * 60 + x; };
let i = 0;
for (const t of ["08:54:33", "08:54:41", "08:54:57", "08:55:05"]) {
  await p.evaluate((g) => { const v = document.getElementById("hxV"); window.__hxTua(g + 2); setTimeout(() => v.pause(), 50); }, gio(t));
  // dò vài nhịp: mô phỏng phát chậm bằng cách tua lùi/tiến 0,2 s để có 2 khung liên tiếp (vùng cử động cần khung trước)
  await new Promise((r) => setTimeout(r, 2500));
  await p.evaluate(() => { const v = document.getElementById("hxV"); v.currentTime += 0.4; });
  await new Promise((r) => setTimeout(r, 2500));
  await p.screenshot({ path: OUT + `clip-bam-${i++}.png`, clip: { x: 0, y: 80, width: 830, height: 470 } });
}
console.log("lỗi:", loi.join(" | ") || "không", "· có mô hình:", await p.evaluate(() => !!window.cocoSsd));
await b.close();
