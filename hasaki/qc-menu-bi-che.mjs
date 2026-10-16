/* QC «menu / lịch bị che» — 13/10/2026 user quay video: lịch Ngày kiểm + menu Request/Type ở tab Kiểm kê Factory mở ra
 * nhưng bị thẻ bên dưới đè (thẻ có will-change = lớp vẽ riêng, thẻ sau vẽ đè thẻ trước). Bộ đo cũ chỉ đo TOẠ ĐỘ menu nên lọt.
 *  M1 mọi tab của Audit Retail + Audit Factory, máy tính 1440 + điện thoại 390: bấm/focus từng ô xổ (.combo input, .date-btn)
 *     → phần mới hiện ra phải THẤY RÕ: lấy 4 điểm trong menu, elementFromPoint phải trúng chính menu.
 *  16/10: thêm nút xổ dạng <button> trong .combo (ô Ngày Planogram Factory bị thẻ Tiến độ/Sơ đồ đè mà bộ đo không bấm tới).
 *  Chặn mọi POST ở tầng mạng (luật qc-khong-ghi-du-lieu-that). Chạy: node qc-menu-bi-che.mjs [--goc=http://localhost:8123]
 */
import puppeteer from "puppeteer-core";
import { EDGE_PATH } from "./token-store.js";

const A = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const GOC = A.goc || "http://localhost:8123";
const nghi = (t) => new Promise((r) => setTimeout(r, t));
const b = await puppeteer.launch({ executablePath: EDGE_PATH, headless: "new" });
let dat = 0; const loi = [];
for (const app of ["/retail/", "/factory/"]) for (const W of [1440, 390]) {
  const p = await b.newPage(); await p.setViewport({ width: W, height: 900, isMobile: W < 600, hasTouch: W < 600 });
  const c = await p.createCDPSession(); await c.send("Network.setBypassServiceWorker", { bypass: true });
  await p.setRequestInterception(true); p.on("request", (r) => (/^(GET|OPTIONS|HEAD)$/.test(r.method()) ? r.continue() : r.abort()));
  await p.goto(GOC + app, { waitUntil: "domcontentloaded" }); await nghi(14000);
  const n = await p.evaluate(() => document.querySelectorAll("#sideNav .s-item").length);
  for (let i = 0; i < n; i++) {
    const ten = await p.evaluate((i) => { const it = document.querySelectorAll("#sideNav .s-item")[i]; it.click(); const c = it.cloneNode(true); c.querySelectorAll(".sn,.di").forEach((x) => x.remove()); return c.textContent.trim(); }, i);
    await nghi(6000);
    const kq = await p.evaluate(async () => {
      const nghi = (t) => new Promise((r) => setTimeout(r, t));
      const hien = (e) => e.offsetParent && e.getBoundingClientRect().height > 0 && getComputedStyle(e).visibility !== "hidden";
      const POP = ".combo-menu,.date-pop,.dp-pop,[class*='-menu'],[class*='-pop']";
      const truoc = new Set([...document.querySelectorAll(POP)].filter(hien));
      const o = [];
      const nut = [...document.querySelectorAll(".wrap .combo input, .wrap .date-btn, .wrap .combo > button")].filter(hien).filter((e) => !e.closest(".modal,[class*=modal]"));
      for (const el of nut) {
        el.scrollIntoView({ block: "center" }); await nghi(150);
        if (el.tagName === "INPUT") el.focus(); else el.click();
        await nghi(450);
        const moi = [...document.querySelectorAll(POP)].filter((m) => hien(m) && !truoc.has(m) && m.getBoundingClientRect().height > 20);
        const ten = el.getAttribute("placeholder") || el.textContent.trim().slice(0, 24) || el.id;
        for (const m of moi) {
          const r = m.getBoundingClientRect();
          const diem = [[.5, .3], [.5, .85], [.15, .7], [.85, .9]].map(([x, y]) => [r.left + r.width * x, Math.min(innerHeight - 2, r.top + r.height * y)]).filter(([, y]) => y > 0);
          const che = diem.map(([x, y]) => document.elementFromPoint(x, y)).filter((e) => e && !m.contains(e));
          if (che.length) o.push(ten + " ← che bởi " + (che[0].id ? "#" + che[0].id : che[0].tagName.toLowerCase() + "." + String(che[0].className).split(" ")[0]));
        }
        if (el.tagName === "INPUT") el.blur();
        document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); document.body.click(); await nghi(250);
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await nghi(150);
      }
      return { so: nut.length, o };
    });
    if (!kq.so) continue;
    const dk = !kq.o.length; if (dk) dat++; else loi.push(app + " " + W + " " + ten);
    console.log((dk ? "  ✓ " : "  ✗ ") + app + " " + W + " " + ten + " — " + kq.so + " ô xổ" + (kq.o.length ? ": " + kq.o.join(" | ") : " thấy rõ"));
  }
  await p.close();
}
await b.close();
console.log(loi.length ? "✗ menu bị che: " + loi.length + " màn" : "✓ menu/lịch không bị che: đạt " + dat + " màn");
process.exit(loi.length ? 1 : 0);
