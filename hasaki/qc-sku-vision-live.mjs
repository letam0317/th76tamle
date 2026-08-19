/**
 * qc-sku-vision-live.mjs — kiểm CỔNG THẬT trên Apps Script (`action=sku_vision`) sau khi deploy.
 *  Gửi 1 ảnh tem tự dựng lên endpoint production và kiểm 4 điều:
 *    1. Chặn email không phải @hasaki.vn
 *    2. Chặn ảnh quá lớn
 *    3. Đọc được tem thật → trả về từ khoá đúng khuôn (item_codes/specs/colors/brands)
 *    4. Chặn 2 lượt gửi SONG SONG (cờ "đang đọc" theo email)
 *  Tốn 2 lượt trong hạn mức ngày (trần 400) — đừng chạy thành vòng lặp.
 *
 *  node qc-sku-vision-live.mjs [--mail ten@hasaki.vn]
 */
import puppeteer from "puppeteer";
import "dotenv/config";
import { EDGE_PATH } from "./token-store.js";

const URL_GAS = process.env.APPSCRIPT_URL || "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const MAIL = process.argv.includes("--mail") ? process.argv[process.argv.indexOf("--mail") + 1] : "qc.nhandiensku@hasaki.vn";

const goi = async (body) => {
  const r = await fetch(URL_GAS, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { status: "error", message: "không phải JSON: " + t.slice(0, 160) }; }
};

/* ---- dựng 1 ảnh tem dây kéo (như tem thật, cỡ ~40KB) ---- */
const browser = await puppeteer.launch({ headless: true, executablePath: EDGE_PATH });
const page = await browser.newPage();
await page.setViewport({ width: 760, height: 320 });
await page.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#8d8d8d;display:flex;align-items:center;justify-content:center;height:320px">
  <div style="width:640px;background:#fdfdf8;color:#111;border:2px solid #333;padding:16px 22px;font-family:Arial">
    <div style="display:flex;align-items:baseline;gap:18px;border-bottom:2px solid #111;padding-bottom:6px">
      <div style="font-size:36px;font-weight:900;letter-spacing:3px">YKK</div>
      <div style="font-size:26px;font-weight:800">8846295</div>
      <div style="font-size:20px;color:#333">CMOR-36</div></div>
    <div style="font-size:22px;font-weight:700;margin-top:12px">Chiều dài: 38.0 CM &nbsp;&nbsp; Màu: 345</div>
    <div style="font-size:15px;color:#333;margin-top:8px">100 PCS &nbsp;·&nbsp; VIETNAM</div>
  </div></body>`, { waitUntil: "load" });
const anh = (await page.screenshot({ type: "jpeg", quality: 78, encoding: "base64" }));
await browser.close();
console.log("✓ Ảnh tem mẫu: " + Math.round(anh.length / 1024) + " KB base64\n");

let dat = 0, truot = 0;
const kiem = (ten, ok, ghi) => { ok ? dat++ : truot++; console.log((ok ? "  ✓ " : "  ✗ ") + ten + (ghi ? "  — " + ghi : "")); };

/* nonce PHẢI khác nhau mỗi lượt chạy: doPost CẤT phản hồi theo nonce 10 phút (chống ghi trùng khi
   client thử lại). Dùng nonce cố định thì lượt sau nhận lại y nguyên phản hồi CŨ — bẫy này đã cắn
   thật 18/08/2026: 2 ca cổng cứ báo "Action không hỗ trợ" của bản deploy trước dù bản mới đã lên. */
const LAN = "qc" + Date.now().toString(36);

/* 0. Chờ bản deploy mới thực sự lên (vài lượt đầu sau clasp deploy vẫn do bản CŨ trả lời).
   Hỏi bằng email sai định dạng nên không tốn hạn mức AI. */
let daLen = false;
for (let i = 0; i < 10 && !daLen; i++) {
  const t = await goi({ action: "sku_vision", email: "kiem.deploy@gmail.com", nonce: LAN + "-warm" + i });
  daLen = !/Action không hỗ trợ/.test(t.message || "");
  if (!daLen) await new Promise((r) => setTimeout(r, 4000));
}
console.log(daLen ? "✓ Bản deploy có sku_vision đã lên\n" : "⚠ Vẫn là bản cũ sau 40 giây — kiểm lại clasp deploy\n");

/* 1. Email sai */
const r1 = await goi({ action: "sku_vision", email: "ai.do@gmail.com", mime: "image/jpeg", anh, nonce: LAN + "-mail" });
kiem("Chặn email không phải @hasaki.vn", r1.status === "error" && /hasaki\.vn/.test(r1.message || ""), r1.message);

/* 2. Ảnh quá lớn */
const r2 = await goi({ action: "sku_vision", email: MAIL, mime: "image/jpeg", anh: "A".repeat(2700000), nonce: LAN + "-to" });
kiem("Chặn ảnh quá lớn", r2.status === "error" && /quá lớn/.test(r2.message || ""), r2.message);

/* 3. Đọc tem thật */
const t0 = Date.now();
const r3 = await goi({ action: "sku_vision", email: MAIL, mime: "image/jpeg", anh, nonce: LAN + "-doc" });
const ms = Date.now() - t0;
const tk = r3.tokens || {};
kiem("Đọc được tem qua cổng production", r3.status === "success",
  r3.status === "success" ? (r3.model + " · " + ms + "ms · còn " + r3.conLai + " lượt hôm nay") : r3.message);
if (r3.status === "success") {
  kiem("Trả về đủ 5 nhóm từ khoá", ["item_codes", "specs", "colors", "brands", "others"].every((k) => Array.isArray(tk[k])),
    JSON.stringify(tk).slice(0, 190));
  kiem("Bóc đúng mã hàng 8846295", (tk.item_codes || []).some((x) => /8846295/.test(x)), (tk.item_codes || []).join(","));
  kiem("Bóc đúng chiều dài 38 + màu 345",
    (tk.specs || []).some((x) => /38/.test(x)) && (tk.colors || []).some((x) => /345/.test(x)),
    "specs=" + (tk.specs || []).join(",") + " colors=" + (tk.colors || []).join(","));
  kiem("Tự đánh giá chất lượng ảnh", /^(ro|mo|khong_doc_duoc)$/.test(r3.quality || ""), r3.quality);
}

/* 4. Hai lượt gửi SONG SONG: đúng 1 lượt được chạy, lượt kia bị cờ "đang đọc" chặn.
   (Không kiểm "chờ N giây" nữa: một lượt gọi Gemini mất 3-7 giây, bắt thủ kho chờ thêm là vô lý —
   thứ cần chặn là bấm 2 lần vì tưởng máy treo, tức 2 lượt CHỒNG NHAU.) */
const [pa, pb] = await Promise.all([
  goi({ action: "sku_vision", email: MAIL, mime: "image/jpeg", anh, nonce: LAN + "-songA" }),
  goi({ action: "sku_vision", email: MAIL, mime: "image/jpeg", anh, nonce: LAN + "-songB" }),
]);
const soChan = [pa, pb].filter((x) => x.status === "error" && /đang đọc/i.test(x.message || "")).length;
const soOk = [pa, pb].filter((x) => x.status === "success").length;
kiem("Chặn 2 lượt gửi song song (cờ \"đang đọc\")", soChan === 1 && soOk === 1,
  "chạy=" + soOk + " · chặn=" + soChan + " · " + [pa, pb].map((x) => x.status + (x.message ? ": " + x.message.slice(0, 34) : "")).join(" | "));

console.log("\n" + (truot ? "✗ " : "✓ ") + dat + "/" + (dat + truot) + " mục đạt" + (truot ? " — " + truot + " TRƯỢT" : ""));
process.exit(truot ? 1 : 0);
