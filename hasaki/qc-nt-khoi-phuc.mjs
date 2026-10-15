/**
 * qc-nt-khoi-phuc.mjs — 15/10/2026: phản hồi CHƯA LƯU lên sheet không được mất khi đóng/tải lại trang
 * (sự cố dòng 25 Phòng bonding: 7 tệp đã lên Drive, nt_ghi hụt khoá, đóng trang → mất ghi chú từng ảnh).
 * Bản nội bộ (xem-noi-bo.mjs 8123) → GAS HEAD + SHEET NHÁP. Ca: gửi (ghi chú chung + ảnh có ghi chú riêng),
 * cố ý làm hỏng nt_ghi → tải lại trang → ghi chú còn + tự gửi lại → lên sheet nháp → dọn (xoá mục QC).
 */
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EDGE_PATH } from "./token-store.js";

const URL = "http://localhost:8123/kiemsoatkho/nghiem-thu.html";
const ANH = path.join(os.tmpdir(), "qc-nt-anh.png");
fs.writeFileSync(ANH, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAQ0lEQVR42u3PMQEAAAgDoNm/9Iyh4AEN6IRk6ioCBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECbg0tQb/BSbDH9AAAAABJRU5ErkJggg==", "base64"));
let dat = 0, truot = 0;
const ca = (ten, ok, ct = "") => { ok ? dat++ : truot++; console.log((ok ? "  ✓ " : "  ✗ ") + ten + (ct ? " — " + ct : "")); };
const nhan = "QC khôi phục " + new Date().toISOString().slice(11, 19), nhanAnh = "ảnh QC ghi chú riêng";

const br = await puppeteer.launch({ headless: "new", executablePath: EDGE_PATH });
let pg;
try {
  pg = await br.newPage(); pg.on("dialog", (d) => d.accept());
  await pg.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  let hong = true; const ghi = [];
  await pg.setRequestInterception(true);
  pg.on("request", (rq) => {
    if (!rq.url().endsWith("/api/nt-thu")) return rq.continue();
    const d = JSON.parse(rq.postData() || "{}");
    if (d.action === "nt_ghi" && !d.xoa) { ghi.push(d); if (hong) return rq.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "error", message: "QC giả lỗi khoá" }) }); }
    rq.continue();
  });
  await pg.goto(URL, { waitUntil: "domcontentloaded" });
  await pg.evaluate(() => localStorage.removeItem("nt-ds2-noibo"));
  await pg.reload({ waitUntil: "domcontentloaded" });
  await pg.waitForFunction("document.querySelectorAll('button.the').length > 0", { timeout: 120000 });
  await pg.click("button.the");
  await pg.waitForFunction("[...document.querySelectorAll('.sheet-in')].some(e => e.offsetParent)", { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 450));
  const ck = await pg.evaluate(() => document.querySelector("[x-data]")._x_dataStack[0].dang.checklist);
  await pg.type(".sheet-in textarea", nhan);
  await (await pg.$(".sheet-in input[type=file]")).uploadFile(ANH);
  await pg.waitForSelector('.the-tep input[placeholder="Ghi chú ảnh này"]', { timeout: 8000 });
  await pg.type('.the-tep input[placeholder="Ghi chú ảnh này"]', nhanAnh);
  await (await pg.evaluateHandle(() => [...document.querySelectorAll(".sheet-in button")].find((b) => b.offsetParent && /GỬI PHẢN HỒI/.test(b.textContent)))).click();
  await pg.waitForFunction("/Chưa lưu/.test(document.body.innerText)", { timeout: 120000 });
  ca("nt_ghi hỏng → hiện «Chưa lưu — thử lại»", true);
  const kho = await pg.evaluate(() => localStorage.getItem("nt-ds2-noibo") || "");
  ca("ghi chú chung + ghi chú riêng ảnh + id tệp đã cất trên máy", kho.includes(nhan) && kho.includes(nhanAnh) && /"ky":"[\w-]{16}"/.test(kho));

  // Đóng trang giữa chừng (tải lại) — trước 15/10 là mất sạch
  hong = false; const truoc = ghi.length;
  await pg.reload({ waitUntil: "domcontentloaded" });
  await pg.waitForFunction("document.querySelectorAll('button.the').length > 0", { timeout: 120000 });
  const t0 = Date.now(); while (ghi.length === truoc && Date.now() - t0 < 30000) await new Promise((r) => setTimeout(r, 300));
  ca("mở lại form → tự gửi lại", ghi.length > truoc);
  const gl = ghi[ghi.length - 1] || { muc: { tep: [] } };
  ca("lượt gửi lại mang đủ ghi chú chung + ghi chú riêng ảnh", gl.muc.ghiChu === nhan && gl.muc.tep.length === 1 && gl.muc.tep[0].ghiChu === nhanAnh && !!gl.muc.tep[0].ky);
  await pg.waitForFunction("!document.querySelector('[x-data]')._x_dataStack[0].ds.some(d => d.muc.some(m => m.cho))", { timeout: 180000 });
  const may = await pg.evaluate((n) => { const s = document.querySelector("[x-data]")._x_dataStack[0]; const d = s.ds.find((x) => x.muc.some((m) => m.ghiChu === n)); return d ? { id: d.muc.find((m) => m.ghiChu === n).id, dong: d.dong } : null; }, nhan);
  ca("lên sheet nháp xong, không còn mục chờ", !!may);
  // dọn: xoá mục QC trên sheet nháp
  if (may) { const r = await pg.evaluate((id, ck, dong) => document.querySelector("[x-data]")._x_dataStack[0].goi({ action: "nt_ghi", dong, checklist: ck, xoa: 1, muc: { id } }), may.id, ck, may.dong); ca("dọn mục QC", r.status === "success"); }
} catch (e) { ca("chạy hết kịch bản", false, e.message); }
await br.close();
console.log(`\nKẾT QUẢ: ${dat} đạt / ${truot} trượt`);
process.exit(truot ? 1 : 0);
