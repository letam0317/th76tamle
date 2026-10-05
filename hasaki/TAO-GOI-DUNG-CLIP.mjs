/**
 * TAO-GOI-DUNG-CLIP.mjs — DỰNG GÓI AGENT DỰNG CLIP mang sang Desktop-JE75K38 (máy in tem) · 05/10/2026
 * ================================================================================================
 *  User 05/10: "cách 2 đi, vì đang k ở cạnh pc". Cùng khuôn TAO-GOI-MAY-IN.mjs: máy in KHÔNG cài Node,
 *  KHÔNG xin IT ⇒ gói mang theo node.exe + đúng các gói node_modules cần (puppeteer + dotenv + phụ thuộc)
 *  + mô hình dò người COCO-SSD (.cache-model) + _clip-noi.mjs. Cài 1 LẦN (bấm phải → Run as administrator):
 *    · chép vào C:\AuditFactory\dung-clip, khoá thư mục chỉ SYSTEM + Administrators đọc (có khoá + mật khẩu top-review)
 *    · task SYSTEM "Audit dung clip" bật lúc khởi động + mỗi 5 phút (agent tự chặn chạy chồng), ưu tiên thấp, không cửa sổ
 *  SỬA dung-clip-agent.mjs / _clip-noi.mjs XONG THÌ PHẢI DỰNG LẠI GÓI + CÀI LẠI (bản trên máy in là bản rời).
 *
 *  node TAO-GOI-DUNG-CLIP.mjs   →  hasaki/_GOI-DUNG-CLIP/   (chép cả thư mục sang máy in, bấm CAI-DUNG-CLIP.bat)
 */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const DIR = path.dirname(fileURLToPath(import.meta.url)), NM = path.join(DIR, "node_modules"), RA = path.join(DIR, "_GOI-DUNG-CLIP");
const MB = (n) => (n / 1048576).toFixed(1) + " MB";
const co = (p) => { let s = 0; for (const e of fs.readdirSync(p, { withFileTypes: true })) { const f = path.join(p, e.name); s += e.isDirectory() ? co(f) : fs.statSync(f).size; } return s; };
function goiCan() {   // đi từ puppeteer + dotenv rồi bò theo dependencies (giống TAO-GOI-MAY-IN)
  const can = new Set(), xet = ["puppeteer", "dotenv"];
  while (xet.length) { const t = xet.pop(); if (can.has(t)) continue;
    const pj = path.join(NM, t, "package.json"); if (!fs.existsSync(pj)) { if (xet.length >= 0) console.log("  · bỏ qua gói không có ở gốc (nằm lồng trong gói cha / tuỳ chọn): " + t); continue; }
    can.add(t); const p = JSON.parse(fs.readFileSync(pj, "utf8"));
    for (const d of Object.keys(p.dependencies || {})) xet.push(d);
    for (const d of Object.keys(p.optionalDependencies || {})) if (fs.existsSync(path.join(NM, d))) xet.push(d); }
  return [...can].sort();
}
fs.rmSync(RA, { recursive: true, force: true }); fs.mkdirSync(path.join(RA, "hasaki"), { recursive: true });
fs.copyFileSync(process.execPath, path.join(RA, "node.exe")); console.log("  node.exe                 " + MB(fs.statSync(process.execPath).size));
for (const f of ["dung-clip-agent.mjs", "_clip-noi.mjs", "token-store.js"]) { fs.copyFileSync(path.join(DIR, f), path.join(RA, "hasaki", f)); console.log("  hasaki/" + f.padEnd(24) + MB(fs.statSync(path.join(DIR, f)).size)); }
// .env RÚT GỌN: chỉ 4 khoá agent cần (không mang PIN, khoá Gemini, Telegram… sang máy công cộng)
const env = fs.readFileSync(path.join(DIR, ".env"), "utf8").split(/\r?\n/).filter((l) => /^(APPSCRIPT_URL|APPSCRIPT_KEY|TOPREVIEW_USER|TOPREVIEW_PASS)=/.test(l));
if (env.length < 4) { console.error("  ✗ .env thiếu một trong APPSCRIPT_URL/APPSCRIPT_KEY/TOPREVIEW_USER/TOPREVIEW_PASS"); process.exit(2); }
fs.writeFileSync(path.join(RA, "hasaki", ".env"), env.join("\r\n") + "\r\n"); console.log("  hasaki/.env              4 khoá (rút gọn)");
fs.cpSync(path.join(DIR, ".cache-model", "ssd_mobilenet_v2"), path.join(RA, "hasaki", ".cache-model", "ssd_mobilenet_v2"), { recursive: true });
console.log("  hasaki/.cache-model      " + MB(co(path.join(RA, "hasaki", ".cache-model"))));
let tong = 0; const ds = goiCan();
for (const g of ds) { fs.cpSync(path.join(NM, g), path.join(RA, "hasaki", "node_modules", g), { recursive: true }); tong += co(path.join(NM, g)); }
console.log("  hasaki/node_modules      " + MB(tong) + "  (" + ds.length + " gói)");
fs.writeFileSync(path.join(RA, "hasaki", "package.json"), JSON.stringify({ type: "module", private: true }));

fs.writeFileSync(path.join(RA, "hasaki", "_DUNG-CLIP-AN.vbs"), [
  "' Chay an agent dung clip (task SYSTEM goi moi 5 phut; agent tu chan chay chong)",
  'Set sh = CreateObject("WScript.Shell")',
  'thuMuc = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\\"))',
  "sh.CurrentDirectory = thuMuc",
  'sh.Run """" & thuMuc & "..\\node.exe"" dung-clip-agent.mjs", 0, False', ""].join("\r\n"), "ascii");

fs.writeFileSync(path.join(RA, "hasaki", "_CAI-DUNG-CLIP.ps1"), `# Cai agent dung clip len may in (chay voi quyen admin)
$ErrorActionPreference = "Stop"
$nguon = Split-Path -Parent $PSScriptRoot
$dich = "C:\\AuditFactory\\dung-clip"
Write-Host "Chep goi vao $dich ..."
New-Item -ItemType Directory -Force $dich | Out-Null
robocopy $nguon $dich /E /NFL /NDL /NJH /NJS /NP | Out-Null
# khoa thu muc: chi SYSTEM + Administrators (co khoa Apps Script + mat khau top-review)
icacls $dich /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" | Out-Null
$a = New-ScheduledTaskAction -Execute "wscript.exe" -Argument ('"' + $dich + '\\hasaki\\_DUNG-CLIP-AN.vbs"') -WorkingDirectory "$dich\\hasaki"
$t1 = New-ScheduledTaskTrigger -AtStartup
$t2 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
$s = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 0) -StartWhenAvailable -Priority 8 -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$p = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "Audit dung clip" -Action $a -Trigger @($t1, $t2) -Settings $s -Principal $p -Force | Out-Null
Start-ScheduledTask -TaskName "Audit dung clip"
Write-Host ""
Write-Host "XONG. Agent dung clip dang chay ngam (task SYSTEM 'Audit dung clip')."
Write-Host "Kiem tra tu laptop: node dung-clip-tu-xa.mjs --may"
`, "utf8");
fs.writeFileSync(path.join(RA, "CAI-DUNG-CLIP.bat"), ["@echo off", "rem Bam PHAI vao file nay -> Run as administrator (tren may in Desktop-JE75K38).", 'cd /d "%~dp0"',
  "net session >nul 2>&1", "if %errorlevel% neq 0 (", "  echo.", "  echo   CHUA CO QUYEN ADMIN. Bam PHAI vao CAI-DUNG-CLIP.bat -^> Run as administrator", "  echo.", "  pause", "  exit /b 1", ")",
  'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0hasaki\\_CAI-DUNG-CLIP.ps1"', "pause", ""].join("\r\n"), "ascii");
fs.writeFileSync(path.join(RA, "DOC-TRUOC-KHI-CAI.txt"), ["GOI AGENT DUNG CLIP - CAI TREN MAY IN (Desktop-JE75K38)", "=======================================================", "",
  "1. Chep CA thu muc nay sang may in (USB hoac tai tu Drive).", "2. Bam PHAI CAI-DUNG-CLIP.bat -> Run as administrator. Doi chu XONG.", "3. Xong. Co the xoa thu muc vua chep (ban chay nam o C:\\AuditFactory\\dung-clip).", "",
  "Agent chay ngam (khong cua so), uu tien CPU thap, RAM trong duoi 3 GB thi cho - khong lam cham BarTender/in tem.",
  "Clip va doan camera bi xoa khoi may ngay sau khi gui di.", ""].join("\r\n"), "ascii");
console.log("✓ " + RA + "  ·  tổng " + MB(co(RA)));
