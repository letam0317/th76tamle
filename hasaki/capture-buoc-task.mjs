/**
 * capture-buoc-task.mjs — BẮT API "hoàn thành bước task" (và mọi API wshr khác)
 * ----------------------------------------------------------------------------
 * Mở Edge (profile SSO dùng chung, đã đăng nhập sẵn) vào đúng trang task.
 * Bạn thao tác BÌNH THƯỜNG: mở bước đang chờ → điền form → bấm hoàn thành.
 * Script móc fetch/XHR trong trang, ghi TOÀN BỘ request tới wshr.hasaki.vn/api
 * (URL, method, body kể cả multipart, response) ra .exports/captured-buoc.json.
 * Xong thao tác thì ĐÓNG cửa sổ Edge — script tự kết thúc và in tóm tắt.
 *
 * Chạy:  node capture-buoc-task.mjs [URL]     (mặc định trang /tasks)
 *        node capture-buoc-task.mjs https://work.hasaki.vn/tasks?task_id=12907945
 */
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { voiKhoa, EDGE_PATH, duongDanProfile } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const START_URL = process.argv[2] || "https://work.hasaki.vn/tasks";
const OUT_FILE = path.join(DIR, ".exports", "captured-buoc.json");
const MAX_WAIT_MS = 20 * 60 * 1000;

const events = [];
const log = (...a) => console.log(new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }), ...a);
const save = () => { try { fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true }); fs.writeFileSync(OUT_FILE, JSON.stringify({ capturedAt: new Date().toISOString(), startUrl: START_URL, events }, null, 2)); } catch (e) { log("Loi ghi:", e.message); } };

// Chạy BÊN TRONG trang: móc fetch + XHR, đọc body (kể cả FormData có file)
function pageHook() {
  const MATCH = /wshr\.hasaki\.vn\/api/i;
  const dumpFormData = (fd) => {
    const out = [];
    try { for (const [k, v] of fd.entries()) {
      if (v && typeof v === "object" && "name" in v && "size" in v) out.push({ key: k, kind: "file", filename: v.name, type: v.type, size: v.size });
      else out.push({ key: k, kind: "value", value: String(v).slice(0, 800) });
    } } catch {}
    return out;
  };
  const describe = (body) => {
    if (!body) return { kind: "none" };
    if (typeof FormData !== "undefined" && body instanceof FormData) return { kind: "formdata", fields: dumpFormData(body) };
    if (typeof body === "string") return { kind: "text", text: body.slice(0, 5000) };
    try { return { kind: "other", text: String(body).slice(0, 1000) }; } catch { return { kind: "other" }; }
  };
  const _fetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = (typeof input === "string" ? input : (input && input.url)) || "";
      const method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
      if (MATCH.test(url)) {
        window.__cap && window.__cap(JSON.stringify({ src: "fetch", method, url, requestBody: describe(init && init.body) }));
        const p = _fetch.apply(this, arguments);
        p.then((res) => res.clone().text().then((t) => window.__cap && window.__cap(JSON.stringify({ src: "fetch-res", method, url, status: res.status, responseBody: t.slice(0, 5000) }))).catch(() => {})).catch(() => {});
        return p;
      }
    } catch {}
    return _fetch.apply(this, arguments);
  };
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__m = String(m || "GET").toUpperCase(); this.__u = u; return _open.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (body) {
    try {
      if (this.__u && MATCH.test(this.__u)) {
        window.__cap && window.__cap(JSON.stringify({ src: "xhr", method: this.__m, url: this.__u, requestBody: describe(body) }));
        this.addEventListener("load", () => {
          try { window.__cap && window.__cap(JSON.stringify({ src: "xhr-res", method: this.__m, url: this.__u, status: this.status, responseBody: String(this.responseText || "").slice(0, 5000) })); } catch {}
        });
      }
    } catch {}
    return _send.apply(this, arguments);
  };
}

await voiKhoa(DIR, async () => {
  log("Dang mo Edge (profile SSO dung chung)...");
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    executablePath: EDGE_PATH,
    userDataDir: duongDanProfile(DIR),
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
  });
  let dong = false;
  browser.on("disconnected", () => { dong = true; });

  async function attach(page) {
    try {
      await page.exposeFunction("__cap", (s) => {
        try {
          const ev = JSON.parse(s); ev.time = new Date().toISOString(); events.push(ev); save();
          const u = String(ev.url || "").replace(/^https?:\/\/wshr\.hasaki\.vn/, "");
          if (ev.src === "fetch" || ev.src === "xhr") {
            if (ev.method !== "GET") log("🔴 " + ev.method + " " + u.slice(0, 100) + "  (body: " + (ev.requestBody && ev.requestBody.kind) + ")");
            else log("·  GET " + u.slice(0, 100));
          } else if (ev.method !== "GET") log("   ↳ " + ev.status + " " + u.slice(0, 80));
        } catch {}
      });
      await page.evaluateOnNewDocument(pageHook);
    } catch (e) { log("attach loi:", e.message); }
  }

  browser.on("targetcreated", async (t) => { try { const p = await t.page(); if (p) await attach(p); } catch {} });
  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());
  await attach(page);

  log("Mo trang:", START_URL);
  await page.goto(START_URL, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  log("==========================================================");
  log("👉 Thao tac BINH THUONG: mo buoc dang cho -> dien -> HOAN THANH.");
  log("   Moi API deu duoc ghi lai. Xong thi DONG cua so Edge.");
  log("==========================================================");

  const t0 = Date.now();
  while (!dong && Date.now() - t0 < MAX_WAIT_MS) await new Promise((r) => setTimeout(r, 1000));
  await new Promise((r) => setTimeout(r, 2000));
  save();
  const posts = events.filter((e) => (e.src === "fetch" || e.src === "xhr") && e.method !== "GET");
  log("KET THUC. Tong su kien: " + events.length + " | Request KHAC GET: " + posts.length);
  posts.forEach((e) => log("  🔴 " + e.method + " " + String(e.url).replace(/^https?:\/\/wshr\.hasaki\.vn/, "")));
  log("File: " + OUT_FILE);
  try { await browser.close(); } catch {}
}, { log });
process.exit(0);
