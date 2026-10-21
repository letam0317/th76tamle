/**
 * qc-thanh-ben-luat.mjs — KIỂM MỌI LUẬT user đã chốt cho thanh bên Xác minh, bằng THAO TÁC THẬT (chạm / vuốt / bấm), 20/10.
 *  Điện thoại 360/390/414 × Theo tác vụ + Theo máy; web 1366 phần Theo máy (ảnh giữ cỡ, danh sách góc mặc định hiện, không chip Ghi nhận).
 *  In BẢNG luật → đạt/tổng. Dữ liệu thật 8591, chặn mọi lượt ghi. Chạy: node qc-thanh-ben-luat.mjs
 */
import puppeteer from "puppeteer-core";
import { phienQC } from "./xacminh-dang-nhap.mjs";
const PH = phienQC(); const ngu = (ms) => new Promise((r) => setTimeout(r, ms)); await ngu(6000);
const D = await (await fetch("http://127.0.0.1:8591/api/du-lieu", { headers: { "x-hx-phien": PH } })).json();
const coCam = (p) => p.bc && (p.bc.clip || (p.bc.moc || []).length);
const tvVL = D.phieu.find((p) => coCam(p) && p.lsKho && p.lsKho.ds.some((x) => x.vatLy) && p.goiY && (p.goiY.nv || []).length >= 3) || D.phieu.find((p) => coCam(p) && p.lsKho && p.lsKho.ds.some((x) => x.vatLy));
const tvKhong = D.phieu.find((p) => coCam(p) && p.lsKho && p.lsKho.ds.length && !p.lsKho.ds.some((x) => x.vatLy));
const tvGy = D.phieu.find((p) => p.goiY && (p.goiY.nv || []).length >= 3);
const mayGoc = D.luot.find((l) => (l.gocPhu || []).length), mayKhong = D.luot.find((l) => !(l.gocPhu || []).length && (l.video || []).length);
console.log("mẫu: tác vụ có ngoài WMS", tvVL && tvVL.id, "· không", tvKhong && tvKhong.id, "· ≥3 gợi ý", tvGy && tvGy.id, "· máy có góc", mayGoc && mayGoc.id, "· không góc", mayKhong && mayKhong.id);
const B = {}; const ghi = (luat, cay, ok, ct) => { (B[luat] ||= { dat: 0, tong: 0, sai: [] }); B[luat].tong++; if (ok) B[luat].dat++; else B[luat].sai.push(cay + (ct ? " " + JSON.stringify(ct).slice(0, 160) : "")); };
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
async function moTrang(w, h, mob) {
  const p = await b.newPage(); const loi = []; p.on("pageerror", (e) => loi.push(e.message)); p.__loi = loi;
  await p.evaluateOnNewDocument((hx) => { try { localStorage.setItem("hx-phien", hx); localStorage.setItem("tk-phien", "qc"); localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: { id: "qc" }, quyen: { "r.xacminh": "lam" } })); } catch (e) {}
    window.__LS = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__LS.push(e.value); }).observe({ type: "layout-shift", buffered: true }); } catch (e) {} }, PH);
  await p.setViewport({ width: w, height: h, isMobile: mob, hasTouch: mob, deviceScaleFactor: mob ? 2 : 1 });
  await p.setRequestInterception(true); p.on("request", (r) => (/script.google/.test(r.url()) || (r.method() !== "GET" && r.method() !== "OPTIONS") ? r.abort() : r.continue()));
  await p.goto("http://localhost:8123/kiemsoatkho/?tab=xacminh", { waitUntil: "networkidle2", timeout: 60000 });
  await p.waitForFunction(() => window.HXACMINH && window.__HX_MUC, { timeout: 60000 }); return p;
}
const mo = async (p, sub, fn, id) => { await p.evaluate((s) => window.HXACMINH.sub(s), sub); await ngu(1200); await p.evaluate(() => { window.__LS.length = 0; }); await p.evaluate((fn, id) => window.HXACMINH[fn](id), fn, id); await ngu(2200); };
const vuot = async (p, x, y) => { await p.touchscreen.touchStart(x, y); for (let k = 1; k <= 10; k++) await p.touchscreen.touchMove(x, y - k * 22); await p.touchscreen.touchEnd(); await ngu(450); };
for (const [w, h] of [[360, 780], [390, 844], [414, 896]]) {
  const p = await moTrang(w, h, true), C = "dt-" + w;
  for (const [tab, sub, fn, ids] of [["tacvu", "treo", "moPhieuId", [tvVL, tvKhong, tvGy].filter(Boolean).map((x) => x.id)], ["may", "cam", "moLuotId", [mayGoc, mayKhong].filter(Boolean).map((x) => x.id)]]) {
    for (const id of [...new Set(ids)]) {
      const cay = C + " " + tab + " " + id; await mo(p, sub, fn, id);
      const x = await p.evaluate((tab) => { const q = (s) => document.querySelector(s), R = (e) => e && e.getBoundingClientRect(), V = (e) => !!e && R(e).height > 0;
        const hd = q("#modal .modal-head"), hr = R(hd), t1 = R(q("#mTitle .hx-mt1")), d = R(q("#mClose")), g = R(q("#gcNut"));
        const chip = [...document.querySelectorAll("#mBody .hx-ng-hang .hx-qd-nguon>*")].filter(V), top = chip.map((e) => Math.round(R(e).top));
        const vl = document.querySelectorAll("#mBody .hx-lan.vl").length;
        const dong = [...document.querySelectorAll("#mBody .hx-qd-ls:not(#lvGocDs) .hx-lan:not(.vl) .hx-lan-hang")].map((e) => e.textContent.trim());
        const nv = [...document.querySelectorAll("#mBody .hx-qd-ls:not(#lvGocDs) .hx-nv")].map((e) => ({ t: e.textContent.trim(), c: e.className }));
        const gyNut = q("#mBody .hx-gy-them"), gyHien = [...document.querySelectorAll("#mBody [data-tp=goiy] .hx-nv")].filter(V).length;
        const th = [...document.querySelectorAll("#mBody .hx-tl-hang")].find(V), tc = th && [th.querySelector(".hx-tl"), th.querySelector("#hxPlay"), ...th.querySelectorAll(".hx-toc button")].filter(Boolean).map((e) => Math.round(R(e).top + R(e).height / 2));
        return { dau: !!(t1 && d && Math.abs(t1.left - hr.left - parseFloat(getComputedStyle(hd).paddingLeft)) <= 2 && Math.abs(d.right - hr.right + parseFloat(getComputedStyle(hd).paddingRight)) <= 2 && (!g || g.right <= d.left + 1)),
          headerAn: R(q("header")).bottom <= 1, chip: chip.map((e) => e.textContent.trim().replace(/\s*\d+$/, "")), motHang: top.length ? Math.max(...top) - Math.min(...top) <= 1 : true, vl,
          ghiAn: ["anh", "thongtin", "loi", "goiy", "seghi"].map((k) => q("#mBody [data-tp=" + k + "]")).filter(Boolean).every((e) => !V(e)),
          gocAn: !q("#lvGocDs") || !V(q("#lvGocDs")), dong, nv, gy: { hien: gyHien, nut: gyNut && gyNut.textContent },
          qdTinh: getComputedStyle(q("#mBody [data-tp=quyetdinh]")).position === "static", tlHang: tc ? Math.max(...tc) - Math.min(...tc) <= 4 : null,
          ngang: document.documentElement.scrollWidth - innerWidth, cls: +window.__LS.reduce((a, z) => a + z, 0).toFixed(3) }; }, tab);
      ghi("R1 đầu thanh: tên trái, Ghi chú · Đóng phải", cay, x.dau); ghi("R2 mở thanh → đầu trang ẩn", cay, x.headerAn);
      const thuTu = tab === "tacvu" ? ["Ghi nhận", "Tác động WMS", "Không qua WMS"] : ["Ghi nhận", "Góc camera"];
      ghi("R5 hàng chip 1 hàng, đúng thứ tự", cay, x.motHang && x.chip.every((c, i, a) => !i || thuTu.indexOf(c.replace(/ \(.*/, "")) > thuTu.indexOf(a[i - 1].replace(/ \(.*/, ""))), x.chip);
      ghi("R6 chip ẩn khi không có dữ liệu", cay, tab === "tacvu" ? (x.vl > 0) === x.chip.includes("Không qua WMS") : (id === (mayGoc && mayGoc.id)) === x.chip.some((c) => /^Góc camera/.test(c)), { vl: x.vl, chip: x.chip });
      ghi("R7 Ghi nhận mặc định ẩn", cay, x.ghiAn); ghi("R8 Góc camera mặc định ẩn (điện thoại)", cay, x.gocAn);
      if (tab === "tacvu" && x.dong.length) ghi("R9 dòng tác động: số lượng · loại · vị trí nguồn đủ · ghi chú", cay, x.dong.every((t) => /^\d+ cái · [^·]+( · F0-[A-Z0-9-]+( [(][0-9]+[)])?)?( · .+)?$/.test(t)) && x.dong.some((t) => / · F0-/.test(t)), x.dong.slice(0, 2));
      if (x.nv.length) ghi("R10 tên NV [email|trạng thái] tô màu", cay, x.nv.every((n) => /\[@[^\]|\s]+ \|(Active|Pending|Inactive)\]/.test(n.t) && /tt-(active|pending|inactive)/.test(n.c)), x.nv[0]);   // 21/10 user: mẫu «Tên [@hamlx |Active]» (bỏ phần sau @)
      if (tab === "tacvu" && tvGy && id === tvGy.id) ghi("R11 Máy gợi ý ≤2 + «+N»", cay, x.gy.hien <= 2 && /^\+\d+ người khác$/.test(x.gy.nut || ""), x.gy);
      ghi("R12 Quyết định không dính đáy", cay, x.qdTinh); if (x.tlHang !== null) ghi("R13 thanh thời gian + Tự động/×1 cùng hàng", cay, x.tlHang);
      ghi("R14 mở / chuyển mục không giật (CLS ≤ 0,01)", cay, x.cls <= 0.01, x.cls); ghi("R15 không cuộn ngang", cay, x.ngang <= 0, x.ngang);
      /* R7b bấm Ghi nhận → hiện; R8b Góc camera bấm hiện */
      const bam = await p.evaluate(async () => { const V = (e) => !!e && e.getBoundingClientRect().height > 0, n = document.querySelector("#mBody [data-anhgn]"); if (!n) return null; n.click(); await new Promise((z) => setTimeout(z, 350));
        const r = { anh: V(document.querySelector("#mBody [data-tp=anh]")) }; n.click(); await new Promise((z) => setTimeout(z, 200)); const g = document.querySelector("#mBody [data-gocchip]"); if (g) { g.click(); await new Promise((z) => setTimeout(z, 350)); r.goc = V(document.getElementById("lvGocDs")); g.click(); } return r; });
      if (bam) { ghi("R7b bấm Ghi nhận → hiện", cay, bam.anh); if (bam.goc !== undefined) ghi("R8b bấm Góc camera → hiện", cay, bam.goc); }
      /* R3 + R4: vuốt 1 lần ăn ngay, clip dính dưới đầu thanh */
      const t0 = await p.evaluate(() => { const bx = document.querySelector("#modal .modal-box"); bx.scrollTop = 0; const c = document.querySelector("#mBody [data-tp=clip]").getBoundingClientRect(); return { tran: bx.scrollHeight - bx.clientHeight, x: Math.round(c.left + c.width / 2), y: Math.round(Math.min(innerHeight - 60, c.bottom + 90)) }; });
      if (t0.tran > 30) { await vuot(p, t0.x, t0.y); const y = await p.evaluate(() => { const bx = document.querySelector("#modal .modal-box"), hd = document.querySelector("#modal .modal-head").getBoundingClientRect(), c = document.querySelector("#mBody [data-tp=clip]").getBoundingClientRect(); return { st: bx.scrollTop, dinh: Math.abs(c.top - hd.bottom) <= 2 }; });
        ghi("R4 vuốt 1 lần là cuộn", cay, y.st > 20, y.st); ghi("R3 clip dính trên khi cuộn", cay, y.dinh); }
      /* R2b đóng → đầu trang hiện lại */
      await p.evaluate(() => document.getElementById("mClose").click()); await ngu(600);
      ghi("R2b đóng thanh → đầu trang hiện lại", cay, await p.evaluate(() => document.querySelector("header").getBoundingClientRect().bottom > 20));
    }
  }
  if (p.__loi.length) ghi("R16 không lỗi trang", C, false, p.__loi.slice(0, 2)); else ghi("R16 không lỗi trang", C, true);
  await p.close();
}
/* WEB 1366 — Theo máy: ảnh giữ cỡ khi bật/tắt danh sách góc; danh sách góc mặc định hiện; không chip Ghi nhận */
{ const p = await moTrang(1366, 768, false); await mo(p, "cam", "moLuotId", mayGoc.id);
  const x = await p.evaluate(async () => { const V = (e) => !!e && e.getBoundingClientRect().height > 0, a = document.querySelector("#mBody [data-tp=anh] img"), ds = document.getElementById("lvGocDs"), n = document.querySelector("#mBody [data-gocchip]");
    const r = { hienMacDinh: V(ds), chipGhi: V(document.querySelector("#mBody [data-anhgn]")), anh1: Math.round(a.getBoundingClientRect().height) }; n.click(); await new Promise((z) => setTimeout(z, 500)); r.anSauBam = !V(ds); r.anh2 = Math.round(a.getBoundingClientRect().height);
    n.click(); await new Promise((z) => setTimeout(z, 500)); r.anh3 = Math.round(a.getBoundingClientRect().height); r.dsCuon = ds.scrollHeight - ds.clientHeight; r.bxTran = document.querySelector("#modal .modal-box").scrollHeight - document.querySelector("#modal .modal-box").clientHeight; return r; });
  ghi("W1 web Theo máy: ảnh giữ cỡ khi bật/tắt danh sách góc", "web-1366", x.anh1 === x.anh2 && x.anh2 === x.anh3, x); ghi("W2 web: danh sách góc mặc định hiện, chip ẩn/hiện", "web-1366", x.hienMacDinh && x.anSauBam, x);
  ghi("W3 web Theo máy: không chip Ghi nhận", "web-1366", !x.chipGhi); ghi("W4 web: danh sách góc cuộn riêng, thanh không cuộn", "web-1366", x.bxTran <= 1, x);
  await p.close(); }
await b.close();
let d = 0, t = 0; console.log("\nLUẬT | đạt/tổng | trượt");
for (const [k, v] of Object.entries(B)) { d += v.dat; t += v.tong; console.log(k + " | " + v.dat + "/" + v.tong + (v.sai.length ? " | " + v.sai.slice(0, 2).join(" ; ") : "")); }
console.log("TỔNG " + d + "/" + t); process.exit(d === t ? 0 : 1);
