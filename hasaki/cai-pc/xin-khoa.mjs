// xin-khoa.mjs — PC KHÔNG có khoá (bộ cài tải ngay trên PC = bản công khai) xin khoá từ máy quản lý, KHÔNG chép file/điền tay.
// 14/10/2026 user cài trên PC → «.env CON TRONG». Luồng: gửi pcXinKhoa {máy, mã ngẫu nhiên} → in MÃ XÁC NHẬN → chờ laptop bấm
// Duyệt ở mục Máy trạm → pcLayKhoa trả gói khoá (1 lần) → ghi vào .env (giữ dòng cũ, điền khoá trống). Chỉ dùng chữ ASCII (cửa sổ cmd).
//   Chạy trong thư mục dự án: node cai-pc/xin-khoa.mjs        thoát 0 = đã có khoá · 1 = hết giờ / từ chối / lỗi
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import crypto from "node:crypto"; import { fileURLToPath } from "node:url";

const DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));   // ...\hasaki
const cfg = JSON.parse(fs.readFileSync(path.join(DIR, "cai-pc", "dieu-phoi.json"), "utf8"));
const GAS = cfg.gasUrl, MAY = os.hostname(), MA = crypto.randomBytes(16).toString("hex");
const CHO_TOI_DA = Number(process.env.XIN_KHOA_CHO_PHUT || 30) * 60000;
if (!GAS) { console.log("  [X] dieu-phoi.json thieu gasUrl"); process.exit(1); }

async function goi(o) {   // GAS lỗi trả HTML → thử lại; không JSON 3 lần thì báo
  for (let i = 0; i < 3; i++) {
    try { const t = await (await fetch(GAS, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(o), signal: AbortSignal.timeout(45000) })).text();
      if (t.trim()[0] === "{") return JSON.parse(t); } catch { /* mạng chập chờn */ }
    await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
  }
  return { status: "error", message: "Khong goi duoc may chu (mang?)" };
}

const x = await goi({ action: "pcXinKhoa", may: MAY, ma: MA });
if (x.status !== "success") { console.log("  [X] Gui yeu cau xin khoa loi: " + x.message); process.exit(1); }
console.log("");
console.log("  ============================================================");
console.log("    MAY NAY CHUA CO KHOA - DA GUI YEU CAU XIN KHOA");
console.log("    Tren LAPTOP: dashboard > Xac minh > May tram > muc 'PC xin khoa'");
console.log("    May: " + MAY);
console.log("    MA XAC NHAN:   " + x.maXN.split("").join(" ") + "      (phai GIONG ma tren laptop moi bam Duyet)");
console.log("  ============================================================");
process.stdout.write("    Dang cho duyet");

const t0 = Date.now(); let goiKhoa = "";
while (Date.now() - t0 < CHO_TOI_DA) {
  await new Promise((r) => setTimeout(r, 10000)); process.stdout.write(".");
  const j = await goi({ action: "pcLayKhoa", may: MAY, ma: MA });
  if (j.status === "success" && j.goi) { goiKhoa = j.goi; break; }
  if (j.status !== "success" && (j.code === 404 || j.code === 410)) { console.log("\n  [X] Yeu cau bi TU CHOI hoac het han - chay lai bo cai de xin lai."); process.exit(1); }
}
if (!goiKhoa) { console.log("\n  [X] Het " + Math.round(CHO_TOI_DA / 60000) + " phut chua duoc duyet - chay lai bo cai de xin lai."); process.exit(1); }

// ghi .env: giữ mọi dòng cũ, điền/ghi đè đúng các khoá trong gói
const envF = path.join(DIR, ".env"), dong = new Map();
try { for (const l of fs.readFileSync(envF, "utf8").replace(/^﻿/, "").split(/\r?\n/)) { const m = /^\s*([A-Z0-9_]+)\s*=/.exec(l); if (m) dong.set(m[1], l); } } catch { /* chưa có .env */ }
let so = 0; for (const l of Buffer.from(goiKhoa, "base64").toString("utf8").split("\n")) { const m = /^([A-Z0-9_]+)=(.+)$/.exec(l.trim()); if (m) { dong.set(m[1], m[1] + "=" + m[2]); so++; } }
fs.writeFileSync(envF, [...dong.keys()].sort().map((k) => dong.get(k)).join("\r\n") + "\r\n", "utf8");
console.log("\n  [OK] DA NHAN " + so + " KHOA - da ghi vao .env, cai tiep...");
process.exit(0);
