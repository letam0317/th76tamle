/**
 * qc-dong-bo-thanh-ben.mjs — đo ĐỒNG BỘ 2 thanh bên Xác minh (17/10, user «QC cho hiển thị đẹp/đồng bộ ở cả 2 thanh bên Theo máy và Theo tác vụ:
 *  vị trí/kích thước clip của 2 mục đều khác nhau, cả khung các hạng mục ở thanh bên phải cũng khác»).
 *  Dữ liệu THẬT từ 8591, chặn mọi lượt ghi. Mỗi cỡ màn: mở N sự việc Theo máy + N phiếu Theo tác vụ có clip, so từng cặp:
 *  D1 clip (khung hình camera) cùng trái/trên/rộng/cao (±2px) · D2 khung phải cùng mép trái · D3 Ảnh ghi nhận cùng trên/rộng/cao
 *  · D4 nhãn «Lỗi» cùng mép trái · D5 Quyết định sát đáy thanh (≤ 16px) · D6 Theo tác vụ: «Ai tác động» ngay dưới clip, cùng khung với clip
 *  · D7 Lỗi → Máy gợi ý → Quyết định trên xuống, cùng khung với Ảnh ghi nhận · D8 không cuộn cả thanh · D10 không lỗi trang.
 *  Chạy: node qc-dong-bo-thanh-ben.mjs [--n=6] [--anh=thư mục]
 */
import puppeteer from "puppeteer-core";
import { phienQC } from "./xacminh-dang-nhap.mjs"; const PHIEN_QC = phienQC();
const A = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const N = +(A.n || 6), MAY0 = [{ ten: "1366", w: 1366, h: 768 }, { ten: "1600", w: 1600, h: 900 }, { ten: "1920", w: 1920, h: 1080 }]; const MAY = A.chi ? MAY0.filter((m) => A.chi.split(",").includes(m.ten)) : MAY0;   // --chi=1366
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
const loi = []; let dat = 0; const ok = (dk, ten) => { if (dk) dat++; else loi.push(ten); };
const DO = () => {   // số đo 1 thanh đang mở
  const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom), r: Math.round(r.right) } : null; };
  const q = (s) => document.querySelector("#mBody " + s), bx = document.querySelector("#modal .modal-box");
  const clip = q(".hx-vwrap") || q("#qdKhung>video") || q("#qdKhung>img"), anh = q(".hx-qd-anh img"), qd = q('[data-tp="quyetdinh"]');
  const kAnh = anh && anh.closest(".hx-tb-khung"), kClip = clip && clip.closest(".hx-tb-khung");
  const loiNhan = [...document.querySelectorAll("#mBody .lbl")].find((x) => /^(Lỗi|Thuộc lỗi)$/.test(x.textContent.trim()))   /* 20/10 Theo tác vụ đổi nhãn «Thuộc lỗi» */, gy = [...document.querySelectorAll("#mBody .lbl")].find((x) => /^(Máy gợi ý|Là ai)$/.test(x.textContent.trim()));
  const ls = q(".hx-qd-ls"), ng = [...document.querySelectorAll("#mBody .hx-qd-nguon button")].filter((x) => x.getBoundingClientRect().width);
  const tlh = q(".hx-tl-hang:not([hidden])");
  return { khungAnh: R(q(".hx-qd-anh")), clip: R(clip), tl: R(tlh), play: R(q("#hxPlay")), toc: R(q(".hx-toc")), kPhai: R(loiNhan && loiNhan.closest(".hx-tb-khung")), anh: R(anh), tv: !!document.querySelector("#mBody [data-tb=tacvu]"), loi: R(loiNhan), gy: R(gy), qd: R(qd), bx: R(bx), cuon: bx.scrollHeight - bx.clientHeight,
    cungKhungPhai: !!(loiNhan && qd && qd.closest(".hx-tb-khung") === loiNhan.closest(".hx-tb-khung") && loiNhan.closest(".hx-tb-khung") !== kClip && (!R(anh) || kAnh === loiNhan.closest(".hx-tb-khung") || kAnh === kClip)),   /* 19/10 (4) Theo tác vụ: Ảnh ghi nhận bật bằng nút, nằm DƯỚI clip */
    ls: R(ls), lsCungClip: !ls || ls.closest(".hx-tb-khung") === kClip, nguonHang: new Set(ng.map((x) => Math.round(x.getBoundingClientRect().top))).size };
};
for (const m of MAY) {
  const p = await b.newPage(); const con = []; p.on("pageerror", (e) => con.push(e.message));
  await p.evaluateOnNewDocument((hx) => { try { localStorage.setItem("hx-phien", hx); localStorage.removeItem("hx-loc"); localStorage.setItem("tk-phien", "qc");
    localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: { id: "qc", ten: "QC", vaiTro: "quantri" }, quyen: { "r.xacminh": "lam" } })); } catch (e) {} }, PHIEN_QC);
  await p.setViewport({ width: m.w, height: m.h });
  await p.setRequestInterception(true); p.on("request", (r) => (r.method() !== "GET" && r.method() !== "OPTIONS" ? r.abort() : r.continue()));
  await p.goto("http://localhost:8123/kiemsoatkho/?tab=xacminh", { waitUntil: "networkidle2", timeout: 60000 });
  await p.waitForFunction(() => window.HXACMINH && window.__HX_MUC, { timeout: 30000 });
  const ds = async (sub, sel, at) => { await p.evaluate((s) => window.HXACMINH.sub(s), sub); await ngu(1500); return p.evaluate((sel, at) => [...new Set([...document.querySelectorAll("#hxBody " + sel)].map((e) => e.getAttribute(at)))], sel, at); };
  const mo = async (fn, id) => { await p.evaluate((fn, id) => window.HXACMINH[fn](id), fn, id); await ngu(900);
    await p.waitForFunction(() => { const i = document.querySelector("#mBody .hx-qd-anh img"); return !i || i.complete; }, { timeout: 8000 }).catch(() => {}); await ngu(300); return p.evaluate(DO); };
  const may = [], tv = [];
  for (const id of await ds("cam", "[data-lid]", "data-lid")) { if (may.length >= N) break; const x = await mo("moLuotId", id); if (x.clip) may.push([id, x]); }
  for (const id of await ds("treo", "[data-p]", "data-p")) { if (tv.length >= N) break; const x = await mo("moPhieuId", id); if (x.clip) tv.push([id, x]); }
  ok(may.length && tv.length, m.ten + ": D0 có sự việc Theo máy (" + may.length + ") + phiếu Theo tác vụ (" + tv.length + ") có clip để so");
  const gan = (a, c, k) => a && c && Math.abs(a[k] - c[k]) <= 2;
  const sai = { D11: [], D1: [], D2: [], D3: [], D4: [], D5: [], D6: [], D7: [], D8: [] };
  const goc = may[0] && may[0][1];
  for (const [id, x] of [...may, ...tv]) {
    if (!["l", "t", "w", "h"].every((k) => gan(x.clip, goc.clip, k))) sai.D1.push(id + JSON.stringify(x.clip));
    if (!gan(x.kPhai, goc.kPhai, "l")) sai.D2.push(id + JSON.stringify(x.kPhai));
    if (!["l", "t"].every((k) => gan(x.anh, goc.anh, k)) || !x.khungAnh || Math.abs(x.khungAnh.w - x.anh.w) > 1 || Math.abs(x.khungAnh.h - x.anh.h) > 1 || x.khungAnh.w < x.kPhai.w - 52) { if (!x.tv) sai.D3.push(id + JSON.stringify([x.anh, x.khungAnh, x.kPhai && x.kPhai.w])); }   /* 19/10 (4) Theo tác vụ: ảnh ẩn tới khi bấm nút — chỉ so Theo máy */   // 17/10 (8) user «ảnh chưa khít khung»: ảnh phủ kín khung, khung kín bề rộng cột (trừ lề 24×2)
    if (!gan(x.loi, goc.loi, "l")) sai.D4.push(id + JSON.stringify(x.loi));
    if (!x.qd || (!x.tv && (x.bx.b - x.qd.b) < 0) || (x.bx.b - x.qd.b) > 53 + 16) sai.D5.push(id + " cách đáy " + (x.qd ? x.bx.b - x.qd.b : "?"));   // 17/10 (8) user: lên 3 cm rồi xuống 2 cm ⇒ cách đáy 37px + 16px lề
    if (!x.lsCungClip || (x.ls && x.ls.t < x.clip.b)) sai.D6.push(id);
    if (!x.cungKhungPhai || !(x.loi && x.gy && x.qd && x.loi.t < x.gy.t && x.gy.b <= x.qd.t + 1)) sai.D7.push(id);
    if (x.cuon > 1 && !x.tv) sai.D8.push(id + " " + x.cuon + "px");
    if (!x.tl || !goc.tl || Math.abs((x.tl.t - x.clip.b) - (goc.tl.t - goc.clip.b)) > 2 || !gan(x.tl, goc.tl, "l") || !gan(x.tl, goc.tl, "w") || !gan(x.play, goc.play, "l") || !gan(x.toc, goc.toc, "l")) sai.D11.push(id + JSON.stringify([x.tl, x.clip && x.clip.b]));
  }
  const TEN = { D11: "thanh thời gian + ▶ giờ · Tự động ×1 ×2 ×3 cùng vị trí ở 2 thanh (17/10 (6))", D1: "clip cùng vị trí + kích thước ở 2 thanh", D2: "khung Ảnh ghi nhận cùng mép trái", D3: "Ảnh ghi nhận cùng mép trái/trên, kín bề rộng cột, ảnh phủ khít khung", D4: "nhãn Lỗi cùng mép trái",
    D5: "Quyết định trong màn, cách đáy ≤ ~1,8 cm (20/10 cột phải Theo tác vụ dài thêm)", D6: "Ai tác động dưới clip, cùng khung clip", D7: "Lỗi → Máy gợi ý → Quyết định dưới Ảnh ghi nhận, cùng khung", D8: "Theo máy không cuộn cả thanh (Theo tác vụ 20/10 thêm khối thông tin → được cuộn, clip dính trên)" };
  Object.keys(sai).forEach((k) => ok(!sai[k].length, m.ten + ": " + k + " " + TEN[k] + (sai[k].length ? " — " + sai[k].length + " lệch: " + sai[k].slice(0, 3).join(" | ") : "")));
  ok(!con.length, m.ten + ": D10 không lỗi trang " + con.slice(0, 2).join(" | "));
  if (A.anh) { if (may[0]) { await mo("moLuotId", may[0][0]); await p.screenshot({ path: A.anh + "/dongbo-may-" + m.ten + ".png" }); } if (tv[0]) { await p.evaluate(() => window.HXACMINH.sub("treo")); await ngu(1200); await mo("moPhieuId", tv[0][0]); await p.screenshot({ path: A.anh + "/dongbo-tacvu-" + m.ten + ".png" }); } }
  console.log("  " + m.ten + " · gốc so: " + JSON.stringify({ clip: goc && goc.clip, anh: goc && goc.anh, kPhai: goc && goc.kPhai && goc.kPhai.l }));
  await p.close();
}
await b.close();
console.log(loi.length ? "✗ " + dat + " đạt, " + loi.length + " lỗi:\n  " + loi.join("\n  ") : "✓ " + dat + "/" + dat + " đạt");
process.exit(loi.length ? 1 : 0);
