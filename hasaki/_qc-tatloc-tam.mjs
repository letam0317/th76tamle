// QC tạm nút ✕ Tắt lọc (23/10 bản 2: ✕ bên TRÁI nút Bộ lọc) — mỗi mục: chưa lọc thì ẩn · lọc thì ✕ đỏ bên trái, bấm được (không bị che)
// · bấm ✕ về mặc định + nút hết «đang lọc» + không mở/đóng bộ lọc · ca ảnh lỗi: lọc rồi TẢI LẠI trang (bộ lọc được nhớ) vẫn phải có ✕.
import puppeteer from "puppeteer";
import { taoPhienTk, dangXuat } from "./xacminh-dang-nhap.mjs";
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
const S = "C:/Users/lechitam/AppData/Local/Temp/claude/C--Users-lechitam-New-folder/52d8353e-a82e-42b6-97e1-a074e22127b7/scratchpad";
const PA = taoPhienTk("tamlc", false).phien; await nghi(6000);
const Q = {}; for (const k of ["r.tong", "r.task", "r.hangmuc", "r.planogram", "r.kk", "r.htonbat", "r.xacminh", "r.xm.treo", "r.xm.cam", "r.maytram", "r.xm.tg", "f.stock", "f.kk", "f.abn", "f.plg", "f.sku", "f.cd", "f.tem"]) Q[k] = "lam";
const ng = { id: "tamlc", ten: "Tâm", vaiTro: "quantri", quyen: Q };
const b = await puppeteer.launch({ headless: "new", executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" });
let hong = 0, dat = 0;
async function trang(url, w, h, p0) {
  const p = p0 || await b.newPage(); if (!p0) { await p.setViewport({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500 });
    p.__loi = []; p.on("pageerror", (e) => p.__loi.push(e.message));
    await p.evaluateOnNewDocument((ph, ng) => { if (sessionStorage.getItem("qc-da")) return; sessionStorage.setItem("qc-da", 1); localStorage.setItem("hx-phien", ph); localStorage.setItem("tk-phien", "x".repeat(40)); localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: ng, quyen: ng.quyen })); }, PA, ng);
    await p.setRequestInterception(true);
    p.on("request", (r) => { if (/script\.google|tk-thu/.test(r.url()) && r.method() === "POST" && /tk_toi/.test(r.postData() || "")) return r.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", nguoi: ng }) }); r.continue(); }); }
  await p.goto(url, { waitUntil: "networkidle2", timeout: 90000 }); await nghi(4000); return p;
}
const LOC = `[...document.querySelectorAll("button")].find((b) => { const c = b.cloneNode(true); c.querySelector(".tat-loc")?.remove(); return /^Bộ lọc/.test(c.textContent.trim()) && b.offsetParent; })`;
const KH = ".modal-box,.modalbox,.hk-dau-panel,.kk-dau-panel,.panel,.pane,section";
async function datLoc(p) {   // chọn lựa chọn thứ 2 của ô chọn đầu tiên (hoặc gõ «a»)
  return p.evaluate(async (LOC, KH) => { const loc = eval(LOC); if (!loc) return ""; if (loc.getAttribute("aria-expanded") !== "true" && !loc.classList.contains("mo")) loc.click(); await new Promise((r) => setTimeout(r, 500));
    const k = loc.closest(KH); const sel = [...k.querySelectorAll("select")].find((s) => !s.closest("table,.hx-qd,[data-khong-tat-loc]") && s.options.length > 1 && !s.disabled);
    if (sel) { sel.selectedIndex = sel.options.length > 2 ? 2 : 1; sel.dispatchEvent(new Event("change", { bubbles: true })); return "chon"; }
    const i = [...k.querySelectorAll("input[type=search],input[type=text],input:not([type])")].find((x) => !x.closest("table,.date-filter") && x.offsetParent); if (i) { i.value = "a"; i.dispatchEvent(new Event("input", { bubbles: true })); return "go"; } return ""; }, LOC, KH);
}
async function do_(p, ten, choDat) {
  const kq = await p.evaluate(async (LOC, KH, choDat) => {
    const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
    const tim = () => eval(LOC); let loc = tim(); if (!loc) return { loi: "khong thay nut Bo loc" };
    if (document.querySelector("button.tat-loc")) return { loi: "con nut cu" };
    const x = loc.querySelector(":scope > .tat-loc"); if (!x || x.hidden) return { loi: "dang loc ma KHONG co ✕", chuNut: loc.textContent.trim() };
    const c = (b) => { const z = b.cloneNode(true); z.querySelector(".tat-loc")?.remove(); return z.textContent.trim(); };
    const rx = x.getBoundingClientRect(), rb = loc.getBoundingClientRect(), mau = getComputedStyle(x).backgroundColor;
    const benTrai = x.classList.contains("tl-trong") ? "trong-nut" : rx.right <= rb.left + 1 && Math.abs((rx.top + rx.bottom) / 2 - (rb.top + rb.bottom) / 2) < 3 ? "ben-trai" : "SAI";
    const dinh = document.elementFromPoint((rx.left + rx.right) / 2, (rx.top + rx.bottom) / 2), bamDuoc = dinh === x;
    const chuX = x.textContent, moTruoc = loc.getAttribute("aria-expanded") + "|" + loc.classList.contains("mo");
    x.click(); await nghi(1500); loc = tim();
    const x2 = loc && loc.querySelector(":scope > .tat-loc");
    return { benTrai, bamDuoc, mau, chuX, chuSau: c(loc), anSau: !x2 || x2.hidden, giuTrangThaiMo: loc.getAttribute("aria-expanded") + "|" + loc.classList.contains("mo") === moTruoc };
  }, LOC, KH, choDat);
  const ok = !kq.loi && kq.benTrai !== "SAI" && kq.bamDuoc && kq.chuX === "✕" && /rgb\(2\d\d, \d{1,2}, /.test(kq.mau) && !/đang lọc/.test(kq.chuSau) && kq.anSau && kq.giuTrangThaiMo;
  ok ? dat++ : hong++;
  console.log((ok ? "DAT  " : "HONG ") + ten.padEnd(34), JSON.stringify(kq), p.__loi.length ? "LOI " + p.__loi.join(";").slice(0, 150) : "");
}
async function anKhiKhongLoc(p, ten) {
  const r = await p.evaluate((LOC) => { const l = eval(LOC); if (!l) return "khong nut"; const x = l.querySelector(":scope > .tat-loc"); return /đang lọc/.test(l.textContent) ? "dang loc san" : (!x || x.hidden) ? "an" : "HIEN SAI"; }, LOC);
  if (r === "HIEN SAI") { hong++; console.log("HONG " + ten.padEnd(34) + " chưa lọc mà ✕ hiện"); }
}
try {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const ma = w < 500 ? "dt " : "web ";
    const p = await trang("http://localhost:8123/kiemsoatkho/", w, h);
    for (const [tab, sub] of [["task"], ["kk"], ["xacminh", "treo"], ["xacminh", "cam"], ["xacminh", "tg"]]) {
      await p.evaluate((t) => setTab(t), tab); await nghi(5000); if (sub) { await p.evaluate((s) => HXACMINH.sub(s), sub); await nghi(3500); }
      const ten = ma + "Retail " + tab + (sub ? "/" + sub : "");
      await anKhiKhongLoc(p, ten);
      if (!(await datLoc(p))) { console.log("--   " + ten + " (không có ô để thử)"); continue; } await nghi(1000);
      if (w > 500 && tab === "task") await p.screenshot({ path: S + "/tl2-task.png", clip: { x: 220, y: 60, width: 1220, height: 200 } });
      if (w < 500 && sub === "cam") await p.screenshot({ path: S + "/tl2-dt-cam.png", clip: { x: 0, y: 0, width: 390, height: 300 } });
      await do_(p, ten);
      await p.evaluate(() => { const c = document.getElementById("mClose"); if (c && document.querySelector("#modal.show")) c.click(); }); await nghi(400);
    }
    /* ca ảnh lỗi: lọc Theo tác vụ → TẢI LẠI (bộ lọc được nhớ) → phải có ✕ */
    await p.evaluate(() => setTab("xacminh")); await nghi(4000); await p.evaluate(() => HXACMINH.sub("treo")); await nghi(3000); await datLoc(p); await nghi(1200);
    await trang("http://localhost:8123/kiemsoatkho/", w, h, p); await p.evaluate(() => setTab("xacminh")); await nghi(5000); await p.evaluate(() => HXACMINH.sub("treo")); await nghi(3500);
    const conLoc = await p.evaluate((LOC) => /đang lọc/.test((eval(LOC) || {}).textContent || ""), LOC);
    if (conLoc) await do_(p, ma + "Retail xacminh/treo SAU TAI LAI"); else console.log("--   " + ma + "tải lại: bộ lọc không được nhớ (không áp ca này)");
    await p.close();
    const f = await trang("http://localhost:8123/factory/", w, h);
    for (const tab of ["kk", "plg"]) { await f.evaluate((t) => showTab(t), tab); await nghi(7000); const ten = ma + "Factory " + tab; await anKhiKhongLoc(f, ten);
      if (!(await datLoc(f))) { console.log("--   " + ten + " (không có ô để thử)"); continue; } await nghi(1000); await do_(f, ten); }
    await f.close();
  }
} finally { await b.close(); dangXuat(PA); console.log("DAT:", dat, "HONG:", hong); }
