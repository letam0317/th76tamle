/**
 * capture-planogram-authed.mjs — READ-ONLY: nap token phien SONG (bridge) vao localStorage
 * cua SPA planogram roi de CHINH SPA goi API that; hook lai de biet dung endpoint/param/response
 * cua trang request-of-declaration. KHONG dang nhap, KHONG precheck/finalize/refresh -> khong
 * tao phien moi, khong da ai. Dung profile Edge TAM (khong dung profile SSO chung).
 */
import puppeteer from "puppeteer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { EDGE_PATH } from "./token-store.js";
import { layTokenSongWms } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ARG = process.argv[2] || "23632957";
const ID = ARG;
const URL = /^https?:\/\//.test(ARG)
  ? ARG
  : `https://planogram.hasaki.vn/asset-management/request-of-declaration/details/${ARG}`;
const OUT = path.join(DIR, ".exports", "captured-planogram-authed.json");
const SHOT = path.join(DIR, ".exports", "captured-planogram-authed.png");
const TMP_PROFILE = path.join(DIR, ".exports", "_tmp-planogram-profile");
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);

const raw = await layTokenSongWms(DIR, log);
if (!raw) { log("✗ Khong co token phien song. Dung."); process.exit(2); }
const jwt = String(raw).replace(/^Bearer\s+/i, "");

const events = [];
const save = () => { try { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), id: ID, url: URL, events }, null, 2)); } catch {} };

const browser = await puppeteer.launch({
  headless: true, executablePath: EDGE_PATH, userDataDir: TMP_PROFILE,
  args: ["--disable-blink-features=AutomationControlled"], defaultViewport: { width: 1440, height: 2000 },
});
try {
  const page = (await browser.pages())[0] || (await browser.newPage());
  // Nap token + company vao localStorage/cookie TRUOC khi app chay (moi navigation)
  await page.evaluateOnNewDocument((tk) => {
    try {
      localStorage.setItem("auth_store", JSON.stringify({ state: { token: tk, company_id: 1001 }, version: 0 }));
      document.cookie = "planogram_token=" + tk + ";path=/";
      document.cookie = "company_ids=1001;path=/";
    } catch (e) {}
  }, jwt);

  page.on("request", (req) => {
    const u = req.url();
    if (!/wms-gw-external\.hasaki\.vn\/api/i.test(u)) return;
    if (req.method() === "OPTIONS") return;
    events.push({ kind: "req", time: new Date().toISOString(), method: req.method(), url: u, postData: (req.postData() || "").slice(0, 1500) });
  });
  page.on("response", async (res) => {
    const u = res.url();
    if (!/wms-gw-external\.hasaki\.vn\/api/i.test(u)) return;
    const ct = String(res.headers()["content-type"] || "");
    if (!/json/i.test(ct)) return;
    let body = ""; try { body = (await res.text()).slice(0, 8000); } catch {}
    events.push({ kind: "res", time: new Date().toISOString(), status: res.status(), url: u, body });
    save();
  });

  // Vao origin truoc de localStorage thuoc dung origin, roi vao trang chi tiet
  log("Nap token vao SPA, mo:", URL);
  await page.goto("https://planogram.hasaki.vn/", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 90000 }).catch((e) => log("(goto: " + e.message + ")"));
  await new Promise((r) => setTimeout(r, 9000));
  log("URL cuoi:", page.url());
  try { await page.screenshot({ path: SHOT, fullPage: true }); } catch {}
  save();

  const posts = events.filter((e) => e.kind === "req");
  log("Tong request API external:", posts.length);
  posts.forEach((e) => log("  " + e.method + " " + e.url.replace(/^https?:\/\/wms-gw-external\.hasaki\.vn\/api\/v1/, "")));
  log("File:", OUT);
} finally {
  await browser.close().catch(() => {});
  try { fs.rmSync(TMP_PROFILE, { recursive: true, force: true }); } catch {}
}
process.exit(0);
