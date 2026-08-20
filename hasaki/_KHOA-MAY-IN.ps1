# _KHOA-MAY-IN.ps1 — CHAY MOT LAN TREN MAY CAM MAY IN (Desktop-je75k38), CAN QUYEN ADMIN.
#
# Muc dich: khong phai thao tac tay nua khi may in "chet". Trong lan in thu 20/08/2026 da gap ba
# kieu hong, script nay khoa ca ba:
#
#   ① Print Spooler DUNG hoac treo  -> job bao "ServerOffline", loi RPC 1722, phai vao restart tay.
#      Vá: dat Recovery cua service = TU KHOI DONG LAI (lan 1, lan 2, va cac lan sau), reset dem
#      moi 1 ngay. Windows tu chua, khong ai phai bam gi.
#   ② Spooler khong tu chay khi may bat -> dat StartupType = Automatic.
#   ③ May in bi dat "tam dung" hoac "in ra file" -> bo hai co do; va bat lai chia se may in de may
#      tram con noi vao duoc.
#
# Script CHI doi ba thu tren, KHONG doi kho giay, KHONG in thu, KHONG go/cai driver.
# HOAN TAC: sc.exe failure spooler reset=0 actions=""   (tra Recovery ve mac dinh)

$ErrorActionPreference = 'Stop'
function OK($s) { Write-Host "  [OK] $s" -ForegroundColor Green }
function XX($s) { Write-Host "  [!!] $s" -ForegroundColor Yellow }

$pr = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host ""
  Write-Host "  CHUA CO QUYEN ADMIN." -ForegroundColor Red
  Write-Host "  Dong cua so nay, bam PHAI vao _KHOA-MAY-IN.bat -> Run as administrator" -ForegroundColor Yellow
  Write-Host ""
  Read-Host "  Bam Enter de dong"
  exit 1
}

Write-Host ""
Write-Host "  === KHOA MAY IN TEM TREN $env:COMPUTERNAME ===" -ForegroundColor Cyan
Write-Host ""

# ── ① + ② Spooler: tu chay khi bat may, va tu khoi dong lai khi chet ──
Set-Service Spooler -StartupType Automatic
if ((Get-Service Spooler).Status -ne 'Running') { Start-Service Spooler }
OK "Print Spooler: $((Get-Service Spooler).Status) - startup = Automatic"

# reset=86400 : dem so lan hong reset sau 1 ngay; restart/5000 : doi 5 giay roi chay lai
$kq = & sc.exe failure Spooler reset= 86400 actions= restart/5000/restart/5000/restart/10000 2>&1 | Out-String
if ($LASTEXITCODE -eq 0) { OK "Spooler se TU KHOI DONG LAI khi chet (5s - 5s - 10s), khong can ai bam" }
else { XX "Khong dat duoc Recovery: $($kq.Trim())" }
# cho phep service tu chay lai ke ca khi bi 'stop' binh thuong (khong chi khi crash)
$kq2 = & sc.exe failureflag Spooler 1 2>&1 | Out-String
if ($LASTEXITCODE -eq 0) { OK "Tu khoi dong lai ke ca khi service bi dung binh thuong" } else { XX $kq2.Trim() }

# ── ③ May in tem: bo tam dung / in ra file, va bat chia se ──
$ds = Get-Printer | Where-Object { $_.Name -match 'PE200|TSC' }
if (-not $ds) { XX "Khong thay may in nao ten chua PE200/TSC tren may nay." }
foreach ($p in $ds) {
  $w = Get-CimInstance Win32_Printer -Filter ("Name='" + ($p.Name -replace "'","''") + "'")
  if ($w -and $w.WorkOffline) {
    try { $w | Invoke-CimMethod -MethodName Resume | Out-Null } catch {}
    XX "$($p.Name): dang 'Work Offline' - da thu bo co do"
  }
  if ($p.PrintProcessor -and $p.PortName -eq 'FILE:') { XX "$($p.Name): dang in ra FILE, hay doi ve cong USB" }
  try {
    if (-not $p.Shared) {
      Set-Printer -Name $p.Name -Shared $true -ShareName ($p.Name -replace '[^0-9A-Za-z]','') -ErrorAction Stop
      OK "$($p.Name): da bat chia se"
    } else { OK "$($p.Name): da chia se san (share = $($p.ShareName))" }
  } catch { XX "$($p.Name): khong bat duoc chia se - $($_.Exception.Message.Substring(0,[Math]::Min(70,$_.Exception.Message.Length)))" }
  # bo tam dung neu co
  try { Get-PrintJob -PrinterName $p.Name -ErrorAction SilentlyContinue | Where-Object { $_.JobStatus -match 'Paused' } | Resume-PrintJob } catch {}
}

# ── bao cao ──
Write-Host ""
Write-Host "  --- trang thai sau khi khoa ---" -ForegroundColor Cyan
Get-Printer | Where-Object { $_.Name -match 'PE200|TSC' } |
  Select-Object Name, PortName, PrinterStatus, Shared, ShareName, JobCount |
  Format-List | Out-String -Width 120 | Write-Host
$rec = & sc.exe qfailure Spooler 2>&1 | Out-String
Write-Host "  --- Recovery cua Spooler ---" -ForegroundColor Cyan
Write-Host $rec.Trim() -ForegroundColor Gray
Write-Host ""
Write-Host "  Xong. Tu gio Spooler tu chua; may tram khong phai bam gi nua." -ForegroundColor Green
Write-Host ""
Read-Host "  Bam Enter de dong"
