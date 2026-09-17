/**
 * qc-toc-do-ghi-nhan-5s.mjs — ĐO TỐC ĐỘ luồng Ghi nhận 5S từ pop-up ô (17/09/2026).
 *
 *  Đo 4 chặng người dùng thật sự phải chờ:
 *    ① bấm nút "Ghi nhận 5S" → pop-up PIN hiện
 *    ② gõ đúng PIN → modal form HIỆN (gồm cả chờ chụp pop-up ở ca A)
 *    ③ form đã điền xong → payload sẵn sàng (nén ảnh, dựng base64) — phần CLIENT của nút Gửi
 *    ④ kích thước payload thật (KB) → suy ra thời gian đường truyền
 *  KHÔNG gửi thật lên Apps Script: một lần gửi là một dòng WMS-5S-AUDIT + một task 5S thật trên
 *  work.hasaki.vn (bộ đẩy chạy mỗi 15'). Chặng mạng đo bằng cách CHẶN request ở lớp trình duyệt,
 *  đo đúng byte đã đóng gói và thời điểm phát đi.
 *
 *  node qc-toc-do-ghi-nhan-5s.mjs [--live] [--url=…] [--mobile] [--3g]
 */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, ".exports", "qc-toc-do-ghi-nhan-5s"); fs.mkdirSync(OUT, { recursive: true });
const ARG = process.argv.slice(2).join(" ");
const URL_GOC = (ARG.match(/--url=(\S+)/) || [])[1] || (/--live/.test(ARG) ? "https://letam0317.github.io/kiemsoatkho/" : "http://localhost:8123/kiemsoatkho/");
const URL = URL_GOC.replace(/\/?$/, "/") + "?tab=planogram";
const MOBILE = /--mobile/.test(ARG), BA_G = /--3g/.test(ARG);
const UA_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const cho = (ms) => new Promise(r => setTimeout(r, ms));
const s2 = (ms) => (ms / 1000).toFixed(2) + " s";

const DO = [];
function ghi(chang, ms, chu){ DO.push({ chang, ms, chu }); console.log("  " + chang.padEnd(52) + " " + String(s2(ms)).padStart(8) + (chu ? "   " + chu : "")); }

async function choDen(page, fn, ms, nhan, arg){
  const t0 = Date.now();
  while (Date.now() - t0 < ms){
    let v = null; try { v = await page.evaluate(fn, arg); } catch (e) { /* trang đang vẽ lại */ }
    if (v) return v;
    await cho(150);
  }
  throw new Error("TREO quá " + ms / 1000 + "s ở bước: " + nhan);
}

const b = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH, args: ["--no-sandbox"] });
const page = await b.newPage();
if (MOBILE){ await page.setUserAgent(UA_IOS); await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); }
else await page.setViewport({ width: 1280, height: 900 });
page.on("pageerror", e => console.log("  (lỗi JS) " + String(e.message).slice(0, 140)));
if (BA_G){ const cdp = await page.createCDPSession(); await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 300, downloadThroughput: 200 * 1024, uploadThroughput: 100 * 1024 }); }

/* CHẶN request GỬI BÁO CÁO tới Apps Script — đo byte + thời điểm, KHÔNG để nó tới máy chủ.
   BẬT MUỘN (17/09/2026): để interception mở suốt buổi thì MỌI request đều vòng qua Node, ảnh CDN 500 KB
   chậm hẳn — lần đo đầu ca B "tải 2 ảnh 60 s" là lỗi của chính bộ đo, không phải của trang. Nay chỉ bật
   ngay trước cú bấm GỬI rồi tắt lại. */
let dangChan = false;
const chanGui = async (bat) => { dangChan = bat; await page.setRequestInterception(bat); };
const guiThat = [];
page.on("request", (r) => {
  const u = r.url(), pd = r.postData();
  if (/script\.google\.com\/macros/.test(u) && r.method() === "POST" && pd && /"hinhAnh"/.test(pd)){
    guiThat.push({ luc: Date.now(), kb: Math.round(Buffer.byteLength(pd, "utf8") / 1024) });
    return r.respond({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ status: "success", message: "(QC chặn — không ghi Sheet)" }) });
  }
  /* interception có thể vừa bị tắt giữa chừng → continue() ném BẤT ĐỒNG BỘ; chỉ đụng khi đang bật và luôn nuốt lỗi */
  if (!dangChan) return;
  try { const pr = r.continue(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) {}
});

console.log("ĐO TỐC ĐỘ Ghi nhận 5S · " + URL + (MOBILE ? " · điện thoại" : " · máy tính") + (BA_G ? " · mạng 3G chậm" : ""));
const tMo = Date.now();
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
const loc0 = await choDen(page, () => { if (!window.HPLANOGRAM || !HPLANOGRAM._S.yc.ok) return null; const a = document.querySelector("#hpMap [data-l]"); return a && a.getAttribute("data-l"); }, 60000, "chờ sơ đồ");
ghi("Mở trang → sơ đồ có dữ liệu", Date.now() - tMo);
await page.evaluate(l => HPLANOGRAM.openViTri(l), loc0);
await choDen(page, () => { const S = HPLANOGRAM._S; return (S.pc.ok || !S.pc.dang) && (S.ccn.ok || !S.ccn.dang) && (S.anh.ok || !S.anh.dang) ? 1 : null; }, 40000, "chờ nguồn bậc 3");
await page.evaluate(() => HPLANOGRAM.closeVt());

/* Chọn ô: ca A (có chụp pop-up) + ca có ảnh báo cáo */
const PL = await page.evaluate(() => { const S = HPLANOGRAM._S, d = S.dDen || S.yc.ngay;
  let A = null, Banh = null, nAnh = 0;
  for (const l of [...new Set([...document.querySelectorAll("#hpMap [data-l]")].map(a => a.getAttribute("data-l")))]){
    const du = HPLANOGRAM._soan5S(l, d);
    if (du.caseA && !A) A = l;
    if (!du.caseA && du.anhBaoCao.length > nAnh){ nAnh = du.anhBaoCao.length; Banh = l; }
  }
  return { d, A, Banh, nAnh }; });
console.log("  · ngày " + PL.d + " · ô ca A: " + (PL.A || "—") + " · ô có ảnh: " + (PL.Banh || "—") + " (" + PL.nAnh + " ảnh)");

/* ===== ① + ② CA A: bấm nút → PIN → form (gồm chụp pop-up) ===== */
if (PL.A){
  console.log("\n── Ca A (đi làm không báo cáo — có chụp pop-up làm bằng chứng) ──");
  await page.evaluate((l) => { const S = HPLANOGRAM._S, d = S.dDen || S.yc.ngay, pc = S.pc.by[Object.keys(S.pc.by).find(k => l.indexOf(k) === 0)];
    const em = String(pc.em).toLowerCase(); let o = S.ccn.em[em] || S.ccn.code[pc.code];
    if (!o){ o = { code: pc.code, em, ten: pc.ten, d: {}, vp: {}, ghi: [] }; S.ccn.em[em] = o; }
    const lui = (n) => { const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/); return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] - n)).toISOString().slice(0, 10); };
    const vp = {}; for (let k = 1; k <= 3; k++) vp[lui(k + 10)] = { so: 1, o: [l] };
    o.vp = vp; o.ghi = []; S.ccn.coVp = true; HPLANOGRAM.openViTri(l); }, PL.A);
  await cho(400);
  /* PIN: nạp sẵn cache phiên để đo đúng chặng giao diện, không đo tốc độ Apps Script (đã đo riêng nhiều lần) */
  await page.evaluate(() => { try { sessionStorage.setItem("ghi5s-pin", hashPin("0000")); } catch (e) {} });
  const t1 = Date.now();
  await page.evaluate(() => document.getElementById("hpVtGhi").click());
  await choDen(page, () => document.querySelector("#pinModal.show") ? 1 : null, 60000, "chờ pop-up PIN");
  ghi("① bấm nút → pop-up PIN hiện", Date.now() - t1);
  const t2 = Date.now();
  await page.evaluate(() => { document.getElementById("pinInput").value = "0000"; document.getElementById("pinOk").click(); });
  await choDen(page, () => document.querySelector("#ghiModal.show") ? 1 : null, 60000, "chờ modal form");
  const tForm = Date.now() - t2;
  ghi("② gõ PIN → modal form hiện", tForm);
  const tAnh = Date.now();
  const anh = await choDen(page, () => { const fr = document.getElementById("gmFrame"), w = fr && fr.contentWindow;
    if (!w || !w.Alpine) return null; const dt = w.Alpine.$data(w.document.querySelector("[x-data]"));
    if (!dt.files.length) return null;
    return { so: dt.files.length, kb: Math.round(String(dt.files[0].base64).length * 3 / 4 / 1024), ten: dt.files[0].ten }; }, 90000, "chờ ảnh chụp pop-up vào form");
  ghi("③ ảnh chụp pop-up sẵn trong form", Date.now() - tAnh, anh.so + " ảnh · " + anh.kb + " KB");
  ghi("   ⇒ TỔNG từ lúc bấm tới khi form dùng được", Date.now() - t1);
  /* ④ bấm Gửi báo cáo — request bị chặn ở lớp trình duyệt, đo byte + thời điểm phát */
  await chanGui(true);
  const t4 = Date.now(); guiThat.length = 0;
  await page.evaluate(() => { const fr = document.getElementById("gmFrame"), w = fr.contentWindow, d = w.document;
    const nut = [...d.querySelectorAll("button")].find(b => /GỬI BÁO CÁO/i.test(b.textContent)); if (nut) nut.click(); });
  const xong = await choDen(page, () => { const fr = document.getElementById("gmFrame"), w = fr.contentWindow;
    const dt = w.Alpine.$data(w.document.querySelector("[x-data]"));
    return dt.thongBao.noiDung ? { tb: dt.thongBao.noiDung.slice(0, 60), loai: dt.thongBao.loai, dangGui: dt.dangGui } : null; }, 90000, "chờ gửi xong");
  const kb = guiThat.length ? guiThat[0].kb : 0, tPhat = guiThat.length ? guiThat[0].luc - t4 : -1;
  ghi("④ bấm GỬI → payload phát đi", tPhat < 0 ? 0 : tPhat, kb + " KB");
  ghi("   bấm GỬI → người dùng thấy kết quả", Date.now() - t4, xong.tb);
  await page.screenshot({ path: path.join(OUT, "caseA-gui.png") });
  await chanGui(false);
  await page.evaluate(() => { dongGhiNhan(); HPLANOGRAM.closeVt(); });
}

/* ===== CA B: có thư viện ảnh báo cáo — đo thêm chặng tick + tải ảnh gốc ===== */
if (PL.Banh){
  console.log("\n── Ca khác (chọn ảnh báo cáo của ngày) ──");
  await page.evaluate(l => HPLANOGRAM.openViTri(l), PL.Banh);
  await cho(500);
  const t1 = Date.now();
  await page.evaluate(() => document.getElementById("hpVtGhi").click());
  await choDen(page, () => document.querySelector("#pinModal.show") ? 1 : null, 30000, "chờ PIN");
  ghi("① bấm nút → pop-up PIN hiện", Date.now() - t1);
  const t2 = Date.now();
  await page.evaluate(() => { document.getElementById("pinInput").value = "0000"; document.getElementById("pinOk").click(); });
  await choDen(page, () => document.querySelector("#ghiModal.show") ? 1 : null, 30000, "chờ modal form");
  ghi("② gõ PIN → modal form hiện", Date.now() - t2);
  const t3 = Date.now();
  const soAnh = await page.evaluate(async () => {
    const fr = document.getElementById("gmFrame"), w = fr.contentWindow, d = w.document, dt = w.Alpine.$data(d.querySelector("[x-data]"));
    const lb = [...d.querySelectorAll("label")].find(l => /Chọn từ ảnh báo cáo|Chọn từ thư viện/.test(l.textContent)); if (lb) lb.click();
    await new Promise(r => setTimeout(r, 300));
    /* Mỗi cú tick làm Alpine vẽ lại lưới ⇒ phải TRUY VẤN LẠI nút trước mỗi lần bấm và nhường 1 nhịp,
       nếu không thì cú thứ hai rơi vào node đã bị tháo khỏi DOM (bản đo đầu treo 60 s vì lỗi này). */
    for (let i = 0; i < 2; i++){
      const o = [...d.querySelectorAll("[x-show='moBC'] button.h-24")];
      if (o[i]) o[i].click();
      await new Promise(r => setTimeout(r, 250));
    }
    const nut = [...d.querySelectorAll("[x-show='moBC'] button")].find(b => /Thêm/.test(b.textContent)); if (nut) nut.click();
    const t0 = Date.now(); while (Date.now() - t0 < 60000 && dt.files.length < 2) await new Promise(r => setTimeout(r, 150));
    return dt.files.length;
  });
  ghi("③ tick 2 ảnh báo cáo → tải + nén xong", Date.now() - t3, soAnh + " ảnh trong form");
  await chanGui(true);
  const t4 = Date.now(); guiThat.length = 0;
  await page.evaluate(() => { const fr = document.getElementById("gmFrame"), w = fr.contentWindow, d = w.document, dt = w.Alpine.$data(d.querySelector("[x-data]"));
    dt.form.hangMuc = dt.dsHangMuc[1];   // hạng mục bắt buộc — người dùng sẽ chọn tay
    const nut = [...d.querySelectorAll("button")].find(b => /GỬI BÁO CÁO/i.test(b.textContent)); if (nut) nut.click(); });
  const xong = await choDen(page, () => { const fr = document.getElementById("gmFrame"), w = fr.contentWindow;
    const dt = w.Alpine.$data(w.document.querySelector("[x-data]"));
    return dt.thongBao.noiDung ? { tb: dt.thongBao.noiDung.slice(0, 60), loai: dt.thongBao.loai } : null; }, 90000, "chờ gửi xong");
  const kb = guiThat.length ? guiThat[0].kb : 0, tPhat = guiThat.length ? guiThat[0].luc - t4 : -1;
  ghi("④ bấm GỬI → payload phát đi", tPhat < 0 ? 0 : tPhat, kb + " KB (2 ảnh)");
  ghi("   bấm GỬI → người dùng thấy kết quả", Date.now() - t4, xong.tb);
  await page.screenshot({ path: path.join(OUT, "caseB-gui.png") });
  await chanGui(false);
}

await b.close();
fs.writeFileSync(path.join(OUT, "do-" + (MOBILE ? "mobile" : "desktop") + (BA_G ? "-3g" : "") + ".json"), JSON.stringify({ luc: new Date().toISOString(), url: URL, do: DO }, null, 2));
console.log("\nKết quả + ảnh: " + OUT);
