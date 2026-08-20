# _BAT-WINRM-MAY-IN.ps1 — CHAY TREN MAY DANG CAM MAY IN TEM (Desktop-je75k38), CAN QUYEN ADMIN.
#
# Script lam dung 4 viec, va noi ro tung viec truoc khi lam:
#   1. Doi Wi-Fi/LAN sang "Private" (neu dang Public) — WinRM khong mo tren mang Public
#   2. Bat WinRM (Enable-PSRemoting)
#   3. Tao mot tai khoan CHI DE DOC ("doc-mayin"), KHONG phai admin, chi thuoc nhom
#      "Remote Management Users" — tai khoan nay khong dung nen chuot, khong cai duoc gi
#   4. Mo tuong lua cho WinRM CHI TRONG MANG NOI BO (172.16.0.0/22), khong mo ra internet
#
# Muon HOAN TAC sau nay: chay 3 lenh
#   Disable-PSRemoting -Force
#   Remove-LocalUser -Name doc-mayin
#   Remove-NetFirewallRule -DisplayName "WinRM chi mang noi bo (Claude doc may in)"

$ErrorActionPreference = 'Stop'
function OK($s) { Write-Host "  [OK] $s" -ForegroundColor Green }
function TT($s) { Write-Host "  [..] $s" -ForegroundColor Gray }
function XX($s) { Write-Host "  [!!] $s" -ForegroundColor Yellow }

$pr = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host ""
  Write-Host "  CHUA CO QUYEN ADMIN." -ForegroundColor Red
  Write-Host "  Hay dong cua so nay, bam PHAI vao file _BAT-WINRM-MAY-IN.bat -> Run as administrator" -ForegroundColor Yellow
  Write-Host ""
  Read-Host "  Bam Enter de dong"
  exit 1
}

Write-Host ""
Write-Host "  === BAT WINRM CHI DOC TREN MAY $env:COMPUTERNAME ===" -ForegroundColor Cyan
Write-Host ""

# ---- 1. mang Private ----
TT "Kiem kieu mang..."
$cn = Get-NetConnectionProfile | Where-Object { $_.IPv4Connectivity -ne 'Disconnected' }
foreach ($c in $cn) {
  if ($c.NetworkCategory -eq 'Public') {
    Set-NetConnectionProfile -InterfaceIndex $c.InterfaceIndex -NetworkCategory Private
    OK "Doi '$($c.InterfaceAlias)' tu Public sang Private"
  } else { OK "'$($c.InterfaceAlias)' da la $($c.NetworkCategory)" }
}

# ---- 2. bat WinRM ----
TT "Bat WinRM..."
Enable-PSRemoting -Force -SkipNetworkProfileCheck | Out-Null
Set-Service WinRM -StartupType Automatic
OK "WinRM: $((Get-Service WinRM).Status)"

# ---- 3. tai khoan chi doc ----
$ten = 'doc-mayin'
if (Get-LocalUser -Name $ten -ErrorAction SilentlyContinue) {
  XX "Tai khoan '$ten' da co san — bo qua buoc tao."
} else {
  Write-Host ""
  Write-Host "  Dat mat khau cho tai khoan CHI DOC '$ten' (go xong bam Enter, chu se khong hien):" -ForegroundColor Cyan
  $mk = Read-Host -AsSecureString "  Mat khau"
  New-LocalUser -Name $ten -Password $mk -FullName "Chi doc may in" -Description "WinRM chi doc — cho dashboard doc trang thai may in" -PasswordNeverExpires | Out-Null
  OK "Da tao tai khoan '$ten' (KHONG phai admin)"
}
Add-LocalGroupMember -Group 'Remote Management Users' -Member $ten -ErrorAction SilentlyContinue
OK "Da cho '$ten' vao nhom 'Remote Management Users'"
# de doc duoc trang thai may in qua WMI thi can quyen doc WMI — nhom nay du cho Get-Printer/Get-PrintConfiguration

# ---- 4. tuong lua gioi han mang noi bo ----
$rule = 'WinRM chi mang noi bo (Claude doc may in)'
if (Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue) {
  XX "Luat tuong lua da co — bo qua."
} else {
  New-NetFirewallRule -DisplayName $rule -Direction Inbound -Protocol TCP -LocalPort 5985 `
    -RemoteAddress 172.16.0.0/22 -Action Allow -Profile Any | Out-Null
  OK "Mo cong 5985 CHI cho dai 172.16.0.0/22 (khong mo ra internet)"
}

Write-Host ""
Write-Host "  === XONG ===" -ForegroundColor Cyan
Write-Host "  May nay: $env:COMPUTERNAME" -ForegroundColor Gray
(Get-NetIPConfiguration | Where-Object { $_.IPv4Address }) | ForEach-Object {
  Write-Host ("  IP: {0}  ({1})" -f $_.IPv4Address.IPAddress, $_.InterfaceAlias) -ForegroundColor Gray
}
Write-Host "  Tai khoan doc: $env:COMPUTERNAME\$ten" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Buoc tiep theo lam tren MAY TRAM (may dang chay dashboard):" -ForegroundColor Cyan
Write-Host "    chay _BAT-WINRM-CLIENT.bat (Run as administrator) va go mat khau vua dat." -ForegroundColor Gray
Write-Host ""
Read-Host "  Bam Enter de dong"
