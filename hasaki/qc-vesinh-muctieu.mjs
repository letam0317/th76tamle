/**
 * qc-vesinh-muctieu.mjs — BỘ ĐO BÁM MỤC TIÊU cho tab Planogram › Vệ sinh (dashboard kiemsoatkho).
 *
 *  VÌ SAO CÓ TỆP NÀY (user chốt 28/09/2026): "QC hiển thị cả web và điện thoại, theo hướng chuyên
 *  nghiệp/hiện đại, tiện lợi/thân thiện, không hiển thị mục rác, gọn gàng" + "sau này thêm 20 khu thì
 *  hiển thị thế nào". Bộ đo cũ (qc-mobile-toan-du-an) chỉ canh luật bố cục chung — không biết màn đầu
 *  có trả lời được "hôm nay xong bao nhiêu, ai chưa làm" không, các con số có KHỚP nhau không, xem ngày
 *  cũ có ra đúng ngày không, hay chữ lập trình có lọt ra màn không. Tệp này đo đúng mấy thứ đó.
 *
 *  Nhóm ca (mỗi máy: Máy tính 1440 · iPhone 14 390 · iPhone SE 375 · Android hẹp 360):
 *   GỌN      trang không kéo ngang · điện thoại cao ≤ 2.600px · từ đỉnh tab tới thẻ đầu ≤ 130px
 *   MÀN ĐẦU  thẻ Tiến độ + Cần xử lý nằm trong màn đầu tiên
 *   SƠ ĐỒ    điện thoại thấy ĐỦ 16 dãy quầy kệ + 4 cụm bàn không kéo ngang · "Phóng to" bấm thật được
 *   KHỚP SỐ  Cần xử lý = tab "Chưa báo cáo" · thẻ Đã vệ sinh = tab "Đã báo cáo" · chip màu cộng lại = số ô
 *   NGÀY CŨ  xem hôm qua → tiêu đề "Nhân viên ngày dd/MM" (không còn "hôm nay"), số vẫn khớp
 *   RÁC      không còn chữ lập trình / câu hướng dẫn / chân trang lặp / số tổng 7 ngày
 *   POP-UP   "Quá 3 ngày": người nghỉ không mang nhãn đỏ · pop-up ô: 7 ô ngày 1 hàng, không câu hướng dẫn
 *   CHẠM     mọi nút mới ≥ 40px trên điện thoại
 *   25 KHU   giả lập thêm 23 khu → hiện nút chọn khu (không 25 chip), bảng Khu vực, chọn 1 khu vẽ lưới
 *            tự sinh, trang vẫn không kéo ngang
 *
 *  node hasaki/qc-vesinh-muctieu.mjs [--url <u>] [--may=pc|ip14|ipse|and]
 *  Mặc định đo bản nội bộ http://localhost:8123 (XEM-BAN-NOI-BO.bat). Chỉ đọc — không ghi dữ liệu.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { EDGE_PATH } from "./token-store.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, ".exports", "qc-vesinh-muctieu");
fs.mkdirSync(OUT, { recursive: true });
const argv = process.argv.slice(2);
const iU = argv.indexOf("--url");
const BASE = iU >= 0 ? argv[iU + 1] : "http://localhost:8123/kiemsoatkho/";
const URL = BASE.replace(/\/?$/, "/") + "?company=hasaki&tab=planogram";
const chiMay = (argv.find((a) => a.startsWith("--may=")) || "").slice(6);
const UA_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const UA_AND = "Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36";
const MAY = [
  { ma: "pc", ten: "Máy tính 1440", w: 1440, h: 900, dt: false },
  { ma: "ip14", ten: "iPhone 14", w: 390, h: 844, dt: true, ua: UA_IOS },
  { ma: "ipse", ten: "iPhone SE", w: 375, h: 667, dt: true, ua: UA_IOS },
  { ma: "and", ten: "Android hẹp", w: 360, h: 780, dt: true, ua: UA_AND },
].filter((m) => !chiMay || m.ma === chiMay);

const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
const ketQua = [];
let may = "";
function bao(ok, ten, chiTiet) {
  ketQua.push({ ok, may, ten, chiTiet });
  console.log((ok ? "  ✓ " : "  ✗ ") + ten + (chiTiet !== undefined && chiTiet !== "" ? "  — " + chiTiet : ""));
}
/* Trần thời gian cho mọi bước (luật "bộ đo không được treo câm") */
const tran = (p, ms, buoc) => Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error("TREO ở bước: " + buoc)), ms))]);
const choSo = async (p) => p.waitForFunction("(" + (() => {
  const t = document.querySelector("#hpToday .hp-tile .k");
  return !!t && /\d/.test(t.textContent);   /* chỉ bám số thật — để bản CŨ vẫn đo được và lộ lỗi, không treo ở bước chờ */
}) + ")()", { timeout: 60000 });

const CHU_RAC = [
  "combo lọc sinh động", "gõ để lọc, đếm số dòng", "bấm ô ngày bên dưới", "SHOP - 170 QUOC LO 1A",
  "F0-A1 + F0-A8", "yêu cầu · cập nhật", "Cần nhắc theo nhân viên", "Độ phủ yêu cầu vệ sinh",
];

const br = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH });
for (const m of MAY) {
  may = m.ten;
  console.log("\n══ " + m.ten + " (" + m.w + "×" + m.h + ")");
  const p = await br.newPage();
  const loiTrang = [];
  p.on("pageerror", (e) => loiTrang.push(e.message.slice(0, 160)));
  p.on("console", (x) => { if (x.type() === "error" && !/favicon|net::ERR/i.test(x.text())) loiTrang.push(x.text().slice(0, 160)); });
  p.on("dialog", (d) => d.dismiss().catch(() => {}));
  if (m.ua) await p.setUserAgent(m.ua);
  await p.setViewport({ width: m.w, height: m.h, deviceScaleFactor: m.dt ? 2 : 1, isMobile: m.dt, hasTouch: m.dt });
  try {
    await tran(p.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 }), 95000, "mở trang");
    await tran(choSo(p), 65000, "chờ số liệu thật");
    await ngu(5000);   // bậc 3 (chấm công, phân công, AI) về

    /* ---------- GỌN + MÀN ĐẦU ---------- */
    const g = await p.evaluate(() => {
      const pane = document.getElementById("pane-planogram");
      const top = (id) => { const e = document.getElementById(id); return e ? e.getBoundingClientRect().top + scrollY : -1; };
      const bot = (id) => { const e = document.getElementById(id); return e ? e.getBoundingClientRect().bottom + scrollY : -1; };
      return { keoNgang: document.documentElement.scrollWidth - innerWidth, cao: document.documentElement.scrollHeight,
        dauTab: top("hpToday") - (pane.getBoundingClientRect().top + scrollY), todayBot: bot("hpToday"), todoTop: top("hpTodo"), todoBot: bot("hpTodo"), vh: innerHeight };
    });
    bao(g.keoNgang <= 0, "GỌN · trang không kéo ngang", g.keoNgang + "px");
    if (m.dt) bao(g.cao <= 2600, "GỌN · trang điện thoại ≤ 2.600px (bản cũ 7.230px)", g.cao + "px");
    bao(g.dauTab <= 130, "GỌN · từ đỉnh tab tới thẻ đầu ≤ 130px (luật ⑬)", Math.round(g.dauTab) + "px");
    bao(g.todayBot <= g.vh + 1, "MÀN ĐẦU · thẻ Tiến độ nằm trọn màn đầu", Math.round(g.todayBot) + " / " + g.vh);
    bao(g.todoTop < g.vh, "MÀN ĐẦU · thẻ Cần xử lý bắt đầu trong màn đầu", Math.round(g.todoTop) + " / " + g.vh);

    /* ---------- RÁC ---------- */
    const rac = await p.evaluate((ds) => { const t = document.getElementById("pane-planogram").innerText; return ds.filter((x) => t.indexOf(x) >= 0); }, CHU_RAC);
    bao(!rac.length, "RÁC · không còn chữ lập trình / hướng dẫn / chân trang lặp", rac.join(" | "));
    const racHint = await p.evaluate(() => [...document.querySelectorAll("#pane-planogram p.hp-hint")].filter((e) => e.offsetParent).map((e) => e.textContent.trim().slice(0, 50)));
    bao(!racHint.length, "RÁC · không còn đoạn gợi ý thường trực", racHint.join(" | "));

    /* ---------- KHỚP SỐ ---------- */
    const so = await p.evaluate(() => {
      const num = (s) => Number(String(s || "").replace(/[^\d]/g, "")) || 0;
      const tile = (k) => document.querySelector('#hpToday .hp-tile[data-k="' + k + '"]');
      const td = (k) => document.querySelector('#hpNhacSlot .hp-tdrow[data-td="' + k + '"]');
      const tab = (t) => { const b = document.querySelector('#hpAI .hp-whtab[data-t="' + t + '"] b'); return b ? num(b.textContent) : -1; };
      const nhac = td("nhac");
      const daT = tile("da"), nhT = tile("nhac");
      const dm = [...document.querySelectorAll("#hpMap .hp-legchip")].filter((c) => !/canhbao|khongchac/.test(c.dataset.st));
      const tongChip = dm.reduce((s, c) => s + num(c.querySelector("b").textContent), 0);
      const ycTot = num((document.querySelector("#hpToday .hp-progt b") || {}).textContent.split("/")[1]);
      return {
        tdNhac: nhac ? num(nhac.querySelector(".n").textContent) : 0, tdNhacO: nhac ? num((nhac.querySelector("small") || {}).textContent) : 0,
        tabChua: tab("chua"), tabDa: tab("da"), daNv: daT ? num((daT.querySelector(".s") || {}).textContent) : -1,
        nhacTile: nhT ? num(nhT.querySelector(".k").textContent) : -1, tongChip, ycTot,
        dmSo: dm.length, coNhac: !!nhac,
      };
    });
    bao(!so.coNhac || so.tdNhac === so.tabChua, "KHỚP SỐ · Cần xử lý (người chưa báo cáo) = tab \"Chưa báo cáo\"", so.tdNhac + " = " + so.tabChua);
    bao(so.daNv === so.tabDa, "KHỚP SỐ · thẻ Đã vệ sinh (số nhân viên) = tab \"Đã báo cáo\"", so.daNv + " = " + so.tabDa);
    bao(!so.coNhac || so.tdNhacO === so.nhacTile, "KHỚP SỐ · số vị trí trong Cần xử lý = ô \"Chưa · đi làm\"", so.tdNhacO + " = " + so.nhacTile);
    bao(so.dmSo >= 2 && so.tongChip >= so.ycTot, "KHỚP SỐ · chip màu cộng lại phủ hết ô có yêu cầu", so.tongChip + " ≥ " + so.ycTot);

    /* ---------- CHIP CHÚ GIẢI BẤM THẬT ---------- */
    const chip = await p.$("#hpMap .hp-legchip[data-st='done']") || await p.$("#hpMap .hp-legchip");
    if (chip) {
      await chip.click(); await ngu(400);
      const dim = await p.evaluate(() => ({ dim: document.querySelectorAll("#hpMap .hp-mapcell.dim").length, on: !!document.querySelector("#hpMap .hp-legchip.on") }));
      bao(dim.on && dim.dim > 0, "SƠ ĐỒ · bấm chip màu → ô nhóm khác mờ đi", dim.dim + " ô mờ");
      const chip2 = await p.$("#hpMap .hp-legchip.on"); if (chip2) { await chip2.click(); await ngu(400); }
      const het = await p.evaluate(() => document.querySelectorAll("#hpMap .hp-mapcell.dim").length);
      bao(het === 0, "SƠ ĐỒ · bấm lại chip → bỏ lọc", het + " ô còn mờ");
    } else bao(false, "SƠ ĐỒ · có dải chip chú giải");

    /* ---------- SƠ ĐỒ VỪA MÀN (điện thoại) ---------- */
    if (m.dt) {
      const sd = await p.evaluate(() => {
        const scs = [...document.querySelectorAll("#hpMap .hp-mapscroll")];
        const tran = scs.map((s) => s.scrollWidth - s.clientWidth);
        const cols = [...document.querySelectorAll("#hpMap .hp-mapa1 .hp-mapcol .cl")].map((c) => c.getBoundingClientRect());
        const ngoai = cols.filter((r) => r.right > innerWidth || r.left < 0).length;
        return { tran, soDay: cols.length, ngoai };
      });
      bao(sd.tran.every((x) => x <= 1), "SƠ ĐỒ · điện thoại: sơ đồ vừa bề ngang, không kéo", sd.tran.join(" / ") + "px");
      bao(sd.soDay === 16 && sd.ngoai === 0, "SƠ ĐỒ · thấy đủ 16 dãy quầy kệ trong màn", sd.soDay + " dãy, " + sd.ngoai + " ngoài màn");
      const nutPhong = await p.$("#hpMap .hp-chiM");
      if (nutPhong) {
        await nutPhong.click(); await ngu(500);
        const to = await p.evaluate(() => ({ cuon: [...document.querySelectorAll("#hpMap .hp-mapscroll")].some((s) => s.scrollWidth > s.clientWidth + 1), trang: document.documentElement.scrollWidth - innerWidth, mini: document.getElementById("hpMap").classList.contains("hp-mini") }));
        bao(to.cuon && !to.mini && to.trang <= 0, "SƠ ĐỒ · bấm \"Phóng to\" → ô to, kéo ngang TRONG khung, trang không trôi", JSON.stringify(to));
        const nut2 = await p.$("#hpMap .hp-chiM"); if (nut2) { await nut2.click(); await ngu(500); }
      } else bao(false, "SƠ ĐỒ · có nút Phóng to trên điện thoại");
    }

    /* ---------- NHÂN VIÊN ---------- */
    const nv = await p.evaluate(() => ({ hang: document.querySelectorAll("#hpAI .hp-nvr").length, them: !!document.querySelector("#hpAI .hp-nvmore"),
      tabOn: (document.querySelector("#hpAI .hp-whtab.active") || {}).textContent || "", tieuDe: (document.querySelector("#hpAI h2") || {}).textContent || "" }));
    bao(/Chưa báo cáo/.test(nv.tabOn), "NHÂN VIÊN · mở sẵn nhóm \"Chưa báo cáo\"", nv.tabOn.trim());
    if (m.dt) {
      bao(nv.hang <= 8, "NHÂN VIÊN · điện thoại chỉ bày ≤ 8 người", nv.hang + " người");
      const them = await p.$("#hpAI .hp-nvmore");
      if (them) { await them.click(); await ngu(400); const n2 = await p.evaluate(() => document.querySelectorAll("#hpAI .hp-nvr").length); bao(n2 > nv.hang, "NHÂN VIÊN · bấm \"Xem cả\" → hiện hết", n2 + " người"); }
    }
    bao(/hôm nay/i.test(nv.tieuDe), "NGÀY · hôm nay: tiêu đề \"Nhân viên hôm nay\"", nv.tieuDe.replace("Tra cứu", "").trim());

    /* ---------- CHẠM ≥ 40px (điện thoại) ---------- */
    if (m.dt) {
      const nho = await p.evaluate(() => {
        const sel = "#hpNhacSlot .hp-tdrow, #hpMap .hp-legchip, #hpMap .hp-h2btn, #hpAI .hp-nvr, #hpAI .hp-whtab, #hpAI .hp-nvmore, #hpToolBtns .hp-h2btn, #hpToday .hp-tile, #hpWhBar .hp-whtab";
        return [...document.querySelectorAll(sel)].filter((e) => e.offsetParent).filter((e) => { const r = e.getBoundingClientRect(); return r.height < 39.5; })
          .map((e) => e.className.split(" ")[0] + " «" + e.textContent.trim().slice(0, 16) + "» " + Math.round(e.getBoundingClientRect().height) + "px");
      });
      bao(!nho.length, "CHẠM · mọi nút mới ≥ 40px", nho.slice(0, 6).join(" · "));
    }
    await p.screenshot({ path: path.join(OUT, m.ma + "-hom-nay.png"), fullPage: true });

    /* ---------- POP-UP "QUÁ 3 NGÀY" ---------- */
    const rCb = await p.$('#hpNhacSlot .hp-tdrow[data-td="canhbao"]');
    if (rCb) {
      await rCb.click(); await ngu(1600);
      const pu = await p.evaluate(() => {
        const rows = [...document.querySelectorAll("#hpMBody tr")];
        const sai = rows.filter((tr) => /nghỉ \/ không chấm công/.test(tr.textContent) && /Chưa · đi làm|Chưa vệ sinh/.test((tr.querySelector("td.mb-tag") || {}).textContent || "")).length;
        return { n: rows.length, sai, sub: (document.getElementById("hpMsub") || {}).textContent || "" };
      });
      bao(pu.n > 0 && pu.sai === 0, "POP-UP · \"Quá 3 ngày\": người nghỉ không mang nhãn đỏ", pu.sai + " dòng sai / " + pu.n);
      bao(!/combo|gõ để lọc/.test(pu.sub), "POP-UP · phụ đề sạch", pu.sub);
      await p.screenshot({ path: path.join(OUT, m.ma + "-popup-qua3.png") });
      await p.evaluate(() => HPLANOGRAM.closeModal()); await ngu(400);
    }
    /* ---------- POP-UP 1 Ô ---------- */
    const o1 = await p.$("#hpMap .hp-mapcell:not(.trong)");
    if (o1) {
      await o1.click(); await ngu(1800);
      const vt = await p.evaluate(() => {
        /* gom theo TÂM DỌC (ô đang chọn nổi lên vài px bằng transform — đếm theo đỉnh là báo oan 2 hàng) */
        const tops = [...document.querySelectorAll("#hpVtBody .hp-vthist")].map((e) => { const r = e.getBoundingClientRect(); return Math.round((r.top + r.bottom) / 2 / 12); });
        const sub = (document.getElementById("hpVtSub") || {}).textContent || "";
        const rong = [...document.querySelectorAll("#hpVtBody")].map((b) => b.innerText).join(" ");
        return { hang: new Set(tops).size, n: tops.length, sub, ba: (rong.match(/chưa có ai báo cáo|chưa chấm(?! ra)|chưa có ảnh/gi) || []).length   /* "chưa chấm ra" là giờ chấm công, không phải AI */ };
      });
      bao(vt.n > 0 && vt.hang === 1, "POP-UP Ô · dải " + vt.n + " ngày nằm trên 1 hàng", vt.hang + " hàng");
      bao(!/bấm ô ngày/.test(vt.sub), "POP-UP Ô · không còn câu hướng dẫn", vt.sub || "(trống)");
      bao(vt.ba <= 1, "POP-UP Ô · chưa báo cáo thì chỉ 1 dòng, không 3 dòng rỗng", vt.ba + " cụm");
      await p.screenshot({ path: path.join(OUT, m.ma + "-popup-o.png") });
      await p.evaluate(() => HPLANOGRAM.closeVt()); await ngu(500);
    }

    /* ---------- NGÀY CŨ ---------- */
    await p.evaluate(() => HPLANOGRAM.chonNgay("hqua"));
    await p.waitForFunction("(" + (() => /ngày \d{2}\/\d{2}/.test((document.querySelector("#hpAI h2") || {}).textContent || "")) + ")()", { timeout: 20000 }).catch(() => {});
    await ngu(4000);
    const cu = await p.evaluate(() => {
      const num = (s) => Number(String(s || "").replace(/[^\d]/g, "")) || 0;
      const td = document.querySelector('#hpNhacSlot .hp-tdrow[data-td="nhac"]');
      const tab = (t) => { const b = document.querySelector('#hpAI .hp-whtab[data-t="' + t + '"] b'); return b ? num(b.textContent) : -1; };
      const daT = document.querySelector('#hpToday .hp-tile[data-k="da"] .s');
      return { tieuDe: (document.querySelector("#hpAI h2") || {}).textContent || "", td: td ? num(td.querySelector(".n").textContent) : 0, coTd: !!td, tabChua: tab("chua"), tabDa: tab("da"), daNv: daT ? num(daT.textContent) : -1 };
    });
    bao(/Nhân viên ngày \d{2}\/\d{2}/.test(cu.tieuDe) && !/hôm nay/i.test(cu.tieuDe), "NGÀY CŨ · tiêu đề theo đúng ngày đang xem (lỗi A1)", cu.tieuDe.replace("Tra cứu", "").trim());
    bao(!cu.coTd || cu.td === cu.tabChua, "NGÀY CŨ · Cần xử lý = tab \"Chưa báo cáo\"", cu.td + " = " + cu.tabChua);
    bao(cu.daNv === cu.tabDa, "NGÀY CŨ · thẻ Đã vệ sinh = tab \"Đã báo cáo\"", cu.daNv + " = " + cu.tabDa);
    await p.screenshot({ path: path.join(OUT, m.ma + "-ngay-cu.png"), fullPage: true });
    await p.evaluate(() => HPLANOGRAM.chonNgay("hnay")); await ngu(1500);

    /* ---------- 25 KHU (giả lập, chỉ trong trình duyệt) ---------- */
    const kh = await p.evaluate(() => {
      const S = HPLANOGRAM._S, mau = S.yc.rows.filter((r) => r.ngay === S.yc.ngay).slice(0, 4);
      if (!mau.length) return { loi: "không có dòng mẫu" };
      const khu = ["A2", "A3", "A4", "A5", "A6", "A7", "A9", "A10", "A11", "A12", "A13", "A14", "A15", "A16", "A17", "A18", "A19", "A20", "A21", "A22", "A23", "A24", "A25"];
      khu.forEach((k, i) => {
        for (let d = 1; d <= 2; d++) for (let o = 1; o <= 3; o++) {
          const r = Object.assign({}, mau[(i + o) % mau.length]);
          r.loc = "F0-" + k + "-5" + String(d).padStart(2, "0") + "-" + String(o).padStart(2, "0") + "-01-01";
          r.id = "qc" + i + d + o; r.anh = [];
          const a = HPLANOGRAM._areaOf(r.loc); r.area = a ? a.k : "";
          S.yc.rows.push(r);
        }
      });
      HPLANOGRAM._render();
      return { ok: true };
    });
    if (kh.loi) bao(false, "25 KHU · giả lập", kh.loi);
    else {
      await ngu(800);
      const k1 = await p.evaluate(() => ({ sel: !!document.getElementById("hpKhuSel"), chip: document.querySelectorAll("#hpWhBar .hp-wb1 .hp-whtab").length,
        dong: document.querySelectorAll("#hpKhu .hp-khurow").length, keo: document.documentElement.scrollWidth - innerWidth }));
      bao(k1.sel && k1.chip === 0, "25 KHU · thanh lọc thành 1 nút chọn khu (không 25 chip)", "nút=" + k1.sel + " chip=" + k1.chip);
      bao(k1.dong >= 20, "25 KHU · bảng Khu vực liệt kê từng khu", k1.dong + " khu");
      bao(k1.keo <= 0, "25 KHU · trang vẫn không kéo ngang", k1.keo + "px");
      /* về đầu trang trước khi bấm: thanh đầu trang của host dính trên cùng, puppeteer cuộn nút lên sát
         mép trên là nút nằm DƯỚI thanh đó (người dùng thật thì bấm lúc nút đang hiện trên màn) */
      await p.evaluate(() => window.scrollTo(0, 0)); await ngu(200);
      const nutK = await p.$("#hpKhuSel > button");
      if (nutK) {
        await nutK.click(); await ngu(400);
        const menu = await p.evaluate(() => { const m = document.getElementById("hpKhuMenu"); const r = m && m.getBoundingClientRect(); return { mo: !!m && m.classList.contains("open"), n: m ? m.querySelectorAll(".hp-khuit").length : 0, tran: r ? Math.round(r.right - innerWidth) : 0 }; });
        bao(menu.mo && menu.n >= 24 && menu.tran <= 0, "25 KHU · menu chọn khu mở, đủ khu, nằm trong màn", JSON.stringify(menu));
        await p.screenshot({ path: path.join(OUT, m.ma + "-25khu-menu.png") });
        const muc = await p.$('#hpKhuMenu .hp-khuit[data-a="A10"]');
        if (muc) {
          await muc.click(); await ngu(700);
          const k2 = await p.evaluate(() => ({ gen: document.querySelectorAll("#hpMap .hp-mapgen .hp-mapcell").length, hdr: (document.querySelector("#hpMap .hp-maphdr") || {}).textContent || "",
            prog: (document.querySelector("#hpToday .hp-progt b") || {}).textContent || "", keo: document.documentElement.scrollWidth - innerWidth }));
          bao(k2.gen === 6 && /Nhà vệ sinh/.test(k2.hdr), "25 KHU · chọn \"Nhà vệ sinh\" → lưới tự sinh đúng 6 ô", k2.gen + " ô · " + k2.hdr);
          bao(/\/ 6 vị trí/.test(k2.prog) && k2.keo <= 0, "25 KHU · thẻ Tiến độ đếm theo khu đã chọn", k2.prog);
          await p.screenshot({ path: path.join(OUT, m.ma + "-25khu-A10.png"), fullPage: true });
        } else bao(false, "25 KHU · có mục Nhà vệ sinh trong menu");
      } else bao(false, "25 KHU · có nút chọn khu");
      await p.screenshot({ path: path.join(OUT, m.ma + "-25khu.png"), fullPage: true });
    }
    bao(!loiTrang.length, "Console sạch", loiTrang.slice(0, 2).join(" | "));
  } catch (e) {
    bao(false, "Đo không trọn", e.message);
  }
  await p.close();
}
await br.close();
const hong = ketQua.filter((k) => !k.ok);
fs.writeFileSync(path.join(OUT, "bao-cao.json"), JSON.stringify(ketQua, null, 1));
console.log("\n═════ TỔNG KẾT: " + (ketQua.length - hong.length) + "/" + ketQua.length + " ca đạt" + (hong.length ? " · ✗ " + hong.length + " ca hỏng" : "") + " · ảnh: " + OUT);
hong.forEach((k) => console.log("  ✗ [" + k.may + "] " + k.ten + (k.chiTiet ? " — " + k.chiTiet : "")));
process.exit(hong.length ? 1 : 0);
