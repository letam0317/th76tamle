/**
 * qc-nghiem-thu.mjs — bộ đo form Nghiệm thu checklist (kiemsoatkho/nghiem-thu.html), 14/10/2026.
 * Chạy trên BẢN NỘI BỘ (xem-noi-bo.mjs phải đang chạy): mọi lượt gửi đi qua /api/nt-thu → GAS HEAD
 * + SHEET NHÁP, sheet thật không bị ghi (luật QC không ghi dữ liệu thật).
 *   node qc-nghiem-thu.mjs            # 4 máy, có ca GỬI thật vào sheet nháp
 *   node qc-nghiem-thu.mjs --khong-gui
 * Ca đo bấm THẬT (click phần tử người dùng chạm), không gọi hàm.
 */
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EDGE_PATH } from "./token-store.js";

const URL = "http://localhost:8123/kiemsoatkho/nghiem-thu.html";
const MAY = [["ip14", 390, 844], ["ipse", 375, 667], ["and", 412, 915], ["pc", 1280, 800]];
const GUI = !process.argv.includes("--khong-gui");
const ANH = path.join(os.tmpdir(), "qc-nt-anh.png");
fs.writeFileSync(ANH, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAQ0lEQVR42u3PMQEAAAgDoNm/9Iyh4AEN6IRk6ioCBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECbg0tQb/BSbDH9AAAAABJRU5ErkJggg==", "base64"));

let dat = 0, truot = 0;
const ca = (ten, ok, chiTiet = "") => { ok ? dat++ : truot++; console.log((ok ? "  ✓ " : "  ✗ ") + ten + (chiTiet ? " — " + chiTiet : "")); };
const coTran = (p, ms, buoc) => Promise.race([p, new Promise((_, l) => setTimeout(() => l(new Error("treo ở bước: " + buoc)), ms))]);

const br = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH });
try {
  for (const [ten, w, h] of MAY) {
    console.log("\n[" + ten + " " + w + "×" + h + "]");
    const pg = await br.newPage();
    pg.on("dialog", (d) => d.accept());
    await pg.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: ten !== "pc", hasTouch: ten !== "pc" });
    await pg.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
    await coTran(pg.goto(URL, { waitUntil: "domcontentloaded" }), 30000, "mở trang");
    await coTran(pg.waitForFunction("document.querySelectorAll('button.the').length > 0", { timeout: 120000 }), 125000, "tải danh sách");
    await new Promise((r) => setTimeout(r, 600));   // chờ hiệu ứng hiện thẻ + bố cục ổn định rồi mới đo
    const s = await pg.evaluate(() => {
      const the = [...document.querySelectorAll("button.the")];
      const nho = [...document.querySelectorAll("body *")].filter((e) => e.offsetParent && e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
        .map((e) => [parseFloat(getComputedStyle(e).fontSize), e.textContent.trim().slice(0, 30)]).filter((x) => x[0] < 10.5);
      return { soThe: the.length, cuonNgang: document.documentElement.scrollWidth - innerWidth, nho: nho.slice(0, 3),
        dauDs: the[0].getBoundingClientRect().top - ((document.querySelector('[x-show="noiBo"]') || {}).offsetHeight || 0) - 12, tab: [...document.querySelectorAll('[role=tablist] button')].map((b) => [b.textContent.trim(), Math.round(b.getBoundingClientRect().height)]) };
    });
    ca("có thẻ checklist", s.soThe > 0, s.soThe + " thẻ");
    ca("không cuộn ngang", s.cuonNgang <= 0, "lệch " + s.cuonNgang + "px");
    ca("sàn cỡ chữ 10,5px", !s.nho.length, JSON.stringify(s.nho));
    ca("nội dung chính bắt đầu ≤130px đầu màn", s.dauDs <= 130, Math.round(s.dauDs) + "px");
    ca("nút lọc cao ≥40px", s.tab.every((t) => t[1] >= 40), JSON.stringify(s.tab));
    if (ten === "ip14") await pg.screenshot({ path: path.join(os.tmpdir(), "qc-nt-ds.png") });

    // Chia nhóm Vật lý / Hệ thống + tìm kiếm — bấm/gõ THẬT
    const theDau = () => pg.evaluate(() => [...document.querySelectorAll("button.the")].map((b) => b.innerText.split("\n")[0].trim()));
    const bamNhom = async (re) => { const h = await pg.evaluateHandle((r) => [...document.querySelectorAll("[role=tablist] button")].find((b) => new RegExp(r).test(b.textContent)), re); await h.click(); await new Promise((r) => setTimeout(r, 150)); };
    const go = async (chu) => { await pg.click("input[type=search]", { clickCount: 3 }); await pg.keyboard.press("Backspace"); if (chu) await pg.type("input[type=search]", chu); await new Promise((r) => setTimeout(r, 200)); };
    await bamNhom("hệ thống");
    const ht = await theDau();
    ca("nhóm Hệ thống có PO, không có Hàng đã picked", ht.some((t) => /^1 · PO/i.test(t)) && !ht.some((t) => /PICKED/i.test(t)), ht.length + " thẻ");
    await bamNhom("vật lý");
    const vl = await theDau();
    ca("nhóm Vật lý có Location, không có PO", vl.some((t) => /LOCATION/i.test(t)) && !vl.some((t) => /^1 · PO/i.test(t)), vl.length + " thẻ");
    ca("mục Vật lý + hệ thống (ADJ) có ở cả 2 nhóm", ht.some((t) => /ADJ/i.test(t)) && vl.some((t) => /ADJ/i.test(t)));
    await go("xa vai");
    const xv = await pg.evaluate(() => [...document.querySelectorAll("button.the")].map((b) => b.innerText));
    ca("tìm không dấu 'xa vai' ra mục 'xả vải'", xv.some((t) => /xả vải/i.test(t)), xv.length + " thẻ");
    await go("422513457");
    const demHt = await pg.evaluate(() => [...document.querySelectorAll("[role=tablist] button")].map((b) => b.textContent.replace(/\s+/g, " ").trim()));
    ca("tìm SKU: số đếm trên nút nhóm chỉ đường sang Hệ thống", /hệ thống 1$/i.test(demHt[1]) && /vật lý 0$/i.test(demHt[0]), demHt.join(" | "));
    await bamNhom("hệ thống");
    const sku = await theDau();
    ca("tìm SKU 422513457 ra đúng mục PO", sku.length === 1 && /PO/.test(sku[0]), sku.join(" | "));
    await go("");
    await bamNhom("vật lý");

    // Bấm thẻ đầu → bảng cập nhật mở
    await pg.click("button.the");
    await pg.waitForFunction("[...document.querySelectorAll('.sheet-in')].some(e => e.offsetParent)", { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 450));   // chờ hết hiệu ứng trượt lên (0,28s) rồi mới đo vị trí
    const b = await pg.evaluate(() => {
      const dong = [...document.querySelectorAll("button[title='Đóng']")].find((e) => e.offsetParent).getBoundingClientRect();
      const sh = [...document.querySelectorAll(".sheet-in")].find((e) => e.offsetParent).getBoundingClientRect();
      return { dong: [Math.round(dong.width), Math.round(dong.height)], vuaMan: sh.bottom <= innerHeight + 1 && sh.top >= 0, cuonNgang: document.documentElement.scrollWidth - innerWidth };
    });
    ca("bảng cập nhật nằm gọn màn hình", b.vuaMan);
    ca("nút đóng ≥44px", b.dong[0] >= 44 && b.dong[1] >= 44, b.dong.join("×"));
    ca("bảng không làm cuộn ngang", b.cuonNgang <= 0);

    // Đính ảnh qua ô chọn tệp thật
    const o = await pg.$(".sheet-in input[type=file]");
    await o.uploadFile(ANH);
    await pg.waitForFunction("document.querySelectorAll('.sheet-in img').length > 0", { timeout: 8000 });
    ca("đính ảnh hiện ô xem trước", true);
    if (ten === "ip14") await pg.screenshot({ path: path.join(os.tmpdir(), "qc-nt-sheet.png") });

    // Ảnh KHÔNG còn nhãn giờ / cụm AUDIT HASAKI (user 14/10): ảnh đỏ trơn đi qua bộ xử lý → góc phải trên vẫn đỏ trơn
    const DO = path.join(os.tmpdir(), "qc-nt-do.png");
    if (!fs.existsSync(DO)) { const p2 = await br.newPage(); await p2.setViewport({ width: 800, height: 600 }); await p2.setContent("<body style='margin:0;background:#d00'></body>"); await p2.screenshot({ path: DO }); await p2.close(); }
    await (await pg.$(".sheet-in input[type=file]")).uploadFile(DO);
    await pg.waitForFunction("document.querySelectorAll('.sheet-in img').length > 1", { timeout: 8000 });
    const tron = await pg.evaluate(async () => {
      const im = [...document.querySelectorAll(".sheet-in img")].pop(); const i2 = new Image(); i2.src = im.src; await i2.decode();
      const c = document.createElement("canvas"); c.width = i2.width; c.height = i2.height; const x = c.getContext("2d"); x.drawImage(i2, 0, 0);
      const px = x.getImageData(Math.round(i2.width * 0.55), 0, Math.round(i2.width * 0.45), Math.round(i2.height * 0.3)).data; let lech = 0;
      for (let k = 0; k < px.length; k += 4) if (px[k] < 150 || px[k + 1] > 90 || px[k + 2] > 90) lech++;
      return lech;
    });
    ca("ảnh không còn nhãn giờ + AUDIT HASAKI", tron === 0, tron + " điểm ảnh lệch màu ở góc phải trên");

    if (GUI && ten === "ip14") {
      const the = () => pg.evaluate(() => { const s = [...document.querySelectorAll(".sheet-in")].find((e) => e.offsetParent); return s ? s.innerText : ""; });
      const bam = async (re, chu) => { const tim = (r, c) => [...document.querySelectorAll(".sheet-in button")].filter((e) => e.offsetParent).find((e) => new RegExp(r).test(e.textContent.trim()) && (!c || (e.closest(".rounded-2xl") || {}).innerText.includes(c)));
        await pg.waitForFunction((t, r, c) => !!eval("(" + t + ")")(r, c), { timeout: 5000 }, tim.toString(), re, chu || "");
        const h = await pg.evaluateHandle((t, r, c) => eval("(" + t + ")")(r, c), tim.toString(), re, chu || ""); await h.click(); };
      const nhan = "QC tự động " + new Date().toISOString().slice(11, 19);
      await pg.type(".sheet-in textarea", nhan);
      // ô riêng của ảnh #1: ghi chú + mã vị trí + UIDgr (14/10)
      await pg.type('.the-tep input[placeholder="Ghi chú ảnh này"]', "anh QC");
      await pg.type('.the-tep input[placeholder="Mã vị trí"]', "F0-QC-01");
      await pg.type('.the-tep input[placeholder="UIDgr / SKU"]', "UIDGRQC");
      const t0 = Date.now();
      await bam("GỬI PHẢN HỒI");
      await pg.waitForFunction((n) => [...document.querySelectorAll(".sheet-in .rounded-2xl")].some((e) => e.innerText.includes(n)), { timeout: 5000 }, nhan);
      const msHien = Date.now() - t0;
      ca("bấm Gửi → phản hồi hiện trên màn < 2 giây", msHien < 2000, msHien + " ms");
      await coTran(pg.waitForFunction("!/Đang lưu lên sheet|Chưa lưu/.test([...document.querySelectorAll('.sheet-in')].find(e => e.offsetParent).innerText)", { timeout: 180000 }), 185000, "đồng bộ nền");
      const msNen = Date.now() - t0, sau = await the();
      ca("chạy nền: 2 ảnh + ghi chú lên sheet nháp xong", /Sửa/.test(sau) && !/Chưa lưu/.test(sau), "xong sau " + (msNen / 1000).toFixed(1) + " s (không bắt người dùng chờ)");
      await pg.screenshot({ path: path.join(os.tmpdir(), "qc-nt-gui.png") });
      await pg.evaluate(() => document.querySelector("[x-data]")._x_dataStack[0].taiDs());
      await new Promise((r) => setTimeout(r, 300));
      await coTran(pg.waitForFunction("!document.querySelector('[x-data]')._x_dataStack[0].dangTai", { timeout: 120000 }), 125000, "tải lại sau gửi");
      const chuThich = (await the()).includes("Vị trí F0-QC-01 · UIDgr UIDGRQC · anh QC");
      ca("ô riêng từng ảnh lưu lên máy chủ + hiện lại sau tải lại", chuThich);

      // SỬA: đổi ghi chú + bỏ 1 ảnh cũ
      await bam("^Sửa$", nhan);
      await pg.waitForFunction("/Sửa phản hồi đã ghi/.test(document.body.innerText)", { timeout: 3000 });
      await pg.click(".sheet-in textarea", { clickCount: 3 }); await pg.keyboard.press("Backspace"); await pg.type(".sheet-in textarea", nhan + " (đã sửa)");
      await pg.click('.sheet-in button[title="Bỏ ảnh/clip này"]');
      await bam("LƯU SỬA");
      await coTran(pg.waitForFunction((n) => { const s = [...document.querySelectorAll('.sheet-in')].find(e => e.offsetParent).innerText; return s.includes(n + " (đã sửa)") && !/Đang lưu lên sheet|Chưa lưu/.test(s); }, { timeout: 180000 }, nhan), 185000, "lưu sửa");
      const soAnh = await pg.evaluate((n) => { const k = [...document.querySelectorAll(".sheet-in .rounded-2xl")].filter((e) => e.innerText.includes(n + " (đã sửa)") && e.querySelector("button")).pop(); return k ? k.querySelectorAll(".grid button").length : -1; }, nhan);
      ca("sửa ghi chú + bỏ 1 ảnh: lưu xong, còn 1 ảnh", soAnh === 1, soAnh + " ảnh");

      // XOÁ
      await bam("^Xoá$", nhan + " (đã sửa)");
      await pg.waitForFunction((n) => !document.body.innerText.includes(n + " (đã sửa)"), { timeout: 3000 }, nhan);
      await coTran(pg.waitForFunction("/Đã xoá|Chưa xoá/.test(document.body.innerText)", { timeout: 180000 }), 185000, "xoá");
      await new Promise((r) => setTimeout(r, 300));
      const conDo = await pg.evaluate((n) => document.body.innerText.includes(n), nhan);
      // xác nhận với MÁY CHỦ: tải lại danh sách, mục đã xoá không quay về
      await pg.evaluate(() => document.querySelector("[x-data]")._x_dataStack[0].taiDs());
      await new Promise((r) => setTimeout(r, 300));
      await coTran(pg.waitForFunction("!document.querySelector('[x-data]')._x_dataStack[0].dangTai", { timeout: 120000 }), 125000, "tải lại sau xoá");
      const conSau = await pg.evaluate((n) => document.body.innerText.includes(n), nhan);
      ca("xoá phản hồi: biến mất ngay + tải lại từ máy chủ không quay về", !conDo && !conSau);
    }
    await pg.close();
  }

  // Quét mã vị trí / SKU-UIDgr: camera ẩn tới khi bấm; giả lập bộ quét trả mã (máy QC không có camera)
  {
    console.log("\n[quét mã — giả lập camera]");
    const pq = await br.newPage(); pq.on("dialog", (d) => d.accept());
    await pq.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await pq.evaluateOnNewDocument(() => {
      window.__ma = [];
      window.Html5Qrcode = class { constructor(id) { this.id = id; } async start(_c, _o, ok) { const ma = window.__ma.shift(); this.t = setTimeout(() => ok(ma), 150); } async stop() { clearTimeout(this.t); } clear() {} };
    });
    await pq.goto(URL, { waitUntil: "domcontentloaded" });
    await coTran(pq.waitForFunction("document.querySelectorAll('button.the').length > 0", { timeout: 120000 }), 125000, "tải danh sách");
    await pq.click("button.the");
    await pq.waitForFunction("!!document.querySelector('textarea') && !!document.querySelector('textarea').offsetParent", { timeout: 10000 });
    const hop = () => pq.evaluate(() => document.querySelector(".lop-quet").getClientRects().length > 0);
    const nut = (chu) => pq.evaluateHandle((c) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === c && b.offsetParent), chu);
    const o = () => pq.$eval("textarea", (t) => t.value);
    ca("mở mục: chưa bấm thì camera quét ẩn", !(await hop()));
    const cao = await pq.evaluate(() => [...document.querySelectorAll("button")].filter((b) => /^(Mã vị trí|SKU \/ UIDgr)$/.test(b.textContent.trim())).map((b) => Math.round(b.getBoundingClientRect().height)));
    ca("2 nút quét cao ≥44px", cao.length === 2 && cao.every((x) => x >= 44), JSON.stringify(cao));
    await pq.type("textarea", "Đã kiểm xong");
    await pq.evaluate(() => window.__ma.push("F0-A1-01"));
    await (await nut("Mã vị trí")).click();
    await new Promise((r) => setTimeout(r, 60));
    ca("bấm Mã vị trí: hiện camera quét", await hop());
    await pq.waitForFunction("document.querySelector('.lop-quet').getClientRects().length === 0", { timeout: 5000 });
    ca("quét xong: camera tự ẩn + ghi dòng Vị trí đầu ghi chú", (await o()) === "Vị trí: F0-A1-01\nĐã kiểm xong", JSON.stringify(await o()));
    for (const m of ["8936012345678", "UIDGR123", "UIDGR123"]) {
      await pq.evaluate((x) => window.__ma.push(x), m);
      await (await nut("SKU / UIDgr")).click();
      await pq.waitForFunction("document.querySelector('.lop-quet').getClientRects().length > 0", { timeout: 5000 });
      await pq.waitForFunction("document.querySelector('.lop-quet').getClientRects().length === 0", { timeout: 5000 });
      await new Promise((r) => setTimeout(r, 50));
    }
    ca("SKU/UIDgr nối 1 dòng sau Vị trí, mã trùng bỏ qua", (await o()) === "Vị trí: F0-A1-01\nSKU/UIDgr: 8936012345678, UIDGR123\nĐã kiểm xong", JSON.stringify(await o()));
    await (await nut("Mã vị trí")).click(); await new Promise((r) => setTimeout(r, 30));
    await (await nut("Đóng camera")).click(); await new Promise((r) => setTimeout(r, 100));
    ca("bấm Đóng camera: tắt camera", !(await hop()));
    // ô riêng từng ảnh: đính ảnh → quét mã vị trí + UIDgr vào đúng ô của ảnh đó, không đụng ô ghi chú chung
    await (await pq.$(".sheet-in input[type=file]")).uploadFile(ANH);
    await pq.waitForFunction("document.querySelectorAll('.the-tep').length === 1", { timeout: 8000 });
    const ghiTruoc = await o();
    for (const [nutTep, m] of [["Quét mã vị trí", "F0-B2-03"], ["Quét UIDgr / SKU", "UIDGR9"], ["Quét UIDgr / SKU", "UIDGR10"]]) {
      await pq.evaluate((x) => window.__ma.push(x), m);
      await pq.click('.the-tep button[title="' + nutTep + '"]');
      await pq.waitForFunction("document.querySelector('.lop-quet').getClientRects().length > 0", { timeout: 5000 });
      await pq.waitForFunction("document.querySelector('.lop-quet').getClientRects().length === 0", { timeout: 5000 });
    }
    const oTep = await pq.evaluate(() => [...document.querySelectorAll(".the-tep input")].map((i) => i.value));
    ca("quét cho từng ảnh: mã vào đúng ô của ảnh, nhiều UIDgr nối «, »", JSON.stringify(oTep) === JSON.stringify(["", "F0-B2-03", "UIDGR9, UIDGR10"]) && (await o()) === ghiTruoc, JSON.stringify(oTep));
    const hangTep = await pq.evaluate(() => { const r = document.querySelector(".the-tep").getBoundingClientRect(); return [Math.round(r.right), innerWidth]; });
    ca("hàng ảnh + 3 ô vừa bề ngang", hangTep[0] <= hangTep[1], hangTep.join("/"));
    const ngang = await pq.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ca("khối quét không gây cuộn ngang", ngang <= 0, ngang + "px");
    await pq.close();
  }

  // Chuyển sang Video khi mic bị chặn (Permissions-Policy cũ microphone=()) → vẫn quay được, không báo lỗi
  {
    console.log("\n[video — mic bị chặn]");
    const pv = await br.newPage(); const loi = []; pv.on("dialog", (d) => { loi.push(d.message()); d.accept(); });
    await pv.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await pv.evaluateOnNewDocument(() => {
      const goc = () => { const c = document.createElement("canvas"); c.width = 320; c.height = 240; const x = c.getContext("2d"); setInterval(() => { x.fillStyle = "#" + Math.floor(Math.random() * 4096).toString(16); x.fillRect(0, 0, 320, 240); }, 100); return c.captureStream(10); };
      Object.defineProperty(navigator, "mediaDevices", { value: { enumerateDevices: async () => [], getUserMedia: async (o) => { if (o.audio) throw new DOMException("Permission denied", "NotAllowedError"); return goc(); } } });
    });
    await pv.goto(URL, { waitUntil: "domcontentloaded" });
    await coTran(pv.waitForFunction("document.querySelectorAll('button.the').length > 0", { timeout: 120000 }), 125000, "tải danh sách");
    await pv.click("button.the");
    await pv.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /Chụp \/ quay/.test(b.textContent) && b.offsetParent), { timeout: 10000 });
    await (await pv.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => /Chụp \/ quay/.test(b.textContent) && b.offsetParent))).click();
    await new Promise((r) => setTimeout(r, 500));
    await (await pv.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Video" && b.offsetParent))).click();
    await new Promise((r) => setTimeout(r, 800));
    const tt = await pv.evaluate(() => ({ mo: !!document.querySelector("video") && [...document.querySelectorAll("video")].some((v) => v.srcObject && v.offsetParent), chu: document.body.innerText.includes("clip không tiếng") }));
    ca("bấm Video khi mic bị chặn: không báo lỗi, camera vẫn mở", !loi.length && tt.mo, loi.join(" | "));
    ca("báo rõ clip không tiếng", tt.chu);
    await pv.close();
  }

  // Khung xin quyền OTP: giả lập GAS trả canKhoa (máy chưa cấp quyền) → xin mã → gõ 4 số → vào được
  console.log("\n[khoá máy — giả lập]");
  const pg = await br.newPage(); pg.on("dialog", (d) => d.accept());
  await pg.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
  await pg.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
  let daCap = false; const goiGia = [];
  await pg.setRequestInterception(true);
  pg.on("request", (rq) => {
    if (!rq.url().endsWith("/api/nt-thu")) return rq.continue();
    const d = JSON.parse(rq.postData() || "{}"); goiGia.push(d.action);
    const tra = (o) => rq.respond({ status: 200, contentType: "application/json", body: JSON.stringify(o) });
    if (d.action === "tb_xin") return tra({ status: "success", choOtp: 1 });
    if (d.action === "tb_otp") { if (d.otp !== "1234") return tra({ status: "error", sai: 1, message: "Mã không đúng (còn 4 lần thử)." }); daCap = true; return tra({ status: "success", duyet: 1 }); }
    if (!daCap) return tra({ status: "error", code: 403, canKhoa: 1, message: "Máy này chưa được cấp quyền" });
    return rq.continue();
  });
  await pg.goto(URL, { waitUntil: "domcontentloaded" });
  await pg.waitForFunction("/chưa được cấp quyền dùng form/.test(document.body.innerText)", { timeout: 30000 });
  ca("máy chưa cấp quyền: hiện khung Xin mã OTP", true);
  await pg.type('input[placeholder="Họ tên · bộ phận"]', "QC máy");
  await (await pg.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Xin mã OTP"))).click();
  await pg.waitForFunction("!!document.querySelector('input[placeholder=\"Mã 4 số\"]').offsetParent", { timeout: 15000 });
  await pg.type('input[placeholder="Mã 4 số"]', "9999");
  const xn = async () => (await pg.evaluateHandle(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Xác nhận"))).click();
  await xn(); await pg.waitForFunction("/Mã không đúng/.test(document.body.innerText)", { timeout: 10000 });
  ca("gõ sai mã: báo sai, chưa cho vào", !daCap);
  await pg.click('input[placeholder="Mã 4 số"]', { clickCount: 3 }); await pg.type('input[placeholder="Mã 4 số"]', "1234"); await xn();
  await coTran(pg.waitForFunction("document.querySelectorAll('button.the').length > 0 && !/chưa được cấp quyền dùng form/.test(document.body.innerText)", { timeout: 120000 }), 125000, "vào sau OTP");
  const khoa = await pg.evaluate(() => localStorage.getItem("tb-khoa") === localStorage.getItem("tb-may") && !!localStorage.getItem("tb-may"));
  ca("gõ đúng mã: máy được nhớ quyền + danh sách hiện ra", khoa, goiGia.join(" → "));
  await pg.close();
} finally { await br.close(); }
console.log("\n" + (truot ? "✗ " : "✓ ") + dat + " đạt · " + truot + " trượt");
process.exit(truot ? 1 : 0);
