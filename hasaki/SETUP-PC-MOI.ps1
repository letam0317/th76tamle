# ============================================================
#  SETUP-PC-MOI.ps1 — Cài đặt hệ 5S/Factory trên MÁY MỚI (1 lần)
#  Chạy:  Click phải file -> Run with PowerShell
#         (hoặc: powershell -ExecutionPolicy Bypass -File SETUP-PC-MOI.ps1)
#  KHÔNG cần quyền Admin (task đăng ký cho user hiện tại, reg ghi HKCU).
#
#  Script tự lấy đường dẫn thư mục hiện tại — đặt dự án ở đâu cũng chạy.
#  Việc script làm:
#    1. Kiểm tra Node / Edge / .env / node_modules
#    2. Đăng ký 4 Scheduled Task (giờ giống hệt máy cũ)
#    3. Đăng ký giao thức hasaki5s:// (nút đăng nhập trong email)
#  Việc PHẢI làm TAY sau đó (xem CHUYEN-MAY-PC.md):
#    - Chép .env + dữ liệu riêng, chạy LOGIN-HASAKI.bat lần đầu,
#      tắt lịch trên máy cũ, chỉnh nguồn điện không sleep.
# ============================================================
$ErrorActionPreference = "Stop"
$DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "== Thu muc du an: $DIR" -ForegroundColor Cyan

# ---------- 1. KIEM TRA MOI TRUONG ----------
$loi = @()
try { $nodeVer = (& node -v) } catch { $nodeVer = $null }
if ($nodeVer) { Write-Host "  [OK] Node $nodeVer" } else { $loi += "Chua cai Node.js (>=18) — tai tai nodejs.org" }

$edge = @("C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
          "C:\Program Files\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($edge) { Write-Host "  [OK] Edge: $edge" } else { $loi += "Khong tim thay Microsoft Edge — cai Edge hoac dat EDGE_PATH trong .env" }

if (Test-Path (Join-Path $DIR ".env")) { Write-Host "  [OK] .env da co" }
else { $loi += "THIEU .env — chep tu may cu (file nay KHONG theo git). Mau: .env.example" }

if (Test-Path (Join-Path $DIR "node_modules")) { Write-Host "  [OK] node_modules da co" }
else {
  Write-Host "  [..] Chua co node_modules -> chay npm install..." -ForegroundColor Yellow
  Push-Location $DIR; & npm install; Pop-Location
}

if (-not (Test-Path (Join-Path $DIR ".exports\tasks-cache.json"))) {
  Write-Host "  [!] Chua co .exports\tasks-cache.json (kho task dong bang) — nen chep tu may cu, khong co thi lan dau phai FULL_RESYNC=1" -ForegroundColor Yellow
}

if ($loi.Count) {
  Write-Host "`n== CON THIEU (sua xong chay lai script): " -ForegroundColor Red
  $loi | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}

# ---------- 2. DANG KY 4 SCHEDULED TASK ----------
Write-Host "`n== Dang ky Scheduled Task (ghi de neu da co)..." -ForegroundColor Cyan
$wscript = "$env:SystemRoot\System32\wscript.exe"
$hom = (Get-Date).Date

function Dang-Ky($ten, $vbs, $trigger) {
  $action = New-ScheduledTaskAction -Execute $wscript -Argument "`"$DIR\$vbs`""
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
              -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $ten -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
  Write-Host "  [OK] $ten"
}

# 7h00 hang ngay: auto-export (5S-TASKS) + noi luong ton vi tri (stocklocation)
Dang-Ky "5S Dong bo dashboard" "auto-export-hidden.vbs" (New-ScheduledTaskTrigger -Daily -At ($hom.AddHours(7)))
# 7h20 hang ngay: cham cong + danh ba nhan su
Dang-Ky "5S Cham cong" "cham-cong-hidden.vbs" (New-ScheduledTaskTrigger -Daily -At ($hom.AddHours(7).AddMinutes(20)))
# Moi 15 phut: day bao cao 5S tu inbox WMS-5S-AUDIT -> task workflow
$t15 = New-ScheduledTaskTrigger -Once -At ($hom.AddHours(7).AddMinutes(5)) `
       -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration ([TimeSpan]::MaxValue)
Dang-Ky "Day bao cao 5S" "day-bao-cao-hidden.vbs" $t15
# Moi 2 phut: canh yeu cau dang nhap (mo Edge khi can OTP)
$t2 = New-ScheduledTaskTrigger -Once -At ($hom.AddHours(7)) `
      -RepetitionInterval (New-TimeSpan -Minutes 2) -RepetitionDuration ([TimeSpan]::MaxValue)
Dang-Ky "5S Canh yeu cau dang nhap" "watch-login-hidden.vbs" $t2

# ---------- 3. GIAO THUC hasaki5s:// (HKCU, khong can Admin) ----------
Write-Host "`n== Dang ky giao thuc hasaki5s:// ..." -ForegroundColor Cyan
$base = "HKCU:\Software\Classes\hasaki5s"
New-Item -Path "$base\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path $base -Name "(Default)" -Value "URL:Hasaki 5S Login"
New-ItemProperty -Path $base -Name "URL Protocol" -Value "" -PropertyType String -Force | Out-Null
New-Item -Path "$base\DefaultIcon" -Force | Out-Null
Set-ItemProperty -Path "$base\DefaultIcon" -Name "(Default)" -Value "cmd.exe,0"
Set-ItemProperty -Path "$base\shell\open\command" -Name "(Default)" -Value "`"$DIR\LOGIN-HASAKI.bat`" `"%1`""
Write-Host "  [OK] hasaki5s:// -> $DIR\LOGIN-HASAKI.bat"

Write-Host "`n== XONG PHAN TU DONG. Tiep theo lam tay:" -ForegroundColor Green
Write-Host "  1. Chay LOGIN-HASAKI.bat 1 lan (tao phien SSO + kho token tren may nay)"
Write-Host "  2. Chay thu: AUTO-EXPORT.bat roi kiem tra auto-export.log + stocklocation.log + Google Sheet"
Write-Host "  3. TAT lich tren MAY CU:  '5S Dong bo dashboard','5S Cham cong','Day bao cao 5S','5S Canh yeu cau dang nhap' | ForEach-Object { Disable-ScheduledTask -TaskName `$_ }"
Write-Host "  4. Chinh nguon dien: khong Sleep (powercfg /change standby-timeout-ac 0) + tu dang nhap user sau khi khoi dong (netplwiz)"
Write-Host "  5. Chay BAO-MAT-MAY.ps1 (SAU khi da chep du .env + du lieu rieng): siet ACL, ma hoa EFS, tu khoa man hinh"
