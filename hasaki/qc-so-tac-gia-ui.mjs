/**
 * qc-so-tac-gia-ui.mjs — đo mục «Máy đã làm gì» (tab Xác minh, bản nội bộ 8123) trên 3 máy, dữ liệu GIẢ chèn vào /api/du-lieu.
 *  Chặn mọi lượt ghi (POST/PUT/DELETE) ở tầng mạng (luật QC không ghi dữ liệu thật).
 *  L1 không kéo ngang · L2 chữ ≥10,5px (điện thoại) · L3 có đủ dòng/thẻ · L4 lọc «Tạo phiếu» ra đúng · L5 tìm mã phiếu · L6 không lỗi console
 *  Chạy: node qc-so-tac-gia-ui.mjs [--url=http://localhost:8123/kiemsoatkho/?tab=xacminh]
 */
import puppeteer from "puppeteer-core";
import { phienQC } from "./xacminh-dang-nhap.mjs"; const PHIEN_QC = phienQC();   // 12/10 phần Xác minh cần đăng nhập — bộ đo tự cấp phiên 1 giờ
const A = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const URL0 = A.url || "http://localhost:8123/kiemsoatkho/?tab=xacminh";
const MAY = [{ ten: "iphone", w: 390, h: 844, mob: true }, { ten: "android", w: 360, h: 800, mob: true }, { ten: "may-tinh", w: 1366, h: 768, mob: false }];
const gia = Array.from({ length: 75 }, (_, i) => ({ t: "2026-10-12 0" + (i % 10) + ":1" + (i % 6) + ":00", ten: ["Cò canh B1.1 (vệ sinh)", "Form 5S → phiếu WF591", "Luật 3 ngày không báo cáo"][i % 3],
  chuoi: i % 3 ? "x.mjs" : "xac-minh-dem.mjs › canh-b11.mjs", cach: "Lịch nền", may: "HSK-KHO170-tamlc-1", hd: ["Bình luận", "Tạo phiếu", "Dừng phiếu", "Bình luận + tệp"][i % 4],
  phieu: String(14080000 + i), doan: i % 7 === 0, nguoi: i % 3 === 1 ? "Nguyễn Văn An (12345) · máy: An · kho 170" : "", nd: "Nhắc QLTT: phiếu treo quá 48 giờ, nhờ anh/chị xác nhận lỗi vệ sinh khu F0-A8 dãy 3 tầng 2 ".repeat(i % 2 + 1), tep: i % 4 === 3 ? ["bang-chung-" + i + ".png · 120 KB"] : [], ok: i % 11 !== 0 }));
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
const loi = []; let dat = 0; const ok = (dk, ten) => { if (dk) dat++; else loi.push(ten); };
for (const m of MAY) {
  const p = await b.newPage(); await p.evaluateOnNewDocument((hx) => { try { if (hx) localStorage.setItem("hx-phien", hx); } catch (e) {} }, PHIEN_QC); await p.setViewport({ width: m.w, height: m.h, deviceScaleFactor: 2, isMobile: m.mob, hasTouch: m.mob });
  const con = []; p.on("pageerror", (e) => con.push(e.message)); p.on("console", (x) => x.type() === "error" && !/favicon|Failed to load resource/.test(x.text()) && con.push(x.text()));
  await p.setRequestInterception(true);
  p.on("request", async (r) => {
    if (r.method() !== "GET" && r.method() !== "OPTIONS") return r.abort();
    if (/8591\/api\/du-lieu/.test(r.url())) { try { const j = await (await fetch(r.url())).json(); j.tacGia = { ds: gia }; j.phieu.forEach((x) => (x.mayTao = "Form 5S → phiếu WF591"));
      return r.respond({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(j) }); } catch (e) { return r.continue(); } }
    r.continue();
  });
  await p.goto(URL0, { waitUntil: "networkidle2", timeout: 60000 });
  await p.waitForFunction(() => window.HXACMINH && window.__HX_MUC, { timeout: 30000 });
  await p.evaluate(() => window.HXACMINH.sub("tg")); await new Promise((r) => setTimeout(r, 800));
  const d = await p.evaluate((mob) => {
    const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
    const nho = []; document.querySelectorAll("#hxBody *").forEach((e) => { if (!vis(e) || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return; const f = parseFloat(getComputedStyle(e).fontSize); if (mob && f < 10.5) nho.push(e.className + " " + f); });
    const hang = [...document.querySelectorAll("#hxBody tbody tr, #hxBody .cl-item")].filter(vis).length;
    return { ngang: document.documentElement.scrollWidth - innerWidth, nho: nho.slice(0, 5), hang, tieuDe: document.querySelector(".hx-muc h2")?.textContent };
  }, m.mob);
  ok(d.tieuDe === "Máy đã làm gì", m.ten + ": mở đúng mục (" + d.tieuDe + ")");
  ok(d.ngang <= 1, m.ten + ": kéo ngang " + d.ngang + "px");
  ok(!d.nho.length, m.ten + ": chữ nhỏ " + d.nho.join(" | "));
  ok(d.hang === 60, m.ten + ": hiện 60 lượt đầu (có " + d.hang + ")");
  const sel = await p.$('#hxFilters select[data-k="tgHd"]');
  await p.evaluate(() => { const s = document.querySelector('#hxFilters select[data-k="tgHd"]'); s.value = "Tạo phiếu"; s.dispatchEvent(new Event("change")); });
  const n1 = await p.evaluate(() => [...document.querySelectorAll("#hxBody tbody tr, #hxBody .cl-item")].filter((e) => e.getBoundingClientRect().height > 0).length);
  ok(sel && n1 === gia.filter((x) => x.hd === "Tạo phiếu").length, m.ten + ": lọc Tạo phiếu ra " + n1);
  await p.evaluate(() => { const s = document.querySelector('#hxFilters select[data-k="tgHd"]'); s.value = ""; s.dispatchEvent(new Event("change")); const i = document.querySelector("#hxFilters input"); i.value = "14080005"; i.dispatchEvent(new Event("input")); });
  await new Promise((r) => setTimeout(r, 400));
  const n2 = await p.evaluate(() => [...document.querySelectorAll("#hxBody tbody tr, #hxBody .cl-item")].filter((e) => e.getBoundingClientRect().height > 0).length);
  ok(n2 === 1, m.ten + ": tìm mã phiếu ra " + n2);
  await p.evaluate(() => { const i = document.querySelector("#hxFilters input"); i.value = ""; i.dispatchEvent(new Event("input")); localStorage.removeItem("hx-loc"); }); await new Promise((r) => setTimeout(r, 400));   // chờ hết nhịp chống dội 160 ms của ô tìm
  await p.evaluate(() => window.HXACMINH.sub("treo")); await new Promise((r) => setTimeout(r, 600));
  const tb = await p.evaluate(() => /Phiếu do Form 5S/.test(document.getElementById("hxBody").textContent)); if (!tb) console.log(await p.evaluate(() => document.querySelector(".hx-muc h2")?.textContent + " :: " + document.getElementById("hxBody").textContent.slice(0, 300)));
  ok(tb, m.ten + ": Theo phiếu hiện dòng «Phiếu do … tạo»");
  if (A.anh) { await p.evaluate(() => window.HXACMINH.sub("tg")); await new Promise((r) => setTimeout(r, 500)); await p.screenshot({ path: A.anh + "/tg-" + m.ten + ".png" }); }
  ok(!con.length, m.ten + ": lỗi console " + con.slice(0, 3).join(" | "));
  await p.close();
}
await b.close();
console.log(loi.length ? "✗ " + dat + " đạt, " + loi.length + " lỗi:\n  " + loi.join("\n  ") : "✓ " + dat + "/" + dat + " đạt"); process.exit(loi.length ? 1 : 0);
