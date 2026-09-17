/**
 * qc-mat-bang-170.mjs — BỘ ĐO cho màn "Mặt bằng thật" của tab Planogram (Hasaki · kho 170).
 *
 * Màn này mới (16/09/2026) nên theo mục 7 bộ chuẩn — "phạm vi đo = phạm vi lời hứa" — phải có bộ
 * đo riêng trước khi phát hành. Bản nội bộ localhost KHÔNG có khoá thiết bị nên tab không ra dữ
 * liệu; vì vậy bộ này mở LIVE để lấy dữ liệu thật nhưng CHẶN 2 file JS và trả về BẢN TRÊN ĐĨA
 * (bản chưa đẩy) — đo đúng thứ sắp phát hành, không phải bản cũ đang chạy.
 *
 * Kiểm 8 điều:
 *   1. Nút "Mặt bằng thật" có mặt trong tiêu đề Sơ đồ.
 *   2. Bấm nút → SVG mặt bằng dựng ra, không lỗi console.
 *   3. Đếm ô: 160 ô kệ A1 bấm được · ô A2/pallet/pick/pack là nền (không bắt chuột).
 *   4. MÀU ô A1 trên mặt bằng KHỚP TỪNG Ô với sơ đồ lưới — hai chế độ không được nói khác nhau.
 *   5. Bấm 1 ô A1 → mở đúng pop-up vị trí của mã đó.
 *   6. Bấm lại nút → quay về sơ đồ lưới nguyên trạng.
 *   7. Thời gian dựng mặt bằng + số byte file dữ liệu tải thêm.
 *   8. Điện thoại (Pixel 5): mặt bằng không tràn ngang, không đè chữ.
 *
 *   node hasaki/qc-mat-bang-170.mjs [url] [--mobile]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const args = process.argv.slice(2);
const URL = args.find((a) => /^https?:/.test(a)) || "https://letam0317.github.io/kiemsoatkho/?company=hasaki&tab=planogram";
const MOBILE = args.includes("--mobile");
const DIR = path.dirname(fileURLToPath(import.meta.url));
const KSK = path.join(DIR, "kiemsoatkho");
const OUT = path.join(DIR, ".exports");
const THAY = {                       // tên file trên live → file trên đĩa (bản chưa đẩy)
  "hasaki-planogram.js": path.join(KSK, "hasaki-planogram.js"),
  "kho170-sodo.js": path.join(KSK, "kho170-sodo.js")
};
const ok = (b) => (b ? "✓" : "✗");
let loi = 0;
const bao = (dat, nhan, them = "") => { if (!dat) loi++; console.log(`  ${ok(dat)} ${nhan}${them ? " — " + them : ""}`); };

const b = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH, args: ["--no-sandbox"] });
const p = await b.newPage();
/* Pixel 5 dựng bằng setViewport như qc-mobile-toan-du-an.mjs — puppeteer bản này không xuất KnownDevices */
if (MOBILE) await p.setViewport({ width: 393, height: 851, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true });
else await p.setViewport({ width: 1440, height: 900 });

const loiConsole = [];
p.on("console", (m) => { if (m.type() === "error") loiConsole.push(m.text().slice(0, 160)); });
p.on("pageerror", (e) => loiConsole.push("pageerror: " + String(e).slice(0, 160)));

let byteThem = 0, daThay = [];
await p.setRequestInterception(true);
p.on("request", (r) => {
  const ten = path.basename(new globalThis.URL(r.url()).pathname);
  const cuc = THAY[ten];
  if (cuc && fs.existsSync(cuc)) {
    const body = fs.readFileSync(cuc, "utf8");
    daThay.push(ten);
    if (ten === "kho170-sodo.js") byteThem = Buffer.byteLength(body);
    return r.respond({ status: 200, contentType: "text/javascript; charset=utf-8", body });
  }
  r.continue();
});

console.log(`\n=== QC MẶT BẰNG KHO 170 ${MOBILE ? "(điện thoại Pixel 5)" : "(desktop 1440)"} · ${URL}\n`);
await p.goto(URL, { waitUntil: "domcontentloaded", timeout: 120000 });
await p.waitForSelector("#pane-planogram .hp-mapcell", { timeout: 150000 }).catch(() => {});

/* ---- ảnh chụp trạng thái LƯỚI + màu từng ô để đối chiếu ---- */
const luoi = await p.evaluate(() => {
  const n = document.querySelectorAll("#pane-planogram .hp-mapcell").length;
  const mau = {};
  document.querySelectorAll("#pane-planogram .hp-mapcell[data-l]").forEach((el) => {
    const l = el.getAttribute("data-l");
    if (/^F0-A1-/.test(l)) mau[l] = getComputedStyle(el).backgroundColor;
  });
  return { n, mau, nut: !!document.querySelector('#pane-planogram .hp-h2btn[onclick*="toggleMatBang"]') };
});
console.log("1) Sơ đồ lưới (trạng thái nền)");
bao(luoi.n > 0, "sơ đồ lưới có ô", luoi.n + " ô");
bao(luoi.nut, 'nút "Mặt bằng thật" có trong tiêu đề Sơ đồ');
bao(Object.keys(luoi.mau).length >= 160, "đọc được màu ô A1 trên lưới", Object.keys(luoi.mau).length + " ô");

/* ---- bật mặt bằng ---- */
console.log("\n2) Bật mặt bằng");
const t0 = Date.now();
await p.evaluate(() => window.HPLANOGRAM.toggleMatBang());
const hienSvg = await p.waitForSelector("#pane-planogram .hp-mbsvg", { timeout: 30000 }).then(() => true).catch(() => false);
await p.waitForFunction(() => document.querySelectorAll("#pane-planogram .hp-mbo.o-ke").length > 0, { timeout: 30000 }).catch(() => {});
const tDung = Date.now() - t0;
bao(hienSvg, "SVG mặt bằng dựng ra", tDung + "ms");
bao(daThay.includes("kho170-sodo.js"), "nạp LAZY file dữ liệu sơ đồ", (byteThem / 1024).toFixed(0) + "KB (bản trên đĩa)");

const mb = await p.evaluate(() => {
  const q = (s) => document.querySelectorAll("#pane-planogram " + s).length;
  const mau = {}, ngoai = [];
  document.querySelectorAll("#pane-planogram .hp-mbo.o-ke[data-l]").forEach((el) => {
    mau[el.getAttribute("data-l")] = el.getAttribute("fill") || "";
  });
  ["o-ke2", "o-pallet", "o-pick", "o-pack"].forEach((c) => {
    const el = document.querySelector("#pane-planogram .hp-mbo." + c);
    if (el && el.getAttribute("onclick")) ngoai.push(c);
  });
  const svg = document.querySelector("#pane-planogram .hp-mbsvg");
  const r = svg ? svg.getBoundingClientRect() : null;
  const wrap = svg ? svg.parentElement.getBoundingClientRect() : null;
  return { ke: q(".hp-mbo.o-ke"), ke2: q(".hp-mbo.o-ke2"), pallet: q(".hp-mbo.o-pallet"),
    pick: q(".hp-mbo.o-pick"), pack: q(".hp-mbo.o-pack"), mau, ngoai,
    rong: r ? Math.round(r.width) : 0, cao: r ? Math.round(r.height) : 0,
    tranNgang: !!(r && wrap && r.width > wrap.width + 1), doiRong: document.documentElement.scrollWidth > window.innerWidth + 1 };
});
console.log("\n3) Đếm ô trên mặt bằng");
bao(mb.ke === 160, "ô kệ A1 bấm được = 160", "thấy " + mb.ke);
bao(mb.pack === 64, "ô bàn đóng gói (PACK) = 64", "thấy " + mb.pack);
bao(mb.ke2 > 0 && mb.pallet > 0 && mb.pick > 0, "ô nền A2/pallet/pick có mặt",
  `A2 ${mb.ke2} · pallet ${mb.pallet} · pick ${mb.pick}`);
bao(mb.ngoai.length === 0, "ô ngoài phạm vi KHÔNG bấm được", mb.ngoai.length ? "lỗi ở " + mb.ngoai.join(",") : "đúng");

console.log("\n4) Màu mặt bằng khớp sơ đồ lưới");
const rgb = (s) => { const m = String(s).match(/\d+/g); return m ? m.slice(0, 3).join(",") : ""; };
const hex2rgb = (h) => { const m = String(h).match(/^#?([0-9a-f]{6})$/i); if (!m) return ""; const v = parseInt(m[1], 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255].join(","); };
let soSanh = 0, lech = [];
Object.keys(luoi.mau).forEach((l) => {
  if (!(l in mb.mau)) return;
  soSanh++;
  const a = rgb(luoi.mau[l]), c = hex2rgb(mb.mau[l]);
  if (mb.mau[l] === "" ) return;                 // ô nét đứt: lưới cũng trong suốt
  if (a && c && a !== c) lech.push(l + " lưới " + a + " ≠ mặt bằng " + c);
});
bao(soSanh >= 150, "số ô đối chiếu được", soSanh + " ô");
bao(lech.length === 0, "màu khớp từng ô", lech.length ? lech.slice(0, 3).join(" · ") : "0 ô lệch");

console.log("\n5) Bấm 1 ô A1 trên mặt bằng");
const maO = Object.keys(mb.mau)[0] || "";
await p.evaluate((m) => { const el = document.querySelector('#pane-planogram .hp-mbo.o-ke[data-l="' + m + '"]'); if (el) el.dispatchEvent(new MouseEvent("click", { bubbles: true })); }, maO);
const moPop = await p.waitForFunction(() => {
  const el = document.querySelector("#hpVtModal,.hp-vtmodal,#pane-planogram .hp-vt");
  return !!el && getComputedStyle(el).display !== "none";
}, { timeout: 15000 }).then(() => true).catch(() => false);
bao(moPop, "pop-up chi tiết vị trí mở", maO);
await p.evaluate(() => { try { window.HPLANOGRAM.closeVt(); } catch (e) {} });

console.log("\n6) Về lại sơ đồ lưới");
await p.evaluate(() => window.HPLANOGRAM.toggleMatBang());
const veLuoi = await p.evaluate(() => ({
  cell: document.querySelectorAll("#pane-planogram .hp-mapcell").length,
  svg: document.querySelectorAll("#pane-planogram .hp-mbsvg").length
}));
bao(veLuoi.cell === luoi.n && veLuoi.svg === 0, "lưới trở lại nguyên trạng", veLuoi.cell + " ô · " + veLuoi.svg + " svg");

console.log("\n7) Bố cục" + (MOBILE ? " điện thoại" : ""));
bao(!mb.tranNgang, "mặt bằng không tràn khỏi khung", mb.rong + "×" + mb.cao + "px");
bao(!mb.doiRong, "trang không sinh cuộn ngang");

console.log("\n8) Lỗi trang");
bao(loiConsole.length === 0, "console sạch", loiConsole.length ? loiConsole.slice(0, 3).join(" | ") : "0 lỗi");

/* ảnh để soi bằng mắt — đóng sạch pop-up trước, không thì ảnh QC chỉ thấy modal */
fs.mkdirSync(OUT, { recursive: true });
await p.evaluate(() => {
  try { window.HPLANOGRAM.closeVt(); } catch (e) {}
  try { window.HPLANOGRAM.closeModal(); } catch (e) {}
  document.querySelectorAll(".hp-vtmodal,.hp-modal,#hpVtModal").forEach((el) => el.classList.remove("open"));
});
await p.keyboard.press("Escape");
await p.evaluate(() => window.HPLANOGRAM.toggleMatBang());
await p.waitForSelector("#pane-planogram .hp-mbsvg", { timeout: 20000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 400));
const anh = path.join(OUT, "qc-mat-bang-170" + (MOBILE ? "-mobile" : "") + ".png");
const el = await p.$("#pane-planogram #hpMap");
if (el) await el.screenshot({ path: anh }); else await p.screenshot({ path: anh });
console.log("\n→ ảnh: " + anh);
console.log(loi === 0 ? "\n✅ ĐẠT — không có mục nào sai\n" : `\n❌ ${loi} mục SAI\n`);
await b.close();
process.exit(loi === 0 ? 0 : 1);
