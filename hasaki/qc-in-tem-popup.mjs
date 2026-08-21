/**
 * qc-in-tem-popup.mjs — MÔ PHỎNG NGƯỜI DÙNG THẬT trên pop-up "In tem SKU"
 * ===========================================================================================
 *  Vì sao cần thêm bộ này: `qc-in-tem.mjs` chỉ kiểm LÕI (mã vạch, khổ giấy, nở danh sách), còn
 *  `qc-tab-nhan-dien.mjs` chỉ chạm pop-up ở mấy ca bố cục. Không bộ nào GÕ VÀO Ô rồi BẤM NÚT như
 *  người thật — mà đúng chỗ đó mới là chỗ sinh lỗi: ô "Số lượng" có tới BA đường chốt số (nút +,
 *  Enter, rời ô) nên rất dễ chốt HAI LẦN cho một con số.
 *
 *  Sự cố thật 21/08/2026 (user báo): "gõ thêm số lượng thì bị double lên 2 lần tem".
 *
 *  Bộ này dùng chuột/bàn phím THẬT của Chromium (page.mouse / page.keyboard), không gọi hàm trong
 *  trang — vì lỗi nằm ở THỨ TỰ SỰ KIỆN (change rồi mới click), gọi hàm trực tiếp thì không bao giờ
 *  thấy.
 *
 *  node qc-in-tem-popup.mjs [--anh]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const URL_TRANG = "file:///" + path.join(DIR, "..", "factory", "index.html").replace(/\\/g, "/");
const OUT = path.join(DIR, ".exports", "qc-intem");
const LUU_ANH = process.argv.includes("--anh");
if (LUU_ANH) fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH,
  args: ["--allow-file-access-from-files", "--disable-web-security"] });
const page = await browser.newPage();
await page.setViewport({ width: 1360, height: 950 });
const loiTrang = [];
page.on("pageerror", (e) => loiTrang.push(String(e.message).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") loiTrang.push("console: " + m.text().slice(0, 160)); });

/* Chặn Apps Script (hàng đợi in + tình trạng máy in) — không ra internet, không đụng máy in thật. */
await page.setRequestInterception(true);
page.on("request", (req) => {
  const u = req.url();
  if (/script\.google\.com/.test(u)) {
    if (/callback=/.test(u)) {
      const cb = (u.match(/callback=([^&]+)/) || [])[1] || "cb";
      return req.respond({ status: 200, contentType: "text/javascript", body: cb + "({status:'success'});" });
    }
    return req.respond({ status: 200, contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ status: "success", may: { ready: true, ten: "TEST" }, cho: [] }) });
  }
  req.continue();
});

const ket = [];
function kiem(ten, ok, ghi) {
  ket.push({ ten, ok: !!ok, ghi: ghi || "" });
  console.log((ok ? "  ✓ " : "  ✗ ") + ten + (ghi ? "  — " + ghi : ""));
}
const cho = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(URL_TRANG, { waitUntil: "domcontentloaded" });
await cho(1200);

/* ---------- Dựng danh sách chờ in: 2 SKU, mỗi dòng 1 tem ---------- */
await page.evaluate(() => {
  PR.sel = {
    "422495218": { sku: "422495218", pn: "Mẫu thông chuyền/CWHO0006/Xanh Tro-Dusky Green/Size S", slHang: "", mau: PR_TEM.MAU_MAC_DINH, sl: 1 },
    "422423807": { sku: "422423807", pn: "Vải Single Mesh/S130413 UZM Sheico/Xanh Tro-Dusky Green/mm", slHang: "", mau: PR_TEM.MAU_MAC_DINH, sl: 1 },
  };
  prLuu(); prMo();
});
await cho(600);
kiem("Pop-up In tem mở được với 2 SKU", await page.evaluate(() => {
  const m = document.getElementById("prmodal");
  return !!(m && m.classList.contains("show") && document.querySelectorAll("#prBody tr.prdong").length === 2);
}), await page.evaluate(() => document.querySelectorAll("#prBody tr.prdong").length + " dòng"));

/* ---------- Tiện ích đọc trạng thái ---------- */
const trangThai = () => page.evaluate(() => {
  const r1 = PR.sel["422495218"], r2 = PR.sel["422423807"];
  const chip = (s) => (PR_TEM.tachSl(s) || []).join("|");
  const oSl = document.querySelector('#prBody input.prsl-v[data-s="422495218"]');
  const oTem = document.querySelector('#prBody input.prsl-t[data-s="422495218"]');
  return {
    chip1: chip(r1.slHang), chip2: chip(r2.slHang),
    sl1: r1.sl, tem1: PR_TEM.temCuaDong(r1), tong: PR_TEM.tongTem(prDs()),
    oSlVal: oSl ? oSl.value : "(không có ô)",
    oTemVal: oTem ? oTem.value : "(không có ô)", oTemDis: oTem ? oTem.disabled : null,
    nutIn: (document.querySelector("#prfoot .primary, .prfoot .primary") || {}).textContent || "",
  };
});
/* Gõ vào ô Số lượng của dòng 1 bằng BÀN PHÍM THẬT (không set .value): phải đi qua đúng chuỗi sự
   kiện input → change mà trang đang nghe. */
async function goSl(so) {
  const o = await page.$('#prBody input.prsl-v[data-s="422495218"]');
  await o.click({ clickCount: 3 });          // chọn hết nội dung cũ rồi ghi đè, y như người dùng
  await page.keyboard.type(String(so), { delay: 12 });
}
const nutCong = () => page.$('#prBody .prsladd[data-s="422495218"]');

/* ══════════ CA 1: gõ số rồi BẤM NÚT "+" ══════════
   Đây là đường chính mà giao diện dạy người dùng. Ô nhập có `onchange="prCam(this)"` và nút "+" có
   `onclick="prCam(...)"` — bấm nút thì input MẤT focus trước (change bắn) rồi mới tới click, tức
   MỘT con số có thể bị chốt HAI LẦN. */
await goSl(5);
(await nutCong()).click();
await cho(400);
let t = await trangThai();
kiem("Gõ 5 rồi bấm + → đúng MỘT chip (không double)",
  t.chip1 === "5", "chip = [" + t.chip1 + "] · số tem dòng 1 = " + t.tem1 + " · tổng " + t.tong);

/* ══════════ CA 2: gõ số rồi bấm ENTER ══════════ */
await goSl(6);
await page.keyboard.press("Enter");
await cho(400);
t = await trangThai();
kiem("Gõ 6 rồi Enter → thành chip thứ hai (không double)",
  t.chip1 === "5|6", "chip = [" + t.chip1 + "] · số tem dòng 1 = " + t.tem1);

/* ══════════ CA 3: gõ số rồi RỜI Ô (bấm ra ngoài) ══════════
   Đường này cố ý có để "không ai mất con số vừa đánh chỉ vì quên bấm +". */
await goSl(7);
await page.click("#prBody tr:first-child td:nth-child(4)");
await cho(400);
t = await trangThai();
kiem("Gõ 7 rồi bấm ra ngoài ô → thành chip thứ ba (không double)",
  t.chip1 === "5|6|7", "chip = [" + t.chip1 + "]");

/* ══════════ CA 4: gõ số rồi bấm sang Ô CỦA DÒNG KHÁC ══════════
   Vừa blur (change) vừa focus phần tử khác — chỗ dễ chốt hai lần nhất. */
await goSl(8);
await page.click('#prBody input.prsl-v[data-s="422423807"]');
await cho(400);
t = await trangThai();
kiem("Gõ 8 rồi bấm sang ô dòng khác → chip thứ tư, dòng khác vẫn trống",
  t.chip1 === "5|6|7|8" && t.chip2 === "", "dòng 1 = [" + t.chip1 + "] · dòng 2 = [" + t.chip2 + "]");

/* ══════════ CA 5: SỐ TEM phải khớp số chip, và ô Số tem bị chốt ══════════ */
t = await trangThai();
kiem("Có nhiều số lượng → SỐ TEM = số chip, và ô Số tem bị vô hiệu (khỏi hai con số chỏi nhau)",
  t.tem1 === 4 && t.oTemVal === "4" && t.oTemDis === true,
  "số tem = " + t.tem1 + " · ô hiện " + t.oTemVal + " · disabled = " + t.oTemDis);

/* ══════════ CA 6: ô trống thì KHÔNG có gì để chốt ══════════
   Nút "+" chỉ hiện khi trong ô ĐANG có số (class ) — ô trống thì nó phải ẩn, và Enter trên ô
   trống cũng không được sinh chip rỗng. */
const truoc6 = (await trangThai()).chip1;
const nutAn = await page.evaluate(() => {
  const b = document.querySelector('#prBody .prsladd[data-s="422495218"]');
  return !!b && getComputedStyle(b).display === 'none';
});
await page.click('#prBody input.prsl-v[data-s="422495218"]');
await page.keyboard.press('Enter');
await cho(300);
t = await trangThai();
kiem("Ô trống: nút + ẩn, Enter không sinh chip rỗng",
  nutAn && t.chip1 === truoc6, "nút + ẩn = " + nutAn + " · chip = [" + t.chip1 + "]");

/* ══════════ CA 7: xoá một chip ══════════ */
await page.click('#prBody .prchip button.x[data-s="422495218"][data-i="1"]');
await cho(400);
t = await trangThai();
kiem("Bấm × trên chip thứ 2 → chỉ mất đúng chip đó", t.chip1 === "5|7|8", "chip = [" + t.chip1 + "]");

/* ══════════ CA 8: "Áp SỐ LƯỢNG cho tất cả" ══════════ */
await page.click("#prSlhAll", { clickCount: 3 });
await page.keyboard.type("42", { delay: 12 });
await page.click("#prSlAll");                     // rời ô -> change
await cho(400);
t = await trangThai();
kiem("Áp SỐ LƯỢNG 42 cho tất cả → mỗi dòng đúng MỘT số 42, không nhân đôi",
  t.chip1 === "42" && t.chip2 === "42" && t.tong === 2,
  "dòng 1 = [" + t.chip1 + "] · dòng 2 = [" + t.chip2 + "] · tổng tem = " + t.tong);

/* ══════════ CA 9: "Áp SỐ TEM cho tất cả" ══════════ */
await page.click("#prSlAll", { clickCount: 3 });
await page.keyboard.type("3", { delay: 12 });
await page.click("#prSlhAll");
await cho(400);
t = await trangThai();
kiem("Áp SỐ TEM 3 → mỗi dòng 3 tem (dòng chỉ có MỘT số lượng thì số tem do người gõ)",
  t.tong === 6, "tổng tem = " + t.tong + " · số tem dòng 1 = " + t.tem1);

/* ══════════ CA 10: gõ nhiều số một lần bằng dấu phẩy ══════════ */
await goSl("12, 14, 16");
(await nutCong()).click();
await cho(400);
t = await trangThai();
kiem("Dán \"12, 14, 16\" rồi bấm + → ba chip, không nhân đôi",
  t.chip1 === "42|12|14|16", "chip = [" + t.chip1 + "]");

/* ══════════ ĐIỆN THOẠI 390px — dải số lượng mới phải theo đúng 9 luật của dự án ══════════
   Luật bắt buộc: mục nào có pop-up thì phải có ca đo màn 390px (xem qc-bo-cuc-dien-thoai). Dải
   `.prslbar` là hàng `tr` RIÊNG, mà trên điện thoại mỗi `tr` là một THẺ có viền + bóng — phải kiểm
   đúng cái chỗ dễ vỡ đó: nó có dán liền đáy thẻ trên hay tách ra thành thẻ thứ hai rời rạc. */
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await cho(700);
const mb = await page.evaluate(() => {
  const dong = document.querySelector("#prBody tr.prdong.co-chip");
  const dai = document.querySelector("#prBody tr.prsl2");
  const bar = document.querySelector("#prBody tr.prsl2 .prchips");
  const oSl = document.querySelector("#prBody input.prsl-v");
  const chip = document.querySelector("#prBody .prchip");
  const nutX = document.querySelector("#prBody .prchip button.x");
  const body = document.querySelector("#prmodal .modalbody");
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  const rd = r(dong), rl = r(dai), rb = r(bar), ro = r(oSl), rc = r(chip), rx = r(nutX);
  const cs = (el, p) => (el ? parseFloat(getComputedStyle(el)[p]) : 0);
  return {
    co: !!(dong && dai && bar),
    ke: rd && rl ? Math.round(rl.top - rd.bottom) : null,     // khe giữa thẻ trên và dải
    traiBang: rd && rl ? Math.abs(rl.left - rd.left) < 2 : false,
    keoNgang: body ? body.scrollWidth - body.clientWidth : -1,
    tranRa: rb && body ? Math.round(rb.right - r(body).right) : null,
    caoO: ro ? Math.round(ro.height) : 0,
    caoX: rx ? Math.round(Math.max(rx.width, rx.height)) : 0,
    rongO: ro && rd ? Math.round((ro.width / rd.width) * 100) : 0,
    chuChip: cs(chip, "fontSize"),
    soDongChip: rc && rb ? Math.round(rb.height / rc.height) : 0,
  };
});
kiem("Điện thoại: dải số lượng DÁN LIỀN đáy thẻ trên (không thành thẻ rời)",
  mb.co && mb.ke !== null && mb.ke <= 1 && mb.traiBang,
  "khe = " + mb.ke + "px · cùng lề trái: " + mb.traiBang);
kiem("Điện thoại: không sinh kéo ngang, dải không tràn khỏi thân pop-up",
  mb.keoNgang <= 0 && mb.tranRa !== null && mb.tranRa <= 0,
  "kéo ngang = " + mb.keoNgang + "px · tràn phải = " + mb.tranRa + "px");
/* Ô nhập chỉ được ăn ~MỘT NỬA bề rộng thẻ (user 21/08/2026: "bự quá"), vẫn phải cao ≥44px và
   nút × của chip ≥40px — hai ràng buộc vùng chạm của dự án. */
kiem("Điện thoại: ô nhập chỉ ~nửa bề rộng, vẫn cao ≥44px; nút × chip ≥40px; chữ chip ≥10,5px",
  mb.rongO > 0 && mb.rongO <= 42 && mb.caoO >= 44 && mb.caoX >= 40 && mb.chuChip >= 10.5,
  "ô nhập rộng " + mb.rongO + "% thẻ · cao " + mb.caoO + "px · nút × " + mb.caoX + "px · chip " + mb.chuChip + "px");
if (LUU_ANH) await page.screenshot({ path: path.join(OUT, "popup-390.png") });
await page.setViewport({ width: 1360, height: 950 });
await cho(400);

if (LUU_ANH) await page.screenshot({ path: path.join(OUT, "popup.png") });
kiem("Không có lỗi JS nào trên trang", loiTrang.length === 0, loiTrang.slice(0, 2).join(" | "));

await browser.close();
const dat = ket.filter((k) => k.ok).length;
console.log("\n" + (dat === ket.length ? "✓ " : "✗ ") + dat + "/" + ket.length + " ca đạt" +
  (LUU_ANH ? "  (ảnh ở " + OUT + ")" : ""));
process.exit(dat === ket.length ? 0 : 1);
