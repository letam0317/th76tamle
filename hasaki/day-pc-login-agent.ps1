# day-pc-login-agent.ps1 - OPTION 1: day agent tu xa len cac PC trong inventory (khong di bo).
#
# MINH BACH: chep vao thu muc CO TEN RO C:\ProgramData\HSK-5S-login, tao task ten
#   "HSK 5S - ghi nhan dang nhap" chay /RU "Users" (ngu canh user dang dang nhap, KHONG SYSTEM,
#   khong can mat khau user). Agent chi doc + gui GAS, khong nhan lenh xa, khong tu cap nhat.
#
# YEU CAU: may dich mo 445 inbound (chay soi-pc-a8.ps1 -CredTest de biet) + 1 admin dung duoc.
# Neu cong dong -> dung duoc, chuyen sang option 3 (cai tai may bang CAI-HSK-5S-LOGIN.bat).
#
# Chay (tren may cung mang, Run as administrator):
#   powershell -ExecutionPolicy Bypass -File day-pc-login-agent.ps1 -WhatIf        # xem se lam gi, khong tac dong
#   powershell -ExecutionPolicy Bypass -File day-pc-login-agent.ps1 -GasUrl <url> -RunNow
# Cred admin dung chung file DPAPI voi probe: %USERPROFILE%\.cred-a8-admin.xml

param(
  [string] $InvJson = '',
  [string] $GasUrl  = '',
  [string] $DestDir = 'C:\ProgramData\HSK-5S-login',
  [int]    $Sample  = 0,
  [switch] $RunNow,
  [switch] $WhatIf
)

$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $InvJson) { $InvJson = Join-Path $here '.exports\pc-a8-inventory.json' }
$credPath = Join-Path $env:USERPROFILE '.cred-a8-admin.xml'
$TASK = 'HSK 5S - ghi nhan dang nhap'
$agent = Join-Path $here 'pc-login-agent.ps1'
$vbs   = Join-Path $here '_HSK-5S-LOGIN.vbs'
$destRel = ($DestDir -replace '^[A-Za-z]:', '') -replace '\\', '\'   # \ProgramData\HSK-5S-login
$destShare = 'C$' + $destRel                                         # C$\ProgramData\HSK-5S-login

function Note($m, $c = 'Gray') { Write-Host $m -ForegroundColor $c }

if (-not (Test-Path $agent) -or -not (Test-Path $vbs)) { Note "[!] Thieu pc-login-agent.ps1 hoac _HSK-5S-LOGIN.vbs" Red; exit 1 }
if (-not (Test-Path $InvJson)) { Note "[!] Chua co inventory: $InvJson (chay soi-pc-a8.ps1 truoc)." Red; exit 1 }

$inv = Get-Content $InvJson -Raw | ConvertFrom-Json
if ($inv -isnot [System.Array]) { $inv = @($inv) }
$targets = @($inv | Where-Object { $_.smb })   # can 445 de chep C$ + tao task tu xa
if ($Sample -gt 0) { $targets = @($targets | Select-Object -First $Sample) }
Note ("Muc tieu day (co SMB 445): " + $targets.Count + " may") Cyan
if (-not $targets.Count) { Note "Khong may nao mo 445 - option 1 khong dung duoc, chuyen option 3." Yellow; exit 2 }

# Cred admin (DPAPI, dung chung voi probe)
if (Test-Path $credPath) { $cred = Import-Clixml $credPath; Note ("Dung cred: " + $cred.UserName) }
else {
  if ($WhatIf) { Note "(WhatIf) Se hoi cred admin khi chay that." Yellow; $cred = $null }
  else { $cred = Get-Credential -Message "Admin cua may A8 (chi de day, luu DPAPI)"; $cred | Export-Clixml $credPath }
}
$pass = if ($cred) { $cred.GetNetworkCredential().Password } else { '' }

$cfgJson = if ($GasUrl) { (@{ gasUrl = $GasUrl } | ConvertTo-Json -Compress) } else { '' }
if ($DestDir -match '\s') { Note "[!] DestDir khong nen chua dau cach (schtasks /TR de vo). Dung mac dinh C:\ProgramData\HSK-5S-login." Yellow; exit 1 }
# Khong dat nhay trong: PowerShell tu bao ca gia tri /TR trong nhay khi co khoang trang -> schtasks nhan dung.
$trCmd = 'wscript //nologo ' + $DestDir + '\_HSK-5S-LOGIN.vbs'

$ok = 0; $fail = 0
foreach ($t in $targets) {
  $ip = $t.ip; $hn = $t.hostname
  Note ("- " + $ip + " (" + $hn + ")") Cyan
  if ($WhatIf) {
    Note ("    (WhatIf) chep agent -> \\$ip\$destShare ; tao task '$TASK' /RU Users /SC MINUTE /MO 5" + $(if ($RunNow) { ' ; /Run' } else { '' }))
    continue
  }
  $drv = 'HSK' + ([guid]::NewGuid().ToString('N').Substring(0, 4))
  try {
    New-PSDrive -Name $drv -PSProvider FileSystem -Root ("\\$ip\C$") -Credential $cred -ErrorAction Stop | Out-Null
    $dst = $drv + ':' + $destRel
    if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Path $dst -Force | Out-Null }
    Copy-Item $agent -Destination $dst -Force
    Copy-Item $vbs   -Destination $dst -Force
    if ($cfgJson) { [System.IO.File]::WriteAllText((Join-Path $dst '.pc-login-agent.cfg'), $cfgJson, (New-Object System.Text.UTF8Encoding($false))) }
    Remove-PSDrive $drv -Force
  } catch {
    Note ("    [chep loi] " + $_.Exception.Message.Split("`n")[0]) Yellow
    try { Remove-PSDrive $drv -Force -ErrorAction SilentlyContinue } catch {}
    $fail++; continue
  }
  # Tao task tu xa (RPC), chay ngu canh user dang dang nhap - khong mat khau user, khong SYSTEM
  $out = & schtasks /Create /S $ip /U $cred.UserName /P $pass /TN $TASK /TR $trCmd /SC MINUTE /MO 5 /RU "Users" /RL LIMITED /F 2>&1
  if ($LASTEXITCODE -ne 0) { Note ("    [task loi] " + ($out -join ' ')) Yellow; $fail++; continue }
  if ($RunNow) { & schtasks /Run /S $ip /U $cred.UserName /P $pass /TN $TASK 2>&1 | Out-Null }
  Note "    [OK] da day + tao task" Green
  $ok++
}
Note ""
Note ("XONG: OK=$ok  Loi=$fail  /  Go 1 may: schtasks /Delete /S <ip> /U <admin> /TN """ + $TASK + """ /F") Cyan
