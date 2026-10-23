import puppeteer from "puppeteer";
import { taoPhienTk, dangXuat } from "./xacminh-dang-nhap.mjs";
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
const S = "C:/Users/lechitam/AppData/Local/Temp/claude/C--Users-lechitam-New-folder/52d8353e-a82e-42b6-97e1-a074e22127b7/scratchpad";
const PA = taoPhienTk("tamlc", false).phien; await nghi(6000);
const Q = {}; for (const k of ["r.tong", "r.task", "r.hangmuc", "r.planogram", "r.kk", "r.htonbat", "r.xacminh", "r.xm.treo", "r.xm.cam", "r.maytram", "r.xm.tg", "f.stock", "f.kk", "f.abn", "f.plg", "f.sku", "f.cd", "f.tem"]) Q[k] = "lam";
const ng = { id: "tamlc", ten: "Tâm", vaiTro: "quantri", quyen: Q };
const b = await puppeteer.launch({ headless: "new", executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" });
try {
  for (const w of [1440, 390]) {
    const p = await b.newPage(); await p.setViewport({ width: w, height: 900, isMobile: w < 500, hasTouch: w < 500 });
    p.__loi = []; p.on("pageerror", (e) => p.__loi.push(e.message));
    await p.evaluateOnNewDocument((ph, ng) => { localStorage.setItem("hx-phien", ph); localStorage.setItem("tk-phien", "x".repeat(40)); localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: ng, quyen: ng.quyen }));
      const f0 = window.fetch; window.fetch = function (u) { return f0.apply(this, arguments).then((r) => { if (/\/api\/du-lieu/.test(String(u))) r.clone().json().then((j) => { window.__PS = j.phieu.filter((p) => p.lsKho && p.lsKho.soan && p.lsKho.soan.length).map((p) => String(p.id)); }).catch(() => {}); return r; }); }; }, PA, ng);
    await p.setRequestInterception(true);
    p.on("request", (r) => { if (/script\.google|tk-thu/.test(r.url()) && r.method() === "POST" && /tk_toi/.test(r.postData() || "")) return r.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", nguoi: ng }) }); r.continue(); });
    await p.goto("http://localhost:8123/kiemsoatkho/", { waitUntil: "networkidle2", timeout: 90000 }); await nghi(4000);
    await p.evaluate(() => setTab("xacminh")); await nghi(5000); await p.evaluate(() => HXACMINH.sub("treo")); await nghi(4000);
    const kq = await p.evaluate(async () => {
      const id = (window.__PS || []).find((i) => document.querySelector('[data-moqd="' + i + '"]')); if (!id) return { loi: "không thấy phiếu có soạn trên trang", ps: (window.__PS || []).length };
      document.querySelector('[data-moqd="' + id + '"]').click(); await new Promise((r) => setTimeout(r, 2500));
      const dong = [...document.querySelectorAll("#modal .hx-lan")].filter((d) => d.querySelector(".hx-tag.soan"));
      const t = dong[0] && dong[0].querySelector(".hx-tag.soan"), cs = t && getComputedStyle(t);
      return { id, soDongSoan: dong.length, tongDong: document.querySelectorAll("#modal .hx-lan").length, mau: cs && cs.color, dauHang: !!dong[0] && dong[0].querySelector(".hx-lan-hang").firstElementChild === t, chu: dong.slice(0, 2).map((d) => d.textContent.replace(/\s+/g, " ").trim().slice(0, 110)) };
    });
    console.log(w, JSON.stringify(kq), p.__loi.length ? "LỖI " + p.__loi.join(";").slice(0, 200) : "");
    const el = await p.$("#modal .hx-lan .hx-tag.soan"); if (el) { await el.evaluate((x) => x.scrollIntoView({ block: "center" })); await nghi(400); await p.screenshot({ path: S + "/soan-" + w + ".png" }); }
    await p.close();
  }
} finally { await b.close(); dangXuat(PA); }
