/**
 * sync-inside-status.mjs — TRẠNG THÁI THẬT của SKU từ inside.mastige.vn → tab "INSIDE-STATUS"
 * ===========================================================================================
 *  Vì sao: WMS không có cờ active/inactive trong báo cáo tồn, nên STATUS của SKU_MASTER đang phải
 *  SUY từ tồn kho — SAI với SKU còn Active nhưng tồn 0 (vd 422364500 "Dây bánh phở": inside = Active,
 *  danh mục suy ra INACTIVE). Trạng thái ĐÚNG nằm ở inside.mastige.vn/sales/product (cột Status).
 *
 *  ── 2 LỚP AUTH (đo 22/08/2026) ──────────────────────────────────────────────────────────────
 *  ① HTTP DIGEST ngoài: realm "inside.hasaki.vn" — user `inside.hasaki.vn` / pass ở INSIDE_DIGEST_PASS
 *     (BẮT BUỘC khai trong .env — không có mặc định; giá trị cũ đã lộ ra repo public 23/08,
 *     xem TAI-UPSTREAM/ROLLOUT). page.authenticate lo.
 *  ② Hasaki SSO (OIDC app_code=inside): app Laravel, phiên = cookie laravel_session. MỖI trình duyệt
 *     phải vào /sso/login TRƯỚC (cưỡi phiên IdP trong profile bot) để lập phiên app, rồi mới đọc
 *     /sales/product. Phiên IdP do login-hasaki tạo (1 OTP phủ ~48h) — hết thì chạy lại login-hasaki.
 *
 *  ── Bảng /sales/product ──────────────────────────────────────────────────────────────────────
 *  Cột: # · ID · SKU · Barcode · Product Name · LatestCost · Average Cost · Price · Status · Type · …
 *  `?limit=500&page=N` → 500 dòng/trang (per_page/length KHÔNG ăn, chỉ `limit`). `?status=` 1=Active
 *  2=In-Active 4=Pending 8=Reject 0=tất cả. `?category_id=` lọc theo danh mục.
 *
 *  ── VÌ SAO LỌC DANH MỤC (đo 22/08/2026) ─────────────────────────────────────────────────────
 *  Catalog inside > 90.000 SP; material SKU rải khắp → quét cả catalog là ~400 trang/18 phút (bỏ).
 *  Material của SKU_MASTER nằm gọn trong vài danh mục "Thời Trang" (mật độ khớp trang đầu):
 *    954 Phụ Liệu 305/500 · 957 NVL 262/500 · 962 Mẫu 293/500 · 964 NL nhận Gia công 458/500 ·
 *    960 Thời Trang 48/500 · 963 Nhận hàng gia công. (942/965/966/971 = 0 khớp → bỏ.)
 *  Duyệt từng danh mục tới khi trang < 500 dòng — nhẹ hơn nhiều lần.
 *
 *  CHỈ ĐỌC. Chỉ giữ status của SKU CÓ trong SKU_MASTER (tab nhỏ, ghi rẻ). Ghi tab INSIDE-STATUS:
 *  SKU · STATUS (ACTIVE|INACTIVE|PENDING|REJECT) · STATUS_RAW · TYPE.
 *
 *  node sync-inside-status.mjs [--dry] [--max-trang N]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { EDGE_PATH, duongDanProfile } from "./token-store.js";
import { gasPost } from "./session-rules.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SHEET_FACTORY = "1eY_oo9fAvWCTXp24x-Z0FXq9mp_jJPlTHg09qdemETs";
const TAB = "INSIDE-STATUS";
const APPSCRIPT_KEY = process.env.APPSCRIPT_KEY;
const DIGEST_USER = process.env.INSIDE_DIGEST_USER || "inside.hasaki.vn";
/* KHÔNG fallback cứng (audit 23/08/2026): mật khẩu Digest phải nằm trong .env (INSIDE_DIGEST_PASS)
 * — repo này PUBLIC, hardcode ở đây là công bố mật khẩu nội bộ lên Internet. */
const DIGEST_PASS = process.env.INSIDE_DIGEST_PASS || "";
if (!DIGEST_PASS) { console.error("✗ Thiếu INSIDE_DIGEST_PASS trong .env (đã gỡ fallback cứng khỏi repo public)."); process.exit(3); }
const DRY = process.argv.includes("--dry");
const _iMT = process.argv.indexOf("--max-trang");
const MAX_TRANG = _iMT >= 0 ? (Number(process.argv[_iMT + 1]) || 80) : 80;
/* Danh mục "Thời Trang" chứa material của SKU_MASTER (xem đầu file). --tat-ca = quét cả catalog. */
const CATS = process.env.INSIDE_CATS ? process.env.INSIDE_CATS.split(",").map((s) => s.trim()).filter(Boolean)
  : ["954", "957", "964", "962", "960", "963"];
const TAT_CA = process.argv.includes("--tat-ca");
const LOGF = path.join(DIR, ".exports", "inside-status.log");
try { fs.mkdirSync(path.join(DIR, ".exports"), { recursive: true }); } catch { /* */ }
const log = (...a) => {
  const s = new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" }) + " " + a.join(" ");
  console.log(s);
  try { fs.appendFileSync(LOGF, s + "\n"); } catch { /* progress file best-effort */ }   // né block-buffer stdout khi chạy nền
};

const MAP_ST = { "active": "ACTIVE", "in-active": "INACTIVE", "inactive": "INACTIVE", "pending": "PENDING", "reject": "REJECT" };
const chuanSt = (s) => MAP_ST[String(s || "").trim().toLowerCase()] || String(s || "").trim().toUpperCase();

/* ---------- SKU_MASTER: chỉ giữ status cho SKU đang có trong danh mục ---------- */
async function docSkuMaster() {
  const u = "https://docs.google.com/spreadsheets/d/" + SHEET_FACTORY + "/gviz/tq?tqx=out:csv&sheet=SKU_MASTER&tq=" + encodeURIComponent("select A");
  const t = await (await fetch(u)).text();
  const set = new Set();
  for (const line of t.split("\n").slice(1)) {
    const m = line.match(/"?(\d{6,})"?/);
    if (m) set.add(m[1]);
  }
  return set;
}

const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!DRY && !APPSCRIPT_KEY) { console.error("✗ Thiếu APPSCRIPT_KEY."); process.exit(3); }
  const canSku = await docSkuMaster();
  log("SKU_MASTER: " + canSku.size + " SKU cần biết trạng thái.");

  const puppeteer = (await import("puppeteer")).default;
  const browser = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH,
    userDataDir: duongDanProfile(DIR), args: ["--disable-blink-features=AutomationControlled", "--no-first-run"] });
  const map = new Map();   // sku -> {status, raw, type}
  try {
    const page = await browser.newPage();
    await page.authenticate({ username: DIGEST_USER, password: DIGEST_PASS });
    // Lập phiên app: /sso/login cưỡi phiên IdP bot
    await page.goto("https://inside.mastige.vn/sso/login", { waitUntil: "networkidle2", timeout: 70000 }).catch(() => {});
    await nghi(1500);
    let u = page.url();
    if (/auth-idp|\/login($|\?)/.test(u)) {
      log("✗ Chưa vào được inside — phiên IdP đã hết (ở " + u.slice(0, 60) + "). Chạy lại login-hasaki rồi thử lại.");
      process.exit(75);
    }
    log("✓ Đã lập phiên app inside (" + u.slice(0, 45) + ").");

    const docTrang = async () => page.evaluate(() => {
      const t = document.querySelector("table"); if (!t) return [];
      const hs = [...t.querySelectorAll("thead th")].map((x) => x.innerText.trim());
      const iS = hs.indexOf("SKU"), iSt = hs.indexOf("Status"), iTy = hs.indexOf("Type");
      return [...t.querySelectorAll("tbody tr")].map((tr) => {
        const c = [...tr.querySelectorAll("td")].map((x) => x.innerText.trim().replace(/\s+/g, " "));
        return { sku: c[iS], status: c[iSt], type: c[iTy] };
      });
    });
    const gomRows = (rows) => { for (const r of rows) {
      const sku = String(r.sku || "").replace(/\D/g, "");
      if (!sku || !canSku.has(sku) || map.has(sku)) continue;
      map.set(sku, { status: chuanSt(r.status), raw: r.status, type: r.type });
    } };

    let tongDong = 0;
    const cum = TAT_CA ? [""] : CATS;
    for (const cat of cum) {
      const nhan = cat ? "danh mục " + cat : "toàn catalog";
      let dongCum = 0;
      for (let p = 1; p <= MAX_TRANG; p++) {
        const url = "https://inside.mastige.vn/sales/product?status=0&limit=500" + (cat ? "&category_id=" + cat : "") + "&page=" + p;
        await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 }).catch(() => {});
        if (/\/login($|\?)/.test(page.url())) { log("  ⚠ bị đá về /login (" + nhan + " trang " + p + ") — phiên rụng."); process.exit(75); }
        await page.waitForSelector("table tbody tr", { timeout: 15000 }).catch(() => {});   // chờ bảng render
        const rows = await docTrang();
        if (!rows.length) break;
        tongDong += rows.length; dongCum += rows.length;
        gomRows(rows);
        if (rows.length < 500) break;
        await nghi(200);
      }
      log("  · " + nhan + ": " + dongCum + " SP · khớp luỹ kế " + map.size + "/" + canSku.size);
    }
    log("Xong: " + tongDong + " SP đã duyệt · khớp " + map.size + "/" + canSku.size + " SKU danh mục.");
  } finally { await browser.close(); }

  if (!map.size) { log("✗ Không thu được status nào — không ghi (tránh xoá trắng)."); process.exit(2); }

  // Thống kê nhanh
  const dem = {}; for (const v of map.values()) dem[v.status] = (dem[v.status] || 0) + 1;
  log("Phân bố: " + Object.entries(dem).map(([k, v]) => k + "=" + v).join(" · "));

  const HEADER = ["SKU", "STATUS", "STATUS_RAW", "TYPE"];
  const rows = [...map.entries()].map(([sku, v]) => ["'" + sku, v.status, v.raw, v.type]);
  if (DRY) {
    fs.mkdirSync(path.join(DIR, ".exports"), { recursive: true });
    fs.writeFileSync(path.join(DIR, ".exports", "inside-status.json"), JSON.stringify(Object.fromEntries([...map])));
    log("(DRY) " + rows.length + " dòng → .exports/inside-status.json, KHÔNG ghi Sheet.");
    process.exit(0);
  }
  const j = await gasPost(JSON.stringify({ action: "syncTasks", key: APPSCRIPT_KEY, tab: TAB, sheetId: SHEET_FACTORY, header: HEADER, rows }), log, TAB);
  if (j.status !== "success") { console.error("✗ Ghi " + TAB + " lỗi: " + (j.message || "?")); process.exit(2); }
  log("✓ Đã ghi " + rows.length + " dòng vào tab " + TAB + ".");
})();
