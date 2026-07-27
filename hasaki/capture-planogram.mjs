/**
 * capture-planogram.mjs — THĂM DÒ trang planogram.hasaki.vn (request-of-declaration)
 * ----------------------------------------------------------------------------
 * Mục đích: TÌM HIỂU (chưa build) — mở Edge headless bằng profile SSO dùng chung
 * (đã đăng nhập sẵn, y hệt pull-timesheet.js), vào trang chi tiết khai báo vệ sinh,
 * ghi lại TOÀN BỘ request/response API (mọi host hasaki) + chụp màn hình + dump DOM.
 *
 * AN TOÀN PHIÊN: chỉ điều hướng bằng cookie SSO sẵn có — KHÔNG đăng nhập WMS,
 * KHÔNG bấm nút SSO nếu chưa có phiên (chỉ ghi nhận "cần đăng nhập" rồi thoát).
 *
 * Chạy:  node capture-planogram.mjs [URL]
 *        (mặc định https://planogram.hasaki.vn/asset-management/request-of-declaration/details/23632957)
 */
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { voiKhoa, EDGE_PATH, duongDanProfile } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const START_URL = process.argv[2] || "https://planogram.hasaki.vn/asset-management/request-of-declaration/details/23632957";
const OUT_FILE = path.join(DIR, ".exports", "captured-planogram.json");
const SHOT_FILE = path.join(DIR, ".exports", "captured-planogram.png");
const DOM_FILE = path.join(DIR, ".exports", "captured-planogram-dom.html");

const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const events = [];
const save = () => {
  try {
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, JSON.stringify({ capturedAt: new Date().toISOString(), startUrl: START_URL, events }, null, 2));
  } catch (e) { log("Loi ghi:", e.message); }
};

await voiKhoa(DIR, async () => {
  log("Mo Edge headless (profile SSO dung chung)...");
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: EDGE_PATH,
    userDataDir: duongDanProfile(DIR),
    args: ["--disable-blink-features=AutomationControlled", "--window-size=1440,900"],
    defaultViewport: { width: 1440, height: 900 },
  });
  try {
    const page = (await browser.pages())[0] || (await browser.newPage());

    // Bắt mọi request tới các host hasaki (planogram / api gateway / sso...)
    page.on("request", (req) => {
      const u = req.url();
      if (!/hasaki|inshasaki/i.test(u)) return;
      if (/\.(png|jpe?g|gif|svg|woff2?|ttf|css|ico|mp4)(\?|$)/i.test(u)) return;
      const h = req.headers();
      events.push({
        kind: "req", time: new Date().toISOString(), method: req.method(), url: u,
        auth: h["authorization"] ? h["authorization"].slice(0, 28) + "…(" + h["authorization"].length + " ky tu)" : "",
        cookie: h["cookie"] ? "(co cookie, " + h["cookie"].length + " ky tu)" : "",
        postData: (req.postData() || "").slice(0, 3000),
      });
    });
    page.on("response", async (res) => {
      const u = res.url();
      if (!/hasaki|inshasaki/i.test(u)) return;
      const ct = String(res.headers()["content-type"] || "");
      if (!/json|text\/plain/i.test(ct)) return;
      let body = "";
      try { body = (await res.text()).slice(0, 20000); } catch {}
      events.push({ kind: "res", time: new Date().toISOString(), status: res.status(), url: u, contentType: ct, body });
      save();
    });

    log("Vao trang:", START_URL);
    await page.goto(START_URL, { waitUntil: "networkidle2", timeout: 90000 }).catch((e) => log("(goto: " + e.message + ")"));
    // SPA co the con goi API tre — cho them
    await new Promise((r) => setTimeout(r, 8000));

    // Neu roi vao trang login planogram: bam nut "Dang nhap bang SSO" (cookie SSO con song
    // se vao thang, KHONG can OTP — y het pull-timesheet.js lam voi hr.hasaki.vn hang ngay).
    // Chi tao PHIEN PLANOGRAM, khong dung phien WMS. Neu SSO doi OTP -> dung lai, khong tu dien.
    if (/planogram\.hasaki\.vn\/auth\/login/i.test(page.url())) {
      log("Trang login planogram — bam 'Dang nhap bang SSO' (dung cookie SSO san co)...");
      await page.evaluate(() => {
        const el = [...document.querySelectorAll("a,button")].find((e) => /SSO/i.test(e.textContent || ""));
        el && el.click();
      }).catch(() => {});
      await page.waitForFunction(() => !/auth\/(login|callback)/.test(location.href), { timeout: 30000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 4000));
      if (/auth\/login|accounts\./i.test(page.url())) {
        log("⚠ SSO doi dang nhap tay (phien SSO het) — DUNG LAI, khong tu dien (an toan phien).");
      } else {
        log("✓ SSO tu dong OK — quay lai trang chi tiet...");
        await page.goto(START_URL, { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
        await new Promise((r) => setTimeout(r, 8000));
      }
    }

    const finalUrl = page.url();
    log("URL cuoi cung:", finalUrl);
    events.push({ kind: "final", url: finalUrl });

    try { await page.screenshot({ path: SHOT_FILE, fullPage: true }); log("Da chup man hinh:", SHOT_FILE); } catch (e) { log("(screenshot: " + e.message + ")"); }
    try { fs.writeFileSync(DOM_FILE, await page.content()); log("Da dump DOM:", DOM_FILE); } catch {}
    save();
    log("Tong su kien API:", events.length, "| File:", OUT_FILE);
  } finally { await browser.close().catch(() => {}); }
}, { log });
process.exit(0);
