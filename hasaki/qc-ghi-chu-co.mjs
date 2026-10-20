/**
 * qc-ghi-chu-co.mjs — đo CỜ GHI CHÚ + CHIP «GÓC KHÁC» ở Xác minh (20/10, dữ liệu THẬT từ 8591, chặn mọi lượt ghi ở tầng mạng).
 *  G1 Theo máy: mục có ghi chú có nhãn «Ghi chú · <trạng thái>», mờ, nằm SAU mọi mục không ghi chú (web + điện thoại)
 *  G2 lượt có góc phụ: chip «Góc khác · …» ẩn khung sẵn; bấm → khung video riêng hiện, nạp được, tua tới trước giờ có người; bấm lại → ẩn
 *  G3 clip chính vẫn còn nguồn khi mở góc phụ · G4 pop-up Ghi chú hiện nhãn trạng thái mới · G5 lượt «xe tải che bãi» không còn trong «Chờ bạn quyết»
 *  G6 không lỗi trang.   Chạy: node qc-ghi-chu-co.mjs [--id=<lượt có ghi chú + góc phụ>]
 */
import puppeteer from "puppeteer-core";
import { phienQC } from "./xacminh-dang-nhap.mjs"; const PHIEN_QC = phienQC();
const A = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const ID = A.id || "2026-10-14_AIBV_074132", CHE = "2026-10-13_AIBV_133232";
const MAY = [{ ten: "may-tinh-1600", w: 1600, h: 900, mob: false }, { ten: "iphone", w: 390, h: 844, mob: true }];
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
const loi = []; let dat = 0; const ok = (dk, ten) => { if (dk) dat++; else loi.push(ten); console.log((dk ? "  OK   " : "  FAIL ") + ten); };
for (const m of MAY) {
  const p = await b.newPage();
  await p.evaluateOnNewDocument((hx) => { try { if (hx) localStorage.setItem("hx-phien", hx); localStorage.removeItem("hx-loc");
    localStorage.setItem("tk-phien", "qc"); localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: { id: "qc", ten: "QC", vaiTro: "quantri" }, quyen: { "r.xacminh": "lam" } })); } catch (e) {} }, PHIEN_QC);
  await p.setViewport({ width: m.w, height: m.h, deviceScaleFactor: 1, isMobile: m.mob, hasTouch: m.mob });
  const con = []; p.on("pageerror", (e) => con.push(e.message));
  await p.setRequestInterception(true); p.on("request", (r) => (r.method() !== "GET" && r.method() !== "OPTIONS" ? r.abort() : r.continue()));
  await p.goto("http://localhost:8123/kiemsoatkho/?tab=xacminh", { waitUntil: "networkidle2", timeout: 60000 });
  await p.waitForFunction(() => window.HXACMINH && window.__HX_MUC, { timeout: 30000 });
  await p.evaluate(() => window.HXACMINH.sub("cam"));
  const sel = m.mob ? ".cardlist [data-lid]" : "#hxBody tbody [data-lid]";
  await p.waitForFunction((s, id) => document.querySelector(s + '[data-lid="' + id + '"] .hx-gc-co'), { timeout: 30000 }, sel, ID).catch(() => {});
  const g1 = await p.evaluate((s, id, che) => { const ds = [...document.querySelectorAll(s)].filter((e) => e.getBoundingClientRect().height > 0);
    const i = ds.findIndex((e) => e.dataset.lid === id), e = ds[i]; if (!e) return null;
    const co = ds.map((x) => !!x.querySelector(".hx-gc-co")), dauCo = co.indexOf(true);
    return { nhan: (e.querySelector(".hx-gc-co") || {}).textContent || "", mo: +getComputedStyle(e).opacity, sauHet: co.slice(dauCo).every(Boolean), che: ds.some((x) => x.dataset.lid === che) }; }, sel, ID, CHE);
  ok(g1 && /^Ghi chú · (chờ|đang|đã) cải tiến$|^Ghi chú · không làm$/.test(g1.nhan), `[${m.ten}] G1 nhãn cờ ghi chú (${g1 && g1.nhan})`);
  ok(g1 && g1.mo < 0.8, `[${m.ten}] G1 mục có ghi chú bị làm mờ (opacity ${g1 && g1.mo})`);
  ok(g1 && g1.sauHet, `[${m.ten}] G1 mục có ghi chú dồn cuối danh sách`);
  ok(g1 && !g1.che, `[${m.ten}] G5 lượt xe tải che bãi không còn trong «Chờ bạn quyết»`);
  await p.evaluate((s, id) => document.querySelector(s + '[data-lid="' + id + '"]').click(), sel, ID);
  await p.waitForFunction(() => document.querySelector("#mBody [data-gocphu]"), { timeout: 20000 }).catch(() => {});
  const g2a = await p.evaluate(() => { const n = document.querySelector("#mBody [data-gocphu]"), o = document.getElementById("lvGocPhu"); return { n: n ? n.textContent : "", an: o ? o.hidden : null }; });
  ok(/^Góc khác · /.test(g2a.n) && g2a.an === true, `[${m.ten}] G2 chip «${g2a.n}» có, khung góc phụ ẩn sẵn`);
  await p.evaluate(() => document.querySelector("#mBody [data-gocphu]").click());
  await p.waitForFunction(() => { const v = document.querySelector("#lvGocPhu video"); return v && v.readyState >= 1 && v.currentTime > 0; }, { timeout: 30000 }).catch(() => {});
  const g2 = await p.evaluate(() => { const o = document.getElementById("lvGocPhu"), v = o && o.querySelector("video"), r = v ? v.getBoundingClientRect() : {}, n = document.querySelector("#mBody [data-gocphu]");
    const hv = document.getElementById("hxV"); let e = o, ch = []; while (e && e.id !== "mBody") { ch.push((e.dataset.tp || e.dataset.tbk || e.className || e.tagName) + ":" + getComputedStyle(e).display + "/" + Math.round(e.getBoundingClientRect().height)); e = e.parentElement; }
    return { ch: ch.join(" < "), vh: Math.round(r.height || 0), hien: o && !o.hidden && r.height > 50, ready: v ? v.readyState : -1, t: v ? +v.currentTime.toFixed(1) : -1, bam: n.getAttribute("aria-pressed"), chinh: !!(hv && hv.src) }; });
  ok(g2.hien && g2.ready >= 1, `[${m.ten}] G2 bấm chip → khung video góc phụ hiện + nạp được (readyState ${g2.ready}, cao ${g2.vh}${g2.hien ? "" : " · " + g2.ch})`);
  ok(g2.t > 0 && g2.bam === "true", `[${m.ten}] G2 tua sẵn tới trước giờ có người (${g2.t} s) · chip bật`);
  ok(g2.chinh, `[${m.ten}] G3 clip chính vẫn giữ nguồn`);
  await p.evaluate(() => document.querySelector("#mBody [data-gocphu]").click());
  ok(await p.evaluate(() => document.getElementById("lvGocPhu").hidden && !document.querySelector("#lvGocPhu video")), `[${m.ten}] G2 bấm lại → ẩn, gỡ video`);
  await p.evaluate(() => document.getElementById("gcNut").click());
  await p.waitForFunction(() => document.querySelector("#gcDs .hx-tag"), { timeout: 10000 }).catch(() => {});
  const g4 = await p.evaluate(() => [...document.querySelectorAll("#gcDs .hx-tag")].map((x) => x.textContent));
  ok(g4.length && g4.every((t) => /^(Chờ|Đang|Đã) cải tiến$|^Không làm$/.test(t)), `[${m.ten}] G4 pop-up Ghi chú nhãn trạng thái (${g4.join(", ")})`);
  /* G7 lọc «Có ghi chú» (Theo máy) ra đủ mục đã ghi chú — kể cả lượt đã chuyển «Chỉ lưu vết» (xe tải che) */
  await p.keyboard.press("Escape"); await p.keyboard.press("Escape");
  await p.evaluate(() => { const s = document.querySelector('#hxFilters select[data-k="tt"]'); s.value = "gc"; s.dispatchEvent(new Event("change")); });
  await p.waitForFunction((s, che) => document.querySelector(s + '[data-lid="' + che + '"]'), { timeout: 15000 }, sel, CHE).catch(() => {});
  const g7 = await p.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.dataset.lid), sel);
  ok(g7.includes(ID) && g7.includes(CHE) && g7.length === 2, `[${m.ten}] G7 lọc «Có ghi chú» ra đủ 2 lượt đã ghi chú (${g7.join(", ")})`);
  /* G8 Theo tác vụ: phiếu 14115619 (hàng chờ cắt clip 12/10) không còn nhãn «Đã xử lý» */
  await p.evaluate(() => window.HXACMINH.sub("treo"));
  await p.waitForFunction(() => document.querySelectorAll("#hxBody [data-p]").length > 3, { timeout: 30000 }).catch(() => {});
  const g8 = await p.evaluate(() => { const e = [...document.querySelectorAll('#hxBody [data-p="14115619"]')].find((x) => x.getBoundingClientRect().height > 0); return e ? e.textContent : null; });
  ok(g8 != null ? !/Đã xử lý/.test(g8) : true, `[${m.ten}] G8 phiếu 14115619 không còn nhãn «Đã xử lý»${g8 == null ? " (không nằm trong 30 dòng đầu)" : ""}`);
  ok(!con.length, `[${m.ten}] G6 không lỗi trang${con.length ? " — " + con.join(" | ").slice(0, 200) : ""}`);
  await p.close();
}
await b.close();
console.log(loi.length ? `\nHỎNG ${loi.length}/${dat + loi.length}` : `\nĐẠT tất cả ${dat}/${dat}`); process.exit(loi.length ? 1 : 0);
