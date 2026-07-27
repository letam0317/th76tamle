# ============================================================
#  BAO-MAT-MAY.ps1 — Gia cố bảo mật máy trạm (chạy được nhiều lần)
#  Chạy:  Click phải -> Run with PowerShell   (KHÔNG cần Admin)
#
#  Mục tiêu: người khác ngồi vào máy (tài khoản khác / cầm ổ cứng)
#  KHÔNG kích hoạt được lịch, KHÔNG đọc được secret (.env, phiên SSO,
#  token, PII), KHÔNG chạy được các file .bat của dự án.
#
#  4 tầng:
#    1. Dọn rác bí mật (token trần, file debug)
#    2. NTFS ACL: thư mục dự án chỉ còn user hiện tại + SYSTEM
#    3. EFS: mã hoá secret theo user (tài khoản khác/tháo ổ đọc không nổi)
#    4. Tự khoá màn hình (screensaver 5' + khoá ngay sau auto-logon)
#  Cuối script in các việc CẦN LÀM TAY (BitLocker, sao lưu khoá EFS...).
# ============================================================
$ErrorActionPreference = "Continue"
$DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$USER = "$env:USERDOMAIN\$env:USERNAME"
Write-Host "== Thu muc du an: $DIR  |  User: $USER" -ForegroundColor Cyan

# ---------- 1. DON RAC BI MAT ----------
Write-Host "`n== [1/4] Don rac bi mat..." -ForegroundColor Cyan
$rac = @(".exports\_tok.txt") + (Get-ChildItem $DIR -Filter "debug-*" -Name -ErrorAction SilentlyContinue) `
     + (Get-ChildItem $DIR -Filter "wms_*.json" -Name -ErrorAction SilentlyContinue) `
     + (Get-ChildItem $DIR -Filter "ck_*.json" -Name -ErrorAction SilentlyContinue)
foreach ($f in $rac) {
  $p = Join-Path $DIR $f
  if (Test-Path $p) { Remove-Item $p -Force; Write-Host "  [XOA] $f" }
}
Write-Host "  [OK] Xong don rac"

# ---------- 2. NTFS ACL: CHI USER HIEN TAI + SYSTEM ----------
# Tai khoan KHAC tren may (ke ca nhom Users) khong mo duoc thu muc du an
# -> khong doc secret, khong bam .bat kich hoat he thong.
# (Admin van co the chiem quyen — tang 3 EFS chan not viec DOC noi dung.)
Write-Host "`n== [2/4] Siet quyen NTFS thu muc du an..." -ForegroundColor Cyan
$goc = Split-Path -Parent $DIR   # siet ca thu muc cha (chua hasaki/ + factory/ + kiemsoatkho/)
icacls "$goc" /inheritance:r /grant:r "${USER}:(OI)(CI)F" "SYSTEM:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -eq 0) { Write-Host "  [OK] $goc -> chi $USER + SYSTEM" }
else { Write-Host "  [!] icacls loi (xem thong bao tren)" -ForegroundColor Red }

# ---------- 3. EFS: MA HOA SECRET THEO USER ----------
# Ma hoa gan voi tai khoan Windows + mat khau cua no. Thao o cung / dang nhap
# tai khoan khac / reset mat khau tu ngoai -> file chi con la rac.
# Luu y: PHAI sao luu chung chi EFS (buoc lam tay o cuoi) de khong tu khoa minh.
Write-Host "`n== [3/4] Ma hoa EFS cac muc nhay cam..." -ForegroundColor Cyan
$nhayCam = @(".env", ".wms-session", ".exports", ".clasp-deploy",
             "nhansu-manual.json", "google-script-DEPLOY.gs", "_backup-on-dinh-2026-07-15")
foreach ($m in $nhayCam) {
  $p = Join-Path $DIR $m
  if (-not (Test-Path $p)) { continue }
  if ((Get-Item $p) -is [System.IO.DirectoryInfo]) { cipher /e /s:"$p" | Out-Null } else { cipher /e /a "$p" | Out-Null }
  if ($LASTEXITCODE -eq 0) { Write-Host "  [OK] $m" } else { Write-Host "  [!] $m — co file dang bi khoa? chay lai sau" -ForegroundColor Yellow }
}

# ---------- 4. TU KHOA MAN HINH ----------
Write-Host "`n== [4/4] Tu khoa man hinh..." -ForegroundColor Cyan
# 4a. Screensaver 5 phut + bat buoc nhap mat khau khi quay lai (HKCU — khong can Admin)
$ss = "HKCU:\Control Panel\Desktop"
Set-ItemProperty $ss -Name ScreenSaveActive -Value "1"
Set-ItemProperty $ss -Name ScreenSaveTimeOut -Value "300"
Set-ItemProperty $ss -Name ScreenSaverIsSecure -Value "1"
Set-ItemProperty $ss -Name SCRNSAVE.EXE -Value "$env:SystemRoot\System32\scrnsave.scr"
Write-Host "  [OK] Man hinh tu khoa sau 5 phut khong dung"

# 4b. Neu may dang de AUTO-LOGON (PC lich chay 24/7): khoa NGAY sau khi tu dang nhap
#     -> lich van chay (task Interactive chay ca khi man hinh khoa), nguoi la khong dung duoc phien.
$auto = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon" -ErrorAction SilentlyContinue).AutoAdminLogon
if ($auto -eq "1") {
  $act = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\rundll32.exe" -Argument "user32.dll,LockWorkStation"
  $trg = New-ScheduledTaskTrigger -AtLogOn -User $USER
  Register-ScheduledTask -TaskName "Khoa man hinh sau auto-logon" -Action $act -Trigger $trg -Force | Out-Null
  Write-Host "  [OK] May co auto-logon -> da dang ky task khoa man hinh ngay sau logon"
} else {
  Write-Host "  [-] May chua bat auto-logon -> bo qua task khoa sau logon (bat auto-logon thi chay lai script)"
}

# ---------- VIEC PHAI LAM TAY ----------
Write-Host "`n== VIEC PHAI LAM TAY (khong the tu dong / can Admin):" -ForegroundColor Green
Write-Host "  1. SAO LUU KHOA EFS ra USB cat rieng (BAT BUOC sau khi ma hoa):"
Write-Host "       cipher /x $env:USERPROFILE\Desktop\efs-backup   (dat mat khau, cat USB khoi may)"
Write-Host "  2. Dat MAT KHAU MANH cho tai khoan '$env:USERNAME' (EFS + khoa man hinh vo nghia neu khong co mat khau)."
Write-Host "  3. Nho nguoi co quyen Admin:"
Write-Host "       - Bat BitLocker o C: (chong thao o cung doc du lieu):  manage-bde -on C:"
Write-Host "       - Tat tai khoan Guest:  net user Guest /active:no"
Write-Host "       - Kiem tra cac tai khoan la (HASAKI, BarTender...) khong nam trong nhom Administrators."
Write-Host "  4. Nguoi khac can dung may -> tao tai khoan Windows RIENG (Standard), KHONG dung chung tai khoan nay."
Write-Host "  5. Thoi quen: roi may bam Win+L."
