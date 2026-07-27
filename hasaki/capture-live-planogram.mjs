/** capture-live-planogram.mjs — chụp dashboard THẬT (Pages + GAS live) để nghiệm thu. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, ".exports");
const browser = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH, args: ["--window-size=1440,900"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 950, deviceScaleFactor: 1.4 });
await page.goto("https://letam0317.github.io/kiemsoatkho/?v=" + Date.now(), { waitUntil: "networkidle2", timeout: 90000 });
await page.evaluate(() => { try { setCty("hasaki"); } catch (e) {} try { setTab("planogram"); } catch (e) {} });
await page.waitForSelector("#hpToday .hp-tile", { timeout: 45000 });
await new Promise((r) => setTimeout(r, 4000));   // chờ CC/AI JSONP về đủ
await page.screenshot({ path: path.join(OUT, "shot-live-main.png") });
await page.evaluate(() => HPLANOGRAM.openYc("da"));
await new Promise((r) => setTimeout(r, 3000));
await page.screenshot({ path: path.join(OUT, "shot-live-modal.png") });
await browser.close();
console.log("Đã chụp shot-live-main.png + shot-live-modal.png");
