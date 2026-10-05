import puppeteer from "puppeteer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EDGE_PATH, duongDanProfile } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = duongDanProfile(DIR);

(async () => {
  console.log("Launching Edge browser with profile:", PROFILE_DIR);
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: EDGE_PATH,
    userDataDir: PROFILE_DIR,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  try {
    const page = (await browser.pages())[0] || (await browser.newPage());

    // Listen to network requests & responses
    page.on("request", (req) => {
      if (req.url().includes("chat") || req.url().includes("user") || req.url().includes("staff") || req.url().includes("api")) {
        console.log("REQ:", req.method(), req.url());
        const headers = req.headers();
        if (headers.authorization) console.log("  Auth:", headers.authorization.slice(0, 30));
      }
    });

    page.on("response", async (res) => {
      const url = res.url();
      if (url.includes("api") && (url.includes("user") || url.includes("staff") || url.includes("chat") || url.includes("profile") || url.includes("info"))) {
        console.log("RES:", res.status(), url);
        try {
          const text = await res.text();
          console.log("  Body snippet:", text.slice(0, 300));
        } catch {}
      }
    });

    console.log("Navigating to https://chat.hasaki.vn/chat ...");
    await page.goto("https://chat.hasaki.vn/chat", { waitUntil: "networkidle2", timeout: 45000 }).catch((e) => console.log("Goto timeout/err:", e.message));

    console.log("Current URL:", page.url());
    const content = await page.content();
    console.log("Page title:", await page.title());

    // Take screenshot if needed or inspect localStorage / cookies
    const cookies = await page.cookies();
    console.log("Cookies count:", cookies.length, cookies.map(c => c.name + "@" + c.domain));

    const localStorageData = await page.evaluate(() => {
      const res = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        res[k] = localStorage.getItem(k);
      }
      return res;
    }).catch(() => ({}));
    console.log("LocalStorage keys:", Object.keys(localStorageData));
    for (const [k, v] of Object.entries(localStorageData)) {
      if (k.toLowerCase().includes("token") || k.toLowerCase().includes("user") || k.toLowerCase().includes("auth")) {
        console.log(`  ${k}:`, String(v).slice(0, 100));
      }
    }

  } finally {
    await browser.close().catch(() => {});
  }
})();
