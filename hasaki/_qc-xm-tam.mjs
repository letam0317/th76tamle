import puppeteer from "puppeteer-core";
const OUT = "C:/Users/lechitam/AppData/Local/Temp/claude/C--Users-lechitam-New-folder/9828c331-b633-4237-82c9-e2b2b77168ba/scratchpad/img/";
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
for (const [ten, w, h, mob] of [["pc", 1440, 900, false], ["dt", 390, 844, true]]) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
  const loi = []; p.on("pageerror", (e) => loi.push(e.message)); p.on("console", (m) => m.type() === "error" && loi.push(m.text()));
  await p.goto("http://localhost:8123/kiemsoatkho/", { waitUntil: "networkidle2", timeout: 90000 });
  await p.evaluate(() => { try { localStorage.removeItem("hx-loc"); } catch (e) {} setTab("xacminh"); });
  await p.waitForFunction(() => document.querySelector("#pane-xacminh .kpi-band .kb-num"), { timeout: 20000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));
  await p.screenshot({ path: OUT + `xm-${ten}-nv.png` });
  await p.evaluate(() => document.querySelector('#pane-xacminh .hx-seg button[data-sub="cam"]').click()); await new Promise((r) => setTimeout(r, 1500));
  await p.screenshot({ path: OUT + `xm-${ten}-cam.png` });
  await p.evaluate(() => { const r = document.querySelector(mobOK() ? "#pane-xacminh .cl-item[data-l]" : "#pane-xacminh tr[data-l]") || document.querySelector("#pane-xacminh [data-l]"); r && r.click(); function mobOK() { return innerWidth < 700; } });
  await new Promise((r) => setTimeout(r, 2500));
  await p.screenshot({ path: OUT + `xm-${ten}-luot.png` });
  await p.evaluate(() => { const m = document.querySelector("#modal .modal-box"); if (m) m.scrollTop = 9999; }); await new Promise((r) => setTimeout(r, 500));
  await p.screenshot({ path: OUT + `xm-${ten}-luot2.png` });
  console.log(ten, "lỗi:", loi.slice(0, 4).join(" | ") || "không");
}
await b.close();
