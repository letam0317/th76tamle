/* QC 21/10: điện thoại — laptop thật + PC dự phòng cùng báo đường hầm → phải chọn LAPTOP (không dự phòng); chỉ dự phòng → chịu bản chỉ xem. */
import puppeteer from "puppeteer-core";
import { phienQC } from "./xacminh-dang-nhap.mjs";
const PHIEN = phienQC(), GOC = "http://localhost:8123/kiemsoatkho/";
const THAT = "https://qc-laptop-that.trycloudflare.com", DP = "https://qc-pc-du-phong.trycloudflare.com";
let dat = 0, truot = 0; const ok = (d, t) => { d ? dat++ : truot++; console.log((d ? "  dat  " : "  HONG ") + t); };
async function ca(ten, may, mong) {
  const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
  const pg = await b.newPage(); const loi = [];
  pg.on("pageerror", (e) => loi.push(e.message));
  await pg.setUserAgent("Mozilla/5.0 (Linux; Android 14; 23116PN5BC) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36");
  await pg.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await pg.evaluateOnNewDocument((hx) => { if (window.top !== window) return; try { localStorage.setItem("hx-phien", hx); localStorage.removeItem("hx-ham"); localStorage.setItem("tk-phien", "qc");
    localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: { id: "qc", ten: "QC", vaiTro: "quantri" }, quyen: { "r.xacminh": "lam", "r.maytram": "lam" } })); } catch (e) {} }, PHIEN);
  await pg.evaluateOnNewDocument(() => { window.__qcToast = []; new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.classList && n.classList.contains("toast")) window.__qcToast.push(n.textContent); })))
    .observe(document, { childList: true, subtree: true }); });
  await pg.setRequestInterception(true);
  const H = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type,x-hx-phien" };
  pg.on("request", (r) => { const u = r.url();
    if (/127\.0\.0\.1:8591|summary\/xm-may-chu\.json/.test(u)) return r.abort();
    if (/script\.google\.com/.test(u) && r.method() === "POST" && /"pcBangPh"/.test(r.postData() || ""))
      return r.respond({ status: 200, contentType: "application/json", headers: H, body: JSON.stringify({ status: "success", srvNow: Date.now(), may: may.map((m) => ({ ...m, luc: new Date().toISOString() })) }) });
    if (u.startsWith(THAT) || u.startsWith(DP)) {
      if (r.method() === "OPTIONS") return r.respond({ status: 204, headers: H });
      if (/\/api\/ping/.test(u)) return r.respond({ status: 200, contentType: "application/json", headers: H, body: JSON.stringify(u.startsWith(DP) ? { ok: 1, duPhong: 1 } : { ok: 1 }) });
      return r.respond({ status: 200, contentType: "application/json", headers: H, body: "{}" });
    }
    if (r.method() !== "GET" && r.method() !== "OPTIONS" && r.method() !== "HEAD") return r.abort();
    r.continue(); });
  await pg.goto(GOC + "?tab=xacminh", { waitUntil: "networkidle2", timeout: 60000 });
  await pg.waitForFunction(() => window.__HX_QUA_HAM, { timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));
  const st = await pg.evaluate(() => ({ api: window.HX_API, dp: window.__HX_DU_PHONG, nho: localStorage.getItem("hx-ham"), bao: (window.__qcToast || []).join(" | ") }));
  console.log("Ca " + ten + ": " + JSON.stringify(st).slice(0, 220));
  ok(st.api === mong.api, ten + ": chọn máy chủ " + (mong.api === THAT ? "LAPTOP THẬT" : "DỰ PHÒNG"));
  ok(!!st.dp === !!mong.dp, ten + ": cờ dự phòng = " + mong.dp);
  ok((st.nho || "") === (mong.nho || ""), ten + ": nhớ địa chỉ = " + (mong.nho ? "laptop" : "không"));
  ok(/bản dự phòng/.test(st.bao) === !!mong.dp, ten + ": báo «bản dự phòng» " + (mong.dp ? "có" : "không"));
  ok(loi.length === 0, ten + ": không lỗi trang " + loi.slice(0, 1).join(""));
  await b.close();
}
try {
  await ca("A cả hai báo", [{ may: "QC-PC", xmHam: DP }, { may: "QC-LAPTOP", xmHam: THAT }], { api: THAT, dp: 0, nho: THAT });
  await ca("B chỉ dự phòng", [{ may: "QC-PC", xmHam: DP }], { api: DP, dp: 1, nho: "" });
} catch (e) { ok(false, "lỗi QC: " + e.message); }
console.log((truot ? "HONG " : "DAT ") + dat + "/" + (dat + truot));
process.exit(truot ? 1 : 0);
