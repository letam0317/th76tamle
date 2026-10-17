/**
 * qc-thanh-cuon.mjs — đo THANH CUỘN CHUNG toàn dự án (17/10/2026, user «thiết kế thanh cuộn đồng bộ theo theme — QC và áp dụng thanh cuộn ngang/dọc
 *  toàn bộ hạng mục, toàn bộ dự án»). Nguồn kiểu: hasaki/kiemsoatkho/thanh-cuon.css (factory/thanh-cuon.css là bản chép).
 *  Mỗi trang × mỗi theme (8 theme ở 2 dashboard; trang lẻ: sáng + tối hệ thống) × mỗi mục trên thanh bên (dashboard):
 *   S1 mọi vùng ĐANG CUỘN được (dọc/ngang, cả trang) mà không cố ý ẩn → scrollbar-width = thin + scrollbar-color khác auto
 *   S2 con trượt nhìn thấy trên nền thật của vùng đó (độ tương phản ≥ 1,35 sau khi pha alpha), ray trong suốt
 *   S3 tệp chung đã nạp (biến --tc-con có giá trị) · S4 bản chép factory/thanh-cuon.css y hệt bản gốc · S5 không lỗi trang
 *  Chặn mọi lượt ghi. Chạy: node qc-thanh-cuon.mjs [--trang=regex] [--anh=thư mục]
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { phienQC } from "./xacminh-dang-nhap.mjs"; const PHIEN_QC = phienQC();
const DIR = path.dirname(fileURLToPath(import.meta.url));
const A = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const THEME = ["antd", "hasaki", "latte", "solar", "nord", "tokyo", "mocha", "dracula"];
const TRANG = [
  { ten: "Retail", url: "http://localhost:8123/kiemsoatkho/", dash: true },
  { ten: "Factory", url: "http://localhost:8123/factory/", dash: true },
  { ten: "form", url: "http://localhost:8123/kiemsoatkho/form.html" },
  { ten: "nghiem-thu", url: "http://localhost:8123/kiemsoatkho/nghiem-thu.html" },
  { ten: "ket-qua-nghiem-thu", url: "http://localhost:8123/kiemsoatkho/ket-qua-nghiem-thu.html" },
  { ten: "kho170-3d", url: "http://localhost:8123/kiemsoatkho/kho170-3d.html" },
  { ten: "lienanh-3d", url: "http://localhost:8123/kiemsoatkho/lienanh-3d.html" },
  { ten: "bang-591 cũ", url: "http://127.0.0.1:8591/cu/" },
].filter((t) => !A.trang || new RegExp(A.trang, "i").test(t.ten));
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const loi = []; let dat = 0; const ok = (dk, ten) => { if (dk) dat++; else loi.push(ten); console.log((dk ? "  ✓ " : "  ✗ ") + ten); };
ok(fs.readFileSync(path.join(DIR, "kiemsoatkho/thanh-cuon.css"), "utf8") === fs.readFileSync(path.join(DIR, "../factory/thanh-cuon.css"), "utf8"), "S4 factory/thanh-cuon.css chép y hệt bản gốc");
const DO = () => {   // chạy trong trang: mọi vùng đang cuộn được + kiểu thanh cuộn
  const mau = (s) => { const m = String(s).match(/[\d.]+/g); if (!m) return null; const v = m.map(Number);
    if (/color\(srgb/.test(s)) return { r: v[0] * 255, g: v[1] * 255, b: v[2] * 255, a: v.length > 3 ? v[3] : 1 };
    return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const tach = (s) => { const i = String(s).search(/\)\s+(rgb|color|transparent|#)/); return i < 0 ? [s, ""] : [s.slice(0, i + 1), s.slice(i + 1).trim()]; };
  const nen = (e) => { for (let x = e; x; x = x.parentElement) { const c = mau(getComputedStyle(x).backgroundColor); if (c && c.a > 0.5) return c; } return mau(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }; };
  const L = (c) => { const f = (u) => { u /= 255; return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ds = [document.scrollingElement, ...document.querySelectorAll("body *")].filter((e) => { if (!e) return false; const cs = getComputedStyle(e);
    const doc = e === document.scrollingElement, cuonY = (doc || /(auto|scroll)/.test(cs.overflowY)) && e.scrollHeight > e.clientHeight + 2, cuonX = (doc || /(auto|scroll)/.test(cs.overflowX)) && e.scrollWidth > e.clientWidth + 2;
    return (cuonY || cuonX) && e.getClientRects().length && cs.visibility !== "hidden"; });
  const sai = [];
  ds.forEach((e) => { const cs = getComputedStyle(e); if (cs.scrollbarWidth === "none") return;
    const ten = e === document.scrollingElement ? "trang" : (e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : ""));
    if (cs.scrollbarWidth !== "thin" || cs.scrollbarColor === "auto") { sai.push(ten + " kiểu=" + cs.scrollbarWidth + "/" + cs.scrollbarColor); return; }
    const [con, ray] = tach(cs.scrollbarColor), c = mau(con), r = mau(ray), b = nen(e === document.scrollingElement ? document.body : e);
    if (!c) { sai.push(ten + " không đọc được màu " + cs.scrollbarColor); return; }
    const tron = { r: c.r * c.a + b.r * (1 - c.a), g: c.g * c.a + b.g * (1 - c.a), b: c.b * c.a + b.b * (1 - c.a) }, l1 = L(tron), l2 = L(b), tp = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (tp < 1.35) sai.push(ten + " con trượt chìm vào nền (tương phản " + tp.toFixed(2) + ")");
    if (r && r.a > 0.05) sai.push(ten + " ray không trong suốt " + ray); });
  return { n: ds.length, sai, bien: getComputedStyle(document.documentElement).getPropertyValue("--tc-con").trim() };
};
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new", args: ["--disable-features=LocalNetworkAccessChecks"] });
for (const t of TRANG) {
  for (const toi of t.dash ? [false] : [false, true]) {
    const p = await b.newPage(); const con = []; p.on("pageerror", (e) => con.push(e.message));
    await p.evaluateOnNewDocument((hx) => { try { localStorage.setItem("hx-phien", hx); localStorage.setItem("tk-phien", "qc");
      localStorage.setItem("tk-nho", JSON.stringify({ ts: Date.now(), nguoi: { id: "qc", ten: "QC", vaiTro: "quantri" }, quyen: { "r.tong": "lam", "r.task": "lam", "r.xacminh": "lam", "r.kk": "lam", "r.planogram": "lam", "r.hangmuc": "lam", "r.maytram": "lam" } })); } catch (e) {} }, PHIEN_QC);
    await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: toi ? "dark" : "light" }]);
    await p.setViewport({ width: 1366, height: 768 });
    await p.setRequestInterception(true); p.on("request", (r) => (r.method() !== "GET" && r.method() !== "OPTIONS" ? r.abort() : r.continue()));
    try { await p.goto(t.url, { waitUntil: "networkidle2", timeout: 60000 }); } catch (e) { ok(false, t.ten + ": không mở được " + e.message.slice(0, 80)); await p.close(); continue; }
    await ngu(1500);
    const tong = { vung: 0, sai: [] }, tabs = t.dash ? await p.evaluate(() => [...document.querySelectorAll("#sideNav .s-item")].filter((x) => x.offsetParent).map((x, i) => i)) : [null];
    for (const th of t.dash ? THEME : [null]) {
      if (th) await p.evaluate((th) => document.documentElement.setAttribute("data-theme", th), th);
      for (const i of tabs) {
        if (i != null) { await p.evaluate((i) => { const x = [...document.querySelectorAll("#sideNav .s-item")].filter((y) => y.offsetParent)[i]; if (x) x.click(); }, i); await ngu(th === THEME[0] ? 1800 : 500); }
        const x = await p.evaluate(DO); tong.vung += x.n;
        if (!x.bien) tong.sai.push("thiếu --tc-con (chưa nạp thanh-cuon.css)");
        const ten = await p.evaluate((i) => { const x = i == null ? null : [...document.querySelectorAll("#sideNav .s-item")].filter((y) => y.offsetParent)[i]; return x ? x.textContent.trim().slice(0, 24) : ""; }, i);
        x.sai.forEach((s) => tong.sai.push((th || (toi ? "tối" : "sáng")) + (ten ? " › " + ten : "") + ": " + s));
      }
    }
    if (t.ten === "Retail") for (const th of THEME) {   // thanh bên Xác minh (Theo máy + Theo tác vụ) — vùng cuộn Ai tác động / người nghi / menu
      await p.evaluate((th) => document.documentElement.setAttribute("data-theme", th), th);
      for (const [sub, fn] of [["cam", "moLuotDau"], ["treo", null]]) {
        const mo = await p.evaluate(async (sub, fn) => { if (!window.HXACMINH) return false; window.HXACMINH.sub(sub); await new Promise((r) => setTimeout(r, 1200));
          if (fn) return window.HXACMINH[fn](); const r = document.querySelector("#hxBody [data-p]"); return r ? window.HXACMINH.moPhieuId(r.dataset.p) : false; }, sub, fn);
        if (!mo) continue; await ngu(1200); const x = await p.evaluate(DO); tong.vung += x.n; x.sai.forEach((s) => tong.sai.push(th + " › thanh bên " + sub + ": " + s));
      }
    }
    const nhan = t.ten + (t.dash ? " (8 theme × " + tabs.length + " mục" + (t.ten === "Retail" ? " + 2 thanh bên Xác minh" : "") + ")" : toi ? " (tối)" : " (sáng)");
    ok(tong.vung > 0 || !t.dash, nhan + ": S0 có vùng cuộn để đo (" + tong.vung + ")");
    ok(!tong.sai.length, nhan + ": S1–S3 thanh cuộn mảnh, theo theme, thấy rõ — " + (tong.sai.length ? tong.sai.length + " sai: " + [...new Set(tong.sai)].slice(0, 6).join(" | ") : "đạt " + tong.vung + " lượt vùng cuộn"));
    ok(!con.length, nhan + ": S5 không lỗi trang " + con.slice(0, 2).join(" | "));
    if (A.anh && !toi) await p.screenshot({ path: path.join(A.anh, "thanh-cuon-" + t.ten.replace(/\W+/g, "-") + ".png") });
    await p.close();
  }
}
await b.close();
console.log(loi.length ? "✗ " + dat + " đạt, " + loi.length + " lỗi:\n  " + loi.join("\n  ") : "✓ " + dat + "/" + dat + " đạt");
process.exit(loi.length ? 1 : 0);
