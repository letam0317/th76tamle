# sua-thong-bao.ps1 - dat lai 3 lop sua thong bao cho Xiaomi 17 Pro (ROM noi dia HyperOS 3)
# Chi dung toi: dich vu Google (com.google.android.gms) + 1 cai dat mang he thong.
# KHONG doc/doi app ngan hang, nhan tin, anh, danh ba. Moi lenh ghi vao nhat-ky.txt canh file nay.
$ErrorActionPreference = 'Continue'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$adb  = Join-Path $here 'adb\adb.exe'
$log  = Join-Path $here 'nhat-ky.txt'
$GMS  = 'com.google.android.gms'

function Ghi($s) { $t = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $s"; Add-Content -Path $log -Value $t -Encoding UTF8; Write-Host $s }
# Ghi nhat ky: chi ghi lenh + toi da 80 ky tu ket qua (khong luu danh sach app nao)
function A { param([Parameter(ValueFromRemainingArguments)]$a) $o = (& $adb @a 2>&1 | Out-String).Trim(); $n = $o; $cmd = ($a -join ' '); if ($a -contains 'MILLET_NO_RESTRICT_APP') { $n = '(an)'; $cmd = ($a[0..4] -join ' ') + ' (an)' } elseif ($n.Length -gt 80) { $n = $n.Substring(0, 80) + '...' }; Add-Content -Path $log -Value ("  adb " + $cmd + " -> " + $n) -Encoding UTF8; return $o }

Write-Host "=== SUA THONG BAO XIAOMI ===" -ForegroundColor Cyan
Ghi "Bat dau"
& $adb start-server *> $null

# 1. cho dien thoai
$ok = $false
for ($i = 0; $i -lt 60; $i++) {
    $d = (& $adb devices) -join "`n"
    if ($d -match "`tdevice") { $ok = $true; break }
    if ($i -eq 0) { Write-Host "Cho dien thoai... (bat Go loi USB, cam cap, bam 'Cho phep' tren dien thoai)" -ForegroundColor Yellow }
    Start-Sleep -Seconds 2
}
if (-not $ok) { Ghi "LOI: khong thay dien thoai sau 2 phut."; Read-Host "Bam Enter de dong"; exit 1 }

# 2. lop 1: tat ngat mang khi ngu
$v1 = A shell settings get system cloud_sleepmode_networkpolicy_enabled
if ($v1 -ne 'off') {
    A shell appops set com.android.shell WRITE_SETTINGS allow | Out-Null
    A shell settings put system cloud_sleepmode_networkpolicy_enabled off | Out-Null
    A shell appops set com.android.shell WRITE_SETTINGS default | Out-Null
}
$v1 = A shell settings get system cloud_sleepmode_networkpolicy_enabled

# 3. lop 2: them GMS vao danh sach Khong han che an (giu nguyen cac muc cu)
$cur = A shell settings get system MILLET_NO_RESTRICT_APP
$items = @(); if ($cur -and $cur -ne 'null') { $items = $cur.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ } }
if ($items -notcontains $GMS) {
    $new = (($items + $GMS) -join ',')
    A shell appops set com.android.shell WRITE_SETTINGS allow | Out-Null
    A shell settings put system MILLET_NO_RESTRICT_APP $new | Out-Null
    A shell appops set com.android.shell WRITE_SETTINGS default | Out-Null
}
$chk = A shell settings get system MILLET_NO_RESTRICT_APP
$v2 = if ($chk.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -eq $GMS }) { 'co' } else { 'KHONG' }

# 4. lop 3: tat bo gioi han Google trong Greezer
& $adb shell dumpsys greezer IM GMS disable *> $null   # lenh nay in ca trang thai moi app -> bo qua, khong ghi
Add-Content -Path $log -Value "  adb shell dumpsys greezer IM GMS disable -> (khong ghi ket qua)" -Encoding UTF8
$v3 = A shell "dumpsys greezer | grep -m1 GmsLimit"

# 5. ket qua
Write-Host ""
$r1 = if ($v1 -eq 'off') { 'OK' } else { 'LOI (can bat Go loi USB (Cai dat bao mat))' }
$r2 = if ($v2 -eq 'co') { 'OK' } else { 'LOI (can bat Go loi USB (Cai dat bao mat))' }
$r3 = if ($v3 -match 'false') { 'OK' } else { 'LOI' }
Ghi "Lop 1 - tat ngat mang khi ngu      : $r1"
Ghi "Lop 2 - Google khong bi dong bang   : $r2"
Ghi "Lop 3 - tat bo gioi han Google      : $r3"
Write-Host ""
Write-Host "XONG. Rut cap, roi tren dien thoai:" -ForegroundColor Green
Write-Host "  Tuy chon nha phat trien -> Thu hoi uy quyen go loi USB -> TAT Tuy chon nha phat trien"
Write-Host "  (luu y: cai/go app hoac doi che do pin app nao do se lam Xiaomi xoa lop 2 -> chay lai file nay)"
# mo lai cong 5555 cho nut "Sua thong bao" trong Termux (mat sau moi lan khoi dong lai may)
& $adb tcpip 5555 *> $null
Ghi "Da mo cong cho nut Termux (5555)"
Start-Sleep -Seconds 2
& $adb kill-server *> $null
Read-Host "Bam Enter de dong"
