/**
 * qc-bo-loc-ngay.mjs — đo BỘ LỌC NGÀY CHUẨN toàn dự án (19/10/2026, user «dùng bộ lọc ngày ở Hạng mục 5S / Planogram làm chuẩn cho toàn
 *  dự án, cả Retail và Factory, cả web và điện thoại; bộ lọc nào khác chuẩn thì đổi cho khớp»). Nguồn: hasaki/kiemsoatkho/bo-loc-ngay.js+.css
 *  (factory/bo-loc-ngay.* là bản chép). Bản CHUẨN để so = ô Ngày của Retail › Planogram.
 *   N0 bản chép factory y hệt bản gốc · N1 không còn lịch/ô ngày tự dựng (input type=date, flatpickr, lưới dp-day ngoài bo-loc-ngay.js)
 *   N2 mỗi bộ lọc ngày ở 1440 và 390 px: mở được, lịch CÙNG MẶT với bản chuẩn (bo góc, lề, hiệu ứng popIn/sheetIn, nút nhanh, ô ngày,
 *      số tháng, Trước/Sau, Xoá/Áp dụng), nằm trọn trong màn và bấm được Áp dụng (không bị khung cắt/che)
 *   N3 hành vi: chạm 1 + chạm 2 = khoảng (1 ngày với Plan date), Áp dụng đóng lịch + đổi nhãn nút, bấm ra ngoài thì đóng
 *   N4 lọc dữ liệu giữ đúng: Factory Planogram «7 ngày» trên lịch = khoá cũ '7' (cùng số ô đã vệ sinh); Factory Kiểm kê «7 ngày» = 6 ngày
 *      trước → hôm nay như cũ; Xác minh › Nhật ký «3 ngày» chỉ còn lượt trong 3 ngày
 *  Chặn mọi lượt ghi (chỉ GET). Chạy trên bản nội bộ http://localhost:8123 (xem-noi-bo.mjs). node qc-bo-loc-ngay.mjs [--chi=regex] [--anh=thư mục]
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { phienQC } from "./xacminh-dang-nhap.mjs"; const PHIEN_QC = phienQC();
const DIR = path.dirname(fileURLToPath(import.meta.url));
const A = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const GOC = A.goc || "http://localhost:8123";
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const loi = []; let dat = 0; const ok = (dk, ten) => { if (dk) dat++; else loi.push(ten); console.log((dk ? "  ✓ " : "  ✗ ") + ten); };

/* ---------- N0 + N1: tĩnh ---------- */
const doc = (p) => fs.readFileSync(path.join(DIR, p), "utf8");
ok(doc("kiemsoatkho/bo-loc-ngay.js") === doc("../factory/bo-loc-ngay.js") && doc("kiemsoatkho/bo-loc-ngay.css") === doc("../factory/bo-loc-ngay.css"), "N0 factory/bo-loc-ngay.js + .css chép y hệt bản gốc");
const QUET = ["kiemsoatkho/index.html", "kiemsoatkho/hasaki-planogram.js", "kiemsoatkho/hasaki-kiemke.js", "kiemsoatkho/factory-kiemke.js", "kiemsoatkho/hasaki-xacminh.js",
  "kiemsoatkho/hasaki-pc.js", "kiemsoatkho/hasaki-tonbatthuong.js", "kiemsoatkho/hasaki-maytram.js", "kiemsoatkho/factory-stock.js", "kiemsoatkho/nghiem-thu.html",
  "kiemsoatkho/ket-qua-nghiem-thu.html", "kiemsoatkho/form.html", "../factory/index.html"];
for (const f of QUET) {
  const s = doc(f), sai = [];
  if (/type=\\?["']?date\b/i.test(s)) sai.push("input type=date");
  if (/flatpickr/i.test(s)) sai.push("flatpickr");
  if (/class=\\?["']dp-day/.test(s) || /["']dp-day['" ]/.test(s.replace(/\.dp-day/g, ""))) sai.push("tự dựng lưới dp-day");
  ok(!sai.length, "N1 " + f + ": không có lịch tự dựng" + (sai.length ? " — " + sai.join(", ") : ""));
}

/* ---------- đo trong trang ---------- */
const MO = (sel) => {   // mở bộ lọc ngày ở root `sel`, trả số đo của lịch
  const root = document.querySelector(sel); if (!root) return { loi: "không thấy " + sel };
  const nut = root.querySelector(":scope > .date-btn"); if (!nut) return { loi: "không có nút .date-btn" };
  nut.scrollIntoView({ block: "center" }); nut.click();
  return { ok: 1 };
};
const DO = () => {
  const ps = [...document.querySelectorAll(".date-pop")].filter((p) => !p.classList.contains("hidden") && p.getClientRects().length);
  if (ps.length !== 1) return { loi: ps.length + " lịch đang mở" };
  const p = ps[0], cs = (e) => getComputedStyle(e), q = (s) => p.querySelector(s);
  const ngay = [...p.querySelectorAll(".dp-day")].find((d) => d.getClientRects().length && !d.classList.contains("out"));
  const pre = q(".dp-presets button"), nav = [...p.querySelectorAll(".dp-nav button")].map((b) => b.textContent.trim()), foot = [...p.querySelectorAll(".dp-foot button")].map((b) => b.textContent.trim());
  const thang = [...p.querySelectorAll(".dp-month")].filter((m) => m.getClientRects().length).length;
  const ad = q(".dp-apply"), r = ad.getBoundingClientRect(), W = document.documentElement.clientWidth, H = window.innerHeight, pr = p.getBoundingClientRect();
  const trung = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return {
    mat: { boGoc: cs(p).borderRadius, le: cs(p).paddingTop + " " + cs(p).paddingLeft, hieuUng: cs(p).animationName, bong: cs(p).boxShadow !== "none",
      nhanhBo: pre ? cs(pre).borderRadius : "-", nhanhLe: pre ? cs(pre).padding : "-", nhanhCo: pre ? cs(pre).fontSize : "-",
      ngayCo: ngay ? Math.round(ngay.getBoundingClientRect().height) + "px/" + cs(ngay).fontSize + "/" + cs(ngay).borderRadius : "-",
      thang, nav: nav.join("|"), chan: foot.join("|"), apNen: cs(ad).backgroundColor === cs(document.documentElement).getPropertyValue("--accent").trim() || cs(ad).backgroundColor },
    trongMan: pr.left >= -1 && pr.right <= W + 1 && r.bottom <= H + 1 && r.top >= 0, bamDuoc: trung === ad || ad.contains(trung),
    keoNgang: document.documentElement.scrollWidth > W + 1,
    vet: p.className + " @" + (p.parentElement.id || p.parentElement.className) + " [" + [pr.left, pr.top, pr.right, pr.bottom].map(Math.round) + "] áp [" + [r.top, r.bottom].map(Math.round) + "] H" + H + " " + (p.getAttribute("style") || ""),
  };
};
const CHON = (motNgay) => {   // chạm 2 ngày (motNgay: 1 ngày) rồi Áp dụng
  const p = [...document.querySelectorAll(".date-pop")].find((x) => !x.classList.contains("hidden"));
  const ds = [...p.querySelectorAll(".dp-day")].filter((d) => d.getClientRects().length && !d.classList.contains("out") && !d.classList.contains("khoa"));
  const a = ds[Math.min(3, ds.length - 1)], b = ds[Math.min(5, ds.length - 1)];
  a.click(); if (!motNgay) b.click();
  const sel = p.querySelector(".dp-sel").textContent;
  p.querySelector(".dp-apply").click();
  return { sel, dong: p.classList.contains("hidden"), iso: [a.dataset.iso, motNgay ? a.dataset.iso : b.dataset.iso] };
};
const NHAN = (sel) => { const n = document.querySelector(sel + " > .date-btn"); return n ? n.textContent.trim() : ""; };
const NGOAI = () => { document.body.click(); const p = [...document.querySelectorAll(".date-pop")].find((x) => !x.classList.contains("hidden")); return !p; };

/* ---------- danh sách bộ lọc ngày ---------- */
const DS = [
  { ten: "Retail › Planogram (CHUẨN)", url: "/kiemsoatkho/?tab=planogram", sel: "#pane-planogram .hp-ngayloc", chuan: 1 },
  { ten: "Retail › Vi phạm (Ngày ghi nhận)", url: "/kiemsoatkho/?tab=task", sel: "#dateFilter", truoc: async (p, dt) => { if (dt) await p.evaluate(() => { const b = document.querySelector(".btn-filter"); const f = document.querySelector(".filters"); if (b && f && f.classList.contains("collapsed")) b.click(); }); } },
  { ten: "Retail › Xác minh › Theo máy (Ngày)", url: "/kiemsoatkho/?tab=xacminh", sel: '#hxFilters [data-ngay="ngay"]', truoc: async (p) => { await p.evaluate(async () => { window.HXACMINH && window.HXACMINH.sub("cam"); await new Promise((r) => setTimeout(r, 1500)); const f = document.getElementById("hxFilters"), b = document.getElementById("hxBtnLoc"); if (f && b && f.classList.contains("collapsed") && getComputedStyle(b).display !== "none") b.click(); }); } },
  { ten: "Retail › Xác minh › Nhật ký (Ngày)", url: "/kiemsoatkho/?tab=xacminh", sel: '#hxFilters [data-ngay="tgNgay"]', nhatKy: 1, truoc: async (p) => { await p.evaluate(async () => { window.HXACMINH && window.HXACMINH.sub("tg"); await new Promise((r) => setTimeout(r, 1500)); const f = document.getElementById("hxFilters"), b = document.getElementById("hxBtnLoc"); if (f && b && f.classList.contains("collapsed") && getComputedStyle(b).display !== "none") b.click(); }); } },
  { ten: "Retail › Kiểm kê › Dự báo (Thời gian đợt kiểm)", url: "/kiemsoatkho/?tab=kk", sel: "#hkFcDateWrap", truoc: async (p) => { await p.waitForFunction(() => window.HKIEMKE && document.querySelector("[onclick*='HKIEMKE.fcOpen']"), { timeout: 45000 }).catch(() => {}); await p.evaluate(async () => { for (const x of document.querySelectorAll("[onclick*='HKIEMKE.fcOpen']")) { x.click(); await new Promise((r) => setTimeout(r, 700)); if (document.getElementById("hkFcDateWrap")) return; window.HKIEMKE.closeFc(); await new Promise((r) => setTimeout(r, 300)); } }); await ngu(600); },
    khongCo: "mọi kho đã kiểm 100% nên pop-up Dự báo không có phần mô phỏng (không có ô ngày) — cùng mã với Factory › Dự báo đã đo" },
  { ten: "Retail › Tạo lệnh kiểm kê (Plan date)", url: "/kiemsoatkho/?tab=kk", sel: "#hpcDateLoc", motNgay: 1, truoc: async (p) => { await p.waitForFunction(() => window.HPC, { timeout: 45000 }).catch(() => {}); await p.evaluate(() => { if (!window.HPC) return; const d = document.createElement("div"); document.body.appendChild(d); window.HPC.wire(d); d.innerHTML = '<input type="checkbox" class="hpc-r" data-w="QC" data-s="QC-SKU">'; const c = d.firstChild; c.checked = true; c.dispatchEvent(new Event("change", { bubbles: true })); window.HPC.open(); }); await ngu(900); } },
  { ten: "Factory › Planogram (Ngày)", url: "/factory/", sel: "#plgTop .pg-ngayloc", plg: 1, truoc: async (p) => { await p.evaluate(() => window.showTab && window.showTab("plg")); await p.waitForFunction(() => document.querySelector("#plgTop .pg-ngayloc > .date-btn"), { timeout: 60000 }).catch(() => {}); } },
  { ten: "Factory › Tồn kho chính xác › Kiểm kê (Ngày kiểm)", url: "/factory/", sel: "#kkfNgay", kkf: 1, truoc: async (p) => { await p.evaluate(() => window.showTab && window.showTab("kk")); await p.waitForFunction(() => document.querySelector("#kkfNgay > .date-btn"), { timeout: 60000 }).catch(() => {}); } },
  { ten: "Factory › Kiểm kê › Dự báo (Thời gian đợt kiểm)", url: "/factory/", sel: "#fcDateWrap", truoc: async (p) => { await p.evaluate(() => window.showTab && window.showTab("kk")); await p.waitForFunction(() => document.querySelector("[onclick*='kkFcOpen']"), { timeout: 60000 }).catch(() => {}); await p.evaluate(() => { const x = document.querySelector("[onclick*='kkFcOpen']"); if (x) x.click(); }); await ngu(900); } },
  { ten: "Factory › Tạo lệnh kiểm kê (Plan date)", url: "/factory/", sel: "#pcDateWrap", motNgay: 1, truoc: async (p) => { await p.evaluate(() => window.showTab && window.showTab("kk")); await p.waitForFunction(() => typeof KK !== "undefined" && KK.data && Array.isArray(KK.data.sku) && KK.data.sku.length, { timeout: 60000 }).catch(() => {}); await p.evaluate(() => { if (typeof PC === "undefined" || typeof pcOpen !== "function") return; PC.sel = { "QC|QC-SKU": { wh: "QC", sku: "QC-SKU", pn: "", t: 1, src: "" } }; pcOpen(); }); await ngu(900); } },
].filter((x) => !A.chi || new RegExp(A.chi, "i").test(x.ten));

const MAY = [{ ten: "1440", w: 1440, h: 900, dt: false }, { ten: "390", w: 390, h: 844, dt: true }];
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new", args: ["--disable-features=LocalNetworkAccessChecks"] });
const CHUAN = {};
for (const may of MAY) for (const x of DS) {
  const nhan = x.ten + " @" + may.ten;
  const p = await b.newPage(); const con = []; p.on("pageerror", (e) => con.push(e.message)); p.on("dialog", (d) => d.dismiss());
  await p.evaluateOnNewDocument((hx) => { try { localStorage.setItem("hx-phien", hx); localStorage.setItem("tk-phien", "qc"); localStorage.removeItem("hx-loc");
    localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: { id: "qc", ten: "QC", vaiTro: "quantri" }, quyen: { "r.tong": "lam", "r.task": "lam", "r.xacminh": "lam", "r.kk": "lam", "r.planogram": "lam", "r.hangmuc": "lam", "r.maytram": "lam", "f.tong": "lam", "f.stock": "lam", "f.kk": "lam", "f.plg": "lam", "f.sku": "lam" } })); } catch (e) {} }, PHIEN_QC);
  await p.setViewport({ width: may.w, height: may.h, isMobile: may.dt, hasTouch: may.dt, deviceScaleFactor: 1 });
  await p.setRequestInterception(true); p.on("request", (r) => (r.method() !== "GET" && r.method() !== "OPTIONS" ? r.abort() : r.continue()));
  try { await p.goto(GOC + x.url, { waitUntil: "networkidle2", timeout: 90000 }); } catch (e) { ok(false, nhan + ": không mở được trang " + e.message.slice(0, 60)); await p.close(); continue; }
  await ngu(1500);
  if (x.truoc) await x.truoc(p, may.dt);
  await p.waitForFunction((s) => document.querySelector(s + " > .date-btn"), { timeout: 30000 }, x.sel).catch(() => {});
  const co = await p.evaluate((s) => !!document.querySelector(s + " > .date-btn"), x.sel);
  if (!co && x.khongCo) { console.log("  ○ " + nhan + ": không đo được — " + x.khongCo); await p.close(); continue; }
  if (!co) { ok(false, nhan + ": N2 không dựng được bộ lọc ngày (" + x.sel + ")"); await p.close(); continue; }
  const daPlg = x.plg ? await p.evaluate(() => { const dem = (k) => { PLG.ngay = k; plgRender(); return Object.keys(PLG.by || {}).filter((l) => plgState(PLG.by[l]) === "da").length; }; return { "7": dem("7"), "45": dem("45") }; }) : null;
  const m0 = await p.evaluate(MO, x.sel); if (m0.loi) { ok(false, nhan + ": " + m0.loi); await p.close(); continue; }
  await ngu(450);
  const d = await p.evaluate(DO);
  if (d.loi) { ok(false, nhan + ": N2 " + d.loi); await p.close(); continue; }
  if (x.chuan) CHUAN[may.ten] = d.mat;
  const c = CHUAN[may.ten], khac = c ? Object.keys(c).filter((k) => String(c[k]) !== String(d.mat[k]) && !(k === "nav" || k === "chan" ? false : false)).map((k) => k + ": " + d.mat[k] + " ≠ chuẩn " + c[k]) : ["chưa đo được bản chuẩn"];
  /* 21/10: chạy --chi (bản chuẩn không nằm trong lượt) hoặc bản chuẩn đo hụt → KHÔNG tính hỏng, chỉ ghi «bỏ qua» (đêm 20/10 báo hỏng giả) */
  if (!c) console.log("  –    " + nhan + ": N2 bỏ qua — bản chuẩn chưa đo trong lượt này"); else ok(!khac.length, nhan + ": N2 cùng mặt bản chuẩn" + (khac.length ? " — " + khac.join(" · ") : ""));
  ok(d.trongMan && d.bamDuoc && !d.keoNgang, nhan + ": N2 lịch trọn màn, Áp dụng bấm được" + (d.trongMan ? "" : " — lòi khỏi màn") + (d.bamDuoc ? "" : " — Áp dụng bị che/cắt") + (d.keoNgang ? " — trang kéo ngang" : "") + (d.trongMan && d.bamDuoc ? "" : " · " + d.vet));
  if (A.anh) await p.screenshot({ path: path.join(A.anh, "bo-loc-ngay-" + x.ten.replace(/\W+/g, "-") + "-" + may.ten + ".png") });
  /* N4 trước khi chọn tay: nút nhanh "7 ngày"/"3 ngày" */
  if (x.plg) for (const k of ["7", "45"]) { const r = await p.evaluate((k) => { const p0 = [...document.querySelectorAll(".date-pop")].find((y) => !y.classList.contains("hidden")); if (!p0) return { loi: 1 };
      [...p0.querySelectorAll(".dp-presets button")].find((y) => y.textContent.trim() === k + " ngày").click(); p0.querySelector(".dp-apply").click();
      return { ngay: PLG.ngay, da: Object.keys(PLG.by || {}).filter((l) => plgState(PLG.by[l]) === "da").length, tong: Object.keys(PLG.by || {}).length }; }, k);
    ok(!r.loi && r.da === daPlg[k], nhan + ": N4 «" + k + " ngày» trên lịch = khoá cũ '" + k + "' (" + r.da + " / " + daPlg[k] + " ô đã vệ sinh trên " + r.tong + " ô, PLG.ngay=" + r.ngay + ")");
    await p.evaluate(MO, x.sel); await ngu(400); }
  if (x.kkf) { const r = await p.evaluate(() => { const p0 = [...document.querySelectorAll(".date-pop")].find((y) => !y.classList.contains("hidden")); if (!p0) return { loi: "lịch không mở" }; [...p0.querySelectorAll(".dp-presets button")].find((y) => y.textContent.trim() === "7 ngày").click(); p0.querySelector(".dp-apply").click();
      const t = fcTodayISO(), tm = Date.parse(t + "T00:00:00Z"), d6 = new Date(tm - 6 * 86400000); return { s: KKF.s, e: KKF.e, mong: fcIsoOf(d6.getUTCFullYear(), d6.getUTCMonth(), d6.getUTCDate()), t }; });
    ok(r.s === r.mong && r.e === r.t, nhan + ": N4 «7 ngày» = " + r.mong + " → " + r.t + " như cũ (được " + r.s + " → " + r.e + ")"); await p.evaluate(MO, x.sel); await ngu(400); }
  if (x.nhatKy) { const r = await p.evaluate(async () => { const p0 = [...document.querySelectorAll(".date-pop")].find((y) => !y.classList.contains("hidden")); if (!p0) return { loi: "lịch không mở" }; [...p0.querySelectorAll(".dp-presets button")].find((y) => y.textContent.trim() === "3 ngày").click(); p0.querySelector(".dp-apply").click();
      await new Promise((res) => setTimeout(res, 500)); const t = new Date(); t.setHours(0, 0, 0, 0); const tu = new Date(t); tu.setDate(t.getDate() - 2);
      const luc = [...document.querySelectorAll("#hxBody table.hx-t-tg tbody tr td:first-child")].map((td) => td.textContent.trim()).filter((s) => /^\d\d\/\d\d/.test(s));
      const ngoai = luc.filter((s) => { const d = new Date(t.getFullYear(), Number(s.slice(3, 5)) - 1, Number(s.slice(0, 2))); return d < tu || d > t; });
      return { n: luc.length, ngoai }; });
    ok(!r.ngoai.length, nhan + ": N4 «3 ngày» chỉ còn lượt trong 3 ngày (" + r.n + " nhóm" + (r.ngoai.length ? ", lọt: " + r.ngoai.slice(0, 3).join(", ") : "") + ")"); await p.evaluate(MO, x.sel); await ngu(400); }
  /* N3 hành vi */
  const truoc = await p.evaluate(NHAN, x.sel);
  const h = await p.evaluate(CHON, !!x.motNgay); await ngu(300);
  const sau = await p.evaluate(NHAN, x.sel);
  ok(h.dong && (x.motNgay ? /\d\d\/\d\d\/\d{4}/.test(h.sel) : /→/.test(h.sel)) && sau && sau !== "" , nhan + ": N3 chạm chọn " + (x.motNgay ? "1 ngày" : "khoảng") + " → Áp dụng đóng lịch, nút «" + truoc + "» → «" + sau + "» (chân lịch «" + h.sel + "»)");
  await p.evaluate(MO, x.sel); await ngu(350);
  const ngoai = await p.evaluate(NGOAI);
  ok(ngoai, nhan + ": N3 bấm ra ngoài thì lịch đóng");
  ok(!con.length, nhan + ": không lỗi trang " + con.slice(0, 2).join(" | "));
  await p.close();
}
await b.close();
console.log(loi.length ? "✗ " + dat + " đạt, " + loi.length + " lỗi:\n  " + loi.join("\n  ") : "✓ " + dat + "/" + dat + " đạt");
process.exit(loi.length ? 1 : 0);
