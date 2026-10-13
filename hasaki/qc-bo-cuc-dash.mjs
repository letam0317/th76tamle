/**
 * qc-bo-cuc-dash.mjs — đo BỘ CHỈNH BỐ CỤC dashboard (dash-bocuc-sua.js + dash-bocuc-ap.js) trên bản QC 8123 — 13/10/2026, kế hoạch giai đoạn D.
 * KHÔNG ghi dữ liệu thật (luật qc-khong-ghi-du-lieu-that): mọi POST /api/dash/* bị CHẶN ở tầng mạng và giả trả lời {ok}; nội dung gửi đi được giữ để soi;
 * ca cuối so dấu vết (cỡ + giờ sửa) tệp dash-bocuc.js thật trước/sau.
 *  B1 bật bộ chỉnh: bảng tab có đủ mục thanh bên   B2 đổi tên tab → thanh bên + link đổi theo   B3 xuống 1 bậc → thứ tự thanh bên đổi
 *  B4 ẩn tab   B5 sao chép tab → mục mới, bấm mở đúng khung gốc   B6 thêm tab mới → khung trống riêng   B7 khối: kéo mép phải → bề rộng 6/12
 *  B8 khối: ẩn   B9 khối: kéo đổi chỗ   B10 hoàn tác Ctrl+Z   B11 tải lại với bố cục đã lưu → giữ nguyên   B12 điện thoại: không áp bề rộng, vẫn ẩn
 *  B13 lượt lưu gửi đúng {tab, khoi}   B14 tệp thật không bị ghi
 *   node qc-bo-cuc-dash.mjs [--app=retail|factory] [--anh=thư mục]
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { phienQC } from "./xacminh-dang-nhap.mjs";
const A = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, "").split("=")));
const APP = A.app || "retail", ANH = A.anh || "";
const DIR = path.dirname(fileURLToPath(import.meta.url));
const TEP = APP === "factory" ? path.join(DIR, "..", "factory", "dash-bocuc.js") : path.join(DIR, "kiemsoatkho", "dash-bocuc.js");
const URL0 = "http://localhost:8123/" + (APP === "factory" ? "factory" : "retail") + "/";
const dauVet = () => { const s = fs.statSync(TEP); return s.size + "@" + s.mtimeMs; }, vet0 = dauVet();
if (ANH) fs.mkdirSync(ANH, { recursive: true });
const b = await puppeteer.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless: "new" });
let dat = 0; const loi = []; const ok = (dk, ten) => { if (dk) dat++; else loi.push(ten); console.log((dk ? "  ✓ " : "  ✗ ") + ten); };
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
let DA_GUI = null, BOCUC_TAI = null;
async function moTrang(w) {
  const p = await b.newPage(); p.__loi = []; await p.setBypassServiceWorker(true);   // Factory có sw.js: phải qua được lớp chặn mạng của bộ đo
  await p.evaluateOnNewDocument((hx) => { try { localStorage.setItem("hx-phien", hx); } catch (e) {} }, (() => { try { return phienQC(); } catch (e) { return ""; } })());
  await p.setViewport({ width: w || 1440, height: 900, isMobile: (w || 1440) < 600, hasTouch: (w || 1440) < 600 });
  p.on("pageerror", (e) => p.__loi.push(e.message.slice(0, 140)));
  await p.setRequestInterception(true);
  p.on("request", (r) => {
    const u = r.url();
    if (/\/api\/dash\//.test(u) && r.method() === "POST") { if (/bocuc$/.test(u)) { DA_GUI = JSON.parse(r.postData() || "{}"); if (A.debug) console.log("    · lưu: tab " + DA_GUI.tab.length + " · khối " + Object.keys(DA_GUI.khoi).join(",")); } return r.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, ver: 99 }) }); }
    if (/\/api\/dash\/[a-z]+\/ping/.test(u)) return r.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, ver: 0 }) });
    if (BOCUC_TAI && /dash-bocuc\.js\?/.test(u)) return r.respond({ status: 200, contentType: "text/javascript", body: "window.DASH_BOCUC=" + JSON.stringify(BOCUC_TAI) + ";" });
    if (!/^(GET|OPTIONS|HEAD)$/.test(r.method())) return r.abort();
    r.continue();
  });
  return p;
}
const napSua = (p) => p.evaluate(() => new Promise((ok) => { const s = document.createElement("script"); s.src = "dash-bocuc-sua.js?qc=" + Date.now(); s.onload = ok; document.body.appendChild(s); }));
const tenMuc = (p) => p.evaluate(() => [...document.querySelectorAll("#sideNav .s-item")].filter((x) => getComputedStyle(x).display !== "none").map((x) => { const c = x.cloneNode(true); c.querySelectorAll(".sn,.di").forEach((y) => y.remove()); return c.textContent.trim(); }));
const bam = (p, sel) => p.evaluate((s) => { const x = document.querySelector(s); if (x) x.click(); return !!x; }, sel);

console.log("── bộ chỉnh bố cục " + APP);
const p = await moTrang(); await p.goto(URL0, { waitUntil: "networkidle2", timeout: 90000 }); await nghi(5000);
await napSua(p); await nghi(500);
await bam(p, "#dashNut"); await nghi(600);
const truoc = await tenMuc(p), soTr = await p.evaluate(() => document.querySelectorAll("#dashBang .tr").length);
ok(soTr >= truoc.length && truoc.length > 2, "B1 bảng tab " + soTr + " dòng · thanh bên " + truoc.length + " mục");
// B2 đổi tên mục thứ 2
const doiTen = async (i, v) => p.evaluate((i, v) => { const x = document.querySelectorAll("#dashBang .tr input[data-f=ten]")[i]; x.value = v; x.dispatchEvent(new Event("change", { bubbles: true })); }, i, v);
await doiTen(1, "Tên thử QC"); await nghi(500);
const sau2 = await tenMuc(p), link2 = await p.evaluate(() => { const x = [...document.querySelectorAll("#sideNav .s-item")].find((y) => y.textContent.indexOf("Tên thử QC") >= 0); return x ? window.adDuongMuc(x) : ""; });
ok(sau2.includes("Tên thử QC") && /tenthuqc$/.test(link2), "B2 đổi tên → thanh bên «Tên thử QC» · link " + link2);
// B3 xuống 1 bậc
await p.evaluate(() => document.querySelectorAll("#dashBang .tr")[1].querySelector("[data-a=xuong]").click()); await nghi(500);
const sau3 = await tenMuc(p);
ok(sau3.indexOf("Tên thử QC") === sau2.indexOf("Tên thử QC") + 1 || sau3.indexOf("Tên thử QC") > sau2.indexOf("Tên thử QC"), "B3 xuống 1 bậc: vị trí " + sau2.indexOf("Tên thử QC") + " → " + sau3.indexOf("Tên thử QC"));
// B4 ẩn
await p.evaluate(() => document.querySelectorAll("#dashBang .tr")[2].querySelector("[data-a=an]").click()); await nghi(500);
const sau4 = await tenMuc(p); ok(!sau4.includes("Tên thử QC"), "B4 ẩn tab → thanh bên còn " + sau4.length + " mục");
await p.evaluate(() => document.querySelectorAll("#dashBang .tr")[2].querySelector("[data-a=an]").click()); await nghi(400);
// B5 sao chép tab thứ 2 (bản gốc mục 2 sau khi xuống bậc)
await p.evaluate(() => document.querySelectorAll("#dashBang .tr")[2].querySelector("[data-a=sao]").click()); await nghi(600);
const ban = await p.evaluate(() => { const x = [...document.querySelectorAll("#sideNav .s-item[data-dash^='ban:']")][0]; if (!x) return null; x.click(); return x.dataset.dash; });
await nghi(2500);
const ban2 = await p.evaluate(() => ({ on: (document.querySelector("#sideNav .s-item.on") || {}).dataset?.dash || "", khung: (window.DASH_AP.khungDangMo() || {}).id || "", path: location.pathname }));
ok(ban && ban2.on === ban && /^(pane-|view)/.test(ban2.khung), "B5 sao chép → mục " + ban + " mở khung " + ban2.khung + " · link " + ban2.path);
// B6 thêm tab mới
await bam(p, "#dashBang [data-a=them]"); await nghi(600);
await p.evaluate(() => { const x = [...document.querySelectorAll("#sideNav .s-item[data-dash^='moi:']")].pop(); if (x) x.click(); }); await nghi(1200);
const moi = await p.evaluate(() => { const k = window.DASH_AP.khungDangMo(); return { id: k && k.id, thay: k && k.offsetParent !== null, trong: !!(k && k.querySelector(".dash-trong")), khac: [...document.querySelectorAll("[id^=pane-],[id^=view]")].filter((x) => x.offsetParent !== null).length }; });
ok(/^dashPane-moi/.test(moi.id) && moi.thay && moi.trong && moi.khac === 0, "B6 tab mới → khung " + moi.id + " (trống), khung app khác đang hiện: " + moi.khac);
// về tab gốc có ≥2 khối để chỉnh khối
const tabKhoi = await p.evaluate(() => { const ds = [...document.querySelectorAll("#sideNav .s-item")].filter((x) => !x.dataset.dash);
  for (const it of ds) { it.click(); } return null; });
const chonTab = await p.evaluate(async () => { const ds = [...document.querySelectorAll("#sideNav .s-item")].filter((x) => !x.dataset.dash && x.dataset.tab !== "home");
  for (const it of ds) { it.click(); await new Promise((r) => setTimeout(r, 1500)); const k = window.DASH_AP.dsKhoi().filter((x) => x.getBoundingClientRect().width > 0); if (k.length >= 2) return { k: window.DASH_AP.khoaTab(), n: k.length, ids: k.map((x) => x.dataset.khoi) }; } return null; });
ok(!!chonTab, "chọn tab có ≥2 khối: " + (chonTab ? chonTab.k + " · " + chonTab.ids.join(", ") : "không có"));
if (chonTab) {
  await nghi(800); await p.evaluate(() => document.querySelector("#sideNav") && null);
  await p.evaluate(() => { document.querySelector("#dashNut").click(); document.querySelector("#dashNut").click(); }); await nghi(800);   // vẽ lại tay nắm cho tab này
  // B7 kéo mép phải khối 1 về nửa bề rộng
  const m = await p.evaluate(() => { const el = window.DASH_AP.dsKhoi().filter((x) => x.getBoundingClientRect().width > 0 || x.hasAttribute('data-dash-an'))[0], h = el.querySelector(".dash-mep.p"), v = el.parentNode.getBoundingClientRect(), r = h.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(40, r.height / 2), dich: v.left + v.width / 2 }; });
  await p.mouse.move(m.x, m.y); await p.mouse.down(); await p.mouse.move(m.dich, m.y, { steps: 6 }); await p.mouse.up(); await nghi(600);
  const r7 = await p.evaluate(() => { const el = window.DASH_AP.dsKhoi().filter((x) => x.getBoundingClientRect().width > 0 || x.hasAttribute('data-dash-an'))[0]; return { rong: getComputedStyle(el).getPropertyValue("--dash-rong").trim(), luoi: el.parentNode.classList.contains("dash-luoi"), w: Math.round(el.getBoundingClientRect().width), vw: Math.round(el.parentNode.getBoundingClientRect().width) }; });
  ok(r7.luoi && r7.rong === "6" && r7.w < r7.vw * 0.6, "B7 kéo mép phải → rộng " + r7.rong + "/12 (" + r7.w + "/" + r7.vw + "px)");
  if (ANH) await p.screenshot({ path: ANH + "/" + APP + "-b7.png" });
  // B8 ẩn khối 2
  await p.evaluate(() => window.DASH_AP.dsKhoi().filter((x) => x.getBoundingClientRect().width > 0 || x.hasAttribute('data-dash-an'))[1].querySelector(".dash-tbk [data-a=an]").click()); await nghi(500);
  const an8 = await p.evaluate((id) => document.querySelector('[data-khoi="' + id + '"]').hasAttribute("data-dash-an"), chonTab.ids[1]);
  ok(an8, "B8 ẩn khối " + chonTab.ids[1]);
  // B9 kéo khối cuối lên trước khối đầu
  const kk = await p.evaluate(() => { const ds = window.DASH_AP.dsKhoi().filter((x) => x.getBoundingClientRect().width > 0 || x.hasAttribute('data-dash-an')), a = ds[ds.length - 1].querySelector(".dash-tbk .keo").getBoundingClientRect(), d = ds[0].getBoundingClientRect(); return { ax: a.left + 8, ay: a.top + 8, dx: d.left + 30, dy: d.top + Math.min(8, d.height / 4) }; });
  await p.mouse.move(kk.ax, kk.ay); await p.mouse.down(); await p.mouse.move(kk.dx, kk.dy, { steps: 8 }); await p.mouse.up(); await nghi(600);
  const thu9 = await p.evaluate((k) => (window.DASH_BOCUC.khoi[k] || []).map((x) => x.id), chonTab.k);
  ok(thu9.indexOf(chonTab.ids[chonTab.ids.length - 1]) < thu9.indexOf(chonTab.ids[0]), "B9 kéo đổi chỗ → thứ tự " + thu9.join(" › "));
  // B10 hoàn tác
  await p.keyboard.down("Control"); await p.keyboard.press("z"); await p.keyboard.up("Control"); await nghi(600);
  const thu10 = await p.evaluate((k) => (window.DASH_BOCUC.khoi[k] || []).map((x) => x.id), chonTab.k);
  ok(thu10.indexOf(chonTab.ids[0]) < thu10.indexOf(chonTab.ids[chonTab.ids.length - 1]), "B10 Ctrl+Z → về " + thu10.join(" › "));
  await nghi(900);
  // B13 lượt lưu
  ok(DA_GUI && Array.isArray(DA_GUI.tab) && DA_GUI.khoi && DA_GUI.khoi[chonTab.k], "B13 lượt lưu gửi {tab:" + (DA_GUI ? DA_GUI.tab.length : 0) + ", khoi:[" + (DA_GUI ? Object.keys(DA_GUI.khoi).join(",") : "") + "]} (đã CHẶN, không ghi tệp)");
}
/* B15–B18 (13/10 chiều, user: «pop-up không kéo/chỉnh được» · «không kéo được hạng mục trong Phiếu đang mở») — chỉ Retail (Xác minh) */
if (APP === "retail") {
  const khoaVung = () => p.evaluate(() => { const b = document.querySelector("#dashBang .dd b"); return b ? b.textContent : ""; });
  await p.evaluate(() => { const x = document.querySelector('#sideNav .s-item[data-sub="treo"]'); if (x) x.click(); }); await nghi(3500);
  // B16 vào trong «Phiếu đang mở»
  const vao = await p.evaluate(() => { const pn = [...document.querySelectorAll("#pane-xacminh [data-khoi]")].find((x) => /Phiếu đang mở/.test(x.textContent) && x.querySelector(".dash-tbk [data-a=vao]")); if (!pn) return null; pn.querySelector(".dash-tbk [data-a=vao]").click(); return pn.dataset.khoi; });
  await nghi(600);
  const con = await p.evaluate(() => [...document.querySelectorAll(".dash-vung > [data-khoi]")].filter((x) => x.getBoundingClientRect().width > 0).map((x) => x.dataset.khoi));
  ok(vao && con.length >= 2, "B16 «Vào trong» khối " + vao + " → " + con.length + " mục con: " + con.join(", ") + " · " + (await khoaVung()));
  if (con.length >= 2) {
    await p.evaluate((id) => document.querySelector('.dash-vung > [data-khoi="' + id + '"] .dash-tbk [data-a=xuong]').click(), con[0]); await nghi(600);
    const sau = await p.evaluate(() => { const k = Object.keys(window.DASH_BOCUC.khoi).find((x) => x.indexOf("|") > 0 && !/^pop:/.test(x)); return k ? { k, ds: window.DASH_BOCUC.khoi[k].map((x) => x.id) } : null; });
    ok(sau && sau.ds.indexOf(con[0]) > sau.ds.indexOf(con[1]), "B16 nút ↓ đổi chỗ mục con trong vùng " + (sau && sau.k) + ": " + (sau && sau.ds.join(" › ")));
    if (ANH) await p.screenshot({ path: ANH + "/" + APP + "-b16.png" });
    await p.evaluate(() => document.querySelector("#dashBang .dd [data-a=ra]").click()); await nghi(500);
    ok(!/›/.test(await khoaVung()), "B17 «Ra ngoài» về vùng gốc: " + (await khoaVung()));
  }
  // B15 pop-up: mở pop-up quyết định → bộ chỉnh chuyển sang vùng pop-up
  await p.evaluate(() => { const td = [...document.querySelectorAll("#pane-xacminh table.hx-chung tbody tr[data-p] td")].find((x) => x.offsetParent !== null); if (td) td.click(); }); await nghi(2500);
  const pop = await p.evaluate(() => ({ goc: window.DASH_AP.vungGoc().key, khoi: [...document.querySelectorAll(".dash-vung > [data-khoi]")].filter((x) => x.getBoundingClientRect().width > 0).map((x) => x.dataset.khoi) }));
  ok(/^pop:/.test(pop.goc) && pop.khoi.length >= 2 && /Pop-up/.test(await khoaVung()), "B15 pop-up mở → bộ chỉnh chỉnh vùng " + pop.goc + " (" + pop.khoi.join(", ") + ")");
  if (pop.khoi.length >= 2) {
    const vao2 = await p.evaluate(() => { const el = [...document.querySelectorAll(".dash-vung > [data-khoi]")].find((x) => x.querySelector(":scope > .dash-tbk [data-a=vao]")); if (!el) return null; el.querySelector(":scope > .dash-tbk [data-a=vao]").click(); return el.dataset.khoi; });
    await nghi(600);
    const con2 = await p.evaluate(() => [...document.querySelectorAll(".dash-vung > [data-khoi]")].filter((x) => x.getBoundingClientRect().width > 0).map((x) => x.dataset.khoi));
    if (con2.length >= 2) { await p.evaluate((id) => document.querySelector('.dash-vung > [data-khoi="' + id + '"] .dash-tbk [data-a=xuong]').click(), con2[0]); await nghi(600); }
    const k2 = await p.evaluate(() => Object.keys(window.DASH_BOCUC.khoi).filter((x) => /^pop:/.test(x)));
    ok(vao2 && con2.length >= 2 && k2.some((x) => x.indexOf("|") > 0), "B18 trong pop-up: «Vào trong» " + vao2 + " → mục con " + con2.join(", ") + " · đổi chỗ lưu ở " + k2.join(", "));
    if (ANH) await p.screenshot({ path: ANH + "/" + APP + "-b18.png" });
  }
}
ok(!p.__loi.length, "không lỗi trang" + (p.__loi.length ? " — " + p.__loi[0] : ""));
await p.close();
// B11 tải lại với bố cục đã lưu
if (DA_GUI) {
  BOCUC_TAI = { ver: 99, tab: DA_GUI.tab, khoi: DA_GUI.khoi };
  const q = await moTrang(); await q.goto(URL0, { waitUntil: "networkidle2", timeout: 90000 }); await nghi(5000);
  const ten11 = await tenMuc(q);
  ok(ten11.includes("Tên thử QC") && ten11.some((x) => /bản sao/.test(x)) && ten11.includes("Tab mới"), "B11 tải lại giữ tên/bản sao/tab mới: " + ten11.join(" · "));
  if (chonTab) {
    await q.evaluate((k) => { const it = [...document.querySelectorAll("#sideNav .s-item")].find((x) => window.DASH_AP.khoaItem(x) === k); if (it) it.click(); }, chonTab.k); await nghi(2500);
    const r11 = await q.evaluate((id) => { const el = document.querySelector('[data-khoi="' + id + '"]'); return el ? { rong: getComputedStyle(el).getPropertyValue("--dash-rong").trim(), an: !!document.querySelector("[data-dash-an][data-khoi]") } : null; }, chonTab.ids[0]);
    ok(r11 && r11.rong === "6" && r11.an, "B11 khối giữ rộng 6/12 + khối ẩn sau tải lại");
    if (ANH) await q.screenshot({ path: ANH + "/" + APP + "-b11.png" });
  }
  await q.close();
  // B12 điện thoại
  if (chonTab) {
    const d = await moTrang(390); await d.goto(URL0, { waitUntil: "networkidle2", timeout: 90000 }); await nghi(5000);
    await d.evaluate((k) => { const it = [...document.querySelectorAll("#sideNav .s-item")].find((x) => window.DASH_AP.khoaItem(x) === k); if (it) it.click(); }, chonTab.k); await nghi(2500);
    const r12 = await d.evaluate(() => { const v = document.querySelector(".dash-luoi"); return { luoi: !!v, hienThi: v ? getComputedStyle(v).display : "", an: [...document.querySelectorAll("[data-dash-an][data-khoi]")].every((x) => x.offsetParent === null) }; });
    ok(r12.luoi && r12.hienThi !== "grid" && r12.an, "B12 điện thoại: vùng khối hiển thị «" + r12.hienThi + "» (không thành lưới 12 cột) · khối ẩn vẫn ẩn");
    await d.close();
  }
}
await b.close();
ok(dauVet() === vet0, "B14 tệp thật " + path.basename(TEP) + " không bị ghi");
console.log(loi.length ? "✗ " + loi.length + " lỗi / " + (dat + loi.length) + " ca" : "✓ bộ chỉnh bố cục: đạt " + dat + " ca"); process.exit(loi.length ? 1 : 0);
