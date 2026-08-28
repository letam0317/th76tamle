/**
 * qc-du-bao-popup.mjs — KIỂM CHỨC NĂNG pop-up "Dự kiến xong" (Dự báo hoàn thành kiểm kê) của tab Kiểm kê factory
 * =====================================================================================================
 *  Sinh ra 28/08/2026 khi sửa sự cố "ô Dự kiến xong bấm không mở": KK_BENCHMARK_252161 khai `var` LỒNG TRONG
 *  kkForecastInfo → kkFcSim (hàm khác) ném ReferenceError TRƯỚC dòng hiện modal → pop-up câm, không có gì trên
 *  màn báo lỗi. Bộ đo bố cục (qc-mobile-toan-du-an) chỉ mở pop-up qua API nên không bắt được lỗi này —
 *  bài này BẤM THẬT ô trên dải KPI như thủ kho, bắt console error + pageerror, và soi số ở cả 2 tầng.
 *
 *  Ca đo (mỗi bảng SKU / mã vị trí):
 *    1. bấm ô .ks.fc → #fcmodal.show trong 3s, 0 pageerror
 *    2. tầng ① có ngày ETA (dd/mm) hoặc ">6 tháng" hoặc ✓; phụ đề nêu "chuẩn đợt …"
 *    3. tầng ② có kết quả mô phỏng (số) và ② mặc định ("Như chuẩn") TÁI TẠO đúng số ngày của ①
 *    4. đổi combo nguồn tốc độ sang "thực đo" rồi về "chuẩn" → không lỗi, kết quả vẫn là số
 *    5. đổi số người → kết quả đổi (mô phỏng sống)
 *    6. đóng pop-up → #fcmodal không còn .show
 *  Lọc từng kho (kkSetWh) → ① phải đổi sang bộ số của kho đó (tên đợt trong phụ đề đổi theo).
 *
 *  Chạy: node qc-du-bao-popup.mjs            (bản file trên đĩa — bản chưa đẩy)
 *        node qc-du-bao-popup.mjs --live     (bản live GitHub Pages)
 */
import puppeteer from "puppeteer";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const LIVE = /--live/.test(process.argv.slice(2).join(" "));
const URL = LIVE ? "https://letam0317.github.io/stocklocationfactory/" : pathToFileURL(path.resolve(DIR, "..", "factory", "index.html")).href;
const ket = []; let loi = 0;
const ok = (ten, dat, ghi) => { ket.push({ ten, dat, ghi }); if (!dat) loi++; console.log((dat ? "  ✓ " : "  ✗ ") + ten + (ghi ? "  — " + ghi : "")); };

const b = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH, args: ["--no-sandbox", "--disable-gpu"] });
const p = await b.newPage();
await p.setViewport({ width: 1280, height: 860 });
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("console.error: " + m.text().slice(0, 200)); });
console.log("Mở " + (LIVE ? "LIVE" : "FILE") + ": " + URL);
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForFunction(() => typeof showTab === 'function' && typeof HOME_MUC !== 'undefined', { timeout: 60000 });
await p.evaluate(() => showTab("kk"));
try {
  await p.waitForFunction(() => typeof KK !== 'undefined' && KK.data && KK.data.sku && KK.data.sku.length > 0 && KK.data.loc && KK.data.loc.length > 0 && document.querySelectorAll('.ks.fc').length >= 2, { timeout: 120000 });
} catch (e) { console.error("✗ Tab Kiểm kê không tải xong dữ liệu (gviz) trong 120s — không đo được."); await b.close(); process.exit(2); }
// Tồn kho chi tiết (WH_DATA) — mẫu số của dự báo; tab Kiểm kê tự nạp nền từ 28/08/2026. Không về trong 90s → vẫn đo (nhánh 'chờ tồn kho').
let coTon = true;
try { await p.waitForFunction(() => typeof WH_DATA !== 'undefined' && Object.keys(WH_DATA).length > 0, { timeout: 90000 }); await new Promise((r) => setTimeout(r, 800)); }
catch (e) { coTon = false; console.log("  ⚠ WH_DATA (tồn kho chi tiết) không về trong 90s — đo nhánh 'chờ tồn kho'."); }
ok("Tab Kiểm kê tự nạp tồn kho chi tiết (WH_DATA) làm mẫu số dự báo", coTon);
const soPhieu = await p.evaluate(() => ({ sku: KK.data.sku.length, loc: KK.data.loc.length, khos: (function () { var s = {}; ["sku", "loc"].forEach(function (k) { KK.data[k].forEach(function (r) { if (r.wh) s[r.wh] = 1; }); }); return Object.keys(s); })() }));
console.log("  Dữ liệu: " + soPhieu.sku + " phiếu SKU · " + soPhieu.loc + " phiếu vị trí · kho: " + soPhieu.khos.join(" | "));
ok("Không có lỗi JS khi tải tab Kiểm kê", errs.length === 0, errs.slice(0, 3).join(" ; "));

async function doBang(kind) {
  const nhan = kind === "sku" ? "SKU" : "mã vị trí";
  console.log("── Bảng " + nhan);
  errs.length = 0;
  // 1. bấm THẬT ô trên dải KPI
  const co = await p.evaluate((k) => { const t = document.querySelector('#kkStrip-' + k + ' .ks.fc'); if (!t) return null; t.click(); return t.textContent.trim().slice(0, 80); }, kind);
  ok("Ô 'Dự kiến xong' tồn tại trên dải KPI (" + nhan + ")", !!co, co || "");
  let mo = false;
  try { await p.waitForFunction(() => document.getElementById('fcmodal').classList.contains('show'), { timeout: 3000 }); mo = true; } catch (e) {}
  ok("Bấm ô → pop-up mở trong 3s", mo, errs.join(" ; ").slice(0, 300));
  ok("0 lỗi JS khi mở pop-up", errs.length === 0, errs.slice(0, 2).join(" ; "));
  if (!mo) return;
  const st = await p.evaluate(() => {
    const q = (s) => (document.querySelector(s) || {}).textContent || "";
    const d = q("#fcBody .fchero .d");
    const fc = KK_FC.fc || {};
    return { title: q("#fcTitle"), sub: q("#fcSub"), hero: d.trim(), heroN: q("#fcBody .fchero .n").trim(), sim: q("#fcSimOut").trim(), mode: fc.mode, ngay: fc.ngay, chuan: fc.chuan && fc.chuan.ten, thucDo: fc.thucDo ? Math.round(fc.thucDo.sec) + "s/" + fc.thucDo.n : "", nCombo: document.querySelectorAll("#fcBody .fccombo").length, facts: [...document.querySelectorAll("#fcBody .fcfact")].map((x) => x.textContent.trim().replace(/\s+/g, " ")) };
  });
  ok("Tầng ① có ETA (dd/mm | >6 tháng | ✓)", /^\d{2}\/\d{2}|>6 tháng|✓/.test(st.hero), st.hero + " · " + st.heroN);
  ok("Dùng bộ số CHUẨN (mode=chuan) theo phạm vi", st.mode === "chuan" || st.mode === undefined && /✓/.test(st.hero), "mode=" + st.mode + " · " + (st.chuan || ""));
  ok("Phụ đề nêu nguồn chuẩn", /chuẩn đợt/.test(st.sub), st.sub);
  console.log("     facts: " + st.facts.join(" | "));
  if (st.mode === "chuan") {
    ok("Tầng ② có kết quả mô phỏng", /\d{2}\/\d{2}|>6 tháng/.test(st.sim), st.sim.slice(0, 160));
    const m = st.sim.match(/≈([\d.,]+) ngày làm việc/);
    const ngay2 = m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : NaN;
    ok("② mặc định (Như chuẩn) tái tạo đúng số ngày của ①", Math.abs(ngay2 - st.ngay) <= 1, "① " + st.ngay + " · ② " + ngay2 + " ngày (lệch ≤1 do làm tròn N người)");
    ok("Combo trong pop-up dùng khuôn .combo dự án (không <select> trần)", st.nCombo >= 4 && (await p.evaluate(() => document.querySelectorAll("#fcBody select").length)) === 0, st.nCombo + " combo");
    // 4. đổi nguồn tốc độ → thực đo → chuẩn
    const doiNguon = async (v) => p.evaluate((v) => { const it = document.querySelector('#fcBody .fccombo[data-id="fcRateSrc"] .combo-item[data-v="' + v + '"]'); if (!it) return null; it.click(); return (document.getElementById("fcSimOut") || {}).textContent || ""; }, v);
    errs.length = 0;
    const s1 = await doiNguon("thucdo"); const s2 = await doiNguon("chuan");
    ok("Đổi nguồn tốc độ thực đo → chuẩn không lỗi, kết quả vẫn là số", s1 != null && s2 != null && /\d{2}\/\d{2}|>6 tháng/.test(s1) && /\d{2}\/\d{2}|>6 tháng/.test(s2) && errs.length === 0, (st.thucDo ? "thực đo " + st.thucDo : "chưa có thực đo → dùng chuẩn") + " · " + errs.join(";"));
    // 5. đổi số người → kết quả đổi
    const truoc = await p.evaluate(() => document.getElementById("fcSimOut").textContent);
    const sau = await p.evaluate(() => { const items = [...document.querySelectorAll('#fcBody .fccombo[data-id="fcN"] .combo-item')]; const cur = document.querySelector('#fcBody .fccombo[data-id="fcN"] input').getAttribute("data-v"); const it = items.find((x) => x.getAttribute("data-v") !== cur && Number(x.getAttribute("data-v")) === 1) || items[0]; it.click(); return document.getElementById("fcSimOut").textContent; });
    ok("Đổi số nhân sự → kết quả mô phỏng thay đổi (mô phỏng sống)", truoc !== sau, sau.slice(0, 120));
  }
  await p.evaluate(() => closeFcModal());
  await new Promise((r) => setTimeout(r, 400));
  ok("Đóng pop-up", await p.evaluate(() => !document.getElementById("fcmodal").classList.contains("show")));
}
await doBang("sku");
await doBang("loc");

// Lọc từng kho → bộ số đổi theo kho
for (const w of soPhieu.khos) {
  await p.evaluate((w) => { KK.wh = ""; kkSetWh(w); }, w);
  await new Promise((r) => setTimeout(r, 300));
  const t = await p.evaluate(() => { const c = kkChuanCho("sku"); return { ten: c.ten, kho: c.b.kho, sec: c.p.sec, loc: kkChuanCho("loc").p.sec }; });
  ok("Lọc kho " + w + " → bộ chuẩn " + (t.kho ? "riêng của kho" : "CHUNG"), t.sec > 0 && t.loc > 0, t.ten + " · " + t.sec + "s/SKU · " + t.loc + "s/vị trí");
}
await p.evaluate(() => { KK.wh = ""; kkRender(); });

console.log("\n══ KẾT QUẢ: " + (ket.length - loi) + "/" + ket.length + " đạt" + (loi ? " · " + loi + " LỖI" : "") + " ══");
await b.close();
process.exit(loi ? 1 : 0);
