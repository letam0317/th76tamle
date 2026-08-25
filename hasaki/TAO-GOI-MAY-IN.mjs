/**
 * TAO-GOI-MAY-IN.mjs — DỰNG GÓI MANG SANG MÁY CẮM MÁY IN (Desktop-JE75K38)
 * ================================================================================================
 *  Vì sao có file này (chốt 21/08/2026): agent nhặt lệnh in phải chạy **ngay trên máy cắm máy in**,
 *  không phải trên laptop. Trước đó laptop tắt là không ai in được, dù máy in vẫn sẵn sàng — đúng
 *  sự cố sáng 21/08 (5 lệnh bấm từ 07:57 nằm trong hàng đợi tới 09:01).
 *
 *  Máy đó KHÔNG cài Node, và mình KHÔNG xin IT cài gì cả. Nên gói này mang theo luôn:
 *    · `node.exe` — trên Windows nó là một file chạy độc lập, chép đi là chạy được, không cần cài.
 *    · đúng 6 gói node_modules mà agent cần (sharp + dotenv + phụ thuộc) ≈ 20 MB, không phải cả
 *      268 MB node_modules của dự án.
 *    · `factory/index.html` — agent cắt khối `PR-TEM` trong đó để dựng tem, nên tem in ra giống hệt
 *      bản xem trước trên dashboard. Thiếu file này agent thoát ngay lúc khởi động.
 *
 *  Chạy:  node TAO-GOI-MAY-IN.mjs
 *  Ra:    hasaki/_GOI-MAY-IN/   (chép cả thư mục sang máy in rồi bấm CAI-TREN-MAY-IN.bat)
 *
 *  SỬA CODE AGENT XONG THÌ PHẢI CHẠY LẠI FILE NÀY + CHÉP LẠI — bản trên máy in là bản RỜI, nó không
 *  tự cập nhật theo laptop. (Đổi lại: laptop tắt nó vẫn in.)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const GOC = path.join(DIR, "..");
const NM = path.join(DIR, "node_modules");
const RA = path.join(DIR, "_GOI-MAY-IN");

/* ── 1. Tính ĐÚNG những gói node_modules cần mang ────────────────────────────────────────────────
   Đi từ `sharp` + `dotenv` rồi bò theo dependencies. Chép cả node_modules cho chắc là 268 MB —
   phần lớn là puppeteer/googleapis mà agent không đụng tới. */
function goiCan() {
  const can = new Set(), xet = ["sharp", "dotenv"];
  while (xet.length) {
    const t = xet.pop();
    if (can.has(t)) continue;
    const pj = path.join(NM, t, "package.json");
    if (!fs.existsSync(pj)) { console.error("  ✗ thiếu gói " + t + " — chạy `npm install` trước"); process.exit(2); }
    can.add(t);
    const p = JSON.parse(fs.readFileSync(pj, "utf8"));
    for (const d of Object.keys(p.dependencies || {})) xet.push(d);
    /* optionalDependencies của sharp là bản nhị phân cho TỪNG nền tảng (win32-x64, linux-arm64…).
       Chỉ mang cái nào máy này thực sự có — đó chính là bản khớp Windows x64. */
    for (const d of Object.keys(p.optionalDependencies || {})) if (fs.existsSync(path.join(NM, d))) xet.push(d);
  }
  return [...can].sort();
}

function chep(tu, den) {
  fs.mkdirSync(path.dirname(den), { recursive: true });
  fs.cpSync(tu, den, { recursive: true });
}
function co(p) { let s = 0; for (const e of fs.readdirSync(p, { withFileTypes: true })) { const f = path.join(p, e.name); s += e.isDirectory() ? co(f) : fs.statSync(f).size; } return s; }
const MB = (n) => (n / 1048576).toFixed(1) + " MB";

/* ── 2. Dựng lại từ đầu ──────────────────────────────────────────────────────────────────────── */
fs.rmSync(RA, { recursive: true, force: true });
fs.mkdirSync(path.join(RA, "hasaki"), { recursive: true });
fs.mkdirSync(path.join(RA, "factory"), { recursive: true });

/* node.exe: file chạy độc lập trên Windows. Lấy đúng cái đang chạy script này để chắc chắn khớp
   phiên bản mà sharp được biên dịch cho. */
fs.copyFileSync(process.execPath, path.join(RA, "node.exe"));
console.log("  node.exe                 " + MB(fs.statSync(process.execPath).size));

const FILE_HASAKI = [
  "in-tem-agent.mjs",        // chính agent
  "_IN-RAW.ps1",             // gửi byte TSPL thẳng vào spooler
  "_MAY-IN-SERVER.ps1",      // tiến trình sống lâu đọc tình trạng máy in
  "_AGENT-IN-TEM-AN.vbs",    // vỏ chạy ẩn + chốt chống chạy trùng
  "_CO-CHO-MAY-IN.ps1",      // bộ cò chờ (cài + tự chữa)
  "_CO-CHO-MAY-IN.bat",      // điểm bấm
  ".env",                    // APPSCRIPT_URL + APPSCRIPT_KEY
];
for (const f of FILE_HASAKI) {
  const tu = path.join(DIR, f);
  if (!fs.existsSync(tu)) { console.error("  ✗ thiếu " + f); process.exit(2); }
  fs.copyFileSync(tu, path.join(RA, "hasaki", f));
  console.log("  hasaki/" + f.padEnd(24) + MB(fs.statSync(tu).size));
}

const HTML = path.join(GOC, "factory", "index.html");
fs.copyFileSync(HTML, path.join(RA, "factory", "index.html"));
console.log("  factory/index.html       " + MB(fs.statSync(HTML).size));

let tongNm = 0;
for (const g of goiCan()) {
  chep(path.join(NM, g), path.join(RA, "hasaki", "node_modules", g));
  tongNm += co(path.join(NM, g));
}
console.log("  hasaki/node_modules      " + MB(tongNm) + "  (" + goiCan().join(", ") + ")");

/* ── 3. Điểm bấm + tờ hướng dẫn nằm ngay trong gói ───────────────────────────────────────────── */
fs.writeFileSync(path.join(RA, "CAI-TREN-MAY-IN.bat"), [
  "@echo off",
  "rem Bam PHAI vao file nay -> Run as administrator.",
  "rem Chay TREN MAY CAM MAY IN (Desktop-JE75K38), khong phai tren laptop.",
  "title Cai co cho + agent in tem - chay tren may cam may in",
  'cd /d "%~dp0"',
  "net session >nul 2>&1",
  "if %errorlevel% neq 0 (",
  "  echo.",
  "  echo   CHUA CO QUYEN ADMIN. Bam PHAI vao CAI-TREN-MAY-IN.bat -^> Run as administrator",
  "  echo.",
  "  pause",
  "  exit /b 1",
  ")",
  'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0hasaki\\_CO-CHO-MAY-IN.ps1"',
  "",
].join("\r\n"), "ascii");

fs.writeFileSync(path.join(RA, "DOC-TRUOC-KHI-CAI.txt"), [
  "GOI CO CHO + AGENT IN TEM - CHAY TREN MAY CAM MAY IN (Desktop-JE75K38)",
  "=====================================================================",
  "",
  "MUC DICH: may nay BAT la moi luot gui in deu ra tem, KHONG phu thuoc laptop cua agent.",
  "Truoc day agent chay tren laptop; laptop tat la khong ai in duoc du may in van san sang.",
  "",
  "CACH CAI",
  "  1. Chep NGUYEN thu muc nay vao may in, vi du  C:\\AuditFactory",
  "     Dung de trong Downloads/Desktop (de bi don nham), cung dung de trong C:\\Users\\Public",
  "     (cho do AI CUNG GHI DUOC, ma trong goi co .env chua APPSCRIPT_KEY).",
  "     Neu goi dang nam o C:\\Users\\Public\\AuditFactory: CAT sang C:\\AuditFactory TRUOC KHI CAI",
  "     - cai xong moi chuyen thi task se tro sai duong dan.",
  "  2. Bam PHAI vao CAI-TREN-MAY-IN.bat -> Run as administrator",
  "  3. No DOC truoc (nep tat/bat 10 ngay, spooler, may in, card mang), dung hoi Enter moi SUA.",
  "  4. Lam not phan BIOS ma no in ra o cuoi (quan trong nhat: Restore on AC Power Loss = Power On).",
  "",
  "TRONG GOI CO GI",
  "  node.exe            Node chay doc lap - may nay khong can cai Node",
  "  hasaki\\             agent in tem + bo co cho + .env (APPSCRIPT_URL/KEY)",
  "  factory\\index.html  loi tem PR-TEM, de tem in ra giong het ban xem truoc tren dashboard",
  "",
  "SAU KHI CAI",
  "  · Task 'Co cho may in tem' chay bang SYSTEM khi khoi dong may + moi 2 phut:",
  "    giu agent song, giu spooler song, go co Offline/Pause cua may in.",
  "  · So: hasaki\\_co-cho-may-in.log  va  hasaki\\.in-tem-agent.log",
  "",
  "SUA CODE AGENT BEN LAPTOP XONG THI PHAI CHEP LAI GOI NAY - ban tren may in la ban ROI.",
  "",
].join("\r\n"), "ascii");

console.log("\n  → " + RA);
console.log("  TONG GOI: " + MB(co(RA)));
console.log("\n  Chép cả thư mục sang máy in (vd C:\\AuditFactory) rồi bấm phải CAI-TREN-MAY-IN.bat → Run as administrator.");
