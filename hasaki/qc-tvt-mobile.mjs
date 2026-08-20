/**
 * qc-tvt-mobile.mjs — ĐO THẬT cách mục "Tồn tại vị trí" + pop-up chi tiết hiển thị TRÊN ĐIỆN THOẠI.
 *
 *  VÌ SAO CÓ TỆP NÀY (người dùng chốt 20/08/2026): trước đây chỉ khi nào SỬA tới đâu mới nhớ ra mà
 *  ngó điện thoại tới đó — nên lỗi bố cục di động chỉ lộ khi người dùng chụp ảnh máy thật gửi lại.
 *  Từ nay MỌI mục có pop-up phải có một bộ đo bố cục 390px chạy cùng bộ QC, độc lập với việc lần
 *  này có sửa vào đó hay không. `qc-tvt-live.mjs` đo SỐ (1560px), tệp này đo BỐ CỤC (390px).
 *
 *  Máy mô phỏng: 390 × 844, isMobile + hasTouch (iPhone 14/15 — hẹp nhất trong số máy đang dùng).
 *  Đọc dữ liệu THẬT qua gviz (không giả lập) để đo đúng độ dài chuỗi thật: tên vải ~90 ký tự,
 *  mã vị trí F0-KHO-503-09-04-01, tên kho "WH - MATERIAL - GARMENT" — chính mấy chuỗi này làm vỡ bảng.
 *
 *  BỆNH ĐANG CANH (đã gặp thật ở chỗ khác trong dự án, xem qc-tab-nhan-dien.mjs mục 12):
 *    ① <table> nhiều cột trong màn 390px bị bóp: cột tên sản phẩm co còn vài px, chữ xếp DỌC
 *       ("V ả i  s i n g…") — phải kéo ngang mới đọc nổi.
 *    ② TRANG (không phải pop-up) bị kéo ngang: modal rộng hơn màn hình thì cả trang trôi.
 *    ③ Vùng chạm < 44px: nút đóng, ô tick chọn dòng, nút bộ lọc.
 *
 *  node qc-tvt-mobile.mjs            (ảnh lưu vào .exports/qc-tvt-mobile)
 */
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(DIR, "..", "factory", "index.html");
const OUT = path.join(DIR, ".exports", "qc-tvt-mobile");
fs.mkdirSync(OUT, { recursive: true });
const MAY = { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

let loi = 0, dat = 0;
const kiem = (ten, ok, chiTiet) => {
  if (ok) { dat++; console.log("  ✓ " + ten + (chiTiet ? "  — " + chiTiet : "")); }
  else { loi++; console.log("  ✗ " + ten + (chiTiet ? "  — " + chiTiet : "")); }
};
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH,
  args: ["--no-sandbox", "--allow-file-access-from-files"] });
const p = await b.newPage();
await p.setViewport(MAY);
const conLoi = [];
p.on("console", (m) => { if (m.type() === "error") conLoi.push("console: " + m.text()); });
p.on("pageerror", (e) => conLoi.push("pageerror: " + e.message));

await p.goto(pathToFileURL(FILE).href, { waitUntil: "networkidle2", timeout: 60000 });
await p.evaluate(() => showTab("abn"));
await p.waitForFunction(() => window.TVT && window.TVT.ok && document.querySelectorAll("#tvtWrap .abntile").length > 0,
  { timeout: 60000 });
await nghi(900);

/* ---------- ① Màn hình chính: mục Tồn tại vị trí ở 390px ---------------------------------------- */
console.log("① Mục \"Tồn tại vị trí\" trên màn 390px");
const man = await p.evaluate(() => {
  const de = document.documentElement;
  const the = [...document.querySelectorAll("#tvtWrap .abntile")];
  const row = [...document.querySelectorAll("#tvtWrap .abnchart .abnrow")];
  const r0 = row[0];
  const nhan = r0 && r0.querySelector(".abnrl"), bar = r0 && r0.querySelector(".abntrack"), so = r0 && r0.querySelector(".abnrv");
  const rn = nhan && nhan.getBoundingClientRect(), rb = bar && bar.getBoundingClientRect(), rs = so && so.getBoundingClientRect();
  const wrap = document.getElementById("tvtWrap").getBoundingClientRect();
  return {
    keoTrang: de.scrollWidth - de.clientWidth,
    nThe: the.length,
    theTran: the.some((x) => { const r = x.getBoundingClientRect(); return r.right > wrap.right + 1 || r.left < wrap.left - 1; }),
    /* Thẻ chỉ số: .abntiles là auto-fit minmax(136px,1fr) ⇒ 390px vừa 2 cột. Con số phải đọc được
       (>=18px) chứ không co theo bề rộng. */
    theCao: the.length ? Math.round(Math.min(...the.map((x) => x.getBoundingClientRect().height))) : -1,
    soCo: the.length ? Math.min(...the.map((x) => parseFloat(getComputedStyle(x.querySelector(".k")).fontSize))) : -1,
    nRow: row.length,
    /* Thanh vị trí ở <=640px chuyển grid-areas "l l" / "t v": nhãn CHIẾM RIÊNG 1 hàng trên,
       bar + số nằm hàng dưới ⇒ tên kho/vị trí dài không bị cắt. */
    nhanRiengHang: !!(rn && rb) && rb.top > rn.bottom - 2,
    nhanRong: rn ? Math.round(rn.width) : -1,
    barTruocSo: !!(rb && rs) && rs.left >= rb.right - 1,
    nhanChu: nhan ? nhan.textContent.trim() : "",
  };
});
kiem("Trang KHÔNG kéo ngang ở 390px", man.keoTrang <= 1, "lệch " + man.keoTrang + "px");
kiem("Thẻ chỉ số không tràn khỏi khung, số đọc được (≥18px)",
  man.nThe >= 4 && !man.theTran && man.soCo >= 18, man.nThe + " thẻ · cỡ số " + man.soCo + "px · cao " + man.theCao + "px");
kiem("Thanh vị trí: nhãn chiếm RIÊNG 1 hàng (bar + số xuống hàng dưới)",
  man.nhanRiengHang && man.barTruocSo && man.nhanRong >= 200,
  man.nRow + " thanh · nhãn rộng " + man.nhanRong + "px · \"" + man.nhanChu.slice(0, 34) + "…\"");

await p.screenshot({ path: path.join(OUT, "01-man-chinh.png") });

/* ---------- ② Pop-up chi tiết: chọn ĐÚNG vị trí đông dòng nhất (chỗ chật nhất) ------------------ */
console.log("② Pop-up \"UID sai vị trí tại …\" trên màn 390px");
const vtChon = await p.evaluate(() => {
  const dem = {};
  tvtRowsInScope().forEach((r) => { dem[r.loc] = (dem[r.loc] || 0) + 1; });
  const top = Object.keys(dem).sort((a, b) => dem[b] - dem[a])[0];
  tvtOpenLoc(top);
  return { loc: top, n: dem[top] };
});
await p.waitForFunction(() => document.querySelector("#tvtmodal").classList.contains("show") &&
  document.querySelectorAll("#tvtmBody tr").length > 0, { timeout: 20000 });
await nghi(700);

const pop = await p.evaluate(() => {
  const de = document.documentElement;
  const box = document.querySelector("#tvtmodal .modalbox");
  const body = document.querySelector("#tvtmodal .modalbody");
  const tr = document.querySelector("#tvtmBody tr");
  const o = (cl) => (tr ? tr.querySelector("." + cl) : null);
  /* SỐ DÒNG CHỮ THẬT — hai cái bẫy đã dính, giữ lại để đừng đo lại kiểu cũ:
     ① ĐỪNG đo bằng (chiều cao ô / line-height): `td` có vertical-align:top nên hộp ô luôn CAO BẰNG
        CẢ HÀNG; bản đo đầu vì thế báo "mã vị trí 10 dòng" trong khi nó chỉ có 1 dòng — nó đang đo
        cái hàng bị ô KHÁC kéo cao, tức đúng con số mà sai thủ phạm.
     ② ĐỪNG đếm số rect của Range: một dòng có thể sinh NHIỀU rect khi trong ô có phần tử con.
        Đo thật ở ô kho: `<span class=dot>` cho 1 rect 9×9 và chữ cho 1 rect 108×14 — 2 rect nhưng
        CÙNG một dòng (ô cao 16px, white-space:nowrap). Phải GOM rect theo dòng rồi mới đếm. */
  const soDong = (el) => { if (!el || !el.firstChild) return -1;
    const r = document.createRange(); r.selectNodeContents(el);
    const rc = [...r.getClientRects()].filter((x) => x.height > 1 && x.width > 1);
    r.detach && r.detach();
    if (!rc.length) return 0;
    /* Gom theo tâm dọc: hai rect chồng nhau theo trục dọc là cùng một dòng. */
    const tam = rc.map((x) => x.top + x.height / 2).sort((a, b) => a - b);
    const cao = Math.max(...rc.map((x) => x.height));
    let n = 1;
    for (let i = 1; i < tam.length; i++) if (tam[i] - tam[i - 1] > cao * 0.7) n++;
    return n; };
  const hien = (el) => !!el && el.offsetParent !== null && el.getBoundingClientRect().width > 0;
  const nhan = (el) => (el ? String(getComputedStyle(el, "::before").content || "").replace(/^"|"$/g, "") : "");
  const rw = (el) => (el ? Math.round(el.getBoundingClientRect().width) : -1);
  const pn = o("tvpn"), loc = o("tvloc"), wh = o("tvwh"), uid = o("tvuid"), sl = o("tvsl");
  const st = o("tvst"), sku = o("tvsku"), upd = o("tvupd"), grp = o("tvgrp"), pcc = tr && tr.querySelector(".pcc");
  const dg = document.querySelector("#tvtmodal .modalhd .mclose");
  const rbox = box.getBoundingClientRect(), rdg = dg && dg.getBoundingClientRect();
  const rtr = tr && tr.getBoundingClientRect();
  const flt = document.getElementById("tvtmFilters");
  return {
    keoTrang: de.scrollWidth - de.clientWidth,
    boxRong: Math.round(rbox.width), boxTran: rbox.right > de.clientWidth + 1 || rbox.left < -1,
    boxCao: Math.round(rbox.height), manCao: de.clientHeight,
    bodyKeo: body.scrollWidth - body.clientWidth,
    bodyOverflowX: getComputedStyle(body).overflowX,
    /* Thẻ hay bảng: tr đổi sang grid/block là đã thành thẻ */
    kieuTr: tr ? getComputedStyle(tr).display : "",
    theadAn: getComputedStyle(document.querySelector("#tvtmodal thead")).display,
    caoThe: rtr ? Math.round(rtr.height) : -1,
    /* Từng ô: hiện không · rộng bao nhiêu · mấy dòng chữ */
    pnRong: rw(pn), pnDong: soDong(pn), pnChu: pn ? pn.textContent.trim().slice(0, 34) : "",
    locDong: soDong(loc), locChu: loc ? loc.textContent.trim() : "",
    whDong: soDong(wh), whChu: wh ? wh.textContent.trim() : "",
    hienUid: hien(uid), hienSl: hien(sl), hienSt: hien(st), hienSku: hien(sku), hienUpd: hien(upd),
    hienPn: hien(pn), hienLoc: hien(loc), hienWh: hien(wh), hienGrp: hien(grp),
    uidCo: uid ? parseFloat(getComputedStyle(uid).fontSize) : -1,
    /* Nhãn ::before phải dán ĐÚNG ô (bài học nth-child ở pop-up in tem) */
    nhanSl: nhan(sl), nhanSku: nhan(sku),
    /* Vùng chạm */
    caoDong: rdg ? Math.round(Math.min(rdg.width, rdg.height)) : -1,
    caoTick: pcc ? Math.round(Math.min(pcc.getBoundingClientRect().width, pcc.getBoundingClientRect().height)) : -1,
    fltThu: flt.classList.contains("mf-thu"),
    fltNut: (() => { const n = document.getElementById("tvtmFltN"); if (!n) return -1;
      return Math.round(n.closest(".mfbtn").getBoundingClientRect().height); })(),
    tieuDe: document.getElementById("tvtmTitle").textContent,
    tong: document.getElementById("tvtmSum").textContent,
  };
});
console.log("   pop-up: " + pop.tieuDe + "  (" + vtChon.n + " dòng)");
console.log("   " + pop.tong);
kiem("Trang KHÔNG kéo ngang khi pop-up mở", pop.keoTrang <= 1, "lệch " + pop.keoTrang + "px");
kiem("Khung pop-up nằm gọn trong màn 390px", !pop.boxTran && pop.boxRong <= 390,
  "rộng " + pop.boxRong + "px · cao " + pop.boxCao + "/" + pop.manCao + "px");
kiem("Bộ lọc THU sẵn, nút bộ lọc chạm được ≥40px", pop.fltThu && pop.fltNut >= 40,
  "mf-thu=" + pop.fltThu + " · nút " + pop.fltNut + "px");
kiem("Nút đóng chạm được ≥44px", pop.caoDong >= 44, pop.caoDong + "px");
kiem("Ô tick chọn dòng chạm được ≥40px", pop.caoTick >= 40, pop.caoTick + "px");
/* ĐIỀU KIỆN CHÍNH: mỗi dòng là THẺ (tr → grid), thead ẩn, KHÔNG kéo ngang trong pop-up. */
kiem("Mỗi dòng là THẺ (tr → grid), hàng tiêu đề ẩn, pop-up không kéo ngang",
  /grid|block/.test(pop.kieuTr) && pop.theadAn === "none" && pop.bodyKeo <= 1,
  "tr=" + pop.kieuTr + " · thead=" + pop.theadAn + " · bảng vượt " + pop.bodyKeo + "px");
kiem("Thẻ gọn: cao ≤150px (bản bảng bóp là 195px toàn khoảng trắng)",
  pop.caoThe > 0 && pop.caoThe <= 150, "cao " + pop.caoThe + "px");
kiem("Tên sản phẩm đủ rộng (≥200px) và kẹp đúng 2 dòng (không băm vụn 10 dòng)",
  pop.pnRong >= 200 && pop.pnDong >= 1 && pop.pnDong <= 2,
  "rộng " + pop.pnRong + "px · " + pop.pnDong + " dòng · \"" + pop.pnChu + "…\"");
kiem("Mã vị trí 1 dòng (không bẻ theo dấu \"-\")", pop.locDong === 1, pop.locDong + " dòng · " + pop.locChu);
kiem("Tên kho 1 dòng (không vỡ \"WH - MATERIAL - GARMENT\" thành 3 dòng)",
  pop.whDong === 1, pop.whDong + " dòng · " + pop.whChu);
/* Thẻ phải mang ĐỦ thông tin đi kho, trừ Group UID (cả danh sách định nghĩa là group = 0). */
kiem("Thẻ hiện đủ 8 trường cần dùng, ẩn đúng Group UID (luôn = 0 nên vô nghĩa)",
  pop.hienUid && pop.hienLoc && pop.hienPn && pop.hienSku && pop.hienSl && pop.hienSt &&
  pop.hienUpd && pop.hienWh && !pop.hienGrp,
  "UID/vị trí/tên/SKU/SL/trạng thái/cập nhật/kho hiện · Group UID ẩn=" + !pop.hienGrp);
kiem("UID là chữ lớn nhất trên thẻ (≥15px) — thứ người đi kho dò mắt tìm",
  pop.uidCo >= 15, pop.uidCo + "px");
kiem("Nhãn ::before dán ĐÚNG ô (SL trên ô số lượng, SKU trên ô SKU)",
  /SL/.test(pop.nhanSl) && /SKU/.test(pop.nhanSku),
  "ô SL → \"" + pop.nhanSl + "\" · ô SKU → \"" + pop.nhanSku + "\"");

await p.screenshot({ path: path.join(OUT, "02-popup.png") });
/* Ảnh cuộn sâu vào bảng: chỗ vỡ nằm ở dòng dữ liệu, không phải ở đầu pop-up */
await p.evaluate(() => { const b2 = document.querySelector("#tvtmodal .modalbody"); b2.scrollTop = 120; });
await nghi(300);
await p.screenshot({ path: path.join(OUT, "03-popup-bang.png") });

/* ---------- ③ Giỏ tạo lệnh mở từ pop-up (thanh #pcbar đè lên đáy màn) --------------------------- */
console.log("③ Chọn dòng → thanh giỏ ở đáy màn");
const gio = await p.evaluate(async () => {
  const tick = document.querySelector("#tvtmBody tr input[type=checkbox]");
  if (tick) { tick.click(); await new Promise((r) => setTimeout(r, 250)); }
  const bar = document.getElementById("pcbar");
  const de = document.documentElement;
  const rb = bar ? bar.getBoundingClientRect() : null;
  return { co: !!bar && bar.offsetParent !== null, keoTrang: de.scrollWidth - de.clientWidth,
    tran: rb ? (rb.right > de.clientWidth + 1 || rb.left < -1) : false,
    duoi: rb ? Math.round(de.clientHeight - rb.bottom) : -1, cao: rb ? Math.round(rb.height) : -1,
    n: (window.PC && PC.sel) ? Object.keys(PC.sel).length : -1 };
});
kiem("Tick 1 dòng → giỏ nhận đúng 1 mục, thanh giỏ không tràn ngang",
  gio.n === 1 && !gio.tran && gio.keoTrang <= 1,
  "giỏ " + gio.n + " mục · cao " + gio.cao + "px · cách đáy " + gio.duoi + "px");
await p.screenshot({ path: path.join(OUT, "04-gio.png") });

/* ---------- ④ Console sạch ---------------------------------------------------------------------- */
console.log("④ Console");
kiem("Không có lỗi console/pageerror suốt lượt đo", conLoi.length === 0, conLoi.join(" | ") || "sạch");

await b.close();
console.log("\nẢnh: " + OUT);
console.log(loi ? "✗ " + loi + " lỗi / " + (loi + dat) + " ca" : "✓ QC bố cục điện thoại: đạt (" + dat + " ca)");
process.exit(loi ? 1 : 0);
