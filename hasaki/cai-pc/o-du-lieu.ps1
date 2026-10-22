# o-du-lieu.ps1 - DOI DU LIEU NANG CUA CO XAC MINH SANG O PHU (D:...) - 20/10/2026
# User 20/10 (may HSK-KHO170-BANGCHUYEN-2: o C day 90%, con 12 GB; o D con 931 GB): "neu chay co xac minh thi minh chuyen o D duoc k".
# Do tren laptop 20/10: co xac minh / camera ghi ~13-15 GB (.exports\.bai-xe-tam 5,8 GB giu 14 ngay, bang chung 6,8 GB, agy-xm 0,9 GB, xm-tu-dong 0,9 GB).
# Cach lam (goi tu _CAP-NHAT-PC.ps1 MOI LUOT 2h, ca khi chua nhan ban moi):
#   1. Chon o FileSystem co dinh (DriveType 3) KHAC C, trong >= 50 GB, nhieu cho nhat. Khong co -> thoi (giu nhu cu).
#   2. Thu muc nang trong repo (.exports\...) -> chuyen noi dung sang <o>:\AuditFactory\du-lieu\<ten> roi dat JUNCTION cung ten
#      (ma nguon khong doi duong dan, git reset --hard khong dung .exports vi gitignore).
#   3. Bang chung (BAIXE_DIR) -> <o>:\AuditFactory\bang-chung\bai-xe ; noi dung cu o C:\AuditFactory\bang-chung chuyen sang.
#   CHI CHUYEN khi khong co task "5S DP *" nao dang chay (khong keo file dang ghi); luot sau lam tiep. Loi -> ghi log, khong nem.
function Get-ODuLieu {
  $o = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction SilentlyContinue |
    Where-Object { $_.DeviceID -ne "C:" -and $_.FreeSpace -ge 50GB } | Sort-Object FreeSpace -Descending | Select-Object -First 1
  if ($o) { return $o.DeviceID.Substring(0, 1) } else { return $null }
}
function Doi-ODuLieu($duAn, $gocThu) {   # $gocThu: QC - thay "<o>:\AuditFactory" va "C:\AuditFactory" bang thu muc thu (khong dung du lieu that)
  $o = Get-ODuLieu; if (-not $o) { return $null }
  $gocO = if ($gocThu) { "$gocThu\o-phu" } else { "${o}:\AuditFactory" }; $gocC = if ($gocThu) { "$gocThu\o-c" } else { "C:\AuditFactory" }
  $baixe = ($gocO -replace '\\', '/') + "/bang-chung/bai-xe"
  $dangChay = @(Get-ScheduledTask -TaskName "5S DP *" -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Running" })
  if ($dangChay.Count) { Ghi ("o du lieu ${o}: hoan doi (dang chay " + (($dangChay | ForEach-Object { $_.TaskName -replace '^5S DP ', '' }) -join ",") + ")"); return $baixe }
  $da = @()
  foreach ($ten in @(".bai-xe-tam", "agy-xm", "xm-tu-dong", "cam-baocao")) {
    try {
      $nguon = Join-Path $duAn ".exports\$ten"; $dich = "$gocO\du-lieu\$ten"
      $it = Get-Item $nguon -Force -ErrorAction SilentlyContinue
      if ($it -and ($it.Attributes -band [IO.FileAttributes]::ReparsePoint)) { continue }   # da la junction
      New-Item -ItemType Directory -Force -Path $dich | Out-Null
      if ($it) { & robocopy.exe $nguon $dich /E /MOVE /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
        if ($LASTEXITCODE -ge 8) { Ghi "[X] o du lieu: chuyen $ten loi robocopy $LASTEXITCODE"; continue }
        if (Test-Path $nguon) { Remove-Item $nguon -Recurse -Force -ErrorAction SilentlyContinue } }
      if (Test-Path $nguon) { Ghi "[X] o du lieu: $ten con file dang khoa, luot sau thu lai"; continue }
      New-Item -ItemType Directory -Force -Path (Split-Path $nguon) | Out-Null
      New-Item -ItemType Junction -Path $nguon -Target $dich | Out-Null; $da += $ten
    } catch { Ghi "[X] o du lieu ${ten}: $_" }
  }
  try {   # bang chung cu tren C (BAIXE_DIR cu) -> o moi
    $cu = "$gocC\bang-chung"; $moi = "$gocO\bang-chung"
    if ((Test-Path $cu) -and -not ((Get-Item $cu -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
      & robocopy.exe $cu $moi /E /MOVE /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
      if ($LASTEXITCODE -lt 8) { $da += "bang-chung" } else { Ghi "[X] o du lieu: chuyen bang chung loi robocopy $LASTEXITCODE" } }
  } catch { Ghi "[X] o du lieu bang chung: $_" }
  # .env: BAIXE_DIR tro sang o moi (envCung cua dieu-phoi.json bi de lai o day)
  try { $envF = Join-Path $duAn ".env"
    if (Test-Path $envF) { $l = @(Get-Content $envF); $co = $false
      $l = @($l | ForEach-Object { if ($_ -match '^\s*BAIXE_DIR\s*=') { $co = $true; "BAIXE_DIR=$baixe" } else { $_ } })
      if (-not $co) { $l += "BAIXE_DIR=$baixe" }
      $moiNd = ($l -join "`r`n"); if ($moiNd -ne ((Get-Content $envF) -join "`r`n")) { $moiNd | Out-File $envF -Encoding utf8; $da += ".env" } }
  } catch { Ghi "[X] o du lieu .env: $_" }
  # 22/10 user «nguoi khac dung may tram co vo D:\AuditFactory xem duoc du lieu k? can bao mat - k cho xem»: khoa quyen y nhu C:\AuditFactory
  #   (CAI-PC.ps1): bo ke thua, CHI SYSTEM + Administrators; con chau /reset de ke thua quyen moi. Chi lam 1 lan (da khoa thi bo qua).
  if (-not $gocThu -and (Test-Path $gocO)) { try {
    if (-not (Get-Acl $gocO).AreAccessRulesProtected) {
      & icacls.exe $gocO /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" | Out-Null
      & icacls.exe "$gocO\*" /reset /T /C /Q 2>&1 | Out-Null
      Ghi "o du lieu ${o}: da khoa quyen $gocO (chi SYSTEM + Administrators)" }
  } catch { Ghi "[X] o du lieu khoa quyen: $_" } }
  if ($da.Count) { Ghi ("o du lieu ${o}: da chuyen " + ($da -join ",")) }
  return $baixe
}
