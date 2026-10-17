/**
 * qc-thanh-ben-xacminh.mjs — đo THANH BÊN PHẢI «Quyết định phiếu» ở Xác minh › Theo tác vụ (16/10, mẫu khung việc HasakiWork),
 *  dữ liệu THẬT từ 8591, chặn mọi lượt ghi ở tầng mạng.
 *  T1 bấm dòng → thanh mở sát mép phải, không phủ nền · T2 khi thanh đang mở, chuột bấm THẬT vào dòng khác bên trái → đổi nội dung tại chỗ,
 *  thanh không đóng · T3 dòng đang xem được tô, dòng cũ bỏ tô · T4 Esc → thanh ẩn vô, bỏ tô, #modal trả về hộp giữa cho pop-up khác
 *  · T5 không kéo ngang · T6 điện thoại: thanh phủ hết bề ngang, nút Đóng ≥44px · T7 không lỗi trang.
 *  Chạy: node qc-thanh-ben-xacminh.mjs [--anh=thư mục]
 */
import puppeteer from "puppeteer-core";
import { phienQC } from "./xacminh-dang-nhap.mjs"; const PHIEN_QC = phienQC();
const A = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const MAY = [{ ten: "may-tinh-1600", w: 1600, h: 900, mob: false }, { ten: "may-tinh-1366", w: 1366, h: 768, mob: false }, { ten: "iphone", w: 390, h: 844, mob: true }];
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
const loi = []; let dat = 0; const ok = (dk, ten) => { if (dk) dat++; else loi.push(ten); };
for (const m of MAY) {
  const p = await b.newPage(); await p.evaluateOnNewDocument((hx) => { try { if (hx) localStorage.setItem("hx-phien", hx); localStorage.removeItem("hx-loc");
    /* Xác minh chỉ mở với tài khoản có quyền r.xacminh — phiên tài khoản QC giả như qc-dong-bo-antd (lượt kiểm phiên là POST, bị chặn) */
    localStorage.setItem("tk-phien", "qc"); localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: { id: "qc", ten: "QC", vaiTro: "quantri" }, quyen: { "r.xacminh": "lam" } })); } catch (e) {} }, PHIEN_QC);
  await p.setViewport({ width: m.w, height: m.h, deviceScaleFactor: 1, isMobile: m.mob, hasTouch: m.mob });
  const con = []; p.on("pageerror", (e) => con.push(e.message));
  await p.setRequestInterception(true); p.on("request", (r) => (r.method() !== "GET" && r.method() !== "OPTIONS" ? r.abort() : r.continue()));
  await p.goto("http://localhost:8123/kiemsoatkho/?tab=xacminh", { waitUntil: "networkidle2", timeout: 60000 });
  await p.waitForFunction(() => window.HXACMINH && window.__HX_MUC, { timeout: 30000 });
  await p.evaluate(() => window.HXACMINH.sub("treo"));
  await p.waitForFunction(() => [...document.querySelectorAll("#hxBody [data-p]")].filter((e) => e.getBoundingClientRect().height > 0).length >= 3, { timeout: 30000 });
  const ids = await p.evaluate(() => [...document.querySelectorAll("#hxBody [data-p]")].filter((e) => e.getBoundingClientRect().height > 0).slice(0, 3).map((e) => e.dataset.p));
  const diem = (id) => p.evaluate((id) => { const r = [...document.querySelectorAll('#hxBody [data-p="' + id + '"]')].find((e) => e.getBoundingClientRect().height > 0);
    r.scrollIntoView({ block: "center" }); const c = (r.querySelector("td, .cl-body") || r).getBoundingClientRect(); return { x: c.left + Math.min(40, c.width / 2), y: c.top + Math.min(20, c.height / 2) }; }, id);
  const tt = () => p.evaluate(() => { const M = document.getElementById("modal"), bx = M.querySelector(".modal-box").getBoundingClientRect();
    return { show: M.classList.contains("show"), ben: M.classList.contains("hx-ben"), vis: getComputedStyle(M).visibility, trai: Math.round(bx.left), phai: Math.round(bx.right), mep: document.documentElement.clientWidth, rong: Math.round(bx.width),
      nen: getComputedStyle(M).backgroundColor, hien: getComputedStyle(M).display !== "none" && getComputedStyle(M).visibility === "visible", tieuDe: document.getElementById("mTitle").textContent, to: [...document.querySelectorAll(".tb-dangxem")].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.dataset.p || e.dataset.lid),
      ngang: document.documentElement.scrollWidth - innerWidth, dong: Math.round(document.getElementById("mClose").getBoundingClientRect().height) }; });
  const benTrai0 = await p.evaluate(() => document.body.classList.contains("side-open"));
  const boCuc = () => p.evaluate(() => { const R = (s) => { const e = document.querySelector(s); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) } : null; };
    const img = document.getElementById("qdAnhGN");
    return { vh: innerHeight, xem: R("#mBody .hx-qd-xem"), khung: R("#mBody [data-khung]"), anh: R("#mBody .hx-qd-anh"), ben: R("#mBody .hx-qd-ben"), ls: R("#mBody .hx-qd-ls"), luu: R("#qdLuu"), qd: R("#mBody .hx-qd-form>.hx-qd-o"), gc: R("#mBody .hx-qd-form>.hx-qd-o:nth-child(2)"),
      lans: (() => { const L = document.querySelector("#mBody .hx-qd-ls .hx-lans"); if (!L) return null; const c = L.children;
        return { n: c.length, cao: Math.round(L.clientHeight), cuon: L.scrollHeight - L.clientHeight, nam: c.length > 5 ? Math.round(c[5].getBoundingClientRect().top - c[0].getBoundingClientRect().top) : null }; })(),
      thanCuon: (() => { const bx = document.querySelector("#modal .modal-box"); return bx.scrollHeight - bx.clientHeight; })(),
      xdau: R("#mBody .hx-xdau"),
      hoMo: (() => { const d = [...document.querySelectorAll("#mBody .hx-qd-ben>div.hx-qd-o")].map((e) => e.getBoundingClientRect()).filter((r) => r.height); return d.length > 1 ? Math.round(Math.max(...d.slice(1).map((r, i) => r.top - d[i].bottom))) : 0; })(),
      luiChu: (() => { const l = document.querySelector("#qdKhung .hx-lui"); return l ? !!document.querySelector("#qdKhung .hx-lui-pd") : null; })(),
      anhTai: !!(img && img.complete && img.naturalWidth), nguon: [...document.querySelectorAll("#mBody .hx-qd-nguon button")].map((b) => b.textContent.trim()),
      tran: [...document.querySelectorAll("#mBody *")].filter((e) => { const r = e.getBoundingClientRect(), bx = document.querySelector("#modal .modal-box").getBoundingClientRect(); return r.width && r.right > bx.right + 1 && !e.closest(".hx-qd-nguon"); }).length }; });
  // T1 mở bằng chuột thật
  let d0 = await diem(ids[0]); await p.mouse.click(d0.x, d0.y); await ngu(600);
  const t1 = await tt();
  ok(t1.show && t1.ben && t1.vis === "visible", m.ten + ": T1 thanh mở (" + JSON.stringify([t1.show, t1.ben, t1.vis]) + ")");
  ok(Math.abs(t1.phai - t1.mep) <= 17, m.ten + ": T1 sát mép phải (phải=" + t1.phai + "/" + t1.mep + ")");
  ok(/rgba\(0, 0, 0, 0\)|transparent/.test(t1.nen), m.ten + ": T1 không phủ nền (" + t1.nen + ")");
  if (!m.mob) ok(t1.trai > 300, m.ten + ": T1 còn chỗ bên trái để bấm dòng (trái=" + t1.trai + ")");
  else ok(t1.rong >= m.w - 1 && t1.dong >= 44, m.ten + ": T6 điện thoại phủ ngang, nút Đóng " + t1.dong + "px");
  if (m.mob) { const thap = await p.evaluate(() => [...document.querySelectorAll("#mBody .hx-qd-nguon button, #mBody .hx-lan, #qdLuu")].filter((e) => e.getBoundingClientRect().height && e.getBoundingClientRect().height < 40).map((e) => e.textContent.trim().slice(0, 20)));
    ok(!thap.length, m.ten + ": T6 vùng chạm ≥40px " + thap); }
  ok(t1.to.length === 1 && t1.to[0] === ids[0], m.ten + ": T3 tô dòng đang xem " + t1.to);
  if (A.anh) await p.screenshot({ path: A.anh + "/thanh-ben-" + m.ten + "-1.png" });
  if (!m.mob) {
    await ngu(400);
    const t8 = await p.evaluate(() => { const vh = innerHeight, bot = (s) => { const e = document.querySelector(s); return e ? Math.min(vh, e.getBoundingClientRect().bottom) : 0; };
      const xem = document.querySelector("#mBody .hx-qd-xem"), ls = document.querySelector("#mBody .hx-qd-ls"), trai = 0, phai = ls ? Math.max(0, ls.getBoundingClientRect().top - xem.getBoundingClientRect().bottom - 20) : 0;   // danh sách lượt nằm NGAY dưới video
      const to = [...document.querySelectorAll("#mBody *")].filter((e) => !e.closest(".hx-mt1,.hx-pd,.hx-qd-ls .lbl,.hx-qd-anh .lbl") && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && e.getBoundingClientRect().width)
        .map((e) => [parseFloat(getComputedStyle(e).fontSize), e.className || e.tagName]).filter((x) => x[0] > 13);
      return { side: document.body.classList.contains("side-open"), trong: Math.round(Math.abs(trai - phai) / vh * 100), to: to.slice(0, 4), trai: Math.round(document.querySelector("#modal .modal-box").getBoundingClientRect().left) }; });
    ok(!t8.side, m.ten + ": T8 mở thanh phải thì thanh trái tự thu");
    ok(t8.trai <= 430, m.ten + ": T8 thanh phải rộng sang trái (mép trái=" + t8.trai + ")");
    ok(!t8.to.length, m.ten + ": T9 chữ ≤13px (bộ antd, gọn như work.hasaki) (" + JSON.stringify(t8.to) + ")");
  }
  /* 16/10 (4) user: Quyết định ⇄ «Ai tác động» đổi chỗ; Ảnh ghi nhận lôi ra đứng TRÊN «Ai tác động» để xem camera + đối chiếu ảnh cùng lúc */
  await p.waitForFunction(() => { const i = document.getElementById("qdAnhGN"); return !i || (i.complete && i.naturalWidth); }, { timeout: 15000 }).catch(() => {});   // chờ ảnh ghi nhận tải xong rồi mới đo T13
  const bc = await boCuc();
  if (!m.mob) {
    /* 17/10 (5) user: dưới clip là «Ai tác động» (cột trái) · Lỗi / Máy gợi ý / Quyết định dưới Ảnh ghi nhận (cột phải) */
    ok(bc.ben && bc.ben.r <= bc.xem.l + 1 && (!bc.anh || bc.ben.t >= bc.anh.b - 1), m.ten + ": T10 Quyết định cột TRÁI (17/10 (7) đổi bên), DƯỚI Ảnh ghi nhận " + JSON.stringify([bc.xem, bc.anh, bc.ben]));
    ok(!bc.ls || (Math.abs(bc.ls.l - bc.xem.l) <= 2 && bc.ls.t >= bc.xem.b - 1), m.ten + ": T11 «Ai tác động» dưới clip, cùng cột trái " + JSON.stringify([bc.xem, bc.ls]));
    ok(!bc.anh || (bc.anh.r <= bc.xem.l + 1 && Math.abs(bc.anh.t - bc.xem.t) <= 2), m.ten + ": T11 Ảnh ghi nhận cột TRÁI, cùng mép trên clip " + JSON.stringify([bc.anh, bc.xem]));
    ok(!bc.anh || !bc.khung || (bc.anh.t < bc.vh && bc.khung.t < bc.vh && bc.anhTai), m.ten + ": T13 video + ảnh ghi nhận cùng hiện một màn (ảnh tải được=" + bc.anhTai + ")");
    ok(bc.luu && bc.gc && Math.abs(bc.luu.b - bc.gc.b) <= 4 && bc.qd && bc.qd.b <= bc.gc.t + 1, m.ten + ": T14 Quyết định trên · Gán người khác + Lưu cùng một hàng (cột phải hẹp)");
  } else {
    const thu = ["xem", "ls", "anh", "ben"].filter((k) => bc[k]).map((k) => bc[k].t);   // 17/10 (5) xếp chồng theo khung: trái (clip, ai tác động) → phải (ảnh … quyết định)
    ok(thu.every((t, i) => !i || t > thu[i - 1]), m.ten + ": T16 điện thoại xếp video → ai tác động → ảnh ghi nhận → quyết định " + JSON.stringify(thu));
  }
  ok(!bc.nguon.includes("Ảnh ghi nhận"), m.ten + ": T12 thanh nguồn không còn nút «Ảnh ghi nhận» trùng (" + bc.nguon.join(", ") + ")");
  if (bc.anh) {   // T15 bấm ảnh → phóng to; Esc đóng phóng to, thanh vẫn mở
    await p.evaluate(() => document.getElementById("qdAnhGN").click()); await ngu(500);
    const lb = await p.evaluate(() => document.getElementById("lightbox").classList.contains("show"));
    await p.keyboard.press("Escape"); await ngu(400);
    const sau = await p.evaluate(() => [document.getElementById("lightbox").classList.contains("show"), document.getElementById("modal").classList.contains("show")]);
    ok(lb && !sau[0] && sau[1], m.ten + ": T15 bấm ảnh ghi nhận mở phóng to, Esc đóng phóng to mà thanh vẫn mở " + JSON.stringify([lb, sau]));
  }
  if (!m.mob) {
    // T2 bấm dòng khác KHI thanh đang mở
    const d1 = await diem(ids[1]);
    const trungDong = await p.evaluate((x, y, id) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('[data-p="' + id + '"]')); }, d1.x, d1.y, ids[1]);
    ok(trungDong, m.ten + ": T2 điểm bấm dòng 2 không bị thanh/nền che");
    await p.mouse.click(d1.x, d1.y); await ngu(600);
    const t2 = await tt();
    ok(t2.show && t2.vis === "visible", m.ten + ": T2 thanh vẫn mở khi đổi dòng");
    ok(t2.to.length === 1 && t2.to[0] === ids[1], m.ten + ": T3 tô chuyển sang dòng 2 (" + t2.to + ")");
    ok(t2.tieuDe !== t1.tieuDe || ids[0] === ids[1], m.ten + ": T2 nội dung đổi (" + t1.tieuDe + " → " + t2.tieuDe + ")");
    ok(t2.ngang <= 1, m.ten + ": T5 kéo ngang " + t2.ngang);
    const cat = await p.evaluate(() => { const bx = document.querySelector("#modal .modal-box").getBoundingClientRect();
      return [...document.querySelectorAll("#mBody .hx-qd-nguon button, #mBody .hx-vl-tt")].filter((e) => { const r = e.getBoundingClientRect(), k = e.closest(".hx-qd-xem").getBoundingClientRect();
        return r.width && (r.right > Math.min(bx.right, k.right) + 1 || e.scrollWidth > e.clientWidth + 1); }).map((e) => e.textContent.trim()); });
    ok(!cat.length, m.ten + ": T5 nút nguồn bị cắt " + cat);
    if (A.anh) await p.screenshot({ path: A.anh + "/thanh-ben-" + m.ten + "-2.png" });
  }
  if (m.ten === "may-tinh-1366") {   // T17 quét MỌI phiếu đang hiện: không lỗi, không tràn, không nút ảnh trùng, bố cục 2 cột đúng ở mọi kiểu phiếu
    for (let k = 0; k < 10 && await p.evaluate(() => { const t = document.getElementById("hxThem"); if (t) t.click(); return !!t; }); k++) await ngu(500);   // mở hết «Xem thêm»
    const tatCa = await p.evaluate(() => [...new Set([...document.querySelectorAll("#hxBody [data-p]")].map((e) => e.dataset.p))]);
    const dem = { anh: 0, khongAnh: 0, khongCam: 0, coLs: 0 }, hong = [];
    for (const id of tatCa) {
      await p.evaluate((id) => window.HXACMINH.moPhieuId(id), id); await ngu(350);
        await p.waitForFunction(() => { const k = document.querySelector("#mBody [data-khung]"), a = document.querySelector("#mBody .hx-qd-anh.khoa"); return !k || !a || Math.abs(k.getBoundingClientRect().height - a.getBoundingClientRect().height) <= 2; }, { timeout: 3000 }).catch(() => {}); 
      const x = await boCuc(); const ngang = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      x.anh ? dem.anh++ : dem.khongAnh++; if (!x.khung) dem.khongCam++; if (x.ls) dem.coLs++;
      const sai = [];
      /* 16/10 (6): «Ai tác động» chỉ 5 dòng, còn lại cuộn RIÊNG; hàng nguồn dưới clip; Quyết định gọn; Dải 72 giờ có chú thích */
      /* «Ai tác động» tối đa 5 dòng; thiếu chỗ thì co lại vừa đáy thanh — vẫn cuộn riêng, không bắt cuộn cả thanh (T20) */
      if (x.lans && x.lans.n > 5 && (x.lans.cao > x.lans.nam + 2 || x.lans.cuon < 10)) sai.push("Ai tác động không gói ≤5 dòng " + JSON.stringify(x.lans));
      if (x.thanCuon > 2) { dem.thanCuon = (dem.thanCuon || 0) + 1; (dem.cuon ||= []).push(id + ":" + x.thanCuon + "px trái" + (x.ben ? x.ben.b : "?") + "/phải" + (x.ls ? x.ls.b : x.anh ? x.anh.b : "?") + "/vh" + x.vh); }
      if (x.xdau && x.khung && x.xdau.t < x.khung.b - 1) sai.push("hàng nguồn không nằm dưới clip");
      if (x.hoMo > 12) sai.push("Lỗi/Máy gợi ý cách nhau " + x.hoMo + "px");
      if (x.luiChu === false) sai.push("Dải 72 giờ thiếu chú thích");
      if (x.luiChu) dem.dai72 = (dem.dai72 || 0) + 1;
      if (x.anh && x.khung && x.anh.l >= x.khung.r - 1) { dem.khoaAnh = (dem.khoaAnh || 0) + 1;   // T22 ảnh ghi nhận khoá = khung camera
        if (Math.abs(x.anh.t - x.khung.t) > 2) sai.push("ảnh ghi nhận lệch mép trên khung camera " + JSON.stringify([x.anh, x.khung])); }   // 17/10 (5) ảnh 16:9 riêng, không còn khoá cao = camera
      if (x.luiChu && !dem.thuKhung) {   // T21 lưới 72 giờ: không dấu phẩy rơi, 9 khung bấm được, bấm → dòng báo thu hẹp hiện (POST bị chặn ở tầng mạng)
        const t21 = await p.evaluate(() => { const k = document.getElementById("qdKhung"), nut = k.querySelectorAll(".hx-lui button[data-o]");
          const phay = [...k.childNodes].concat([...(k.querySelector(".hx-lui") || k).childNodes]).some((n) => n.nodeType === 3 && /,/.test(n.textContent));
          if (nut[1]) nut[1].click(); const c = document.getElementById("qdLuiChu"); return { n: nut.length, phay, chu: c && !c.hidden ? c.textContent.trim() : "" }; });
        dem.thuKhung = t21.n + " khung · " + (t21.chu || "không hiện chữ").slice(0, 40);
        if (t21.phay || t21.n < 2 || !t21.chu) sai.push("lưới 72 giờ hỏng " + JSON.stringify(t21)); }
      if (x.nguon.includes("Ảnh ghi nhận")) sai.push("nút ảnh trùng");
      if (!x.khung && x.nguon.length) sai.push("khung ẩn mà còn nút nguồn");
      if (x.tran) sai.push("tràn " + x.tran);
      if (ngang > 1) sai.push("kéo ngang " + ngang);
      if (!x.ben || (x.anh && x.ben.t < x.anh.b - 1)) sai.push("quyết định không dưới ảnh ghi nhận");
      if (x.ls && x.xem && (Math.abs(x.ls.l - x.xem.l) > 2 || x.ls.t < x.xem.b - 1)) sai.push("ai tác động không dưới clip");
      /* T18 16/10 nguồn hàng từng lượt: dòng có sổ phải ghi nguồn + title chuỗi đầy đủ; ca mẫu user dán (06/10 06:43 Trương Thanh Bình) */
      const ng = await p.evaluate(() => { const rows = [...document.querySelectorAll("#mBody .hx-lan:not(.vl)")];
        const chung = (document.querySelector("#mBody .hx-ng-chung") || {}).textContent || "";
        return { n: rows.length, co: rows.filter((r) => r.querySelector(".hx-nguon-lan[title]")).length, thieuChu: rows.filter((r) => { const s = r.querySelector(".hx-nguon-lan"); return s && !chung && !/^\d+ cái · ./.test(s.textContent.trim()); }).length,
          mau: rows.map((r) => r.textContent.replace(/\s+/g, " ")).find((t) => /06\/10 06:43/.test(t) && /Trương Thanh Bình/.test(t)) || "" }; });
      const khung = await p.evaluate(() => [...document.querySelectorAll("#mBody .hx-nguon-lan")].filter((e) => { const c = getComputedStyle(e); return parseFloat(c.borderTopWidth) > 0 || parseFloat(c.paddingTop) > 2 || c.display === "grid"; }).length);
      if (khung) sai.push(khung + " dòng nguồn bị đóng khung (đụng lớp CSS)");
      dem.dong = (dem.dong || 0) + ng.n; dem.coNguon = (dem.coNguon || 0) + ng.co;
      if (ng.thieuChu) sai.push(ng.thieuChu + " dòng có sổ mà không ghi nguồn");
      if (ng.mau) { dem.mau = ng.mau; if (!/1 cái · Chuyển từ ô khác · 512-03-20-02/.test(ng.mau)) sai.push("ca mẫu sai nguồn: " + ng.mau); }
      if (sai.length) hong.push(id + ": " + sai.join(", "));
    }
    ok(!hong.length, m.ten + ": T17 quét " + tatCa.length + " phiếu " + JSON.stringify(dem) + (hong.length ? " — " + hong.slice(0, 4).join(" | ") : ""));
    ok(!!dem.mau, m.ten + ": T18 có ca mẫu 06/10 06:43 Trương Thanh Bình trong các phiếu đang mở (" + (dem.mau || "không thấy") + ")");
    ok(dem.coNguon >= dem.dong * 0.9, m.ten + ": T18 ≥90% dòng lượt có nguồn hàng (" + dem.coNguon + "/" + dem.dong + ")");
    console.log("  T17 " + tatCa.length + " phiếu: " + JSON.stringify(dem));
    ok(!dem.thanCuon, m.ten + ": T20 cả thanh bên không phải cuộn (" + (dem.thanCuon || 0) + "/" + tatCa.length + " phiếu phải cuộn cả thanh)");
  }
  // T4 Esc → ẩn vô
  await p.keyboard.press("Escape"); await ngu(150);
  const dangTruot = await p.evaluate(() => { const M = document.getElementById("modal"); return getComputedStyle(M).visibility === "visible" && M.classList.contains("hx-ben"); });
  await ngu(500);
  const t4 = await tt();
  ok(dangTruot, m.ten + ": T4 có nhịp trượt vô (chưa tắt ngay)");
  ok(!t4.show && !t4.ben && !t4.hien && !t4.to.length, m.ten + ": T4 đóng hẳn, bỏ tô, trả #modal (" + JSON.stringify([t4.show, t4.ben, t4.hien, t4.to]) + ")");
  ok(await p.evaluate(() => document.body.classList.contains("side-open")) === benTrai0, m.ten + ": T8 đóng thanh phải thì thanh trái về như cũ");
  /* ===== THEO MÁY (16/10 (7) user: thanh bên như Theo tác vụ) ===== */
  await p.evaluate(() => window.HXACMINH.sub("cam")); await ngu(800);
  await p.evaluate(() => { const s = document.querySelector("#hxFilters select, #hxFilters [data-k='tt']"); });
  const lids = await p.evaluate(() => [...new Set([...document.querySelectorAll("#hxBody [data-lid]")].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.dataset.lid))]);
  ok(lids.length >= 2, m.ten + ": M0 Theo máy có ≥2 sự việc để thử (" + lids.length + ")");
  if (lids.length >= 2) {
    const dL = (id) => p.evaluate((id) => { const r = [...document.querySelectorAll('#hxBody [data-lid="' + id + '"]')].find((e) => e.getBoundingClientRect().height > 0);
      r.scrollIntoView({ block: "center" }); const c = (r.querySelector("td, .cl-body") || r).getBoundingClientRect(); return { x: c.left + Math.min(40, c.width / 2), y: c.top + Math.min(20, c.height / 2) }; }, id);
    let d = await dL(lids[0]); await p.mouse.click(d.x, d.y); await ngu(700);
    await p.waitForFunction(() => { const i = document.getElementById("lvAnhGN"); return !i || (i.complete && i.naturalWidth); }, { timeout: 15000 }).catch(() => {});
    const m1 = await tt(), b1 = await boCuc();
    ok(m1.show && m1.ben && m1.vis === "visible" && /rgba\(0, 0, 0, 0\)|transparent/.test(m1.nen), m.ten + ": M1 Theo máy mở thanh bên, không phủ nền");
    ok(m1.to.length === 1 && m1.to[0] === lids[0], m.ten + ": M3 tô sự việc đang xem (" + m1.to + ")");
    ok(!!b1.anh && !!b1.khung, m.ten + ": M5 có khung camera + ảnh ghi nhận riêng");
    if (!m.mob) {
      /* 16/10 (8) user: Theo máy ảnh camera ngang → khối ảnh vừa khít tấm ảnh (không dải xám), «Người trong khung đỏ» sát ngay dưới; điều khiển + mốc 1 hàng; nút quyết cỡ theo chữ */
      const m6 = await p.evaluate(() => { const a = document.querySelector("#mBody .hx-qd-anh"), im = document.getElementById("lvAnhGN"), ng = document.querySelector("#mBody .hx-qd-nguoi .lbl");
        const ra = a.getBoundingClientRect(), ri = im.getBoundingClientRect(), xd = document.querySelector("#mBody .hx-xdau"), mc = document.querySelector("#mBody .hx-mocs");
        const nut = [...document.querySelectorAll("#mBody .hx-act button:not(.chinh)")].map((b) => b.getBoundingClientRect());   // 17/10 (2) «Lưu · lập phiếu» cả hàng dưới 3 chip — không tính
        return { xam: Math.round(ra.height - ri.height), cach: Math.round(ng.getBoundingClientRect().top - ra.bottom), motHang: !mc || Math.abs(xd.getBoundingClientRect().top - mc.getBoundingClientRect().top) <= 6 || mc.scrollWidth <= mc.clientWidth + 1, mocCat: mc ? mc.scrollWidth - mc.clientWidth : 0,
          nutRong: Math.round(Math.max(...nut.map((r) => r.width))), nutHang: new Set(nut.map((r) => Math.round(r.top))).size }; });
      ok(b1.anh && Math.abs(b1.anh.t - b1.khung.t) <= 2 && m6.xam <= 2, m.ten + ": M6 ảnh ghi nhận cùng mép trên clip, vừa khít ảnh " + JSON.stringify(m6));
      /* 16/10 (10) user «kích thước camera lệch so với thanh thời gian»: video và dải thời gian phải cùng mép trái/phải */
      /* 17/10 (3) user: điều khiển clip gọn, bên PHẢI ngang hàng thanh thời gian — thanh thời gian thẳng mép trái clip, điều khiển thẳng mép phải clip */
      const m13 = await p.evaluate(() => { const v = document.querySelector("#lvClip .hx-vwrap").getBoundingClientRect(), t = document.getElementById("hxTl").getBoundingClientRect(), c = document.querySelector("#lvClip .hx-xdau").getBoundingClientRect();
        return { trai: Math.round(v.left - t.left), phai: Math.round(v.right - c.right), hang: Math.round(Math.abs((t.top + t.bottom) / 2 - (c.top + c.bottom) / 2)), cao: Math.round(c.height) }; });
      ok(Math.abs(m13.trai) <= 1 && Math.abs(m13.phai) <= 1 && m13.hang <= 3 && m13.cao <= 28, m.ten + ": M13 điều khiển gọn ngang hàng thanh thời gian, thẳng mép clip " + JSON.stringify(m13));
      ok(m6.mocCat <= 1 && m6.nutHang <= 2, m.ten + ": M12 nút quyết không quá 2 hàng " + JSON.stringify(m6));
      /* 17/10 (3) user: gộp làm 1 khung DƯỚI cả hàng clip, trên xuống: Lỗi → Máy gợi ý/Là ai → Quyết định; bỏ «Người trong khung đỏ», câu hỏi, ảnh cắt nhỏ */
      const m7 = await p.evaluate(() => { const R = (e) => e && e.getBoundingClientRect(), cl = R(document.querySelector("#mBody [data-khung]")), an = R(document.querySelector("#mBody .hx-qd-anh"));
        const loi = document.querySelector("#mBody [data-mcb]"), ai = document.querySelector("#mBody [data-cb]"), qd = document.querySelector("#mBody .hx-qd-nut"); if (!loi || !ai || !qd) return null;
        const k = [loi, ai, qd].map((e) => e.closest(".hx-tb-khung"));
        return { motKhung: k[0] === k[1] && k[1] === k[2] && k[0] === document.querySelector("#mBody .hx-qd-anh").closest(".hx-tb-khung"), thuTu: R(loi).bottom <= R(ai).top + 1 && R(ai).bottom <= R(qd).top + 1, duoiHang: Math.round(R(loi).top - an.bottom),
          cauHoi: document.querySelectorAll("#mBody .hx-hoi").length, crop: document.querySelectorAll("#mBody .hx-crop").length, tieuDe: /Người trong khung đỏ/.test(document.getElementById("mBody").textContent) }; });
      ok(m7 && m7.motKhung && m7.thuTu && m7.duoiHang >= -1, m.ten + ": M7 Lỗi → Là ai → Quyết định dưới Ảnh ghi nhận, cùng khung (cột phải) " + JSON.stringify(m7));
      ok(m7 && !m7.cauHoi && !m7.crop && !m7.tieuDe, m.ten + ": M8 bỏ tiêu đề Người trong khung đỏ, câu hỏi, ảnh cắt " + JSON.stringify(m7));
      ok(!b1.nguon.length, m.ten + ": M9 không còn cụm nút nguồn (ảnh đã đứng riêng)");
      /* 17/10 (2) user: Sẽ ghi nhận dưới Ảnh ghi nhận · Quyết định dưới Máy gợi ý, 3 chip ngang hàng + Lưu ở dưới · mốc trên thanh thời gian · giờ không kèm «×3» */
      const m14 = await p.evaluate(() => { const R = (q) => { const e = document.querySelector(q); return e ? e.getBoundingClientRect() : null; };
        const an = R("#mBody .hx-qd-anh"), sg = R("#hxChot"), gy = R('#mBody [data-tp="dsnguoi"]'), qd = R('#mBody [data-tp="quyetdinh"]');
        const chip = [...document.querySelectorAll('#mBody .hx-act button:not(.chinh):not([data-qd="-1"])')].map((b) => b.getBoundingClientRect()), luu = R('#mBody .hx-act button.chinh');
        return { seghi: sg && an ? Math.round(sg.top - an.bottom) : null, sgL: sg && an ? Math.round(Math.abs(sg.left - an.left)) : null, qdDuoi: qd && gy ? Math.round(qd.top - gy.bottom) : null,
          chipHang: new Set(chip.map((r) => Math.round(r.top))).size, chipN: chip.length, luuDuoi: luu && chip.length ? Math.round(luu.top - Math.max(...chip.map((r) => r.bottom))) : null,
          mkn: document.querySelectorAll("#hxTl .mkn").length, buoc: document.querySelectorAll("#hxTl .mk").length, hangMoc: document.querySelectorAll("#mBody .hx-mocs").length, gio: document.getElementById("hxGio").textContent }; });
      ok(m14.seghi !== null && m14.seghi >= 0 && m14.sgL <= 2, m.ten + ": M14 Sẽ ghi nhận dưới Ảnh ghi nhận, cùng khung (canh giữa phần còn lại — 17/10 (4)) " + JSON.stringify(m14));
      ok(m14.qdDuoi !== null && m14.qdDuoi >= 0 && m14.chipN === 3 && m14.chipHang === 1 && m14.luuDuoi >= 0, m.ten + ": M15 Quyết định dưới Máy gợi ý, 3 chip ngang hàng, Lưu ở dưới " + JSON.stringify(m14));
      ok(m14.mkn === m14.buoc && !m14.hangMoc && !/×/.test(m14.gio), m.ten + ": M16 mốc là số trên thanh thời gian, bỏ hàng mốc riêng, giờ không kèm ×N " + JSON.stringify(m14));
      /* M17 (17/10 (8) user «dưới còn chỗ thì thả lên làm gì · hiệu ứng thả xuống»): ô Lỗi + ô Là ai — dưới đủ chỗ thì MỞ XUỐNG ngay dưới ô, có hiệu ứng popIn,
         nằm trong thanh; lăn chuột ngoài menu không cuộn khung nào · M19 có ✕ khi đã chọn, bấm ✕ thì xoá thật + mở lại danh sách */
      const vt = await p.evaluate(() => { const t = document.querySelector("#mBody [data-mcb]"); if (!t) return null; const r = t.getBoundingClientRect(); return { x: r.left + 20, y: r.top + 10 }; });
      if (vt) { await p.mouse.click(vt.x, vt.y); await ngu(400);
        const m17a = await p.evaluate(() => { const t = document.querySelector("#mBody [data-mcb]"), mn = t.parentNode.querySelector(".menu"), r = t.parentNode.getBoundingClientRect(), rm = mn.getBoundingClientRect(), bx = document.querySelector("#modal .modal-box").getBoundingClientRect();
          const C = document.querySelector("#mBody .hx-ds-ng"), duoi = bx.bottom - r.bottom - 12, can = Math.min(mn.scrollHeight, 240);
          return { mo: getComputedStyle(mn).display !== "none", xuong: Math.round(rm.top - r.bottom), duoi: Math.round(duoi), canXuong: duoi >= can, anim: getComputedStyle(mn).animationName,
            trong: rm.top >= bx.top - 1 && rm.left >= bx.left - 1 && rm.right <= bx.right + 1 && rm.bottom <= bx.bottom + 1, c0: C ? C.scrollTop : 0, b0: document.querySelector("#modal .modal-box").scrollTop }; });
        const giua = await p.evaluate(() => { const r = document.querySelector("#mBody .hx-ds-ng").getBoundingClientRect(); return { x: r.left + 10, y: r.bottom - 10 }; });
        await p.mouse.move(giua.x, giua.y); await p.mouse.wheel({ deltaY: 400 }); await ngu(300);
        const m17b = await p.evaluate(() => { const C = document.querySelector("#mBody .hx-ds-ng"); return { c1: C ? C.scrollTop : 0, b1: document.querySelector("#modal .modal-box").scrollTop }; });
        ok(m17a.mo && (!m17a.canXuong || (m17a.xuong >= 0 && m17a.xuong <= 8)) && m17a.anim === "popIn" && m17a.trong, m.ten + ": M17 menu Lỗi MỞ XUỐNG khi dưới đủ chỗ, hiệu ứng popIn, trong thanh " + JSON.stringify(m17a));
        ok(m17b.c1 === m17a.c0 && m17b.b1 === m17a.b0, m.ten + ": M18 menu đang mở thì các khung không cuộn " + JSON.stringify([m17a, m17b]));
        await p.keyboard.press("Escape").catch(() => {}); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await ngu(300);
        /* M19 ô Là ai: có ✕ khi đang có tên; bấm ✕ → ô trống, «Sẽ ghi nhận» báo chưa chọn NV, danh sách mở xuống. Chỉ trên trình duyệt (POST bị chặn) — không lưu gì. */
        const x19 = await p.evaluate(() => { const i = document.querySelector("#mBody [data-cb]"), x = i && i.parentNode.querySelector(".hx-cb-xoa"); if (!i || !x) return null;
          const r = x.getBoundingClientRect(); return { co: !!i.value && getComputedStyle(x).display !== "none" && r.width > 0, x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
        if (x19 && x19.co) { await p.mouse.click(x19.x, x19.y); await ngu(400);
          const m19 = await p.evaluate(() => { const i = document.querySelector("#mBody [data-cb]"), mn = i.parentNode.querySelector(".menu"), r = i.parentNode.getBoundingClientRect(), rm = mn.getBoundingClientRect();
            return { trong: i.value === "", mo: getComputedStyle(mn).display !== "none", xuong: Math.round(rm.top - r.bottom), chot: /chưa chọn NV/.test(document.getElementById("hxChot").textContent) }; });
          ok(m19.trong && m19.mo && m19.chot, m.ten + ": M19 bấm ✕ ở Là ai → xoá chọn, mở lại danh sách " + JSON.stringify(m19));
          await p.evaluate(() => document.activeElement && document.activeElement.blur()); await ngu(300); }
        else console.log("  M19 " + m.ten + ": Là ai đang trống ở sự việc này — chưa thử ✕"); }
      const d2 = await dL(lids[1]); const trung = await p.evaluate((x, y, id) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('[data-lid="' + id + '"]')); }, d2.x, d2.y, lids[1]);
      ok(trung, m.ten + ": M2 điểm bấm sự việc 2 không bị che");
      await p.mouse.click(d2.x, d2.y); await ngu(700);
      const m2 = await tt();
      ok(m2.show && m2.to.length === 1 && m2.to[0] === lids[1], m.ten + ": M2 thanh vẫn mở, tô chuyển sang sự việc 2 (" + m2.to + ")");
      ok(m2.ngang <= 1, m.ten + ": M4 không kéo ngang " + m2.ngang);
      if (A.anh) await p.screenshot({ path: A.anh + "/theo-may-" + m.ten + ".png" });
    } else if (A.anh) await p.screenshot({ path: A.anh + "/theo-may-" + m.ten + ".png" });
    if (m.ten === "may-tinh-1366") {   // M10 quét MỌI sự việc
      const tatL = await p.evaluate(() => [...new Set([...document.querySelectorAll("#hxBody [data-lid]")].map((e) => e.dataset.lid))]);
      const hongL = [], demL = { n: tatL.length, khoa: 0, thanCuon: 0 };
      for (const id of tatL) { await p.evaluate((id) => window.HXACMINH.moLuotId(id), id); await ngu(400);
        await p.waitForFunction(() => { const k = document.querySelector("#mBody [data-khung]"), a = document.querySelector("#mBody .hx-qd-anh.khoa"); return !k || !a || Math.abs(k.getBoundingClientRect().height - a.getBoundingClientRect().height) <= 2; }, { timeout: 3000 }).catch(() => {}); 
        const x = await boCuc(), ng = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), sai = [];
        if (x.anh && x.khung && x.anh.l >= x.khung.r - 1) { demL.khoa++; if (Math.abs(x.anh.t - x.khung.t) > 2) sai.push("ảnh lệch mép trên clip"); }
        if (x.tran) sai.push("tràn " + x.tran); if (ng > 1) sai.push("kéo ngang " + ng);
        const lech = await p.evaluate(() => { const v = document.querySelector("#lvClip .hx-vwrap"), t = document.getElementById("hxTl"); if (!v || !t) return 0; const a = v.getBoundingClientRect(), c = t.getBoundingClientRect(); return Math.abs(a.left - c.left); });
        if (lech > 1) sai.push("clip lệch dải thời gian " + Math.round(lech) + "px");
        if (x.thanCuon > 2) { const ct = await p.evaluate(() => { const C = document.querySelector("#mBody .hx-ds-ng"); if (!C) return null; const r = C.getBoundingClientRect();
            return { top: Math.round(r.top), cao: Math.round(r.height), max: C.style.maxHeight, sh: C.scrollHeight, the: C.children.length, chot: Math.round(document.getElementById("hxChot").getBoundingClientRect().height), anh: Math.round(document.querySelector("#mBody .hx-qd-anh").getBoundingClientRect().height) }; });
          (demL.ct ||= []).push(id + ":" + JSON.stringify(ct)); }
        if (x.thanCuon > 2) { demL.thanCuon++; demL.mau ||= { cuon: x.thanCuon, trai: x.ben && x.ben.b, phai: x.ls && x.ls.b, vh: x.vh, xem: x.xem, ben: x.ben }; }
        if (sai.length) hongL.push(id + ": " + sai.join(", ")); }
      ok(!hongL.length, m.ten + ": M10 quét " + tatL.length + " sự việc " + JSON.stringify(demL) + (hongL.length ? " — " + hongL.slice(0, 4).join(" | ") : ""));
      console.log("  M10 " + JSON.stringify(demL));
      ok(!demL.thanCuon, m.ten + ": M11 Theo máy không phải cuộn cả thanh (" + demL.thanCuon + "/" + tatL.length + ")");
    }
    await p.keyboard.press("Escape"); await ngu(600);
    const m4 = await tt();
    ok(!m4.show && !m4.ben && !m4.to.length, m.ten + ": M4 Esc đóng thanh Theo máy, bỏ tô");
  }
  ok(!con.length, m.ten + ": T7 lỗi trang " + con.slice(0, 2));
  await p.close();
}
await b.close();
console.log(loi.length ? "✗ " + dat + " đạt, " + loi.length + " lỗi:\n  " + loi.join("\n  ") : "✓ " + dat + "/" + dat + " đạt"); process.exit(loi.length ? 1 : 0);
