/* 10/10/2026 — QC TAB XÁC MINH · GIAO DIỆN CŨ (user: «qc theo giao diện cũ > dựa vào đó tiếp tục cải tiến giao diện cũ, QC kỹ»).
 *  Bản QC nội bộ localhost:8123 (dữ liệu THẬT từ bang-591), ép localStorage hx-giaodien=cu (tắt lớp Velonic).
 *  2 máy: máy tính 1500×900 · điện thoại 390×844 (isMobile, hasTouch, dpr 2 — chuẩn qc-bo-cuc-dien-thoai).
 *  Màn: 5 mục con (treo · cam · khu · nhac · nv) + pop-up Quyết định phiếu B1 · Lượt camera · Việc 1 nhân viên.
 *  Mỗi màn kiểm (luật quy-chuan-hien-thi-dien-thoai + tinh-dong-bo-du-an):
 *   ① trang không kéo ngang · ② pop-up gọn trong màn · ③ điện thoại: bảng thành THẺ (tr không phải table-row) hoặc bảng nằm trong khung cuộn tự khai
 *   ④ chữ đọc được: điện thoại không chữ < 11px (trừ nhãn ::before) · ⑤ vùng chạm điện thoại ≥ 40px (nút, select, a trong thanh hành động)
 *   ⑥ không icon emoji · ⑦ chữ không tràn khung (scrollWidth > clientWidth mà khung không cuộn) · ⑧ ô chỉ có "—" trong thẻ điện thoại
 *   ⑨ console sạch · ⑩ thời gian vẽ (2 rAF) · ảnh chụp từng màn → .exports/qc-xacminh-cu/<máy>-<màn>.png
 *  node qc-xacminh-cu.mjs [--may=pc|dt] [--man=treo,cam] [--ra=thư mục]   → in bảng + bao-cao.json; mã thoát 3 nếu có lỗi */
import puppeteer from "puppeteer-core"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { phienQC } from "./xacminh-dang-nhap.mjs"; const PHIEN_QC = phienQC();   // 12/10 phần Xác minh cần đăng nhập — bộ đo tự cấp phiên 1 giờ
const A = Object.fromEntries(process.argv.slice(2).filter((x) => x.startsWith("--")).map((x) => { const [k, v] = x.slice(2).split("="); return [k, v ?? "1"]; }));
const URL = A.url || "http://localhost:8123/kiemsoatkho/";
const RA = A.ra || path.join(path.dirname(fileURLToPath(import.meta.url)), ".exports", "qc-xacminh-cu");
fs.mkdirSync(RA, { recursive: true });
const MAY = { pc: { width: 1500, height: 900 }, dt: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } };
const MAN = [
  { k: "treo", mo: "HXACMINH.sub('treo')" }, { k: "cam", mo: "HXACMINH.sub('cam')" },
  { k: "nhac", mo: "HXACMINH.sub('nhac')" }, { k: "nv", mo: "HXACMINH.sub('nv')" },
  { k: "popup-phieu", popup: 1, mo: "HXACMINH.sub('treo'); (document.querySelector('#hxBody tr[data-p], #hxBody .cl-item[data-p]')||{click(){}}).click()" },
  { k: "popup-luot", popup: 1, mo: "HXACMINH.sub('cam'); HXACMINH.moLuotDau()" },
  { k: "popup-nv", popup: 1, mo: "HXACMINH.sub('nv'); HXACMINH.moNVDau()" },
].filter((m) => !A.man || A.man.split(",").includes(m.k));
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;
const br = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
const BC = []; let tongLoi = 0;
for (const [mk, vp] of Object.entries(MAY).filter(([k]) => !A.may || A.may === k)) {
  const p = await br.newPage(); await p.setViewport(vp);
  const loiJS = []; p.on("pageerror", (e) => loiJS.push(String(e.message).slice(0, 140))); p.on("console", (m) => { if (m.type() === "error") loiJS.push("console: " + m.text().slice(0, 140)); });
  p.on("response", (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) loiJS.push(r.status() + " " + r.url().slice(0, 120)); });
  await p.evaluateOnNewDocument((hx) => { try { localStorage.setItem("hx-giaodien", "cu"); } catch (e) {} try { if (hx) localStorage.setItem("hx-phien", hx); } catch (e) {} }, PHIEN_QC);
  await p.goto(URL, { waitUntil: "networkidle2", timeout: 120000 });
  await p.evaluate(async () => { setTab("xacminh"); for (let i = 0; i < 300 && !(window.HXACMINH && HXACMINH.coDuLieu()); i++) await new Promise((r) => setTimeout(r, 50)); });
  for (const m of MAN) {
    loiJS.length = 0;
    await p.evaluate(() => { const c = document.querySelector("#modal.show"); if (c) { (document.querySelector("#modal.show .m-close,#mClose") || { click() {} }).click(); } window.scrollTo(0, 0); });
    await new Promise((r) => setTimeout(r, 350));
    const ms = await p.evaluate(async (src) => { const t = performance.now(); (0, eval)(src); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return Math.round(performance.now() - t); }, m.mo);
    await new Promise((r) => setTimeout(r, m.popup ? 1600 : 700));
    const kq = await p.evaluate((laPopup, laDT, emojiSrc) => {
      const EMO = new RegExp(emojiSrc, "u"); const loi = []; const W = innerWidth;
      const goc = laPopup ? document.querySelector("#modal.show .m-box, #modal.show .modal-box, #modal.show > div") || document.querySelector("#modal.show") : document.getElementById("pane-xacminh");
      if (!goc) return { loi: ["không mở được màn"], so: {} };
      const hien = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
      const ten = (e) => (e.id ? "#" + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : "")) + " «" + (e.innerText || e.value || "").trim().slice(0, 28).replace(/\s+/g, " ") + "»";
      // ① kéo ngang
      if (document.documentElement.scrollWidth > W + 1) loi.push("① trang kéo ngang " + document.documentElement.scrollWidth + " > " + W);
      // ② pop-up gọn
      if (laPopup) { const r = goc.getBoundingClientRect(); if (r.left < -1 || r.right > W + 1) loi.push("② pop-up tràn ngang [" + Math.round(r.left) + "," + Math.round(r.right) + "] / " + W); }
      const tatCa = [...goc.querySelectorAll("*")].filter(hien);
      // ③ bảng điện thoại
      if (laDT) for (const t of goc.querySelectorAll("table")) { if (!hien(t)) continue; const tr = t.querySelector("tbody tr"); if (!tr) continue;
        const cuon = (() => { for (let e = t.parentElement; e && e !== goc.parentElement; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if (o === "auto" || o === "scroll") return e.scrollWidth > e.clientWidth + 1 ? "cuon" : "vua"; } return ""; })();
        if (getComputedStyle(tr).display === "table-row" && t.getBoundingClientRect().width > W - 8 && cuon !== "vua") loi.push("③ bảng chưa thành thẻ trên điện thoại (" + t.querySelectorAll("thead th").length + " cột" + (cuon ? ", kéo ngang trong khung" : "") + "): " + ten(t)); }
      // ④ chữ nhỏ (điện thoại)
      if (laDT) { const nho = new Map(); for (const e of tatCa) { if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue; const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 11) nho.set(e, fs); }
        if (nho.size) loi.push("④ " + nho.size + " chữ < 11px, vd: " + [...nho].slice(0, 3).map(([e, f]) => f + "px " + ten(e)).join(" · ")); }
      // ⑤ vùng chạm (điện thoại)
      if (laDT) { const be = tatCa.filter((e) => e.matches("button, select, .cs-trig, input[type=checkbox], input[type=radio], [data-qd], [data-sx], a.btn, .btn") && !e.closest(".cs-list") && !e.classList.contains("cs-native") && e.getBoundingClientRect().width > 4).filter((e) => { const r = (e.matches("input[type=checkbox], input[type=radio]") && e.closest("label") || e).getBoundingClientRect(); return Math.min(r.height, r.width) < 40 && r.height < 40; });   // ô tick: vùng chạm = cả nhãn bọc nó
        if (be.length) loi.push("⑤ " + be.length + " vùng chạm < 40px, vd: " + be.slice(0, 4).map((e) => Math.round(e.getBoundingClientRect().height) + "px " + ten(e)).join(" · ")); }
      // ⑥ emoji
      const em = tatCa.filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && EMO.test(n.textContent)));
      if (em.length) loi.push("⑥ icon emoji: " + em.slice(0, 3).map(ten).join(" · "));
      // ⑦ chữ tràn khung
      const tran = tatCa.filter((e) => { if (e.scrollWidth <= e.clientWidth + 2 || e.clientWidth === 0) return false; const s = getComputedStyle(e); if (/auto|scroll/.test(s.overflowX) || s.textOverflow === "ellipsis" || e.matches("table, tbody, thead, tr, video, canvas, img, svg, select, input, textarea, pre")) return false; return s.overflowX === "hidden" || s.overflowX === "visible"; })
        .filter((e) => !e.closest("[style*='overflow-x:auto'],[style*='overflow-x: auto']") && e.scrollWidth - e.clientWidth > 6);
      if (tran.length) loi.push("⑦ " + tran.length + " khung chữ/nội dung tràn, vd: " + tran.slice(0, 3).map((e) => "+" + (e.scrollWidth - e.clientWidth) + "px " + ten(e)).join(" · "));
      // ⑧ ô "—" trong thẻ điện thoại
      if (laDT) { const ga = [...goc.querySelectorAll("td")].filter((td) => hien(td) && /^[—–-]$/.test(td.innerText.trim())); if (ga.length) loi.push("⑧ " + ga.length + " ô chỉ có «—» vẫn hiện trong thẻ"); }
      const so = { nut: tatCa.length, anh: goc.querySelectorAll("img").length, cao: Math.round(goc.scrollHeight) };
      return { loi, so };
    }, !!m.popup, mk === "dt", EMOJI.source);
    if (loiJS.length) kq.loi.push("⑨ console/mạng: " + [...new Set(loiJS)].slice(0, 3).join(" | "));
    const anh = path.join(RA, `${mk}-${m.k}.png`);
    if (m.popup) { const h = await p.$("#modal.show .m-box, #modal.show .modal-box, #modal.show > div"); if (h) await h.screenshot({ path: anh }).catch(() => p.screenshot({ path: anh })); else await p.screenshot({ path: anh }); }
    else await p.screenshot({ path: anh, fullPage: mk === "dt" ? false : false });
    tongLoi += kq.loi.length; BC.push({ may: mk, man: m.k, ms, ...kq });
    console.log(`${(kq.loi.length ? "✗" : "✓")} ${mk} · ${m.k.padEnd(12)} ${String(ms).padStart(4)} ms · ${kq.so.nut} phần tử` + (kq.loi.length ? "\n     " + kq.loi.join("\n     ") : ""));
  }
  await p.close();
}
fs.writeFileSync(path.join(RA, "bao-cao.json"), JSON.stringify(BC, null, 1));
console.log(`\n${tongLoi ? "✗ " + tongLoi + " lỗi" : "✓ sạch"} · ảnh + bao-cao.json → ${RA}`);
await br.close(); process.exit(tongLoi ? 3 : 0);
