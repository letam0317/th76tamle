/**
 * qc-sku-ocr-live.mjs — kiểm CỔNG THẬT `action=sku_ocr` trên Apps Script sau khi deploy.
 *  Gửi ảnh tem tự dựng lên endpoint production và kiểm 6 điều:
 *    1. Bản deploy đã có sku_ocr chưa
 *    2. Chặn email không phải @hasaki.vn
 *    3. Chặn ảnh quá lớn
 *    4. Đọc được chữ trên tem THẬT (phải thấy đúng MÃ HÀNG in trên tem) + đo thời gian
 *    5. Chặn 2 lượt gửi SONG SONG (cờ "đang đọc" theo email)
 *    6. Ảnh trắng trơn → nói "không thấy chữ nào", không im lặng trả rỗng
 *  KHÔNG tốn hạn mức AI (đường này dùng OCR của Drive), nhưng vẫn tính vào trần 2.000 ảnh/ngày.
 *
 *  node qc-sku-ocr-live.mjs [--mail ten@hasaki.vn]
 */
import puppeteer from "puppeteer";
import "dotenv/config";
import { EDGE_PATH } from "./token-store.js";

const URL_GAS = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const MAIL = process.argv.includes("--mail") ? process.argv[process.argv.indexOf("--mail") + 1] : "qc.ocrtem@hasaki.vn";
const LAN = "qcocr" + Date.now().toString(36);

/* Gọi GAS y NHƯ dashboard: đọc thô → nếu chặng 2 của Apps Script trả trang HTML thì thử lại VỚI
   CÙNG NONCE (doPost cất phản hồi theo nonce 10 phút nên lượt sau chỉ lấy lại, không chạy lại OCR).
   Đo 19/08/2026: 404-HTML ở chặng 2 xảy ra cả với lượt chạy nhanh 1 giây, nên đây KHÔNG phải mẹo
   che lỗi mà là cách gọi đúng của web app Apps Script. */
const goi = async (body, lan = 3) => {
  let cuoi = "";
  for (let i = 0; i < lan; i++) {
    if (i) await new Promise((r) => setTimeout(r, 1200 * i));
    const r = await fetch(URL_GAS, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
    const t = (await r.text()).trim();
    if (t.startsWith("{")) { try { return JSON.parse(t); } catch { cuoi = "JSON hỏng"; continue; } }
    cuoi = "Apps Script trả HTML/HTTP " + r.status + " ở chặng 2";
  }
  return { status: "error", message: cuoi + " (đã thử " + lan + " lượt)" };
};

/* ---- dựng ảnh tem (mã F9-5284 + thông số, cỡ như tem thật) ---- */
const browser = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH });
const page = await browser.newPage();
await page.setViewport({ width: 760, height: 340 });
await page.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#8d8d8d;display:flex;align-items:center;justify-content:center;height:340px">
  <div style="width:640px;background:#fdfdf8;color:#111;border:2px solid #333;padding:18px 22px;font-family:Arial">
    <div style="font-size:30px;font-weight:900;letter-spacing:2px;border-bottom:2px solid #111;padding-bottom:6px">THESEUS IRISA</div>
    <div style="font-size:23px;font-weight:800;margin-top:12px">ART: F9-5284 &nbsp;&nbsp; COLOR: Hồng tro</div>
    <div style="font-size:20px;font-weight:700;margin-top:6px">Tkt 120 &nbsp; Tex 27 &nbsp; 60/3</div>
    <div style="font-size:14px;color:#333;margin-top:8px">PHONG VIET CO.,LTD &nbsp;·&nbsp; 5000m &nbsp;·&nbsp; LOT 2508-11</div>
  </div></body>`, { waitUntil: "load" });
const anh = await page.screenshot({ type: "jpeg", quality: 78, encoding: "base64" });
await page.setContent(`<!doctype html><body style="margin:0;background:#fff;height:300px"></body>`, { waitUntil: "load" });
const anhTrang = await page.screenshot({ type: "jpeg", quality: 60, encoding: "base64" });
await browser.close();
console.log("✓ Ảnh tem mẫu " + Math.round(anh.length / 1024) + " KB base64 · ảnh trắng " + Math.round(anhTrang.length / 1024) + " KB\n");

let dat = 0, truot = 0;
const kiem = (ten, ok, ghi) => { ok ? dat++ : truot++; console.log((ok ? "  ✓ " : "  ✗ ") + ten + (ghi ? "  — " + ghi : "")); };

/* 1. Chờ bản deploy có sku_ocr (hỏi bằng email sai định dạng nên không tốn lượt nào) */
let daLen = false;
for (let i = 0; i < 10 && !daLen; i++) {
  const t = await goi({ action: "sku_ocr", email: "kiem.deploy@gmail.com", nonce: LAN + "-warm" + i });
  daLen = !/Action không hỗ trợ/i.test(t.message || "");
  if (!daLen) await new Promise((r) => setTimeout(r, 4000));
}
kiem("Bản deploy đã có action sku_ocr", daLen, daLen ? "" : "vẫn là bản cũ sau 40 giây — kiểm lại clasp deploy");

/* 2. Email sai định dạng */
const r2 = await goi({ action: "sku_ocr", email: "ai.do@gmail.com", anh: "x", nonce: LAN + "-mail" });
kiem("Chặn email không phải @hasaki.vn", r2.status === "error" && /hasaki\.vn/.test(r2.message || ""), r2.message);

/* 3. Ảnh quá lớn — hợp đồng là "KHÔNG BAO GIỜ đem đi OCR", chứ không nhất thiết do mình chặn:
   một POST 2,7 MB có lúc bị chính hạ tầng Apps Script trả về phản hồi của doGet (đo thật 19/08/2026),
   nên test chấp nhận cả hai lối chặn miễn là không có chữ nào được đọc. */
const r3 = await goi({ action: "sku_ocr", email: MAIL, anh: "A".repeat(2700000), nonce: LAN + "-lon" }, 1);
kiem("Ảnh quá lớn không bao giờ được OCR", !r3.text && !/drive-ocr/.test(r3.nguon || ""),
  /quá lớn/.test(r3.message || "") ? "chặn bằng trần SO_TRAN_ANH_B64" : ("hạ tầng chặn trước: " + String(r3.message || "").slice(0, 60)));

/* 4. Đọc chữ trên tem thật */
const t0 = Date.now();
const r4 = await goi({ action: "sku_ocr", email: MAIL, mime: "image/jpeg", anh, lang: "vi", nonce: LAN + "-doc" });
const ms = Date.now() - t0;
const chu = String(r4.text || "");
kiem("Đọc được chữ trên tem", r4.status === "success" && chu.length > 20, r4.status === "success" ? (ms + "ms · " + chu.replace(/\s*\n+\s*/g, " | ").slice(0, 150)) : r4.message);
kiem("Thấy đúng MÃ HÀNG in trên tem (F9-5284)", /F9[\s\-]?5284/i.test(chu), chu ? "" : "không có chữ nào");
kiem("Thấy thông số Tex/Tkt", /te[xk]t?\s*\.?\s*(27|120)/i.test(chu) || /tkt/i.test(chu), "");
kiem("Đo được thời gian từng chặng (nạp ảnh / lấy chữ)", typeof r4.msUp === "number" && typeof r4.msExport === "number",
  "nạp " + r4.msUp + "ms · lấy chữ " + r4.msExport + "ms · tổng script " + r4.ms + "ms");
kiem("Có trả về nguồn + số lượt còn lại", r4.nguon === "drive-ocr" && typeof r4.conLai === "number", "nguồn=" + r4.nguon + " · còn " + r4.conLai);

/* 5. Hai lượt song song → lượt sau bị cờ "đang đọc" chặn */
const [a, b] = await Promise.all([
  goi({ action: "sku_ocr", email: MAIL, mime: "image/jpeg", anh, nonce: LAN + "-song1" }),
  goi({ action: "sku_ocr", email: MAIL, mime: "image/jpeg", anh, nonce: LAN + "-song2" }),
]);
const soChan = [a, b].filter((x) => /Đang đọc ảnh trước/.test(x.message || "")).length;
kiem("Chặn 2 lượt gửi song song (cờ đang đọc)", soChan === 1, "chặn " + soChan + "/2");

/* 6. Ảnh trắng trơn → phải nói rõ là không thấy chữ */
const r6 = await goi({ action: "sku_ocr", email: MAIL, mime: "image/jpeg", anh: anhTrang, nonce: LAN + "-trang" });
kiem("Ảnh không có chữ → báo bằng tiếng người", r6.status === "error" && /không thấy chữ/i.test(r6.message || ""), r6.message);

console.log("\n" + (truot ? "✗ " : "✓ ") + dat + "/" + (dat + truot) + " ca đạt" + (truot ? " — " + truot + " ca TRƯỢT" : ""));
process.exit(truot ? 1 : 0);
