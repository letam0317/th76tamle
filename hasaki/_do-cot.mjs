// Tạm 05/10: đo độ rộng từng cột vs nội dung thật (user: "kích thước giữa các cột đã đo chưa, lãng phí không gian")
import puppeteer from "puppeteer-core";
const O = "C:/Users/lechitam/AppData/Local/Temp/claude/C--Users-lechitam-New-folder/9828c331-b633-4237-82c9-e2b2b77168ba/scratchpad/img/cot-";
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
const p = await b.newPage(); await p.setViewport({ width: 1440, height: 900 });
await p.goto("http://localhost:8123/kiemsoatkho/?tab=xacminh", { waitUntil: "networkidle2", timeout: 60000 }); await p.waitForFunction(() => window.HXACMINH && HXACMINH.coDuLieu(), { timeout: 60000 });
for (const sub of ["treo", "cam"]) {
  await p.evaluate((s) => HXACMINH.sub(s), sub); await new Promise((r) => setTimeout(r, 2000));
  const kq = await p.evaluate(() => {
    const t = document.querySelector("#pane-xacminh table"); const th = [...t.querySelectorAll("thead th")]; const rows = [...t.querySelectorAll("tbody tr")].slice(0, 30);
    const rg = document.createRange();
    const can = (el) => { let w = 0; el.querySelectorAll("*").forEach((c) => { if (!c.children.length || c.tagName === "IMG" || c.tagName === "BUTTON") { const r = c.getBoundingClientRect(); w = Math.max(w, r.right - el.getBoundingClientRect().left); } });
      rg.selectNodeContents(el); const rr = rg.getClientRects(); for (const x of rr) w = Math.max(w, x.right - el.getBoundingClientRect().left); return w; };
    const out = th.map((h, i) => { const cells = rows.map((r) => r.children[i]).filter(Boolean); const can_ = cells.map(can).sort((a, b) => a - b);
      const cao = cells.map((c) => c.getBoundingClientRect().height); return { cot: h.textContent.trim(), rong: Math.round(h.getBoundingClientRect().width), noiDungTB: Math.round(can_.reduce((a, x) => a + x, 0) / can_.length), noiDungMax: Math.round(can_[can_.length - 1]) }; });
    const caoDong = rows.map((r) => r.getBoundingClientRect().height); return { cot: out, caoDongTB: Math.round(caoDong.reduce((a, x) => a + x, 0) / caoDong.length), bang: Math.round(t.getBoundingClientRect().width), soDong: rows.length };
  });
  console.log("\n" + sub, "· bảng", kq.bang, "px · cao dòng TB", kq.caoDongTB, "px");
  for (const c of kq.cot) console.log(`  ${c.cot.padEnd(18)} rộng ${String(c.rong).padStart(4)} · nội dung TB ${String(c.noiDungTB).padStart(4)} · lớn nhất ${String(c.noiDungMax).padStart(4)} · thừa ~${Math.max(0, c.rong - c.noiDungMax)}`);
  await p.screenshot({ path: O + sub + ".png" });
}
await b.close();
