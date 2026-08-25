# ============================================================
#  SETUP-PC-MOI.ps1 — Cài đặt hệ 5S/Factory trên MÁY MỚI (1 lần)
#  Chạy:  Click phải file -> Run with PowerShell
#         (hoặc: powershell -ExecutionPolicy Bypass -File SETUP-PC-MOI.ps1)
#  KHÔNG cần quyền Admin (task đăng ký cho user hiện tại, reg ghi HKCU).
#
#  Script tự lấy đường dẫn thư mục hiện tại — đặt dự án ở đâu cũng chạy.
#  Việc script làm:
#    1. Kiểm tra Node / Edge / .env / node_modules
#    2. Đăng ký 5 Scheduled Task (ĐÚNG lịch đang chạy thật — xem bảng dưới)
#    3. Đăng ký giao thức hasaki5s:// (nút đăng nhập trong email)
#
#  LỊCH CHUẨN (soát lại 30/07/2026 — bản cũ ghi 7h00 và THIẾU watchdog):
#    5S Dong bo dashboard      08:40 hằng ngày   auto-export + cụm tồn kho (dời 7h00->8h40 từ 22/07)
#    5S Cham cong              07:20 hằng ngày   danh bạ + chấm công hôm nay
#    Day bao cao 5S            mỗi 15'           inbox 5S -> task workflow 591
#    5S Canh yeu cau dang nhap mỗi 2'            cờ dashboard + sync-guard + sync-poller
#    5S Tra UID tren Sheet     mỗi 2'            tra UID trên file Sheet "TRA UID"
#    5S Kenh tin nhan          mỗi 2'            nghe lệnh Telegram (KENH-TIN-NHAN.md)
#    5S Task hang ngay         ĐÃ TẮT 19/08      nộp báo cáo task = bấm NUT-NOP-TASK.bat
#    Factory watchdog ton kho  logon +5' & mỗi giờ 07:05-18:05   vá bước tồn kho còn cũ
#  Vì sao 08:40 chứ không 07:00: máy hay bật muộn, task "chạy bù" dồn vào giữa giờ làm và
#  đụng khung chặn re-login 07:45-18:00 (session-rules.js) -> cụm hoãn trong im lặng.
#  Watchdog là bộ phận BẮT BUỘC: thiếu nó, một bước chết giữa cụm sẽ trơ dữ liệu cũ cả ngày.
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

# ---------- 2. DANG KY SCHEDULED TASK ----------
Write-Host "`n== Dang ky Scheduled Task (ghi de neu da co)..." -ForegroundColor Cyan
$wscript = "$env:SystemRoot\System32\wscript.exe"
$hom = (Get-Date).Date
# BAY 19/08/2026: -RepetitionDuration ([TimeSpan]::MaxValue) KHONG dang ky duoc tren may nay —
# Register-ScheduledTask tra "The task XML contains a value which is incorrectly formatted or out
# of range. (8,42):Duration:P99999999DT23H59M59S". Ba task nhip ngan (15'/2'/2') truoc day dung
# MaxValue => dung script nay tren MAY MOI se DUT ca ba ngay tai buoc dang ky. Cac task dang chay
# that tren may deu la P3650D (10 nam) — lay dung con so do lam chuan.
$LAP_MAI = New-TimeSpan -Days 3650

function Dang-Ky($ten, $vbs, $trigger) {
  $action = New-ScheduledTaskAction -Execute $wscript -Argument "`"$DIR\$vbs`""
  # KHONG -WakeToRun o day (audit 23/08/2026 de xuat nhung DA BAC): WakeToRun la thuoc tinh CA TASK,
  # gan vao task nhip 2' la may bi dung day 720 lan/ngay. Viec "may ngu thi ai chay task" da co
  # task rieng "Factory co cho bat may sang" (06:50 hang ngay, WakeToRun=True) lo — xem A2.
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
              -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $ten -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
  Write-Host "  [OK] $ten"
}

# 8h40 hang ngay: auto-export (5S-TASKS) + noi cum ton kho (SYNC-STOCK.bat: stocklocation,
# kiem ke, ton bat thuong, ve sinh, AI anh). KHONG dat 7h00: may bat muon -> chay bu giua gio lam.
Dang-Ky "5S Dong bo dashboard" "auto-export-hidden.vbs" (New-ScheduledTaskTrigger -Daily -At ($hom.AddHours(8).AddMinutes(40)))
# 7h20 hang ngay: cham cong + danh ba nhan su
Dang-Ky "5S Cham cong" "cham-cong-hidden.vbs" (New-ScheduledTaskTrigger -Daily -At ($hom.AddHours(7).AddMinutes(20)))
# Moi 15 phut: day bao cao 5S tu inbox WMS-5S-AUDIT -> task workflow
$t15 = New-ScheduledTaskTrigger -Once -At ($hom.AddHours(7).AddMinutes(5)) `
       -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration $LAP_MAI
Dang-Ky "Day bao cao 5S" "day-bao-cao-hidden.vbs" $t15
# Moi 2 phut: TRUC THAN KINH — co dashboard (cap nhat/cham cong/tai lai ton kho/dang nhap),
# so nhat ky phien WMS, goi sync-guard (khong --force) va sync-poller (nhip 15-30' trong ngay).
$t2 = New-ScheduledTaskTrigger -Once -At ($hom.AddHours(7)) `
      -RepetitionInterval (New-TimeSpan -Minutes 2) -RepetitionDuration $LAP_MAI
Dang-Ky "5S Canh yeu cau dang nhap" "watch-login-hidden.vbs" $t2
# Moi 2 phut: TRA UID tren Google Sheet (file "TRA UID - Ton kho WMS"). Lich RIENG chu khong nhet
# vao bo canh tren, vi bo canh hay ban chay auto-export/sync-guard nhieu phut -> luot tra UID phai
# xep hang (do that 17/08/2026: 181 giay). WMS chan IP ngoai nen Apps Script khong tu goi WMS duoc.
$t2b = New-ScheduledTaskTrigger -Once -At ($hom.AddHours(7)) `
       -RepetitionInterval (New-TimeSpan -Minutes 2) -RepetitionDuration $LAP_MAI
Dang-Ky "5S Tra UID tren Sheet" "tra-uid-hidden.vbs" $t2b
# Moi 2 phut: KENH RA LENH BANG TIN NHAN (Telegram) — xem KENH-TIN-NHAN.md.
# Moi luot long-poll ~100s roi thoat => phu gan lien tuc ma van tu hoi sinh khi may tat/bat.
# Chua khai TELEGRAM_BOT_TOKEN trong .env thi script thoat em (exit 0), khong lam gi.
$t2c = New-ScheduledTaskTrigger -Once -At ($hom.AddHours(7)) `
       -RepetitionInterval (New-TimeSpan -Minutes 2) -RepetitionDuration $LAP_MAI
Dang-Ky "5S Kenh tin nhan" "tin-nhan-hidden.vbs" $t2c
# WATCHDOG ton kho: khi dang nhap Windows (+5') VA moi gio tu 07:05 keo dai 11h (-> 18:05).
# Guard tu doc moc tung buoc (.sync-ok-*) va CHI chay lai buoc con cu (SYNC_SKIP_FRESH=1).
$tgLogon = New-ScheduledTaskTrigger -AtLogOn
$tgLogon.Delay = "PT5M"
# LUU Y PowerShell 5.1: -Daily KHONG nhan -RepetitionInterval (khac parameter set -> loi binding).
# Cach dung: tao trigger Daily, roi GAN Repetition lay tu mot trigger -Once.
$tgGio = New-ScheduledTaskTrigger -Daily -At ($hom.AddHours(7).AddMinutes(5))
$tgGio.Repetition = (New-ScheduledTaskTrigger -Once -At ($hom.AddHours(7).AddMinutes(5)) `
                     -RepetitionInterval (New-TimeSpan -Hours 1) `
                     -RepetitionDuration (New-TimeSpan -Hours 11)).Repetition
Dang-Ky "Factory watchdog ton kho" "sync-guard-hidden.vbs" @($tgLogon, $tgGio)

# NOP BAO CAO 9 TASK HANG NGAY tren work.hasaki.vn (xem TASK-HANG-NGAY.md).
# CHOT 19/08/2026: dang ky nhung DE TAT. Chu may giu quyen "hoan thanh" — can bot nop thi BAM NUT
# (NUT-NOP-TASK.bat / shortcut Desktop, che do --nut co hoi truoc khi nop), khong can thi tu bam
# tren web. Task van dang ky san de bat lai 1 dong khi muon quay ve nhip tu dong:
#   Enable-ScheduledTask -TaskName '5S Task hang ngay'
# (Nhip cu: 16:00 + lap moi 30' trong 2h — lap la de VET khi 16h chua co phien work song.)
$tgTask = New-ScheduledTaskTrigger -Daily -At ($hom.AddHours(16))
$tgTask.Repetition = (New-ScheduledTaskTrigger -Once -At ($hom.AddHours(16)) `
                      -RepetitionInterval (New-TimeSpan -Minutes 30) `
                      -RepetitionDuration (New-TimeSpan -Hours 2)).Repetition
Dang-Ky "5S Task hang ngay" "task-hangngay-hidden.vbs" $tgTask
Disable-ScheduledTask -TaskName "5S Task hang ngay" | Out-Null
Write-Host "  [TAT] 5S Task hang ngay - nop bao cao bang NUT-NOP-TASK.bat (bam tay)"

# NUT ngoai Desktop: bam de bot nop bao cao 9 task hang ngay (hoi truoc khi nop).
$deskt = [Environment]::GetFolderPath('Desktop')
$lnk = Join-Path $deskt 'NOP BAO CAO TASK (bam khi can).lnk'
$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($lnk)
$sc.TargetPath = "$DIR\NUT-NOP-TASK.bat"
$sc.WorkingDirectory = $DIR
$sc.Description = 'Bam de bot nop bao cao 9 task hang ngay tren work.hasaki.vn (hoi truoc khi nop)'
$sc.IconLocation = (Get-Command node).Source + ',0'
$sc.Save()
Write-Host "  [OK] Shortcut nut: $lnk"

# BO CO CHO MAY TRAM (21/08/2026) — 2 task rieng + cai dat nguon. Khong nhet vao ham Dang-Ky o tren
# vi chung can trigger SU KIEN (cam sac / may thuc day) va co WakeToRun — nhung thu New-ScheduledTaskTrigger
# cua PS 5.1 khong dung duoc. De nguyen mot cho trong CAI-CO-CHO.ps1, tranh hai noi troi khac nhau.
#   -KhongHoi = chi lam cai dat nguon + 2 task; TU DANG NHAP WINDOWS phai co nguoi tra loi,
#   bam dup CAI-CO-CHO.bat sau (xem CO-CHO-MAY-IN.md).
& powershell -NoProfile -ExecutionPolicy Bypass -File "$DIR\CAI-CO-CHO.ps1" -KhongHoi

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
Write-Host "  3. TAT lich tren MAY CU (CA 5 task — 2 may cung chay = 2 phien SSO da nhau + 2 nguon ghi de Sheet):"
Write-Host "     '5S Dong bo dashboard','5S Cham cong','Day bao cao 5S','5S Canh yeu cau dang nhap','Factory watchdog ton kho','5S Task hang ngay' | ForEach-Object { Disable-ScheduledTask -TaskName `$_ }"
Write-Host "  4. Chinh nguon dien: khong Sleep (powercfg /change standby-timeout-ac 0) + tu dang nhap user sau khi khoi dong (netplwiz)"
Write-Host "  5. Chay BAO-MAT-MAY.ps1 (SAU khi da chep du .env + du lieu rieng): siet ACL, ma hoa EFS, tu khoa man hinh"
