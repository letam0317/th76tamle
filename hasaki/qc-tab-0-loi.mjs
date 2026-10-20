// qc-tab-0-loi.mjs — 20/10: mở từng tab bản nội bộ 8123, đếm lỗi JS trang + kiểm tiện ích chung (tien-ich.js). node qc-tab-0-loi.mjs fkiemke fstock … (không tham số = mọi pane-*)
// Mở từng tab trên bản nội bộ 8123, đếm lỗi JS trang (pageerror) + kiểm tiện ích chung hoạt động. Chỉ đọc (chặn POST).
import puppeteer from "puppeteer-core";
import fs from "node:fs";
const TABS = process.argv.slice(2).length ? process.argv.slice(2) : [...new Set([...fs.readFileSync(new URL("./kiemsoatkho/index.html", import.meta.url), "utf8").matchAll(/id="pane-([a-z0-9-]+)"/g)].map((m) => m[1]))];
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
let loi = 0;
try {
  for (const tab of TABS) {
    const p = await b.newPage(); const errs = [], con = [];
    await p.setViewport({ width: 1366, height: 860 });
    await p.setRequestInterception(true);
    p.on("request", (r) => (r.method() === "POST" ? r.abort() : r.continue()));
    p.on("pageerror", (e) => errs.push(String(e.message || e).slice(0, 160)));
    p.on("console", (m) => { if (m.type() === "error" && !/net::ERR|Failed to load resource|CORS|404|401|403/.test(m.text())) con.push(m.text().slice(0, 140)); });
    await p.goto("http://localhost:8123/kiemsoatkho/?tab=" + tab, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 4000));
    const ti = await p.evaluate(() => { const T = window.hskTienIch; if (!T) return "KHÔNG CÓ hskTienIch"; return T.esc("<a b='c'>") + " | " + T.ngayVN("2026-10-20 13:00") + " | " + T.hm("13:05:00") + " | " + (T.$id("app") ? "ok" : "id?") + " | esc-toàn-cục=" + (typeof esc === "function" ? esc(null) + "" : "không"); });
    const tabHien = await p.evaluate((t) => { const el = document.querySelector('[data-tab="' + t + '"].active, #tab-' + t + ', [id$="' + t + '"]'); return el ? "có khối" : "?"; }, tab);
    const ok = !errs.length && !con.length;
    if (!ok) loi++;
    console.log((ok ? "  OK   " : "  FAIL ") + tab.padEnd(14) + " lỗi trang " + errs.length + " · console error " + con.length + " · " + tabHien + " · " + ti + (errs.length ? "\n         " + errs.join("\n         ") : "") + (con.length ? "\n         " + con.join("\n         ") : ""));
    await p.close();
  }
} finally { await b.close(); }
console.log(loi ? `\n${loi} tab HỎNG` : "\nĐẠT tất cả"); process.exit(loi ? 1 : 0);
