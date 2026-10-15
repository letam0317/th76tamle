/* 15/10: Báo cáo «Kết quả nghiệm thu — công việc sắp xếp chuẩn bị kiểm tổng».
 * Đọc sheet nghiệm thu qua GAS nt_lay (CHỈ ĐỌC) → tải ảnh/clip về kiemsoatkho/nt-media/ (bản xem trên máy này)
 * → dựng kiemsoatkho/ket-qua-nghiem-thu.html (dữ liệu nhúng sẵn, ngoài máy này tự dùng link Drive).
 * Chạy lại bất cứ lúc nào: node tao-ket-qua-nghiem-thu.mjs  (tệp đã tải thì bỏ qua). */
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath, pathToFileURL } from "url";
import sharp from "sharp";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const GAS = "https://script.google.com/macros/s/AKfycbzIE6E68VYxS0Zm1vj8Ttfd790-JYolO1C4rMoEPj7FdNOWLPb23QpUHgIZ2T_dlZPJRQ/exec";
const SHEET = "https://docs.google.com/spreadsheets/d/1MtXq8zOTZ610BWna-7m1yVY7cDIdlNtCKn9R6gqh9o4/edit?gid=0#gid=0";
const MEDIA = path.join(DIR, "kiemsoatkho", "nt-media");
const RA = path.join(DIR, "kiemsoatkho", "ket-qua-nghiem-thu.html");

/* LUẬT KẾT LUẬN (người duyệt sửa tại đây, chạy lại là xong):
 *  - Mục ghi trong DAT (khớp đầu ô Checklist) → «Đạt».
 *  - Mục có phản hồi nghiệm thu (ảnh/clip/ghi chú) mà không nằm trong DAT → «Chưa đạt» (phản hồi nêu tồn tại).
 *  - Mục chưa có phản hồi → «Chưa nghiệm thu». */
const DAT = [
  /^- Yêu cầu cây xả vải khi QC xong/,          // có đánh dấu X
  /^- Nền: Chạy máy chà sàn/,                   // đạt, góp ý tăng cường cuối ca
  /^Cảnh báo người dùng bước Hoàn thành/,       // đã có
  /^Xác nhận hệ thống có chức năng clear uid temp/,
  /^3\. Chụp ảnh thực tế khi lệch/,             // đã bắt buộc chụp đúng bước
  /^4\. Đối với SKU có UID Group/,              // đạt
];

/* ẢNH NẰM NGHIÊNG (soi bằng mắt 15/10): chụp bằng camera trong form khi cầm ngang điện thoại → lưu khung dọc, cảnh nghiêng.
 * Xoay 270° (ngược kim đồng hồ) cho đúng. Form đã tự xoay từ 15/10 tối; ảnh mới bị nghiêng thì thêm id Drive vào đây. */
const XOAY_270 = new Set([
  "1Qdmqrz912aQ0yMsvGy3bXWimLmD3xV8v",   // ảnh 10 dòng 12
  "1ENPN9PjydYzONnhZmUuPWlH4hYmBs1pH",   // ảnh 11 dòng 12
  "1e5AHod7cPyeQ5THoKgu4AW6J6okSBqvW",   // ảnh 13 dòng 16
  "1oJMRnj7zqRgc62LWG5HhCrbdcFnTnmKo",   // ảnh 14 dòng 16
  "17IOTPGvjHvaITq3X4L5CXr_u_oY4YjBl",   // ảnh 15 dòng 16
  "1bDTijCkfpSm3uFp5qB7HEqZxzh8W5AOZ",   // ảnh 16 dòng 16
  "1sBzUgnbK7LwUzfIWcoMSHjrhNWpQ6paf",   // ảnh 19 dòng 18
  "1Y3tZI0D673FYf4PdW6k3TLg_WY1zVZLv",   // ảnh 23 dòng 20
  "14xJJBobc27IBeFaM0JiDDprJ8c6f1gfl",   // ảnh 26 dòng 22
  "1ipMU_8daKXII36u8kw9AowRPubz0sq4e",   // ảnh 27 dòng 22
  "1c2N3mv7WqbEMRuL7EZeU28Jg0EvXhHHW",   // ảnh 28 dòng 23
  "1RcoB1nwfg9oVeiLziTg1ogmkyPzg159V",   // ảnh 29 dòng 23
  "1Kyw76Pb-YkObTBrftLD0JxngG7b3aMed",   // ảnh 30 dòng 23
  "1QyQwYNg0lh2vIUjLdJSDdSQi_3fPL5o-",   // ảnh 31 dòng 23
  "1nO63Coj7HbJDPEkwSRErKzuuUs8HO-xC",   // ảnh 44 dòng 35
  "1ZBpA5H3s-1kz9vCqsNW7pPcb4QyhcPrn",   // ảnh 45 dòng 35
  "1baH_tCnMhDUcqzMKAxDjAvrguXtB8hRs",   // ảnh 46 dòng 35
]);

async function layDuLieu() {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(GAS, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ action: "nt_lay" }) });
      const j = JSON.parse(await r.text());
      if (j.status === "success") return j;
      throw new Error(j.message || "nt_lay lỗi");
    } catch (e) { if (i === 3) throw e; await new Promise((ok) => setTimeout(ok, 1500 * (i + 1))); }   // GAS chập chờn 404 → thử lại
  }
}

/* rớt mạng giữa chừng (ECONNRESET 15/10) → thử lại tối đa 3 lần */
async function taiTep(t) {
  for (let i = 0; ; i++) {
    try { return await taiTep1(t); }
    catch (e) { if (i >= 2) throw e; await new Promise((ok) => setTimeout(ok, 2000 * (i + 1))); }
  }
}
async function taiTep1(t) {
  const duoi = t.loai === "video" ? ".mp4" : ".jpg", tep = path.join(MEDIA, t.id + duoi);
  if (fs.existsSync(tep) && fs.statSync(tep).size > 0) return path.basename(tep);
  let r = await fetch(`https://drive.usercontent.google.com/download?id=${t.id}&export=download&confirm=t`);
  if (!r.ok || /text\/html/.test(r.headers.get("content-type") || "")) r = await fetch(`https://drive.google.com/uc?export=download&id=${t.id}&confirm=t`);
  if (!r.ok || /text\/html/.test(r.headers.get("content-type") || "")) throw new Error("không tải được " + t.id);
  fs.writeFileSync(tep, Buffer.from(await r.arrayBuffer()));
  return path.basename(tep);
}

const sach = (s, nhan) => String(s || "").replace(nhan, "").trim();

const j = await layDuLieu();
fs.mkdirSync(MEDIA, { recursive: true });
const tatCa = j.dong.flatMap((d) => d.muc.flatMap((m) => m.tep));
let xong = 0;
for (let i = 0; i < tatCa.length; i += 4) {
  await Promise.all(tatCa.slice(i, i + 4).map(async (t) => { t.tepMay = await taiTep(t); xong++; }));
  process.stdout.write(`\rtải ảnh/clip ${xong}/${tatCa.length}`);
}
console.log();

/* Khổ ngang/dọc từng tệp để trang dựng đúng khung ngay (không giật khi ảnh tải xong).
   Ảnh: đo bằng sharp (tính cả cờ xoay EXIF). Clip: kích thước Drive báo (videoMediaMetadata, token clasp). */
async function tokenClasp() {
  const rc = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".clasprc.json"), "utf8")), t = rc.tokens ? rc.tokens.default : rc.token;
  const r = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: t.client_id, client_secret: t.client_secret, refresh_token: t.refresh_token, grant_type: "refresh_token" }) })).json();
  return r.access_token || "";
}
const tk = await tokenClasp().catch(() => "");
for (const t of tatCa) {
  try {
    if (t.loai === "video") {
      const m = await (await fetch(`https://www.googleapis.com/drive/v3/files/${t.id}?fields=videoMediaMetadata`, { headers: { Authorization: "Bearer " + tk } })).json();
      const v = m.videoMediaMetadata || {}; if (v.width && v.height) t.ty = +(v.width / v.height).toFixed(3);
    } else {
      if (XOAY_270.has(t.id)) {   // bản xem trên máy: tệp đã xoay sẵn; trang ngoài máy này xoay bằng CSS (cờ xoay)
        const ra = t.id + ".x270.jpg";
        if (!fs.existsSync(path.join(MEDIA, ra))) await sharp(path.join(MEDIA, t.tepMay)).rotate(270).jpeg({ quality: 85 }).toFile(path.join(MEDIA, ra));
        t.tepMay = ra; t.xoay = 270;
      }
      const m = await sharp(path.join(MEDIA, t.tepMay)).metadata(), xoay = (m.orientation || 1) >= 5;
      t.ty = +((xoay ? m.height : m.width) / (xoay ? m.width : m.height)).toFixed(3);
    }
  } catch (e) { /* không đo được → trang tự đo khi tải */ }
}

/* Chữ gõ tay ở ô G (tay) đôi khi là bản chép lại phản hồi đã có (dòng 6 chép phản hồi dòng 7) → bỏ để khỏi lặp. */
const gon = (s) => String(s || "").normalize("NFC").toLowerCase().replace(/(ảnh|clip) \d+/g, "").replace(/[^\p{L}\p{N}]+/gu, "");
const daCo = j.dong.flatMap((d) => d.muc.flatMap((m) => [m.ghiChu, ...m.tep.map((t) => t.ghiChu)])).map(gon).filter((x) => x.length > 15);
const trung = (tay) => { const g = gon(tay).slice(0, 30); return g.length > 15 && daCo.some((x) => x.includes(g)); };
for (const d of j.dong) if (d.tay && trung(d.tay)) { console.log(`bỏ chữ tay trùng ở dòng ${d.dong}`); d.tay = ""; }

const muc = j.dong.map((d) => {
  const coPhanHoi = d.muc.length > 0 || !!d.tay;
  const ketLuan = DAT.some((re) => re.test(d.checklist)) ? "dat" : coPhanHoi ? "chua" : "cho";
  return {
    dong: d.dong, stt: d.stt, congViec: d.congViec, checklist: d.checklist, tienDo: d.tienDo, tay: d.tay, ketLuan,
    phanHoi: d.muc.map((m) => ({
      ghiChu: m.ghiChu,   // 15/10 user: bỏ tên người gửi khỏi báo cáo
      tep: m.tep.map((t) => ({ id: t.id, loai: t.loai, may: t.tepMay, ty: t.ty || 0, xoay: t.xoay || 0, ghiChu: t.ghiChu || "",
        viTri: sach(t.viTri, /^Vị trí:\s*/i), ma: sach(t.ma, /^SKU\/UIDgr:\s*/i) })),
    })),
  };
});
const goi = { ten: j.ten, sheet: SHEET, luc: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }), muc };

const khuon = fs.readFileSync(path.join(DIR, "kiemsoatkho", "ket-qua-nghiem-thu.khuon.html"), "utf8");
fs.writeFileSync(RA, khuon.replace("/*__DU_LIEU__*/null", JSON.stringify(goi).replace(/</g, "\\u003c")));
const dem = (k) => muc.filter((m) => m.ketLuan === k).length;
console.log(`xong: ${muc.length} mục — Đạt ${dem("dat")} · Chưa đạt ${dem("chua")} · Chưa nghiệm thu ${dem("cho")} · ${tatCa.length} ảnh/clip → ${path.relative(DIR, RA)}`);

/* --pdf: xuất bản PDF khổ A4 bằng Edge (mở thẳng tệp trên đĩa, không cần máy chủ 8123) → Desktop\Tệp xuất\Kết quả nghiệm thu <ngày>.pdf
   Clip trong PDF = khung hình đại diện + dấu ▶; bấm ảnh/clip trong PDF mở bản gốc trên Drive. */
if (process.argv.includes("--pdf")) {
  const { default: puppeteer } = await import("puppeteer");
  const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
  const b = await puppeteer.launch({ headless: "new", executablePath: EDGE, args: ["--allow-file-access-from-files"] });   // không có cờ này canvas chụp khung clip bị coi là «bẩn»
  try {
    const p = await b.newPage();
    await p.setViewport({ width: 1000, height: 1400 });
    await p.goto(pathToFileURL(RA).href + "?in=1", { waitUntil: "load", timeout: 120000 });
    await p.evaluate(async () => {
      for (const v of [...document.querySelectorAll(".tep video")]) {   // clip → ảnh khung hình
        if (v.readyState < 2) await new Promise((ok) => { v.addEventListener("loadeddata", ok, { once: true }); setTimeout(ok, 8000); });
        try { v.currentTime = Math.min(1, (v.duration || 2) / 2); await new Promise((ok) => { v.addEventListener("seeked", ok, { once: true }); setTimeout(ok, 4000); }); } catch (e) { }
        const c = document.createElement("canvas"), s = Math.min(1, 800 / Math.max(v.videoWidth, v.videoHeight));
        c.width = v.videoWidth * s; c.height = v.videoHeight * s; c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
        const img = new Image(); img.src = c.toDataURL("image/jpeg", 0.82); v.replaceWith(img);
      }
      await Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((ok) => { i.onload = i.onerror = ok; })));
    });
    const ngay = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }).split("/").map((x) => x.padStart(2, "0"));
    const { thuMucXuat } = await import("./thu-muc-xuat.mjs");   // Desktop\Tệp xuất — user xem thẳng, khỏi đi tìm
    const pdf = path.join(thuMucXuat(), `Kết quả nghiệm thu ${ngay[0]}-${ngay[1]}-${ngay[2]}.pdf`);
    await p.pdf({ path: pdf, format: "A4", printBackground: true, margin: { top: "12mm", bottom: "14mm", left: "10mm", right: "10mm" },
      displayHeaderFooter: true, headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font:9px Arial;color:#888;padding:0 10mm;display:flex;justify-content:space-between"><span>Kết quả nghiệm thu — Công việc sắp xếp chuẩn bị kiểm tổng</span><span>Trang <span class="pageNumber"></span>/<span class="totalPages"></span></span></div>` });
    console.log(`PDF: ${pdf} (${(fs.statSync(pdf).size / 1048576).toFixed(1)} MB)`);
  } finally { await b.close(); }
}
