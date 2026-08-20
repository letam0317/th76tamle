# _BAT-WINRM-CLIENT.ps1 — CHAY TREN MAY TRAM (may dang chay dashboard), CAN QUYEN ADMIN.
#
# Ba viec:
#   1. Bat dich vu WinRM phia CLIENT (chi de goi di, khong mo cong nao cho ai goi vao)
#   2. Ghi 172.16.0.113 vao TrustedHosts — vi 2 may cung workgroup (khong co domain) nen
#      Windows bat buoc phai khai bao truoc moi cho xac thuc NTLM
#   3. Luu tai khoan doc vao file MA HOA bang DPAPI (chi user nay tren may nay giai ma duoc),
#      dat NGOAI thu muc du an de khong bao gio bi commit len GitHub
#
# HOAN TAC: Clear-Item WSMan:\localhost\Client\TrustedHosts -Force ; Remove-Item <duong dan file cred>

$ErrorActionPreference = 'Stop'
$IP  = '172.16.0.113'
$CRED = "$env:USERPROFILE\.cred-mayin-172-16-0-113.xml"

$pr = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host ""
  Write-Host "  CHUA CO QUYEN ADMIN." -ForegroundColor Red
  Write-Host "  Dong cua so nay, bam PHAI vao _BAT-WINRM-CLIENT.bat -> Run as administrator" -ForegroundColor Yellow
  Write-Host ""
  Read-Host "  Bam Enter de dong"
  exit 1
}

Write-Host ""
Write-Host "  === CHUAN BI MAY TRAM DE DOC MAY IN $IP ===" -ForegroundColor Cyan
Write-Host ""

Start-Service WinRM
Set-Service WinRM -StartupType Automatic
Write-Host "  [OK] WinRM (client): $((Get-Service WinRM).Status)" -ForegroundColor Green

$cu = (Get-Item WSMan:\localhost\Client\TrustedHosts).Value
if ($cu -and $cu.Split(',') -contains $IP) {
  Write-Host "  [OK] $IP da co trong TrustedHosts" -ForegroundColor Green
} else {
  if ($cu) { Set-Item WSMan:\localhost\Client\TrustedHosts -Value ($cu + ',' + $IP) -Force }
  else     { Set-Item WSMan:\localhost\Client\TrustedHosts -Value $IP -Force }
  Write-Host "  [OK] Da them $IP vao TrustedHosts" -ForegroundColor Green
}

Write-Host ""
Write-Host "  Go tai khoan doc da tao o may kia:" -ForegroundColor Cyan
Write-Host "     User:     Desktop-je75k38\doc-mayin" -ForegroundColor Gray
Write-Host "     Password: mat khau vua dat ben may do" -ForegroundColor Gray
Write-Host ""
$c = Get-Credential -Message "Tai khoan CHI DOC cua may in" -UserName "Desktop-je75k38\doc-mayin"
$c | Export-Clixml -Path $CRED
Write-Host "  [OK] Da luu (ma hoa DPAPI) vao: $CRED" -ForegroundColor Green
Write-Host "       File nay chi user $env:USERNAME tren may $env:COMPUTERNAME giai ma duoc." -ForegroundColor Gray

Write-Host ""
Write-Host "  Thu ket noi..." -ForegroundColor Cyan
try {
  Test-WSMan -ComputerName $IP -Credential $c -Authentication Negotiate -ErrorAction Stop | Out-Null
  Write-Host "  [OK] WinRM tra loi." -ForegroundColor Green
  $r = Invoke-Command -ComputerName $IP -Credential $c -ScriptBlock {
    Get-Printer | Select-Object Name, PortName, PrinterStatus, JobCount
  }
  Write-Host ""
  Write-Host "  DOC DUOC MAY IN CUA MAY DO:" -ForegroundColor Green
  $r | Format-Table -AutoSize | Out-String -Width 110 | Write-Host
} catch {
  Write-Host "  [!!] Chua ket noi duoc: $($_.Exception.Message.Substring(0,[Math]::Min(200,$_.Exception.Message.Length)))" -ForegroundColor Yellow
  Write-Host "       Thuong do: chua chay _BAT-WINRM-MAY-IN.bat ben may kia, sai mat khau," -ForegroundColor Gray
  Write-Host "       hoac mang ben do van dang la 'Public'." -ForegroundColor Gray
}
Write-Host ""
Read-Host "  Bam Enter de dong"
