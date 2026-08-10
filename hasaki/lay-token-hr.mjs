/**
 * lay-token-hr.mjs — READ-ONLY: mở hr.hasaki.vn bằng profile Edge sẵn có, bắt token mà UI HR
 * gửi lên wshr rồi nạp vào kho (khe "hr"). KHÔNG gõ email/mật khẩu/OTP → chỉ là một vòng SSO
 * im lặng, không tạo phiên IdP mới nên không đá phiên ai (xem ghi chú session-rules.js).
 * Lý do cần: khe "work" (bridge từ work.hasaki.vn) bị 403 ở các endpoint HR (sheet-summary,
 * hr/staff, hr/location) — quyền theo ứng dụng, phải dùng token do chính hr.hasaki.vn mint.
 * Chạy: node lay-token-hr.mjs
 */
import puppeteer from "puppeteer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EDGE_PATH, duongDanProfile, luuToken } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.log(...a);
const wshrNhan = async (tk) => { try { return (await fetch("https://wshr.hasaki.vn/api/news/staff/search-for-dropdown?limit=1", { headers: { authorization: tk } })).ok; } catch { return false; } };

const browser = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH, userDataDir: duongDanProfile(DIR), args: ["--disable-blink-features=AutomationControlled"] });
let tok = null;
try {
  const page = (await browser.pages())[0] || (await browser.newPage());
  // Gom MỌI token ứng viên rồi kiểm từng cái với wshr — Hasaki ID v2 có lúc gửi id_token OIDC trước.
  const ungVien = [], daThay = new Set();
  page.on("request", (req) => { const a = req.headers()["authorization"]; if (a && /wshr\.hasaki\.vn/.test(req.url()) && !daThay.has(a)) { daThay.add(a); ungVien.push(a); } });
  await page.goto("https://hr.hasaki.vn/auth/login", { waitUntil: "networkidle2", timeout: 90000 }).catch(() => { });
  if (/auth\/login/.test(page.url())) {
    // CHỈ bấm nút SSO — không gõ email/mật khẩu/OTP. Phiên IdP còn sống thì đây là vòng SSO im lặng
    // (mint token mới, KHÔNG tạo phiên IdP mới nên không đá ai); phiên IdP chết thì kẹt lại ở IdP.
    log("→ đang ở trang đăng nhập HR — bấm nút SSO (không gõ thông tin đăng nhập)...");
    await page.evaluate(() => { const el = [...document.querySelectorAll("a,button")].find(e => /Hasaki SSO|Đăng nhập với/i.test(e.textContent)); el && el.click(); }).catch(() => { });
    await page.waitForFunction(() => !/auth\/(login|callback)/.test(location.href), { timeout: 30000 }).catch(() => { });
  }
  await page.goto("https://hr.hasaki.vn/", { waitUntil: "networkidle2", timeout: 60000 }).catch(() => { });
  let loai = 0;
  for (let i = 0; i < 20 && !tok; i++) {
    while (ungVien.length && !tok) { const t = ungVien.shift(); if (await wshrNhan(t)) tok = t; else loai++; }
    if (!tok) await new Promise(r => setTimeout(r, 1000));
  }
  if (loai) log(`  … loại ${loai} token bị wshr từ chối (id_token OIDC).`);
  log("URL cuối: " + page.url());
} finally { await browser.close().catch(() => { }); }

if (!tok) { log("✗ Không bắt được token HR (phiên hr.hasaki.vn / IdP đã hết hạn) — cần chạy: node login-hasaki.js"); process.exit(2); }
luuToken(DIR, "hr", tok, "bot");
const r = await fetch("https://wshr.hasaki.vn/api/hr/sheet-summary?from_date=2026-07-01&to_date=2026-07-31&staff_id=7672&limit=5", { headers: { authorization: tok, accept: "application/json" } });
log("✓ Đã nạp kho khe 'hr'. Thử sheet-summary → HTTP " + r.status + "  " + (await r.text()).replace(/\s+/g, " ").slice(0, 120));
