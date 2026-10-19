/**
 * qc-thanh-ben-muot.mjs — đo ĐỘ MƯỢT + CUỘN thanh bên Xác minh (19/10 user):
 *  «chọn 1 mục Theo tác vụ thanh bên phải xổ ra bị GIẬT KHUNG» · «đang mở thanh Theo tác vụ bấm sang Theo máy thì LAG/TREO»
 *  · «clip dính rồi mà cuộn xuống không ăn, cuộn 3–5 lần chỉ động đậy» (cả 2 thanh, web + điện thoại).
 *  Bấm/lăn/vuốt bằng thao tác THẬT (sự kiện vào hàng đợi trình duyệt ⇒ longtask bắt được — page.evaluate thì không, bẫy 10/10). Dữ liệu thật 8591, chặn mọi lượt ghi.
 *  K0 mốc kiểm chứng: cú bấm gây vòng bận 120 ms PHẢI bị longtask bắt (không thì «0 việc nặng» vô nghĩa)
 *  S1 mở thanh từ danh sách Theo tác vụ: CLS 1,5 s ≤ 0,02 · không việc nặng > 200 ms · bấm → thanh dựng xong ≤ 600 ms
 *  S2 (web) đổi phiếu khi thanh đang mở: CLS ≤ 0,02 · không việc nặng > 200 ms
 *  S3 thanh Theo tác vụ đang mở, bấm mục «Theo máy» ở thanh menu (điện thoại: mở ngăn kéo ☰ trước): tới khi danh sách vẽ xong < 300 ms
 *     · không việc nặng > 200 ms · thanh đã đóng
 *  S4 hiệu ứng trượt thanh vẫn còn (transition transform)
 *  C1 cả 2 thanh: 1 lần lăn chuột (web) / 1 lần vuốt (điện thoại) ⇒ thanh cuộn xuống ngay · lăn/vuốt tiếp tới đáy thấy nút Lưu · clip vẫn dính dưới đầu thanh
 *  S5 không lỗi trang.
 *  Chạy: node qc-thanh-ben-muot.mjs [--cham=1] [--lan=3] [--chi=1366,1920,dt-390,dt-360]
 */
import puppeteer from "puppeteer-core";
import { phienQC } from "./xacminh-dang-nhap.mjs"; const PHIEN_QC = phienQC();
const A = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const CHAM = +(A.cham || 1), LAN = +(A.lan || 3);
let MAY = [{ ten: "1366", w: 1366, h: 768 }, { ten: "1920", w: 1920, h: 1080 }, { ten: "dt-390", w: 390, h: 844, mob: true }, { ten: "dt-360", w: 360, h: 780, mob: true }];
if (A.chi) MAY = MAY.filter((m) => A.chi.split(",").includes(m.ten));
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
await ngu(6000);   // máy chủ 8591 đọc lại sổ phiên theo nhịp đệm 5 s — phiên QC vừa tạo phải chờ, không thì trang ra ô đăng nhập (bẫy chập chờn)
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new", args: ["--disable-background-timer-throttling"] });
const loi = []; let dat = 0; const ok = (dk, ten) => { if (dk) dat++; else loi.push(ten); console.log((dk ? "  ✓ " : "  ✗ ") + ten); };
for (const m of MAY) {
  const p = await b.newPage(); const con = []; p.on("pageerror", (e) => con.push(e.message));
  await p.evaluateOnNewDocument((hx) => { try { localStorage.setItem("hx-phien", hx); localStorage.removeItem("hx-loc"); localStorage.setItem("tk-phien", "qc");
    localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: { id: "qc", ten: "QC", vaiTro: "quantri" }, quyen: { "r.xacminh": "lam" } })); } catch (e) {}
    window.__CLS = 0; window.__LT = [];
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__CLS += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch (e) {}
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__LT.push(Math.round(e.duration)); }).observe({ type: "longtask", buffered: true }); } catch (e) { window.__LT = null; }
    addEventListener("pointerdown", () => { window.__T0 = performance.now(); }, true); }, PHIEN_QC);
  await p.setViewport({ width: m.w, height: m.h, isMobile: !!m.mob, hasTouch: !!m.mob, deviceScaleFactor: m.mob ? 2 : 1 });
  await p.setRequestInterception(true); p.on("request", (r) => (r.method() !== "GET" && r.method() !== "OPTIONS" ? r.abort() : r.continue()));
  const cdp = await p.target().createCDPSession();
  await p.goto("http://localhost:8123/kiemsoatkho/?tab=xacminh", { waitUntil: "networkidle2", timeout: 60000 });
  await p.waitForFunction(() => window.HXACMINH && window.__HX_MUC, { timeout: 60000 });
  if (CHAM > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: CHAM });
  const sach = () => p.evaluate(() => { window.__CLS = 0; if (window.__LT) window.__LT.length = 0; window.__T0 = 0; });
  const hien = async (sel) => { const hs = []; for (const x of await p.$$(sel)) if (await x.evaluate((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })) hs.push(x); return hs; };
  const bam = async (sel, i = 0) => { const h = (await hien(sel))[i]; if (!h) return false; await h.evaluate((e) => e.scrollIntoView({ block: "center" })); await ngu(150);
    const r = await h.boundingBox(); if (!r) return false; await sach();
    /* thẻ phiếu trên điện thoại: chạm vào dòng chữ lỗi (góc trái thẻ là ảnh nhỏ — chạm vào đó là phát clip, không mở thanh) */
    const the = m.mob && /data-p|data-lid/.test(sel), x = the ? r.x + r.width * 0.7 : r.x + Math.min(40, r.width / 2), y = the ? r.y + Math.min(48, r.height / 2) : r.y + r.height / 2;
    if (m.mob) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); return true; };
  const cho = (dk, han = 8000) => p.evaluate((src, han) => new Promise((res) => { const f = (0, eval)(src), t = performance.now();
    (function vong() { if (f()) requestAnimationFrame(() => requestAnimationFrame(() => res(Math.round(performance.now() - (window.__T0 || t))))); else if (performance.now() - t > han) res(-1); else setTimeout(vong, 4); })(); }), "(" + dk.toString() + ")", han);
  const lay = () => p.evaluate(() => ({ cls: +(window.__CLS || 0).toFixed(4), lt: window.__LT ? window.__LT.slice() : null }));
  const dongThanh = async () => { await p.evaluate(() => { const M = document.getElementById("modal"); if (M.classList.contains("show")) document.getElementById("mClose").click(); }); await ngu(500); };
  /* K0 mốc kiểm chứng */
  await p.evaluate(() => { const d = document.createElement("button"); d.id = "__qcBan"; d.textContent = "bận"; d.style.cssText = "position:fixed;left:0;bottom:0;z-index:99999;width:60px;height:40px";
    d.onclick = () => { const t = performance.now(); while (performance.now() - t < 120); }; document.body.appendChild(d); });
  await bam("#__qcBan"); await ngu(400); const kc = await lay(); await p.evaluate(() => document.getElementById("__qcBan").remove());
  ok(kc.lt && kc.lt.some((x) => x >= 100), m.ten + ": K0 mốc kiểm chứng — vòng bận 120 ms bị bắt (" + JSON.stringify(kc.lt) + ")");
  const r = { mo: [], doi: [], chuyen: [] }; let hieuUng = "";
  for (let lan = 0; lan < LAN; lan++) {
    await p.evaluate(() => window.HXACMINH.sub("treo")); await ngu(1500); await dongThanh();
    if (!(await bam("#hxBody [data-p]", lan))) break;
    const msMo = await cho(() => document.getElementById("modal").classList.contains("show") && document.querySelector('#mBody .hx-tb-luoi [data-tp="quyetdinh"]'));   // phiếu không camera cũng tính (thanh đã dựng xong)
    await ngu(1500); r.mo.push({ ms: msMo, ...(await lay()) });
    if (!lan) hieuUng = await p.evaluate(() => { const e = document.querySelector("#modal.hx-ben .modal-box"); return e ? getComputedStyle(e).transitionProperty : "không có thanh"; });
    if (!m.mob && await bam("#hxBody [data-p]", lan + 1)) { const ms2 = await cho(() => document.querySelector('#mBody .hx-tb-luoi [data-tp="clip"] :is(video,img)')); await ngu(1500); r.doi.push({ ms: ms2, ...(await lay()) }); }
    /* điện thoại: thanh bên đang mở thì đầu trang (☰) ẨN (19/10 (4) B) ⇒ người dùng bấm Đóng → ☰ → Theo máy; đo B: đầu trang ẩn lúc mở, hiện lại sau Đóng */
    if (m.mob) { const anDau = await p.evaluate(() => { const h = document.querySelector("header").getBoundingClientRect(); return h.bottom <= 1; }); r.anDau = (r.anDau || []).concat(anDau);
      await bam("#mClose"); await ngu(500); r.hienLai = (r.hienLai || []).concat(await p.evaluate(() => document.querySelector("header").getBoundingClientRect().bottom > 20));
      await bam("#sideToggle"); await ngu(700); }
    let msCh = -1;
    if (await bam('.s-item[data-tab="xacminh"][data-sub="cam"]')) msCh = await cho(() => [...document.querySelectorAll("#hxBody [data-lid]")].some((e) => e.getBoundingClientRect().height));
    await ngu(1200); const x3 = await lay(); const dong = await p.evaluate(() => !document.getElementById("modal").classList.contains("show"));
    r.chuyen.push({ ms: msCh, dong, ...x3 });
    if (m.mob) await p.evaluate(() => { if (document.body.classList.contains("side-open")) document.getElementById("sideToggle").click(); });
  }
  console.log("  " + m.ten + " " + JSON.stringify(r));
  const nang = (a) => Math.max(0, ...a.flatMap((x) => x.lt || []));
  ok(r.mo.length && r.mo.every((x) => x.cls <= 0.02), m.ten + ": S1 mở thanh không giật khung (CLS " + r.mo.map((x) => x.cls).join("/") + ")");
  ok(r.mo.length && nang(r.mo) <= 200, m.ten + ": S1 mở thanh không việc nặng >200 ms (lớn nhất " + nang(r.mo) + " ms)");
  ok(r.mo.length && r.mo.every((x) => x.ms > 0 && x.ms <= 600), m.ten + ": S1 bấm → thanh dựng xong ≤ 600 ms (" + r.mo.map((x) => x.ms).join("/") + ")");
  if (!m.mob) { ok(r.doi.length && r.doi.every((x) => x.cls <= 0.02), m.ten + ": S2 đổi phiếu không giật (CLS " + r.doi.map((x) => x.cls).join("/") + ")"); ok(nang(r.doi) <= 200, m.ten + ": S2 đổi phiếu không việc nặng >200 ms (" + nang(r.doi) + ")"); }
  ok(r.chuyen.length && r.chuyen.every((x) => x.ms > 0 && x.ms < 300), m.ten + ": S3 Theo tác vụ → Theo máy < 300 ms (" + r.chuyen.map((x) => x.ms).join("/") + ")");
  ok(r.chuyen.length && nang(r.chuyen) <= 200, m.ten + ": S3 chuyển không việc nặng >200 ms (lớn nhất " + nang(r.chuyen) + " ms)");
  ok(r.chuyen.length && r.chuyen.every((x) => x.dong), m.ten + ": S3 chuyển xong thanh bên đã đóng");
  if (m.mob) ok(r.anDau && r.anDau.every(Boolean) && r.hienLai.every(Boolean), m.ten + ": B thanh bên mở → đầu trang ẩn; Đóng → hiện lại (" + JSON.stringify([r.anDau, r.hienLai]) + ")");
  ok(/transform|all/.test(hieuUng), m.ten + ": S4 còn hiệu ứng trượt thanh (" + hieuUng + ")");
  /* C1 cuộn thanh: 2 thanh × 2 mục, thao tác thật */
  const sai = []; let soDo = 0;
  for (const [sub, sel, ten] of [["treo", "#hxBody [data-p]", "Theo tác vụ"], ["cam", "#hxBody [data-lid]", "Theo máy"]]) {
    await p.evaluate((s) => window.HXACMINH.sub(s), sub); await ngu(1500);
    for (let i = 0; i < 2; i++) {
      await dongThanh(); if (!(await bam(sel, i))) break; await ngu(2200);
      const t0 = await p.evaluate(() => { const bx = document.querySelector("#modal .modal-box"), c = document.querySelector('#mBody [data-tp="clip"]').getBoundingClientRect();
        return { tran: bx.scrollHeight - bx.clientHeight, x: Math.round(c.left + c.width / 2), y: Math.round(Math.min(innerHeight - 40, c.bottom + 80)) }; });
      if (t0.tran < 30) continue;   // thanh không dài hơn màn — không có gì để cuộn
      soDo++;
      /* vuốt = touchStart/Move/End thật (BẪY: CDP synthesizeScrollGesture kiểu touch KHÔNG cuộn gì trong Edge headless — mốc đối chứng ra 0) */
      const mot = async () => { if (m.mob) { await p.touchscreen.touchStart(t0.x, t0.y); for (let k = 1; k <= 10; k++) await p.touchscreen.touchMove(t0.x, t0.y - k * 24); await p.touchscreen.touchEnd(); }
        else { await p.mouse.move(t0.x, t0.y); await p.mouse.wheel({ deltaY: 240 }); } await ngu(350); return p.evaluate(() => document.querySelector("#modal .modal-box").scrollTop); };
      const s1 = await mot(); let sN = s1; for (let k = 0; k < 12 && sN < t0.tran - 2; k++) sN = await mot();
      const cuoi = await p.evaluate(() => { const hd = document.querySelector("#modal .modal-head").getBoundingClientRect(), c = document.querySelector('#mBody [data-tp="clip"]').getBoundingClientRect();
        const l = document.querySelector("#mBody #qdLuu, #mBody .hx-act button.chinh"), rl = l && l.getBoundingClientRect();
        return { clipDinh: Math.abs(c.top - hd.bottom) <= 2, thayLuu: !!(rl && rl.height && rl.bottom <= innerHeight + 1 && rl.top >= c.bottom - 1) }; });
      if (!(s1 > 20 && sN >= t0.tran - 2 && cuoi.clipDinh && cuoi.thayLuu)) sai.push(ten + "#" + i + " " + JSON.stringify({ tran: t0.tran, lan1: s1, cuoi: sN, ...cuoi }));
    }
  }
  ok(!sai.length, m.ten + ": C1 " + (m.mob ? "vuốt" : "lăn chuột") + " 1 lần là cuộn, tới đáy thấy nút Lưu, clip vẫn dính (2 thanh, " + soDo + " thanh dài hơn màn)" + (sai.length ? " — " + sai.slice(0, 2).join(" | ") : ""));
  ok(!con.length, m.ten + ": S5 không lỗi trang" + (con.length ? " — " + con.slice(0, 2).join(" | ") : ""));
  await p.close();
}
await b.close();
console.log(loi.length ? "✗ " + dat + " đạt, " + loi.length + " lỗi:\n  " + loi.join("\n  ") : "✓ " + dat + "/" + dat + " đạt");
process.exit(loi.length ? 1 : 0);
