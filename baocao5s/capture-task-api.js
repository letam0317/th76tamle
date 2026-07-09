/**
 * capture-task-api.js  (v2)
 * --------------------------------------------------------------------------
 * Mở Edge vào trang workflow; người dùng tạo 1 task. Script "móc" vào fetch &
 * XMLHttpRequest TRONG trang để đọc ĐẦY ĐỦ các trường gửi đi (kể cả multipart
 * có file), cùng token và response. Ghi tất cả ra file JSON để phân tích.
 *
 * Chạy:  node capture-task-api.js
 * --------------------------------------------------------------------------
 */
import puppeteer from "puppeteer";
import fs from "node:fs";

const START_URL = "https://work.hasaki.vn/tasks-workflow?wfid=591";
const OUT_FILE = "C:/Users/lechitam/AppData/Local/Temp/claude/C--Users-lechitam-New-folder/f71766f5-b21b-43cf-ba59-67680e52fd7a/scratchpad/captured-v2.json";
const PROFILE_DIR = "C:/Users/lechitam/AppData/Local/Temp/claude/C--Users-lechitam-New-folder/f71766f5-b21b-43cf-ba59-67680e52fd7a/scratchpad/edge-profile";
const TARGET = "create-task-workflow";
const MAX_WAIT_MS = 15 * 60 * 1000;

const events = [];
let gotTarget = false;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const save = () => { try { fs.writeFileSync(OUT_FILE, JSON.stringify({ capturedAt: new Date().toISOString(), events }, null, 2)); } catch (e) { log("Loi ghi:", e.message); } };

// Mã chạy BÊN TRONG trang để móc fetch + XHR và đọc body (kể cả FormData)
function pageHook() {
  const MATCH = /wshr\.hasaki\.vn|create-task-workflow/i;
  const dumpFormData = (fd) => {
    const out = [];
    try { for (const [k, v] of fd.entries()) {
      if (v && typeof v === "object" && "name" in v && "size" in v) out.push({ key: k, kind: "file", filename: v.name, type: v.type, size: v.size });
      else out.push({ key: k, kind: "value", value: String(v).slice(0, 500) });
    } } catch (e) {}
    return out;
  };
  const describe = (body) => {
    if (!body) return { kind: "none" };
    if (typeof FormData !== "undefined" && body instanceof FormData) return { kind: "formdata", fields: dumpFormData(body) };
    if (typeof body === "string") return { kind: "text", text: body.slice(0, 3000) };
    try { return { kind: "other", text: String(body).slice(0, 1000) }; } catch { return { kind: "other" }; }
  };
  // Hook fetch
  const _fetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = (typeof input === "string" ? input : (input && input.url)) || "";
      const method = (init && init.method) || (input && input.method) || "GET";
      if (MATCH.test(url)) {
        const body = describe(init && init.body);
        window.__cap && window.__cap(JSON.stringify({ src: "fetch", method, url, requestBody: body }));
        const p = _fetch.apply(this, arguments);
        p.then((res) => res.clone().text().then((t) => window.__cap && window.__cap(JSON.stringify({ src: "fetch-res", url, status: res.status, responseBody: t.slice(0, 3000) }))).catch(() => {})).catch(() => {});
        return p;
      }
    } catch (e) {}
    return _fetch.apply(this, arguments);
  };
  // Hook XHR (axios mặc định dùng XHR)
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__m = m; this.__u = u; return _open.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (body) {
    try {
      if (this.__u && MATCH.test(this.__u)) {
        window.__cap && window.__cap(JSON.stringify({ src: "xhr", method: this.__m, url: this.__u, requestBody: describe(body) }));
        this.addEventListener("load", () => {
          try { window.__cap && window.__cap(JSON.stringify({ src: "xhr-res", url: this.__u, status: this.status, responseBody: String(this.responseText || "").slice(0, 3000) })); } catch (e) {}
        });
      }
    } catch (e) {}
    return _send.apply(this, arguments);
  };
}

(async () => {
  log("Dang mo Edge...");
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    userDataDir: PROFILE_DIR,
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
  });

  async function attach(page) {
    try {
      await page.exposeFunction("__cap", (s) => {
        try {
          const ev = JSON.parse(s);
          ev.time = new Date().toISOString();
          events.push(ev);
          save();
          if (String(ev.url || "").includes(TARGET)) {
            if (ev.src === "xhr" || ev.src === "fetch") { gotTarget = true; log("✅ DA BAT BODY tao task:", ev.url, "(" + (ev.requestBody && ev.requestBody.kind) + ")"); }
            if (ev.src && ev.src.endsWith("-res")) log("   ↳ Response status:", ev.status);
          } else if (/wshr\.hasaki\.vn/.test(ev.url || "")) {
            log("· wshr", ev.src, String(ev.url).replace(/^https?:\/\//, "").slice(0, 80));
          }
        } catch (e) {}
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
  log("👉 Tao 1 task moi trong workflow (da dang nhap san).");
  log("   Script tu doc het cac truong gui di. Xong se bao o day.");
  log("==========================================================");

  const t0 = Date.now();
  while (!gotTarget && Date.now() - t0 < MAX_WAIT_MS) {
    await new Promise((r) => setTimeout(r, 1000));
    if (browser.process() && browser.process().killed) break;
  }
  await new Promise((r) => setTimeout(r, 4000)); // cho response kip ghi
  save();
  log(gotTarget ? ("HOAN TAT — file: " + OUT_FILE) : ("Het gio. So su kien: " + events.length));
  try { await browser.close(); } catch {}
  process.exit(0);
})();
