// QC ✕ Tắt lọc TỪNG Ô (23/10 user t4: «nhấn tắt lọc nhưng vẫn còn lọc» — Theo máy ô Ngày): mỗi mục, lần lượt đặt từng ô lọc
// (ô chọn → lựa chọn khác · ô gõ → «a» · lịch ngày → nút nhanh thứ 2 + Áp dụng) rồi bấm ✕ ⇒ phải hết «đang lọc», ✕ ẩn, số dòng về như trước.
import puppeteer from "puppeteer";
import { taoPhienTk, dangXuat } from "./xacminh-dang-nhap.mjs";
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
const PA = taoPhienTk("tamlc", false).phien; await nghi(6000);
const Q = {}; for (const k of ["r.tong", "r.task", "r.hangmuc", "r.planogram", "r.kk", "r.htonbat", "r.xacminh", "r.xm.treo", "r.xm.cam", "r.maytram", "r.xm.tg", "f.stock", "f.kk", "f.abn", "f.plg", "f.sku", "f.cd", "f.tem"]) Q[k] = "lam";
const ng = { id: "tamlc", ten: "Tâm", vaiTro: "quantri", quyen: Q };
const W = Number((process.argv.find((a) => /^--w=/.test(a)) || "--w=1440").slice(4));
const b = await puppeteer.launch({ headless: "new", executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" });
let dat = 0, hong = 0;
async function trang(url) {
  const p = await b.newPage(); await p.setViewport({ width: W, height: 900, isMobile: W < 500, hasTouch: W < 500 });
  await p.evaluateOnNewDocument((ph, ng) => { localStorage.setItem("hx-phien", ph); localStorage.setItem("tk-phien", "x".repeat(40)); localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: ng, quyen: ng.quyen })); }, PA, ng);
  await p.setRequestInterception(true);
  p.on("request", (r) => { if (/script\.google|tk-thu/.test(r.url()) && r.method() === "POST" && /tk_toi/.test(r.postData() || "")) return r.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", nguoi: ng }) }); r.continue(); });
  await p.goto(url, { waitUntil: "networkidle2", timeout: 90000 }); await nghi(4000); return p;
}
const KH = ".modal-box,.modalbox,.hk-dau-panel,.kk-dau-panel,.panel,.pane,section";
async function tungO(p, ten) {
  const soO = await p.evaluate((KH) => { const l = [...document.querySelectorAll("button")].find((b) => { const c = b.cloneNode(true); c.querySelector(".tat-loc")?.remove(); return /^Bộ lọc/.test(c.textContent.trim()) && b.offsetParent; });
    if (!l) return -1; window.__KH = l.closest(KH); window.__OS = () => [...window.__KH.querySelectorAll("select, input[type=search], input[type=text], input:not([type]), .date-filter")]
      .filter((x) => !x.closest("table, .menu, .date-pop, .tk-f, .hx-qd, [data-khong-tat-loc]") && !(x.matches("input") && x.closest(".date-filter")) && !x.disabled); return window.__OS().length; }, KH);
  if (soO < 0) { console.log("--   " + ten + " không thấy nút Bộ lọc"); return; }
  for (let i = 0; i < soO; i++) {
    const kq = await p.evaluate(async (i, KH) => {
      const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
      const nut = () => [...document.querySelectorAll("button")].find((b) => { const c = b.cloneNode(true); c.querySelector(".tat-loc")?.remove(); return /^Bộ lọc/.test(c.textContent.trim()) && b.offsetParent; });
      const chu = (b) => { const c = b.cloneNode(true); c.querySelector(".tat-loc")?.remove(); return c.textContent.trim(); };
      window.__KH = nut().closest(KH);
      const oNhin = () => [...nut().closest(KH).querySelectorAll("tbody tr, .cl-item")].filter((x) => x.getClientRects().length).length;
      if (nut().getAttribute("aria-expanded") === "false" || document.querySelector("#hxFilters.collapsed, #filterGrid.collapsed")) { nut().click(); await nghi(500); }
      const truoc = { chu: chu(nut()), n: oNhin() };
      const o = window.__OS()[i]; if (!o) return { bo: "ô biến mất" };
      const ten = ((o.closest("label,.date-filter,.fld,.field") || {}).querySelector?.(".lbl,span,label") || {}).textContent || o.id || o.tagName;
      if (!o.getClientRects().length) { nut().click(); await nghi(600); }
      if (!o.getClientRects().length) return { ten, bo: "ô ẩn" };
      if (o.tagName === "SELECT") { if (o.options.length < 2) return { ten, bo: "1 lựa chọn" }; o.selectedIndex = o.selectedIndex === 1 ? Math.min(2, o.options.length - 1) : 1; o.dispatchEvent(new Event("change", { bubbles: true })); }
      else if (o.tagName === "INPUT") { o.value = "a"; o.dispatchEvent(new Event("input", { bubbles: true })); o.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "a" })); }
      else { (o.querySelector(".date-btn") || o).click(); await nghi(400); const pr = [...document.querySelectorAll(".dp-presets button")].filter((x) => x.getClientRects().length); if (!pr.length) return { ten, bo: "lịch không mở" };
        (pr[1] || pr[0]).click(); await nghi(200); const ap = [...document.querySelectorAll(".dp-apply")].find((x) => x.getClientRects().length); if (ap) ap.click(); }
      await nghi(1300);
      const x = nut().querySelector(":scope > .tat-loc"), khi = { chu: chu(nut()), n: oNhin() };
      if (khi.chu === truoc.chu && khi.n === truoc.n && (!x || x.hidden)) return { ten, bo: "giá trị này không đổi gì (lọc không ăn)" };
      if (!x || x.hidden) return { ten, loi: "đang lọc mà KHÔNG có ✕", truoc, khi };
      x.click(); await nghi(1600);
      const x2 = nut().querySelector(":scope > .tat-loc"), sau = { chu: chu(nut()), n: oNhin(), conX: !!(x2 && !x2.hidden) };
      return { ten, truoc, khi, sau, ok: !/đang lọc/.test(sau.chu) && !sau.conX && sau.n === truoc.n };
    }, i, KH);
    if (kq.bo) { console.log("--   " + ten.padEnd(26) + " " + (kq.ten || "") + ": " + kq.bo); continue; }
    kq.ok ? dat++ : hong++;
    console.log((kq.ok ? "DAT  " : "HONG ") + ten.padEnd(26) + " " + String(kq.ten).trim().slice(0, 30).padEnd(30) + (kq.ok ? "" : " " + JSON.stringify(kq)));
  }
}
try {
  const p = await trang("http://localhost:8123/kiemsoatkho/");
  for (const [tab, sub] of [["task"], ["kk"], ["xacminh", "treo"], ["xacminh", "cam"], ["xacminh", "tg"]]) {
    await p.evaluate((t) => setTab(t), tab); await nghi(5000); if (sub) { await p.evaluate((s) => HXACMINH.sub(s), sub); await nghi(3500); }
    await tungO(p, "Retail " + tab + (sub ? "/" + sub : ""));
  }
  await p.close();
  const f = await trang("http://localhost:8123/factory/");
  for (const tab of ["kk", "plg"]) { await f.evaluate((t) => showTab(t), tab); await nghi(7000); await tungO(f, "Factory " + tab); }
} finally { await b.close(); dangXuat(PA); console.log("DAT:", dat, "HONG:", hong); }
