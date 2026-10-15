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
  # MAY NGU/WIFI: chinh Settings qua bo doc XML cua Task Scheduler (tu dung XML dung thu tu schema) TRUOC khi dang ky
  try {
    $svcX = New-Object -ComObject Schedule.Service; $svcX.Connect(); $d = $svcX.NewTask(0); $d.XmlText = $raw
    $d.Settings.WakeToRun = $true; $d.Settings.StartWhenAvailable = $true
    $d.Settings.DisallowStartIfOnBatteries = $false; $d.Settings.StopIfGoingOnBatteries = $false
    $raw = $d.XmlText
  } catch { Write-Host "  [!] khong chinh duoc Settings cho $ten : $_" }
  # 15/10 GOC "0/13 task" tren CA 4 may: Register -Xml KHONG -User -> Windows tu choi (UserId SYSTEM ma khong co kieu dang nhap
  #   ServiceAccount), loi bi nuot (ErrorAction Continue) nen van bao "nap 13". 2 task Audit song duoc vi dang ky bang Principal
  #   ServiceAccount. Nay: -User SYSTEM (= ServiceAccount), loi THAT ghi vao nhat ky (capGan), chi tinh task THAT SU co.
  $loi = ""
  try { Register-ScheduledTask -Xml $raw -TaskName $ten -User "NT AUTHORITY\SYSTEM" -Force -ErrorAction Stop | Out-Null } catch { $loi = $_.Exception.Message }
  if (-not (Get-ScheduledTask -TaskName $ten -ErrorAction SilentlyContinue)) {
    # du phong: schtasks /RU SYSTEM (tep XML UTF-16 dung nhu khai bao trong XML)
    $tmp = Join-Path $env:TEMP ("dp-" + $viec.ten + ".xml")
    try { [IO.File]::WriteAllText($tmp, $raw, [Text.Encoding]::Unicode); $o = (& schtasks.exe /Create /TN $ten /XML $tmp /RU SYSTEM /F 2>&1) -join " "; if ($LASTEXITCODE -ne 0) { $loi += " | schtasks: " + $o } } catch { $loi += " | " + $_ }
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  }
  if (-not (Get-ScheduledTask -TaskName $ten -ErrorAction SilentlyContinue)) {
    $m = "[X] khong dang ky duoc $ten : " + ($loi -replace '\s+', ' ').Trim()
    Write-Host "  $m"; try { "$("{0:yyyy-MM-dd HH:mm:ss}" -f (Get-Date)) $m" | Out-File "$duAn\.cap-nhat-pc.log" -Append -Encoding utf8 } catch {}
    return $null
  }
  return $ten
}

# Dong bo TOAN BO theo dieu-phoi.json cho may nay. Tra @{ nap; xoa; envKeys=@(...) }
function DongBo-DieuPhoi($kit, $cfg, $duAn, $duongCu) {
  $may = [System.Net.Dns]::GetHostName()   # 14/10: khop ten trong uuTien / bang nhip (os.hostname)
  $soFile = "$duAn\.cai-pc-tasks.json"
  # 15/10 THU PHAM "0/13 task": PS 5.1 ConvertFrom-Json tra MANG thanh 1 phan tu -> @(...) = 1 phan tu chua ca 13 ten ->
  #   vong go ben duoi coi ca mang la 1 task "thua" -> Unregister ca 13 task vua nap (log "nap 13, go 1" moi luot). Nay: trai mang ra.
  $daQuanLy = @(); if (Test-Path $soFile) { try { $daQuanLy = @(Get-Content $soFile -Raw | ConvertFrom-Json | ForEach-Object { $_ } | Where-Object { $_ -is [string] -and $_ -like '5S DP *' }) } catch {} }
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
