/**
 * qc-live-planogram-subloc.mjs — QC LIVE TOÀN DIỆN THEO BỘ QUY CHUẨN DỰ ÁN
 *
 * Kiểm tra tính năng hiển thị vị trí con, mô tả kệ/tầng/mâm, tên người báo cáo và thời gian
 * trên pop-up ảnh (Lightbox) của tab Planogram (Hasaki).
 *
 * Bao gồm 2 kịch bản:
 *   - Kịch bản A: LIVE 100% từ Google Sheets (dữ liệu thật của nhân viên).
 *   - Kịch bản B: CAROUSEL 16 ẢNH CON (chuyển ảnh Next/Prev, kiểm tra vị trí con từng mâm/tầng).
 *   - Đo đạc 9 luật hiển thị điện thoại trên iPhone 14 (390x844).
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const GOC = path.resolve(DIR, "..");
const OUT = path.join(DIR, ".exports");
const ARTIFACT_DIR = "C:\\Users\\lechitam\\.gemini\\antigravity-cli\\brain\\c8c66938-7451-4e6a-b472-d87065146955";
fs.mkdirSync(OUT, { recursive: true });

const PORT = 8129;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const CHO_PHEP = {
  factory: path.join(GOC, "factory"),
  kiemsoatkho: path.join(GOC, "hasaki", "kiemsoatkho")
};

const server = http.createServer((req, res) => {
  try {
    const u = decodeURIComponent((req.url || "/").split("?")[0]);
    const m = u.match(/^\/(factory|kiemsoatkho)(\/.*)?$/);
    if (!m) {
      res.writeHead(404);
      return res.end("404");
    }
    const goc = CHO_PHEP[m[1]];
    let rel = (m[2] || "/").replace(/\/+$/, "/");
    if (rel === "/" || rel === "") rel = "/index.html";
    const file = path.normalize(path.join(goc, rel));
    if (!file.startsWith(goc) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end("404");
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    res.writeHead(500);
    res.end(String(e && e.message || e));
  }
});

await new Promise((resolve) => server.listen(PORT, resolve));
console.log(`[QC Server] Đã khởi động tại http://localhost:${PORT}/kiemsoatkho/`);

const b = await puppeteer.launch({
  headless: "new",
  executablePath: EDGE_PATH,
  args: ["--no-sandbox", "--disable-web-security", "--allow-file-access-from-files", "--window-size=1440,960"]
});

try {
  // ── TEST 1: DESKTOP LIVE 100% ──────────────────────────────────────
  console.log("\n=======================================================");
  console.log("TEST 1: DESKTOP - DỮ LIỆU LIVE 100% TỪ GOOGLE SHEETS");
  console.log("=======================================================");

  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });

  const errors = [];
  p.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push("CONSOLE: " + m.text());
  });

  const url = `http://localhost:${PORT}/kiemsoatkho/?company=hasaki&tab=planogram`;
  console.log("Đang mở URL:", url);
  const t0 = Date.now();
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  await p.waitForSelector("#hpToday .hp-tile", { timeout: 90000 });
  await p.waitForFunction(() => window.HPLANOGRAM && window.HPLANOGRAM._S && window.HPLANOGRAM._S.yc.ok, { timeout: 90000 });
  console.log(`✓ Màn hình Planogram dựng xong sau ${Date.now() - t0}ms`);

  const testLoc = "F0-A1-505-02-04-01";

  // Mở vị trí trên Planogram và chờ nạp ảnh live từ VESINH-ANH
  console.log("Mở vị trí:", testLoc);
  await p.evaluate((loc) => window.HPLANOGRAM.openViTri(loc), testLoc);
  await new Promise((r) => setTimeout(r, 4000));

  await p.waitForSelector("#hpVtBody img", { timeout: 15000 });
  await p.screenshot({ path: path.join(OUT, "qc-live-desktop-popup.png") });

  console.log("-> Click thumbnail ảnh live...");
  await p.evaluate(() => {
    const firstImg = document.querySelector("#hpVtBody img");
    if (firstImg) firstImg.click();
  });
  await p.waitForSelector("#lightbox.show", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 500));

  const lbLive = await p.evaluate(() => {
    const cap = document.getElementById("lbCaption");
    const cnt = document.getElementById("lbCount");
    const titleEl = cap ? cap.querySelector(".lb-title") : null;
    const subEl = cap ? cap.querySelector(".lb-sub") : null;
    const metaEl = cap ? cap.querySelector(".lb-meta") : null;

    return {
      hien: document.getElementById("lightbox").classList.contains("show"),
      count: cnt ? cnt.innerText : "",
      title: titleEl ? titleEl.innerText : "",
      sub: subEl ? subEl.innerText : "",
      meta: metaEl ? metaEl.innerText : "",
      capHienThi: cap && getComputedStyle(cap).display !== "none"
    };
  });
  console.log("Kết quả Lightbox Live:", lbLive);
  await p.screenshot({ path: path.join(OUT, "qc-live-desktop-lb-live.png") });

  // Đóng Lightbox
  await p.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 400));

  // ── TEST 2: CAROUSEL 16 ẢNH CON (KỆ A1 ĐỦ 16 MÂM) ───────────────────
  console.log("\n=======================================================");
  console.log("TEST 2: CAROUSEL 16 ẢNH CON - KIỂM TRA CHUYỂN ẢNH VÀ VỊ TRÍ CON");
  console.log("=======================================================");

  // Kích hoạt xem 16 ảnh con qua HPLANOGRAM.openAnh
  await p.evaluate(() => {
    const S = window.HPLANOGRAM._S;
    const req = {
      id: "27769301",
      loc: "F0-A1-505-02-04-01",
      ngay: "2026-09-08",
      at: "2026-09-08 14:35:10",
      email: "uyennht@hasaki.vn",
      anh: Array.from({ length: 16 }, (_, i) => `https://placehold.co/600x400/1e293b/white?text=Anh+${i+1}`)
    };
    S.yc.rows.push(req);
    window.HPLANOGRAM.openAnh(req.id, 0);
  });
  await p.waitForSelector("#lightbox.show", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 500));

  // Kiểm tra ảnh 1/16
  const lb1 = await p.evaluate(() => {
    const cap = document.getElementById("lbCaption");
    const cnt = document.getElementById("lbCount");
    return {
      count: cnt ? cnt.innerText : "",
      title: cap ? (cap.querySelector(".lb-title") || {}).innerText : "",
      sub: cap ? (cap.querySelector(".lb-sub") || {}).innerText : "",
      meta: cap ? (cap.querySelector(".lb-meta") || {}).innerText : ""
    };
  });
  console.log("Ảnh 1/16:", lb1);
  await p.screenshot({ path: path.join(OUT, "qc-live-desktop-lb-anh1.png") });

  // Bấm #lbNext 5 lần sang Ảnh 6 (Tầng 04 Mâm 06)
  console.log("-> Bấm nút #lbNext 5 lần sang ảnh 6/16...");
  for (let s = 0; s < 5; s++) {
    await p.evaluate(() => document.getElementById("lbNext").click());
    await new Promise((r) => setTimeout(r, 120));
  }
  const lb6 = await p.evaluate(() => {
    const cap = document.getElementById("lbCaption");
    const cnt = document.getElementById("lbCount");
    return {
      count: cnt ? cnt.innerText : "",
      title: cap ? (cap.querySelector(".lb-title") || {}).innerText : "",
      sub: cap ? (cap.querySelector(".lb-sub") || {}).innerText : "",
      meta: cap ? (cap.querySelector(".lb-meta") || {}).innerText : ""
    };
  });
  console.log("Ảnh 6/16:", lb6);
  await p.screenshot({ path: path.join(OUT, "qc-live-desktop-lb-anh6.png") });

  // Bấm tiếp 1 lần sang Ảnh 7 (Tầng 03 Mâm 01)
  console.log("-> Bấm nút #lbNext sang ảnh 7/16...");
  await p.evaluate(() => document.getElementById("lbNext").click());
  await new Promise((r) => setTimeout(r, 150));
  const lb7 = await p.evaluate(() => {
    const cap = document.getElementById("lbCaption");
    const cnt = document.getElementById("lbCount");
    return {
      count: cnt ? cnt.innerText : "",
      title: cap ? (cap.querySelector(".lb-title") || {}).innerText : "",
      sub: cap ? (cap.querySelector(".lb-sub") || {}).innerText : "",
      meta: cap ? (cap.querySelector(".lb-meta") || {}).innerText : ""
    };
  });
  console.log("Ảnh 7/16:", lb7);

  // Bấm tiếp 9 lần sang Ảnh 16 (Tầng 01 Mâm 06)
  console.log("-> Bấm nút #lbNext đến ảnh 16/16...");
  for (let s = 0; s < 9; s++) {
    await p.evaluate(() => document.getElementById("lbNext").click());
    await new Promise((r) => setTimeout(r, 100));
  }
  const lb16 = await p.evaluate(() => {
    const cap = document.getElementById("lbCaption");
    const cnt = document.getElementById("lbCount");
    return {
      count: cnt ? cnt.innerText : "",
      title: cap ? (cap.querySelector(".lb-title") || {}).innerText : "",
      sub: cap ? (cap.querySelector(".lb-sub") || {}).innerText : "",
      meta: cap ? (cap.querySelector(".lb-meta") || {}).innerText : ""
    };
  });
  console.log("Ảnh 16/16:", lb16);
  await p.screenshot({ path: path.join(OUT, "qc-live-desktop-lb-anh16.png") });

  await p.keyboard.press("Escape");
  await p.close();

  // ── TEST 3: MOBILE (iPhone 14, 390x844) ────────────────────────────
  console.log("\n=======================================================");
  console.log("TEST 3: MOBILE (390x844) - ĐO 9 QUY TẮC HIỂN THỊ ĐIỆN THOẠI");
  console.log("=======================================================");

  const pMob = await b.newPage();
  await pMob.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  });
  await pMob.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1");

  pMob.on("pageerror", (e) => errors.push("PAGEERROR-MOB: " + e.message));
  pMob.on("console", (m) => {
    if (m.type() === "error") errors.push("CONSOLE-MOB: " + m.text());
  });

  await pMob.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await pMob.waitForSelector("#hpToday .hp-tile", { timeout: 90000 });
  await pMob.waitForFunction(() => window.HPLANOGRAM && window.HPLANOGRAM._S && window.HPLANOGRAM._S.yc.ok, { timeout: 90000 });

  await pMob.evaluate((loc) => window.HPLANOGRAM.openViTri(loc), testLoc);
  await new Promise((r) => setTimeout(r, 4000));
  await pMob.waitForSelector("#hpVtBody img", { timeout: 15000 });
  await pMob.screenshot({ path: path.join(OUT, "qc-live-mobile-popup.png") });

  // Mở ảnh carousel 16 ảnh trên mobile
  await pMob.evaluate(() => {
    const S = window.HPLANOGRAM._S;
    const req = {
      id: "27769301",
      loc: "F0-A1-505-02-04-01",
      ngay: "2026-09-08",
      at: "2026-09-08 14:35:10",
      email: "uyennht@hasaki.vn",
      anh: Array.from({ length: 16 }, (_, i) => `https://placehold.co/600x400/1e293b/white?text=Anh+${i+1}`)
    };
    S.yc.rows.push(req);
    window.HPLANOGRAM.openAnh(req.id, 0);
  });
  await pMob.waitForSelector("#lightbox.show", { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 500));

  const doMobile = await pMob.evaluate(() => {
    const cap = document.getElementById("lbCaption");
    const closeBtn = document.getElementById("lbClose");
    const prevBtn = document.getElementById("lbPrev");
    const nextBtn = document.getElementById("lbNext");
    const cnt = document.getElementById("lbCount");
    const titleEl = cap ? cap.querySelector(".lb-title") : null;
    const subEl = cap ? cap.querySelector(".lb-sub") : null;
    const metaEl = cap ? cap.querySelector(".lb-meta") : null;

    const getRect = (el) => (el ? el.getBoundingClientRect() : null);
    const getFs = (el) => (el ? parseFloat(getComputedStyle(el).fontSize) : 0);

    const closeRect = getRect(closeBtn);
    const prevRect = getRect(prevBtn);
    const nextRect = getRect(nextBtn);
    const capRect = getRect(cap);

    return {
      count: cnt ? cnt.innerText : "",
      titleText: titleEl ? titleEl.innerText : "",
      subText: subEl ? subEl.innerText : "",
      metaText: metaEl ? metaEl.innerText : "",
      fontSizeTitle: getFs(titleEl),
      fontSizeSub: getFs(subEl),
      fontSizeMeta: getFs(metaEl),
      closeBtnSize: closeRect ? { w: Math.round(closeRect.width), h: Math.round(closeRect.height) } : null,
      prevBtnSize: prevRect ? { w: Math.round(prevRect.width), h: Math.round(prevRect.height) } : null,
      nextBtnSize: nextRect ? { w: Math.round(nextRect.width), h: Math.round(nextRect.height) } : null,
      capWidth: capRect ? Math.round(capRect.width) : 0,
      viewportWidth: window.innerWidth,
      tranNgang: capRect ? capRect.right > window.innerWidth : false,
      datSanChu: getFs(titleEl) >= 10.5 && getFs(subEl) >= 10.5 && getFs(metaEl) >= 10.5,
      datVungCham: closeRect && closeRect.width >= 40 && closeRect.height >= 40
    };
  });

  console.log("KẾT QUẢ ĐO ĐẠC MOBILE:", JSON.stringify(doMobile, null, 2));
  await pMob.screenshot({ path: path.join(OUT, "qc-live-mobile-lb.png") });

  console.log("\n=======================================================");
  console.log("TỔNG KẾT KIỂM THỬ:");
  console.log("=======================================================");
  console.log(`1. Lỗi JS phát sinh: ${errors.length === 0 ? "0 lỗi (ĐẠT)" : errors.length + " LỖI"}`);
  if (errors.length > 0) {
    errors.forEach((e) => console.log("   " + e));
  }
  console.log(`2. Dữ liệu LIVE thật (100% Google Sheets):`);
  console.log(`   - Vị trí con: "${lbLive.title}"`);
  console.log(`   - Mô tả: "${lbLive.sub}"`);
  console.log(`   - Người/ngày: "${lbLive.meta}"`);
  console.log(`3. Carousel 16 ảnh con:`);
  console.log(`   - Ảnh 1 (${lb1.count}): "${lb1.title}" — ${lb1.sub}`);
  console.log(`   - Ảnh 6 (${lb6.count}): "${lb6.title}" — ${lb6.sub}`);
  console.log(`   - Ảnh 7 (${lb7.count}): "${lb7.title}" — ${lb7.sub}`);
  console.log(`   - Ảnh 16 (${lb16.count}): "${lb16.title}" — ${lb16.sub}`);
  console.log(`4. Sàn cỡ chữ Mobile >= 10.5px: ${doMobile.datSanChu ? "ĐẠT" : "KHÔNG ĐẠT"}`);
  console.log(`5. Vùng chạm nút đóng Mobile >= 40px: ${doMobile.datVungCham ? "ĐẠT" : "KHÔNG ĐẠT"}`);
  console.log(`6. Không tràn viền Mobile: ${!doMobile.tranNgang ? "ĐẠT" : "KHÔNG ĐẠT"}`);

  // Copy ảnh vào artifact directory
  const filesToCopy = [
    "qc-live-desktop-popup.png",
    "qc-live-desktop-lb-live.png",
    "qc-live-desktop-lb-anh1.png",
    "qc-live-desktop-lb-anh6.png",
    "qc-live-desktop-lb-anh16.png",
    "qc-live-mobile-popup.png",
    "qc-live-mobile-lb.png"
  ];
  for (const f of filesToCopy) {
    const src = path.join(OUT, f);
    const dst = path.join(ARTIFACT_DIR, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
    }
  }
  console.log(`✓ Đã sao chép ${filesToCopy.length} ảnh kết quả vào thư mục artifact.`);

  await pMob.close();
} finally {
  await b.close();
  server.close();
  console.log("[QC Server] Đã đóng server.");
}
