/**
 * qc-thanh-ben-dien-thoai.mjs — đo thanh bên Xác minh (Theo máy + Theo tác vụ) theo video user 19/10 quay trên điện thoại:
 *  «chip Đóng/Ghi chú/Mở task/tiêu đề to chiếm màn · Lưu quyết định Theo máy dính đáy còn Theo tác vụ phải kéo → bỏ dính, đồng bộ
 *   · clip phải dính trên, mục khác cuộn · thanh thời gian + Tự động/×1… ngang hàng như web · phụ đề to · nút clip camera/khung giờ to».
 *  Dữ liệu THẬT từ 8591 (bản QC localhost:8123), chặn mọi lượt ghi. Máy: 360/390/414 (điện thoại, chạm) + 1366/1600/1920.
 *  G1 đầu thanh gọn: cao ≤ 52px, chip ≤ 32px, tiêu đề 1 dòng/ý · G2 vùng chạm THẬT (elementFromPoint): Đóng ≥ 44px, Ghi chú/Mở task ≥ 40px
 *  · G3 cuộn thanh xuống → clip dính ngay dưới đầu thanh, vẫn thấy trọn · G4 Quyết định KHÔNG dính (position static) ở cả 2 thanh
 *  · G5 điện thoại: thanh thời gian, ▶ giờ, Tự động ×1 ×2 ×3 cùng 1 hàng · G6 điện thoại: phụ đề ≤ 12px, nút tốc độ ≤ 26px, nút nguồn ≤ 30px,
 *  vùng chạm ≥ 40px · G7 không kéo ngang · G8 không lỗi trang · G9 (19/10) đầu thanh 1 hàng: tiêu đề + giờ sát trái, Mở task · Ghi chú · Đóng sát phải.
 *  Chạy: node qc-thanh-ben-dien-thoai.mjs [--n=3] [--anh=thư mục]
 */
import fs from "node:fs";
import puppeteer from "puppeteer-core";
import { phienQC } from "./xacminh-dang-nhap.mjs"; const PHIEN_QC = phienQC();
const A = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const N = +(A.n || 3);
let MAY = [{ ten: "dt-360", w: 360, h: 780, mob: true }, { ten: "dt-390", w: 390, h: 844, mob: true }, { ten: "dt-414", w: 414, h: 896, mob: true },
  { ten: "1366", w: 1366, h: 768 }, { ten: "1600", w: 1600, h: 900 }, { ten: "1920", w: 1920, h: 1080 }];
if (A.chi) MAY = MAY.filter((m) => A.chi.split(",").includes(m.ten));   // --chi=1366,dt-390
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
await ngu(6000);   // máy chủ 8591 đọc lại sổ phiên theo nhịp đệm 5 s — chờ phiên QC có hiệu lực
if (A.anh) fs.mkdirSync(A.anh, { recursive: true });
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
const loi = []; let dat = 0; const ok = (dk, ten) => { if (dk) dat++; else loi.push(ten); console.log((dk ? "  ✓ " : "  ✗ ") + ten); };
const DO = (mob) => {
  const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom) } : null; };
  const cham = (e) => { const r = e && e.getBoundingClientRect(); if (!r || !r.height) return 0; const x = r.left + r.width / 2; let n = 0;
    for (let y = Math.floor(r.top - 12); y <= Math.ceil(r.bottom + 12); y++) { const h = document.elementFromPoint(x, y); if (h && (h === e || e.contains(h))) n++; } return n; };
  const hd = document.querySelector("#modal .modal-head"), q = (s) => document.querySelector(s);
  const chip = [...hd.querySelectorAll("#mClose,.hx-gc-nut,.hx-motask")].filter((e) => e.getBoundingClientRect().height);
  const mt = [...hd.querySelectorAll("#mTitle .hx-mt1,#mTitle .hx-mt2")].filter((e) => e.getBoundingClientRect().height);
  const qd = q('#mBody .hx-tb-luoi [data-tp="quyetdinh"]'), clip = q('#mBody .hx-tb-luoi [data-tp="clip"]');
  const hang = [...document.querySelectorAll("#mBody .hx-tb-luoi .hx-tl-hang")].find((e) => e.getBoundingClientRect().height);
  const toc = hang ? [...hang.querySelectorAll(".hx-toc button")] : [], play = hang && hang.querySelector("#hxPlay"), tl = hang && hang.querySelector(".hx-tl");
  const nguon = [...document.querySelectorAll("#mBody .hx-qd-nguon button")].filter((e) => e.getBoundingClientRect().height);
  const pd = [...document.querySelectorAll("#mBody .hx-pd")].find((e) => e.getBoundingClientRect().height);
  return { hd: R(hd), chip: chip.map((e) => ({ t: e.textContent.trim().slice(0, 12), h: Math.round(e.getBoundingClientRect().height), c: cham(e), dong: e.id === "mClose" })),
    mt: mt.map((e) => ({ h: Math.round(e.getBoundingClientRect().height), lh: parseFloat(getComputedStyle(e).lineHeight) || 18 })),
    qdPos: qd ? getComputedStyle(qd).position : "?", clipPos: clip ? getComputedStyle(clip).position : "?", clip: R(clip),
    hang: hang ? { tl: R(tl), play: R(play), toc: toc.map(R).filter(Boolean), tocH: Math.max(0, ...toc.map((e) => e.getBoundingClientRect().height)), tocC: Math.min(99, ...toc.map(cham)) } : null,
    nguon: nguon.map((e) => ({ t: e.textContent.trim().slice(0, 14), h: Math.round(e.getBoundingClientRect().height), c: cham(e) })),
    pd: pd ? Math.max(...[pd, ...pd.querySelectorAll("*")].filter((e) => e.textContent.trim()).map((e) => parseFloat(getComputedStyle(e).fontSize))) : 0,
    ngang: document.documentElement.scrollWidth - innerWidth,
    /* G10 19/10 (5) user: chip «Tác động WMS» · «Không qua WMS» · «Ảnh ghi nhận» CÙNG 1 HÀNG ở mọi cỡ, không cuộn ngang */
    nguonHang: (() => { const h = q("#mBody .hx-ng-hang .hx-qd-nguon"); if (!h || !h.getBoundingClientRect().height) return null; /* web Theo máy không có hàng chip (20/10) */ const bs = [...h.children].filter((e) => e.getBoundingClientRect().width);
      const tops = bs.map((e) => Math.round(e.getBoundingClientRect().top)); return { n: bs.length, lech: tops.length ? Math.max(...tops) - Math.min(...tops) : 0, tran: h.scrollWidth - h.clientWidth, phai: Math.round(Math.max(0, ...bs.map((e) => e.getBoundingClientRect().right)) - h.closest(".hx-tb-tp").getBoundingClientRect().right) }; })(),
    /* 19/10 (3) user: 1 hàng — TRÁI tiêu đề + giờ, PHẢI Mở task · Ghi chú · Đóng (Đóng ngoài cùng); chữ dài cắt … ở tiêu đề, không đẩy nút */
    dau: (() => { const hr = hd.getBoundingClientRect(), pl = parseFloat(getComputedStyle(hd).paddingLeft), pr = parseFloat(getComputedStyle(hd).paddingRight);
      const tt = q("#mTitle"), t1 = q("#mTitle .hx-mt1"), t2 = q("#mTitle .hx-mt2"), dg = q("#mClose"), gc = q("#gcNut"), mt = q("#hxMoTask");
      const R2 = (e) => e && e.getBoundingClientRect().width ? e.getBoundingClientRect() : null, a = [R2(t1), R2(t2), R2(mt), R2(gc), R2(dg)];
      const giua = a.filter(Boolean).map((r) => r.top + r.height / 2);
      return { traiSat: !!a[0] && Math.abs(a[0].left - (hr.left + pl)) <= 2, phaiSat: !!a[4] && Math.abs(a[4].right - (hr.right - pr)) <= 2,
        thuTu: [a[0], a[1], a[2], a[3], a[4]].filter(Boolean).every((r, i, x) => !i || r.left >= x[i - 1].right - 1),
        motHang: giua.length >= 3 && Math.max(...giua) - Math.min(...giua) <= 8, tieuDeTrongKhung: !!tt && tt.getBoundingClientRect().right <= (a[2] || a[3] || a[4]).left + 1 };
    })() };
};
for (const m of MAY) {
  const p = await b.newPage(); const con = []; p.on("pageerror", (e) => con.push(e.message));
  await p.evaluateOnNewDocument((hx) => { try { localStorage.setItem("hx-phien", hx); localStorage.removeItem("hx-loc"); localStorage.setItem("tk-phien", "qc");
    localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: { id: "qc", ten: "QC", vaiTro: "quantri" }, quyen: { "r.xacminh": "lam" } })); } catch (e) {} }, PHIEN_QC);
  await p.setViewport({ width: m.w, height: m.h, isMobile: !!m.mob, hasTouch: !!m.mob, deviceScaleFactor: m.mob ? 2 : 1 });
  if (m.mob) await p.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36");
  await p.setRequestInterception(true); p.on("request", (r) => (r.method() !== "GET" && r.method() !== "OPTIONS" ? r.abort() : r.continue()));
  await p.goto("http://localhost:8123/kiemsoatkho/?tab=xacminh", { waitUntil: "networkidle2", timeout: 60000 });
  await p.waitForFunction(() => window.HXACMINH && window.__HX_MUC, { timeout: 60000 });
  const ds = async (sub, sel, at) => { await p.evaluate((s) => window.HXACMINH.sub(s), sub); await ngu(1500); return p.evaluate((sel, at) => [...new Set([...document.querySelectorAll("#hxBody " + sel)].map((e) => e.getAttribute(at)))], sel, at); };
  const mo = async (fn, id) => { await p.evaluate((fn, id) => window.HXACMINH[fn](id), fn, id); await ngu(1000);
    await p.waitForFunction(() => { const i = document.querySelector("#mBody .hx-qd-anh img"); return !i || i.complete; }, { timeout: 8000 }).catch(() => {}); await ngu(1400); };
  const sai = { G1: [], G2: [], G3: [], G4: [], G5: [], G6: [], G7: [], G9: [], G10: [] }; let soLuot = 0;
  for (const [sub, sel, at, fn, ten] of [["cam", "[data-lid]", "data-lid", "moLuotId", "may"], ["treo", "[data-p]", "data-p", "moPhieuId", "tacvu"]]) {
    let n = 0;
    for (const id of await ds(sub, sel, at)) {
      if (n >= N) break; await mo(fn, id);
      if (!(await p.evaluate(() => !!document.querySelector('#mBody .hx-tb-luoi [data-tp="clip"] :is(video,img)')))) continue;
      if (ten === "tacvu") { await p.evaluate(() => { const v = document.querySelector("#qdKhung video"); if (v) { v.muted = true; v.play().catch(() => {}); } }); await ngu(1500); }
      n++; soLuot++; const x = await p.evaluate(DO, !!m.mob), nh = ten + " " + id;
      if (m.mob && (x.hd.h > 52 || x.chip.some((c) => c.h > 32) || x.mt.some((t) => t.h > t.lh * 1.6))) sai.G1.push(nh + JSON.stringify([x.hd.h, x.chip.map((c) => c.h), x.mt]));
      if (m.mob && x.chip.some((c) => c.c < (c.dong ? 44 : 40))) sai.G2.push(nh + JSON.stringify(x.chip.map((c) => c.t + ":" + c.c)));
      if (x.qdPos === "sticky" || x.qdPos === "fixed") sai.G4.push(nh + " " + x.qdPos);
      if (m.mob) {
        const h = x.hang; if (!h || !h.tl || !h.play || !h.toc.length || Math.abs(h.tl.t + h.tl.h / 2 - (h.play.t + h.play.h / 2)) > 4 || h.toc.some((t) => Math.abs(t.t - h.toc[0].t) > 1 || Math.abs(t.t + t.h / 2 - (h.play.t + h.play.h / 2)) > 4)) sai.G5.push(nh + JSON.stringify(h));
        if ((x.pd && x.pd > 12) || (h && (h.tocH > 26 || h.tocC < 40)) || x.nguon.some((g) => g.h > 30 || g.c < 40)) sai.G6.push(nh + JSON.stringify({ pd: x.pd, toc: h && [h.tocH, h.tocC], nguon: x.nguon }));
      }
      if (x.ngang > 0) sai.G7.push(nh + " " + x.ngang + "px");
      if (!(x.dau.traiSat && x.dau.phaiSat && x.dau.thuTu && x.dau.motHang && x.dau.tieuDeTrongKhung)) sai.G9.push(nh + JSON.stringify(x.dau));
      if (x.nguonHang && (x.nguonHang.n < 1 || x.nguonHang.lech > 1 || x.nguonHang.tran > 1 || x.nguonHang.phai > 1)) sai.G10.push(nh + JSON.stringify(x.nguonHang));
      /* G3: cuộn thanh xuống tối đa → clip vẫn dính ngay dưới đầu thanh, thấy trọn */
      const c3 = await p.evaluate(() => { const bx = document.querySelector("#modal .modal-box"); const tran = bx.scrollHeight - bx.clientHeight; bx.scrollTop = bx.scrollHeight; return tran; });
      await ngu(250);
      if (c3 > 40) { const y = await p.evaluate(DO, !!m.mob);
        if (!y.clip || Math.abs(y.clip.t - y.hd.b) > 2 || y.clip.b > m.h) sai.G3.push(nh + " cuộn " + c3 + "px → " + JSON.stringify([y.hd.b, y.clip])); }
      if (A.anh && n === 1) { await p.evaluate(() => { document.querySelector("#modal .modal-box").scrollTop = 0; }); await ngu(200);
        await p.screenshot({ path: A.anh + "/" + m.ten + "-" + ten + "-dau.png" }); await p.evaluate(() => { const bx = document.querySelector("#modal .modal-box"); bx.scrollTop = bx.scrollHeight; }); await ngu(200);
        await p.screenshot({ path: A.anh + "/" + m.ten + "-" + ten + "-cuon.png" }); }
      await p.evaluate(() => { document.querySelector("#modal .modal-box").scrollTop = 0; });
    }
  }
  ok(soLuot >= 2, m.ten + ": G0 có lượt Theo máy + phiếu Theo tác vụ có clip (" + soLuot + ")");
  const TEN = { G1: "đầu thanh gọn (≤52px, chip ≤32px, tiêu đề không bẻ vụn)", G2: "vùng chạm thật Đóng ≥44 / Ghi chú, Mở task ≥40", G3: "cuộn xuống: clip dính dưới đầu thanh, thấy trọn",
    G4: "Quyết định không dính (2 thanh như nhau)", G5: "thanh thời gian + ▶ giờ + Tự động ×1 ×2 ×3 cùng 1 hàng", G6: "phụ đề ≤12px · nút tốc độ ≤26px · nút nguồn ≤30px · vùng chạm ≥40", G7: "không kéo ngang", G9: "đầu thanh 1 hàng: tiêu đề + giờ sát trái, Mở task · Ghi chú · Đóng sát phải (Đóng ngoài cùng)", G10: "chip Tác động WMS · Không qua WMS · Ảnh ghi nhận cùng 1 hàng (±1px), không tràn/cuộn ngang" };
  for (const k of Object.keys(sai)) { if (!m.mob && ["G1", "G2", "G5", "G6"].includes(k)) continue; ok(!sai[k].length, m.ten + ": " + k + " " + TEN[k] + (sai[k].length ? " — " + sai[k].slice(0, 2).join(" | ") : "")); }
  ok(!con.length, m.ten + ": G8 không lỗi trang" + (con.length ? " — " + con.slice(0, 2).join(" | ") : ""));
  await p.close();
}
await b.close();
console.log(loi.length ? "✗ " + dat + " đạt, " + loi.length + " lỗi:\n  " + loi.join("\n  ") : "✓ " + dat + "/" + dat + " đạt");
process.exit(loi.length ? 1 : 0);
