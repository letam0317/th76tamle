/**
 * qc-thanh-ben-vipham.mjs — đo THANH BÊN PHẢI của mục Vi phạm (16/10 user «làm như WF591 bên work.hasaki.vn»), dữ liệu thật của trang,
 *  chặn mọi lượt ghi ở tầng mạng.
 *  V1 bấm dòng → thanh mở sát mép phải, không phủ nền, thanh trái thu · V2 tiêu đề 2 dòng + «Mở task» cạnh Đóng · V3 dải bước: đúng 1 bước chọn,
 *  thân + cột phải theo bước đó · V4 đổi bước tại chỗ · V5 «Dữ liệu khai báo» đánh số 01… · V6 bấm dòng khác khi thanh mở → đổi nội dung, tô dòng
 *  · V7 ảnh bấm → phóng to, Esc đóng phóng to mà thanh vẫn mở · V8 Esc đóng thanh, bỏ tô, gỡ «Mở task», trả thanh trái · V9 quét mọi task: không lỗi,
 *  không tràn, không kéo ngang, chữ ≤16px, đúng 1 bước chọn · V10 điện thoại: phủ ngang, vùng chạm ≥40px.
 *  Chạy: node qc-thanh-ben-vipham.mjs [--anh=thư mục]
 */
import puppeteer from "puppeteer-core";
const A = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const MAY = [{ ten: "may-tinh-1600", w: 1600, h: 900, mob: false }, { ten: "may-tinh-1366", w: 1366, h: 768, mob: false }, { ten: "iphone", w: 390, h: 844, mob: true }];
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
const loi = []; let dat = 0; const ok = (dk, ten) => { if (dk) dat++; else loi.push(ten); };
for (const m of MAY) {
  const p = await b.newPage();
  await p.evaluateOnNewDocument(() => { try {   // phiên tài khoản QC giả như qc-dong-bo-antd (lượt kiểm phiên là POST, bị chặn)
    localStorage.setItem("tk-phien", "qc"); localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: { id: "qc", ten: "QC", vaiTro: "quantri" }, quyen: { "r.tong": "lam", "r.task": "lam", "r.hangmuc": "lam" } })); } catch (e) {} });
  await p.setViewport({ width: m.w, height: m.h, deviceScaleFactor: 1, isMobile: m.mob, hasTouch: m.mob });
  const con = []; p.on("pageerror", (e) => con.push(e.message));
  await p.setRequestInterception(true); p.on("request", (r) => (/^(GET|OPTIONS|HEAD)$/.test(r.method()) ? r.continue() : r.abort()));
  await p.goto("http://localhost:8123/kiemsoatkho/?tab=task", { waitUntil: "networkidle2", timeout: 90000 });
  await p.waitForFunction(() => [...document.querySelectorAll("#tbody tr[data-i], #cardList [data-i]")].filter((e) => e.getBoundingClientRect().height > 0).length >= 3, { timeout: 90000 });
  const hang = () => p.evaluate(() => [...document.querySelectorAll("#tbody tr[data-i], #cardList [data-i]")].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.dataset.i));
  const ds = await hang();
  const diem = (i) => p.evaluate((i) => { const r = [...document.querySelectorAll('#tbody [data-i="' + i + '"], #cardList [data-i="' + i + '"]')].find((e) => e.getBoundingClientRect().height > 0);
    r.scrollIntoView({ block: "center" }); const c = (r.querySelector("td, .cl-loi") || r).getBoundingClientRect(); return { x: c.left + Math.min(30, c.width / 2), y: c.top + Math.min(16, c.height / 2) }; }, i);
  const tt = () => p.evaluate(() => { const M = document.getElementById("modal"), bx = M.querySelector(".modal-box").getBoundingClientRect(), cs = getComputedStyle(M);
    const tab = [...document.querySelectorAll("#mBody .vp-tab")], on = tab.filter((t) => t.classList.contains("on"));
    const gd = [...document.querySelectorAll("#mBody .vp-gd-b")], coDL = tab.filter((t) => !t.classList.contains("trong")).map((t) => t.dataset.vpb);
    const nho = [...document.querySelectorAll("#modal .modal-box *")].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && e.getBoundingClientRect().width).map((e) => parseFloat(getComputedStyle(e).fontSize));
    return { show: M.classList.contains("show"), ben: M.classList.contains("hx-ben"), hien: cs.display !== "none" && cs.visibility === "visible", nen: cs.backgroundColor, trai: Math.round(bx.left), phai: Math.round(bx.right), rong: Math.round(bx.width), mep: document.documentElement.clientWidth,
      t1: (document.querySelector("#mTitle .vp-mt1") || {}).textContent || "", t2: (document.querySelector("#mTitle .vp-mt2") || {}).textContent || "", moTask: !!document.getElementById("hxMoTask"),
      nTab: tab.length, nOn: on.length, gdKhop: gd.length === coDL.length && gd.every((li, j) => li.dataset.vpgd === coDL[j] && li.querySelector(".vp-gd-ten") && li.querySelector(".vp-gd-cham")), nGd: gd.length,
      so: [...document.querySelectorAll("#mBody .vp-muc:not([data-vpb]) .vp-so")].map((e) => e.textContent), to: [...document.querySelectorAll(".tb-dangxem")].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.dataset.i),
      side: document.body.classList.contains("side-open"), ngang: document.documentElement.scrollWidth - innerWidth, chuTo: Math.max(0, ...nho),
      tran: [...document.querySelectorAll("#mBody *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > bx.right + 1 && !e.closest(".vp-buoc"); }).length,
      dong: Math.round(document.getElementById("mClose").getBoundingClientRect().height), dauTran: [document.getElementById("mClose"), document.getElementById("hxMoTask")].filter((e) => e && e.getBoundingClientRect().right > bx.right + 1).length, tabCao: Math.min(99, ...tab.map((t) => t.getBoundingClientRect().height)) }; });
  const ben0 = await p.evaluate(() => document.body.classList.contains("side-open"));
  let d = await diem(ds[0]); await p.mouse.click(d.x, d.y); await ngu(700);
  const v1 = await tt();
  ok(v1.show && v1.ben && v1.hien && /rgba\(0, 0, 0, 0\)|transparent/.test(v1.nen), m.ten + ": V1 thanh mở, không phủ nền " + JSON.stringify([v1.show, v1.ben, v1.hien, v1.nen]));
  ok(Math.abs(v1.phai - v1.mep) <= 17, m.ten + ": V1 sát mép phải (" + v1.phai + "/" + v1.mep + ")");
  if (!m.mob) { ok(v1.trai > 300 && Math.abs(v1.mep - v1.trai - 740) <= 20, m.ten + ": V1 thanh rộng 740 px, còn chỗ bên trái bấm dòng (trái=" + v1.trai + ")"); ok(!v1.side, m.ten + ": V1 thanh trái tự thu"); }
  ok(!v1.dauTran, m.ten + ": V2 nút Đóng / Mở task nằm trong màn");
  if (m.mob) ok(v1.rong >= m.w - 1 && v1.dong >= 44 && v1.tabCao >= 40, m.ten + ": V10 điện thoại phủ ngang, Đóng " + v1.dong + "px, bước " + v1.tabCao + "px");
  ok(v1.t1.length > 5 && /^HSK-/.test(v1.t2), m.ten + ": V2 tiêu đề 2 dòng (tên / mã) «" + v1.t2 + "»");
  ok(v1.moTask, m.ten + ": V2 có nút Mở task cạnh Đóng");
  ok(v1.nTab >= 1 && v1.nOn === 1 && v1.gdKhop && v1.nGd >= 1, m.ten + ": V3 «Giai đoạn» dòng thời gian = mọi bước đã chạy tới, đúng thứ tự " + JSON.stringify([v1.nTab, v1.nOn, v1.nGd, v1.gdKhop]));
  ok(v1.so.length >= 1 && v1.so.every((s, k) => s === String(k + 1).padStart(2, "0")), m.ten + ": V5 Dữ liệu khai báo đánh số " + v1.so.join(","));
  ok(v1.to.length === 1 && v1.to[0] === ds[0], m.ten + ": V6 tô dòng đang xem " + v1.to);
  if (v1.nTab >= 2) {
    const kq = await p.evaluate(() => { const t = [...document.querySelectorAll("#mBody .vp-tab:not(.trong)")].pop(); t.click(); return t.dataset.vpb; }); await ngu(900);
    const v4 = await tt(), thay = await p.evaluate((k) => { const li = document.querySelector('#mBody .vp-gd-b[data-vpgd="' + k + '"]'), bx = document.querySelector("#modal .modal-box").getBoundingClientRect(), r = li.getBoundingClientRect(), dai = document.querySelector("#mBody .vp-buoc").getBoundingClientRect();
      return r.top >= dai.bottom - 2 && r.top < bx.bottom - 40; }, kq);
    ok(v4.nOn === 1 && v4.show && thay, m.ten + ": V4 bấm bước → cuộn tới bước đó trong Giai đoạn, không che dưới dải bước (bước " + kq + ")");
  }
  if (A.anh) await p.screenshot({ path: A.anh + "/vipham-" + m.ten + "-1.png" });
  const coAnh = await p.evaluate(() => { const t = document.querySelector("#mBody .vp-muc:not([hidden]) .thumb"); if (!t) return false; t.click(); return true; });
  if (coAnh) { await ngu(500); const lb = await p.evaluate(() => document.getElementById("lightbox").classList.contains("show"));
    await p.keyboard.press("Escape"); await ngu(400); const sau = await p.evaluate(() => [document.getElementById("lightbox").classList.contains("show"), document.getElementById("modal").classList.contains("show")]);
    ok(lb && !sau[0] && sau[1], m.ten + ": V7 ảnh phóng to, Esc đóng phóng to mà thanh vẫn mở " + JSON.stringify([lb, sau])); }
  if (!m.mob) {
    d = await diem(ds[1]);
    const trung = await p.evaluate((x, y, i) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('[data-i="' + i + '"]')); }, d.x, d.y, ds[1]);
    ok(trung, m.ten + ": V6 điểm bấm dòng 2 không bị che");
    await p.mouse.click(d.x, d.y); await ngu(700);
    const v6 = await tt();
    ok(v6.show && v6.to.length === 1 && v6.to[0] === ds[1] && v6.t2 !== v1.t2, m.ten + ": V6 thanh vẫn mở, đổi nội dung + tô dòng 2 (" + v1.t2 + " → " + v6.t2 + ")");
    if (A.anh) await p.screenshot({ path: A.anh + "/vipham-" + m.ten + "-2.png" });
  }
  if (m.ten === "may-tinh-1366") {   // V9 quét mọi task đang hiện
    const hong = [], dem = { n: ds.length, buoc: 0, thatBai: 0, anh: 0 };
    for (const i of ds) { await p.evaluate((i) => moChiTiet(+i), i); await ngu(120);
      const x = await tt(), sai = [];
      dem.buoc += x.nTab; dem.thatBai += await p.evaluate(() => document.querySelectorAll("#mBody .step-fail").length); dem.anh += await p.evaluate(() => document.querySelectorAll("#mBody .thumb").length);
      if (x.nTab && x.nOn !== 1) sai.push(x.nOn + " bước chọn"); if (!x.gdKhop) sai.push("Giai đoạn lệch dải bước");
      if (x.tran) sai.push("tràn " + x.tran); if (x.ngang > 1) sai.push("kéo ngang " + x.ngang); if (x.chuTo > 16) sai.push("chữ " + x.chuTo + "px");
      if (!/^HSK-/.test(x.t2)) sai.push("thiếu mã"); if (x.dauTran) sai.push("nút đầu thanh ra ngoài màn");
      if (sai.length) hong.push(i + ": " + sai.join(", ")); }
    ok(!hong.length, m.ten + ": V9 quét " + ds.length + " task " + JSON.stringify(dem) + (hong.length ? " — " + hong.slice(0, 4).join(" | ") : ""));
    console.log("  V9 " + JSON.stringify(dem));
  }
  await p.keyboard.press("Escape"); await ngu(150);
  const truot = await p.evaluate(() => { const M = document.getElementById("modal"); return getComputedStyle(M).visibility === "visible" && M.classList.contains("hx-ben"); });
  await ngu(500); const v8 = await tt();
  ok(truot && !v8.show && !v8.ben && !v8.hien && !v8.to.length && !v8.moTask && v8.side === ben0, m.ten + ": V8 Esc trượt vô, bỏ tô, gỡ Mở task, trả thanh trái " + JSON.stringify([truot, v8.show, v8.ben, v8.to, v8.moTask, v8.side, ben0]));
  ok(!con.length, m.ten + ": lỗi trang " + con.slice(0, 2));
  await p.close();
}
await b.close();
console.log(loi.length ? "✗ " + dat + " đạt, " + loi.length + " lỗi:\n  " + loi.join("\n  ") : "✓ " + dat + "/" + dat + " đạt"); process.exit(loi.length ? 1 : 0);
