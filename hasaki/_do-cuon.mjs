// Tạm 05/10: đo độ mượt khi cuộn tab Xác minh (khung hình rớt khi cuộn đều) — user: "DASHBOARD QUÁ LAG KHI CUỘN XUỐNG DƯỚI"
import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new", args: ["--disable-gpu-vsync", "--enable-gpu"] });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
await p.goto("http://localhost:8123/kiemsoatkho/?tab=xacminh", { waitUntil: "networkidle2", timeout: 60000 }); await new Promise((r) => setTimeout(r, 6000)); await p.waitForFunction(() => window.HXACMINH && HXACMINH.coDuLieu(), { timeout: 60000 });
for (const sub of (process.argv[2] || "treo,cam").split(",")) {
  await p.evaluate((s) => HXACMINH.sub(s), sub); await new Promise((r) => setTimeout(r, 2500));
  const kq = await p.evaluate(async () => {
    const sc = [...document.querySelectorAll("*")].filter((e) => e.scrollHeight > e.clientHeight + 200 && /auto|scroll/.test(getComputedStyle(e).overflowY)).sort((a, b) => b.scrollHeight - a.scrollHeight)[0] || document.scrollingElement;
    sc.scrollTop = 0; await new Promise((r) => setTimeout(r, 500));
    const dai = sc.scrollHeight - sc.clientHeight; window.__sc = (sc.id || sc.className || sc.tagName); const d = []; let tr = performance.now(), y = 0;
    const lt = []; const ob = new PerformanceObserver((l) => l.getEntries().forEach((e) => lt.push(e.duration))); try { ob.observe({ type: "longtask", buffered: false }); } catch (e) {}
    await new Promise((ok) => { function b() { const n = performance.now(); d.push(n - tr); tr = n; y += 40; sc.scrollTop = y; if (y < dai) requestAnimationFrame(b); else ok(); } requestAnimationFrame(b); });
    ob.disconnect(); d.shift();
    const roi = d.filter((x) => x > 34).length, tb = d.reduce((a, x) => a + x, 0) / d.length;
    return { cuon: window.__sc, dom: document.querySelectorAll("#pane-xacminh *").length, video: document.querySelectorAll("#pane-xacminh video").length, img: document.querySelectorAll("#pane-xacminh img").length,
      caoPx: dai, khung: d.length, tbMs: +tb.toFixed(1), roiKhung: roi, tyLeRoi: Math.round(100 * roi / d.length) + "%", maxMs: Math.round(Math.max(...d)), longTask: lt.length, longTaskMs: Math.round(lt.reduce((a, x) => a + x, 0)) };
  });
  console.log(sub, JSON.stringify(kq));
}
await b.close();
