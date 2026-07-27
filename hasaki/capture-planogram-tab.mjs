/**
 * capture-planogram-tab.mjs — TEST RENDER tab Planogram mới (KHÔNG đụng GAS thật).
 * Serve kiemsoatkho/ tĩnh; chặn mọi request script.google.com + docs.google.com,
 * trả JSONP giả lập từ dữ liệu DRY của sync-vesinh-all.js (.exports/*-out.json).
 * Chụp: hero + tiles, pop-up yêu cầu (ảnh thumbnail), pop-up tra cứu NV.
 */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.join(DIR, "kiemsoatkho");
const OUT = path.join(DIR, ".exports");
const PORT = 8931;

const TABS = {};
for (const t of ["PHU-TRACH-QUAY-KE", "CHAMCONG-VESINH", "VESINH-YEUCAU", "VESINH-NHATKY"]) {
  const j = JSON.parse(fs.readFileSync(path.join(OUT, t + "-out.json"), "utf8"));
  TABS[t] = { status: "success", header: j.header, rows: j.rows, ts: Date.now() };
}
// Mock VESINH-AI từ các dòng status 3 của VESINH-YEUCAU (giả lập verdict để test UI)
{
  const yc = TABS["VESINH-YEUCAU"].rows.filter((r) => Number(r[4]) === 3);
  const VD = [
    ["DAT", 92, 88, "Các ô sạch, hàng xếp gọn đúng tiêu chuẩn.", ""],
    ["KHONG_DAT", 45, 90, "Ô F0-A8-505: còn thùng carton rỗng trên sàn.", "F0-A8-505-01-01-02: thùng rỗng chưa dọn"],
    ["CAN_XEM", 60, 55, "[Tin cậy thấp] Ảnh ô cuối hơi mờ, không đánh giá được góc kệ.", ""],
  ];
  TABS["VESINH-AI"] = {
    status: "success",
    header: ["Request ID", "Ngày", "Location", "Executor", "Executed At", "Kết luận", "Điểm", "Tin cậy", "Lý do", "Ảnh lỗi", "Model", "Judged At"],
    rows: yc.map((r, i) => { const v = VD[i % 3]; return [r[0], r[1], r[2], r[6], r[7], v[0], v[1], v[2], v[3], v[4], "claude-opus-4-8", new Date().toISOString()]; }),
    ts: Date.now(),
  };
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json" };
const srv = http.createServer((req, res) => {
  let p = req.url.split("?")[0]; if (p === "/") p = "/index.html";
  const f = path.join(WEB, p);
  if (!f.startsWith(WEB) || !fs.existsSync(f)) { res.writeHead(404); res.end("nf"); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
  res.end(fs.readFileSync(f));
}).listen(PORT);

const browser = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH, args: ["--window-size=1440,900"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.4 });
await page.setRequestInterception(true);
page.on("request", (r) => {
  const u = r.url();
  if (/script\.google\.com/.test(u)) {
    const m = u.match(/callback=([A-Za-z0-9_]+)/); const cb = m ? m[1] : "cb";
    const tm = u.match(/tab=([^&]+)/); const tab = tm ? decodeURIComponent(tm[1]) : "";
    const act = (u.match(/action=([a-zA-Z]+)/) || [])[1] || "";
    let body = `${cb}({"status":"error"})`;
    if (act === "readTab" && TABS[tab]) body = `${cb}(${JSON.stringify(TABS[tab])})`;
    else if (act === "lastSync") body = `${cb}({"status":"success","ts":${Date.now()}})`;
    return r.respond({ status: 200, contentType: "text/javascript", body });
  }
  if (/docs\.google\.com/.test(u)) return r.respond({ status: 200, contentType: "text/javascript", body: "/*gviz off*/" });
  if (/wms-gw-external\.hasaki\.vn/.test(u)) return r.continue();   // ảnh thật (hotlink)
  r.continue();
});
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text().slice(0, 200)); });

await page.goto("http://127.0.0.1:" + PORT + "/index.html", { waitUntil: "networkidle2", timeout: 60000 });
// Vào công ty HASAKI ▸ tab Planogram
await page.evaluate(() => { try { setCty && setCty("hasaki"); } catch (e) {} try { setTab && setTab("planogram"); } catch (e) {} });
await page.waitForSelector("#hpToday .hp-tile", { timeout: 20000 });
await new Promise((r) => setTimeout(r, 1600));
await page.screenshot({ path: path.join(OUT, "shot-pg-new-main.png"), fullPage: false });

// Pop-up "Chưa vệ sinh (có đi làm)"
await page.evaluate(() => HPLANOGRAM.openYc("nhac"));
await new Promise((r) => setTimeout(r, 1400));
await page.screenshot({ path: path.join(OUT, "shot-pg-new-modal-nhac.png") });

// Pop-up "Đã vệ sinh" (có ảnh thật)
await page.evaluate(() => { HPLANOGRAM.closeModal(); });
await new Promise((r) => setTimeout(r, 350));
await page.evaluate(() => HPLANOGRAM.openYc("da"));
await new Promise((r) => setTimeout(r, 2600));
await page.screenshot({ path: path.join(OUT, "shot-pg-new-modal-da.png") });

// Lightbox từ thumbnail
const thumb = await page.$(".hp-thumbs img");
if (thumb) { await thumb.click(); await new Promise((r) => setTimeout(r, 1600)); await page.screenshot({ path: path.join(OUT, "shot-pg-new-lightbox.png") }); await page.evaluate(() => dongLB && dongLB()); }
await page.evaluate(() => HPLANOGRAM.closeModal());
await new Promise((r) => setTimeout(r, 350));

// Pop-up tra cứu theo nhân viên
await page.evaluate(() => HPLANOGRAM.openNk());
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: path.join(OUT, "shot-pg-new-nk.png") });
await page.evaluate(() => HPLANOGRAM.closeNk());
await new Promise((r) => setTimeout(r, 350));

// Pop-up CHI TIẾT VỊ TRÍ từ sơ đồ (băng chuyền 502 — có báo cáo + AI)
await page.evaluate(() => HPLANOGRAM.openViTri("F0-A8-502-01-01-01"));
await new Promise((r) => setTimeout(r, 2000));
await page.screenshot({ path: path.join(OUT, "shot-pg-new-vitri.png") });
await page.evaluate(() => HPLANOGRAM.closeVt());
await new Promise((r) => setTimeout(r, 350));

// Sơ đồ đa màu + cảnh báo (screenshot riêng khối #hpMap)
{ const el = await page.$("#hpMap"); if (el) await el.screenshot({ path: path.join(OUT, "shot-pg-map-colors.png") }); }
// Panel "Cần nhắc theo NV" mặc định THU GỌN: bấm nút tog xổ ra → chụp; bấm chip NV đầu → soi ô
const coTog = await page.evaluate(() => { const t = document.querySelector(".hp-ptnhac .hp-ptchip.tog"); if (t) { t.click(); return true; } return false; });
if (coTog) {
  await new Promise((r) => setTimeout(r, 700));
  { const el = await page.$("#hpMap"); if (el) await el.screenshot({ path: path.join(OUT, "shot-pg-ptxo.png") }); }
  await page.evaluate(() => { const c = document.querySelector(".hp-ptnhac .hp-ptchip:not(.tog):not(.clear)"); if (c) c.click(); });
  await new Promise((r) => setTimeout(r, 900));
  const el = await page.$("#hpMap"); if (el) await el.screenshot({ path: path.join(OUT, "shot-pg-ptsoi.png") });
  await page.evaluate(() => HPLANOGRAM.setPtHi(""));
  await new Promise((r) => setTimeout(r, 300));
} else console.log("⚠ Không thấy nút 'Cần nhắc theo nhân viên' (không có ô remind hôm nay?)");
// Pop-up danh sách quá hạn (nếu có banner cảnh báo)
const coAlert = await page.evaluate(() => { const b = document.querySelector('.hp-alertbar'); if (b) { b.click(); return true; } return false; });
if (coAlert) { await new Promise((r) => setTimeout(r, 1400)); await page.screenshot({ path: path.join(OUT, "shot-pg-canhbao.png") }); await page.evaluate(() => HPLANOGRAM.closeModal()); await new Promise((r) => setTimeout(r, 300)); }

// Mobile
await page.evaluate(() => { HPLANOGRAM.closeNk(); });
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: path.join(OUT, "shot-pg-new-mobile.png") });

await browser.close(); srv.close();
console.log("Đã chụp 6 ảnh vào .exports/shot-pg-new-*.png");
