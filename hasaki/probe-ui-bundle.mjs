/** probe-ui-bundle.mjs — READ-ONLY: mở work.hasaki.vn bằng profile Edge sẵn có (headless),
 *  gom các bundle JS của SPA rồi grep CHUỖI ENDPOINT API bên trong (tìm API "điều hướng bước").
 *  Không bấm gì, không ghi gì lên server. Chạy: node probe-ui-bundle.mjs [task_id]
 */
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EDGE_PATH, duongDanProfile, voiKhoa } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ID = process.argv[2] || "13522322";
const OUT = path.join(DIR, ".exports", "ui-bundle-endpoints.json");

await voiKhoa(DIR, async () => {
  const browser = await puppeteer.launch({
    headless: true, executablePath: EDGE_PATH, userDataDir: duongDanProfile(DIR),
    args: ["--disable-blink-features=AutomationControlled"],
  });
  try {
    const page = (await browser.pages())[0] || (await browser.newPage());
    await page.goto("https://work.hasaki.vn/tasks?task_id=" + ID, { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
    // silent-SSO có thể còn đang chạy chuỗi redirect — đợi tối đa 25s cho tới khi rời /auth/login
    for (let i = 0; i < 25 && /auth\/login/.test(page.url()); i++) await new Promise((r) => setTimeout(r, 1000));
    console.log("URL sau khi đợi:", page.url());
    if (/auth\/login/.test(page.url())) { console.log("✗ Phiên hết hạn — node login-hasaki.js"); return; }
    await new Promise((r) => setTimeout(r, 4000));
    const jsUrls = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((e) => e.name).filter((u) => /\.js(\?|$)/.test(u)));
    console.log("Bundle JS:", jsUrls.length);
    const ketQua = await page.evaluate(async (urls) => {
      const hits = new Set();
      for (const u of urls) {
        try {
          const t = await (await fetch(u)).text();
          // mọi path API tương đối/tuyệt đối trong bundle
          for (const m of t.matchAll(/["'`](\/?api\/[a-z0-9/_${}.-]{3,90})["'`]/gi)) hits.add(m[1]);
          for (const m of t.matchAll(/["'`]([a-z0-9/_-]*(?:workflow|mass-update|next-step|task-input|redirect|navigat)[a-z0-9/_${}.-]*)["'`]/gi)) hits.add(m[1]);
        } catch (e) { hits.add("!ERR " + u + " " + e.message); }
      }
      return [...hits].sort();
    }, jsUrls);
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), jsUrls, ketQua }, null, 1));
    const quanTam = ketQua.filter((s) => /workflow|step|redirect|navigat|mass-update|fail/i.test(s));
    console.log("── Chuỗi dính workflow/step/redirect (" + quanTam.length + "):");
    quanTam.forEach((s) => console.log("   " + s));
    console.log("── Toàn bộ đã lưu: " + OUT + " (" + ketQua.length + " chuỗi)");
  } finally { await browser.close().catch(() => {}); }
}, { log: console.log });
process.exit(0);
