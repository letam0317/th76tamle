/**
 * do-toc-do-chimuc.mjs — ĐO BƯỚC "ĐANG DỰNG CHỈ MỤC DANH MỤC…" TRONG EDGE THẬT
 * ===========================================================================================
 *  Đo đúng thứ thủ kho nhìn thấy: từ lúc gọi `ndsNapDs(rows)` tới lúc danh mục sẵn sàng —
 *    · lần ĐẦU (kho IndexedDB rỗng)  = dựng lại từ đầu
 *    · lần SAU (tải lại trang)       = mở gói đã cất  ← cái phải "trong nháy mắt"
 *  Chạy ở 3 mức CPU: máy bàn · bóp 4× · bóp 6× (tầm điện thoại thủ kho cầm ngoài kho).
 *
 *  KHÔNG gọi mạng: chặn mọi request ra ngoài, dữ liệu lấy từ .sku-master-dry.json.
 *
 *  node do-toc-do-chimuc.mjs
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const GOC = path.join(DIR, "..", "factory");
const PORT = Number(process.env.PORT || 8137);
const rows = JSON.parse(fs.readFileSync(path.join(DIR, ".sku-master-dry.json"), "utf8")).rows
  .map((r) => ({ sku: String(r[0]), pn: r[1], type: r[2], status: r[3], qty: Number(r[4]) || 0 }));

const may = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path.normalize(path.join(GOC, p === "/" ? "/index.html" : p));
  if (!file.startsWith(path.normalize(GOC)) || !fs.existsSync(file)) { res.writeHead(404); res.end("404"); return; }
  res.writeHead(200, { "Content-Type": p.endsWith(".html") || p === "/" ? "text/html; charset=utf-8" : "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT);

const trinhDuyet = await puppeteer.launch({
  headless: "new",
  executablePath: process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  args: ["--no-sandbox"],
});

/* MỖI PHÉP ĐO MỘT NGĂN LƯU TRỮ RIÊNG. Đã thử cách "xoá IndexedDB rồi tải lại": `deleteDatabase`
   gặp kết nối đang mở thì nằm chờ (onblocked) và chỉ xoá lúc trang đóng — nên lượt cất gói của
   trang đầu bị xoá theo, còn lượt đọc của trang sau thì thấy kho rỗng. Ngăn riêng thì trang đầu
   luôn bắt đầu bằng kho SẠCH và trang sau đọc được đúng gói nó vừa cất. */
async function moNgan() { return await trinhDuyet.createBrowserContext(); }
async function mo(bopCpu, ngan) {
  const tr = await ngan.newPage();
  await tr.setRequestInterception(true);
  tr.on("request", (r) => {
    const u = r.url();
    if (u.startsWith("http://localhost:" + PORT)) r.continue();
    else r.abort();                       // chặn gviz/Apps Script: bộ đo này không được đụng mạng
  });
  const cdp = await tr.createCDPSession();
  if (bopCpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: bopCpu });
  await tr.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "domcontentloaded" });
  await tr.evaluate(() => { window.NDS.loadedOnce = true; });   // khoá đường hâm nóng, đo cho sạch
  return { tr, cdp };
}

/* Đo MỘT lượt nạp: trả thời gian + nguồn chỉ mục ('vừa dựng' | 'cất sẵn') */
/* MỘT LƯỢT = MỘT LẦN MỞ TRANG, đúng như thủ kho gặp: mở trang → vào tab → chờ danh mục.
   Giữ nguyên lượt đọc kho mà `ndsHamNong` đã bắn lúc trang mở (đó là một phần của đường nhanh). */
async function doMotLuot(bopCpu, ngan, rows, choGhi) {
  const { tr } = await mo(bopCpu, ngan);
  const kq = await tr.evaluate(async (rows) => {
    const t = performance.now();
    await window.ndsNapDs(rows);
    const ms = performance.now() - t;
    return { ms: Math.round(ms), tu: window.NDS.chiMucTu, soTu: (window.NDS.cm.tuVung || []).length };
  }, rows);
  if (choGhi) await new Promise((r) => setTimeout(r, 1500));   // chờ requestIdleCallback cất gói
  await tr.close();
  return kq;
}

console.log("Danh mục " + rows.length + " dòng · Edge thật · chặn mạng\n");
console.log("  bóp CPU |  lần đầu (dựng lại) |  lần sau (cất sẵn) |  nhanh hơn");
console.log("  --------|---------------------|--------------------|-----------");
for (const bop of [1, 4, 6]) {
  const ngan = await moNgan();                       // ngăn lưu trữ SẠCH
  const a = await doMotLuot(bop, ngan, rows, true);  // kho rỗng -> dựng lại rồi cất gói
  const b = await doMotLuot(bop, ngan, rows);        // trang mở lại -> mở gói
  const c = await doMotLuot(bop, ngan, rows);        // lượt nữa cho chắc
  console.log("  " + String(bop + "×").padStart(7) + " | " + String(a.ms + "ms (" + a.tu + ")").padStart(19) +
    " | " + String(b.ms + "ms (" + b.tu + ")").padStart(18) + " | " + (a.ms / Math.max(b.ms, 1)).toFixed(1) + "×");
  if (a.tu !== "vừa dựng") console.log("    ✗ lần đầu lẽ ra phải DỰNG LẠI mà lại là: " + a.tu);
  if (b.tu !== "cất sẵn") console.log("    ✗ lần sau KHÔNG dùng được gói đã cất (" + b.tu + ") — kiểm tra vân/IndexedDB");
  if (c.tu !== "cất sẵn") console.log("    ✗ lượt thứ 3 tuột mất gói (" + c.tu + ")");
  if (a.soTu !== b.soTu) console.log("    ✗ số từ vựng lệch: dựng lại " + a.soTu + " ≠ cất sẵn " + b.soTu);
  await ngan.close();
}
/* Danh mục ĐỔI thì phải tự dựng lại — canh luôn ở đây cho khỏi phải nhớ */
{
  const ngan = await moNgan();
  await doMotLuot(1, ngan, rows, true);
  const doi = rows.map((r, i) => (i === 100 ? { ...r, pn: r.pn + " X" } : r));
  const d = await doMotLuot(1, ngan, doi, true);
  console.log("\n  danh mục đổi 1 tên hàng → " + d.tu + " (" + d.ms + "ms) " + (d.tu === "vừa dựng" ? "✓" : "✗ PHẢI dựng lại!"));
  const e = await doMotLuot(1, ngan, doi);
  console.log("  mở lại với danh mục mới  → " + e.tu + " (" + e.ms + "ms) " + (e.tu === "cất sẵn" ? "✓" : "✗"));
  await ngan.close();
}
await trinhDuyet.close();
may.close();
