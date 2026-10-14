# dong-bo-task.ps1 - ham dung CHUNG cho CAI-PC.ps1 (cai lan dau) va _CAP-NHAT-PC.ps1 (tu cap nhat).
# Dot-source:  . "$PSScriptRoot\dong-bo-task.ps1"
# NGUON DUY NHAT = cai-pc\dieu-phoi.json. May dang ky TUNG viec ma hostname nam trong uuTien, moi task
# boc qua _DP-CHAY.vbs (cong gac dieu phoi). Them/bot viec = sua dieu-phoi.json + push -> tu dong theo.

# Doc trigger/settings tu XML cua viec, nhung DOI Action -> wscript _DP-CHAY.vbs <ten> <vbsThat>, chu -> SYSTEM.
function Nap-ViecDP($viec, $kit, $duAn, $duongCu) {
  $xmlF = Join-Path (Join-Path $kit "tasks-xml") $viec.xml
  if (-not (Test-Path $xmlF)) { Write-Host "  [X] thieu XML $($viec.xml) cho viec $($viec.ten)"; return $null }
  $raw = Get-Content $xmlF -Raw -Encoding UTF8
  # chu -> SYSTEM
  $raw = [regex]::Replace($raw, '<UserId>.*?</UserId>', '<UserId>S-1-5-18</UserId>')
  # 14/10: BO HAN LogonType. "ServiceAccount" trong XML bi Windows tu choi (0x80041318, "(11,35):LogonType") - lan cai that dau tien
  # tren laptop vap dung cho nay. Windows tu xuat task SYSTEM chi co UserId S-1-5-18 (tu hieu LogonType=ServiceAccount).
  # Da kiem 13/13 XML bang bo doc XML cua Task Scheduler (Schedule.Service NewTask.XmlText). KHONG them RunLevel (XML 1.3 tu choi).
  $raw = [regex]::Replace($raw, '\s*<LogonType>[^<]*</LogonType>', '')
  # Action -> cong gac. WorkingDirectory = cai-pc (noi _DP-CHAY.vbs); no tu cd sang duAn.
  $dpVbs = Join-Path $kit "_DP-CHAY.vbs"
  $argMoi = ('"' + $dpVbs + '" ' + $viec.ten + ' ' + $viec.vbs)
  $raw = [regex]::Replace($raw, '(?s)<Actions.*?</Actions>',
    "<Actions Context=""Author""><Exec><Command>wscript.exe</Command><Arguments>$([System.Security.SecurityElement]::Escape($argMoi))</Arguments><WorkingDirectory>$([System.Security.SecurityElement]::Escape($kit))</WorkingDirectory></Exec></Actions>")
  $ten = "5S DP " + $viec.ten
  Register-ScheduledTask -Xml $raw -TaskName $ten -Force | Out-Null
  # MAY NGU/WIFI: chinh Settings bang cmdlet (tu dung XML dung thu tu schema) sau khi dang ky
  try {
    $st = Get-ScheduledTask -TaskName $ten
    $st.Settings.WakeToRun = $true
    $st.Settings.StartWhenAvailable = $true
    $st.Settings.DisallowStartIfOnBatteries = $false
    $st.Settings.StopIfGoingOnBatteries = $false
    Set-ScheduledTask -InputObject $st | Out-Null
  } catch { Write-Host "  [!] khong chinh duoc Settings cho $ten : $_" }
  return $ten
}

# Dong bo TOAN BO theo dieu-phoi.json cho may nay. Tra @{ nap; xoa; envKeys=@(...) }
function DongBo-DieuPhoi($kit, $cfg, $duAn, $duongCu) {
  $may = $env:COMPUTERNAME
  $soFile = "$duAn\.cai-pc-tasks.json"
  $daQuanLy = @(); if (Test-Path $soFile) { try { $daQuanLy = @(Get-Content $soFile -Raw | ConvertFrom-Json) } catch {} }
  # Cai HET viec (cong gac + khoa + suc manh tu loc o runtime); may nao co khoa top-review moi nhan viec camera.
  # Chi khi 1 viec co uuTien (ghim tay) thi moi loc theo hostname.
  $muon = @(); $envKeys = @()
  foreach ($v in $cfg.viec) {
    if ($v.uuTien -and -not ($v.uuTien -contains $may)) { continue }   # chi loc khi co GHIM tay
    $t = Nap-ViecDP $v $kit $duAn $duongCu
    if ($t) { $muon += $t; $envKeys += $v.envKeys }
  }
  # Go task "5S DP *" truoc day bo cai dat ma gio khong con (doi uuTien / bo viec khoi dieu-phoi.json)
  $go = 0
  foreach ($t in $daQuanLy) {
    if ($muon -notcontains $t -and (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue)) {
      Unregister-ScheduledTask -TaskName $t -Confirm:$false; $go++
    }
  }
  ($muon | Sort-Object -Unique) | ConvertTo-Json | Out-File $soFile -Encoding utf8
  return @{ nap = $muon.Count; xoa = $go; envKeys = ($envKeys | Sort-Object -Unique) }
}
