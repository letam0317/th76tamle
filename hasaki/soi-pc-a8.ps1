# soi-pc-a8.ps1 - PHASE 0: DO KHA THI theo doi tai khoan dang nhap tren cac PC khu A8.
#
# CONG CU DOC-LA-CHINH, KHONG cai gi lau dai len may nao. Ba viec:
#   1. Kiem ke: quet dai IP kho (mac dinh 172.16.0.0/22), tim may song qua cong 445/5985/3389,
#      lay hostname -> ghi .exports/pc-a8-inventory.json
#   2. (Tuy chon -CredTest) Thu quyen admin tu xa (workgroup) tren vai may mau, va do 3 nguon
#      dinh danh doc duoc tu xa hay khong:
#        (a) Tai khoan Windows dang dang nhap  (quser / Win32_ComputerSystem.UserName)
#        (b) Token WMS trong ho so trinh duyet tren dia (\\HOST\C$\...Edge/Chrome Local Storage)
#        (c) Email ho so Edge/Chrome (Preferences.account_info)
#   3. Xuat BANG "may -> tai khoan" (de doc, sap theo tai khoan de cum trung nhau lai) +
#      TU CANH BAO "trung tai khoan" (1 tai khoan dung tren nhieu may) + bao cao
#      .exports/SOI-PC-A8.md + goi y nhanh trien khai (A/B/C).
#
# CHAY: mo PowerShell (Run as administrator neu dung -CredTest) TREN MAY DANG O MANG CONG TY,
#   roi:  powershell -ExecutionPolicy Bypass -File hasaki\soi-pc-a8.ps1
#   them: -CredTest        (thu doc dinh danh tu xa - can 1 tai khoan admin cua may A8)
#         -All             (do TAT CA may cham duoc, khong chi -Sample - de ra bang day du)
#         -Subnet 172.16.0.0/22   -Sample 3   -Timeout 300   -Concurrency 128
#         -SelfTestSubnet 192.168.0.216/29   (chi de KIEM CO CHE quet chay dung, khong phai A8)
#         -Force            (van quet du may khong o dai 172.16.x - dung khi vao qua VPN)
#   Bang day du tai kho:  SOI-PC-A8.bat -AutoSubnet -CredTest -All
#
# KHONG ghi gi len may tu xa. Cred (neu -CredTest) luu MA HOA DPAPI ngoai repo:
#   %USERPROFILE%\.cred-a8-admin.xml  (Remove-Item de xoa).
# Dau ra nam trong .exports\ (da gitignore) vi chua hostname/email = PII, repo PUBLIC.

param(
  [string]   $Subnet         = '172.16.0.0/22',
  [int[]]    $Ports          = @(445, 5985, 3389),
  [int]      $Timeout        = 300,
  [int]      $Concurrency    = 128,
  [int]      $Sample         = 3,
  [switch]   $CredTest,
  [switch]   $All,
  [switch]   $AutoSubnet,
  [string]   $SelfTestSubnet = '',
  [switch]   $Force,
  [string]   $OutDir         = ''
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $OutDir) { $OutDir = Join-Path $here '.exports' }
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
$invJson = Join-Path $OutDir 'pc-a8-inventory.json'
$repMd   = Join-Path $OutDir 'SOI-PC-A8.md'
$credPath = Join-Path $env:USERPROFILE '.cred-a8-admin.xml'

function Note($m, $c='Gray') { Write-Host $m -ForegroundColor $c }
function Write-Utf8NoBom([string]$path, [string]$content) {
  [System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding($false)))
}

# ---- Expand mot CIDR thanh danh sach IP host (bo network + broadcast) ----
function Expand-Cidr([string]$cidr) {
  $p = $cidr -split '/'
  if ($p.Count -ne 2) { throw "Subnet phai dang A.B.C.D/prefix, nhan duoc: $cidr" }
  $b = ([System.Net.IPAddress]::Parse($p[0])).GetAddressBytes(); [array]::Reverse($b)
  $base = [System.BitConverter]::ToUInt32($b, 0)
  $pfx  = [int]$p[1]
  if ($pfx -lt 0 -or $pfx -gt 32) { throw "Prefix khong hop le: $pfx" }
  $hostBits = 32 - $pfx
  $count = [uint64][math]::Pow(2, $hostBits)
  if ($count -gt 70000) { throw "Dai qua rong ($count dia chi). Chia nho subnet ra." }
  $net = [uint64]$base - ([uint64]$base % $count)
  $out = New-Object System.Collections.Generic.List[string]
  if ($count -le 2) {
    for ($i = $net; $i -lt $net + $count; $i++) { $out.Add((IntToIp $i)) }
  } else {
    for ($i = $net + 1; $i -lt $net + $count - 1; $i++) { $out.Add((IntToIp $i)) }
  }
  return $out
}
function IntToIp([uint64]$i) {
  $bb = [System.BitConverter]::GetBytes([uint32]$i); [array]::Reverse($bb)
  return ([System.Net.IPAddress]::new($bb)).ToString()
}

# ---- Quet cong song song bang runspace pool ----
function Invoke-PortScan([string[]]$ips, [int[]]$ports, [int]$timeout, [int]$conc) {
  $sb = {
    param($ip, $ports, $timeout)
    $open = @()
    foreach ($p in $ports) {
      try {
        $c = New-Object System.Net.Sockets.TcpClient
        $iar = $c.BeginConnect($ip, $p, $null, $null)
        if ($iar.AsyncWaitHandle.WaitOne($timeout, $false) -and $c.Connected) { $open += $p }
        $c.Close()
      } catch {}
    }
    if ($open.Count) { [pscustomobject]@{ ip = $ip; ports = $open } } else { $null }
  }
  $pool = [runspacefactory]::CreateRunspacePool(1, [math]::Max(1, $conc)); $pool.Open()
  $jobs = New-Object System.Collections.Generic.List[object]
  foreach ($ip in $ips) {
    $ps = [powershell]::Create(); $ps.RunspacePool = $pool
    [void]$ps.AddScript($sb).AddArgument($ip).AddArgument($ports).AddArgument($timeout)
    $jobs.Add([pscustomobject]@{ ps = $ps; handle = $ps.BeginInvoke() })
  }
  $alive = New-Object System.Collections.Generic.List[object]
  $done = 0; $tot = $jobs.Count
  foreach ($j in $jobs) {
    try { $r = $j.ps.EndInvoke($j.handle); if ($r) { $alive.Add($r) } } catch {}
    $j.ps.Dispose(); $done++
    if ($done % 128 -eq 0) { Write-Host ("  ...da quet {0}/{1}" -f $done, $tot) -ForegroundColor DarkGray }
  }
  $pool.Close(); $pool.Dispose()
  return $alive
}

# ---- Lay hostname (reverse DNS -> NetBIOS) ----
function Resolve-HostName([string]$ip) {
  try { $n = [System.Net.Dns]::GetHostEntry($ip).HostName; if ($n) { return $n } } catch {}
  try {
    $nb = & nbtstat -A $ip 2>$null | Select-String '<00>\s+UNIQUE' | Select-Object -First 1
    if ($nb) { return ($nb.Line.Trim() -split '\s+')[0] }
  } catch {}
  return ''
}

# ---- Do 3 nguon dinh danh tren 1 may (can cred admin) ----
function Test-RemoteIdentity([string]$ip, [string]$name, $cred) {
  $r = [ordered]@{
    ip = $ip; hostname = $name
    winrm = $false; wmi = $false; cshare = $false
    win_user = ''            # (a)
    wms_token_found = $false  # (b)
    wms_token_sub = ''
    wms_account = ''          # (b) email @hasaki tra tu danh ba
    wms_name = ''
    edge_emails = @()         # (c)
    notes = @()
  }
  # (2) + (a) qua WinRM
  try {
    $so = New-CimSessionOption -Protocol Wsman
    $s = New-CimSession -ComputerName $ip -Credential $cred -SessionOption $so -OperationTimeoutSec 12 -ErrorAction Stop
    $cs = Get-CimInstance -CimSession $s -ClassName Win32_ComputerSystem -ErrorAction Stop
    $r.winrm = $true; if ($cs.UserName) { $r.win_user = $cs.UserName }
    if (-not $r.hostname) { $r.hostname = $cs.Name }
    Remove-CimSession $s
  } catch { $r.notes += "winrm: " + $_.Exception.Message.Split("`n")[0] }
  # (2) + (a) qua WMI/DCOM neu WinRM khong duoc
  if (-not $r.winrm) {
    try {
      $so2 = New-CimSessionOption -Protocol Dcom
      $s2 = New-CimSession -ComputerName $ip -Credential $cred -SessionOption $so2 -OperationTimeoutSec 12 -ErrorAction Stop
      $cs2 = Get-CimInstance -CimSession $s2 -ClassName Win32_ComputerSystem -ErrorAction Stop
      $r.wmi = $true; if ($cs2.UserName) { $r.win_user = $cs2.UserName }
      if (-not $r.hostname) { $r.hostname = $cs2.Name }
      Remove-CimSession $s2
    } catch { $r.notes += "wmi: " + $_.Exception.Message.Split("`n")[0] }
  }
  # (a) bo sung: quser tren may (chinh xac hon UserName khi da khoa man)
  if ($r.winrm) {
    try {
      $q = Invoke-Command -ComputerName $ip -Credential $cred -ErrorAction Stop -ScriptBlock {
        (quser 2>$null)
      }
      if ($q) { $r.notes += "quser: " + (($q | Select-Object -Skip 1) -join ' | ') }
    } catch {}
  }
  # (b)+(c) doc ho so trinh duyet qua C$ (chi doc)
  $unc = "\\$ip\C$\Users"
  try {
    if (Test-Path $unc -ErrorAction Stop) {
      $r.cshare = $true
      $profiles = Get-ChildItem $unc -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notin @('Public', 'Default', 'Default User', 'All Users') }
      foreach ($pf in $profiles) {
        $bases = @(
          (Join-Path $pf.FullName 'AppData\Local\Microsoft\Edge\User Data'),
          (Join-Path $pf.FullName 'AppData\Local\Google\Chrome\User Data')
        )
        foreach ($base in $bases) {
          if (-not (Test-Path $base)) { continue }
          # (c) email ho so
          foreach ($pref in (Get-ChildItem $base -Recurse -Filter 'Preferences' -Depth 1 -ErrorAction SilentlyContinue)) {
            try {
              $j = Get-Content $pref.FullName -Raw -ErrorAction Stop | ConvertFrom-Json
              $ai = $j.account_info
              if ($ai) { foreach ($a in $ai) { if ($a.email) { $r.edge_emails += $a.email } } }
            } catch {}
          }
          # (b) chep leveldb ve TAM roi trich auth_store bang node (KHONG chay gi tren may xa)
          foreach ($lv in (Get-ChildItem $base -Recurse -Directory -Filter 'leveldb' -ErrorAction SilentlyContinue |
              Where-Object { $_.FullName -like '*Local Storage\leveldb' } | Select-Object -First 6)) {
            $dst = Join-Path $env:TEMP ('a8ldb-' + [guid]::NewGuid().ToString('N').Substring(0, 10))
            try {
              New-Item -ItemType Directory -Path $dst -Force | Out-Null
              # Chep cac file leveldb ve tam (bo qua file dang khoa: .ldb la bat bien nen chep duoc)
              Get-ChildItem $lv.FullName -File -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match '\.(ldb|log)$' -or $_.Name -eq 'CURRENT' -or $_.Name -like 'MANIFEST-*' } |
                ForEach-Object { Copy-Item $_.FullName -Destination $dst -ErrorAction SilentlyContinue }
              $nodeOut = & node (Join-Path $here 'soi-auth-store.mjs') "--dir=$dst" '--json' 2>$null
              if ($nodeOut) {
                $arr = ($nodeOut -join "`n") | ConvertFrom-Json
                foreach ($a in $arr) {
                  if ($a.sub) {
                    $r.wms_token_found = $true; $r.wms_token_sub = "$($a.sub)"
                    if ($a.taiKhoan) { $r.wms_account = $a.taiKhoan }
                    if ($a.ten) { $r.wms_name = $a.ten }
                  }
                }
              }
            } catch { $r.notes += 'ldb: ' + $_.Exception.Message.Split("`n")[0] }
            finally { Remove-Item $dst -Recurse -Force -ErrorAction SilentlyContinue }
          }
        }
      }
      $r.edge_emails = @($r.edge_emails | Select-Object -Unique)
    }
  } catch { $r.notes += "cshare: " + $_.Exception.Message.Split("`n")[0] }
  return $r
}

# ---- Rut ra "danh tinh" cua 1 may de hien thi + phat hien trung tai khoan ----
#   Uu tien: tai khoan WMS that -> email ho so Edge/Chrome -> user Windows.
#   key = khoa gom nhom (chuan hoa chu thuong) de dem trung; label = ten hien thi cho nguoi doc.
function Resolve-AccountInfo($d) {
  if ($d.wms_token_found) {
    if ($d.wms_account) {
      $lbl = $d.wms_account + $(if ($d.wms_name) { " ($($d.wms_name))" } else { "" })
      return [pscustomobject]@{ key = $d.wms_account.ToLower(); label = $lbl; source = 'WMS' }
    }
    return [pscustomobject]@{ key = "sub:$($d.wms_token_sub)"; label = "sub=$($d.wms_token_sub)"; source = 'WMS' }
  }
  $em = @($d.edge_emails | Where-Object { $_ } | Sort-Object -Unique)
  if ($em.Count) {
    return [pscustomobject]@{ key = $em[0].ToLower(); label = ($em -join ', '); source = 'Email' }
  }
  if ($d.win_user) {
    return [pscustomobject]@{ key = 'win:' + $d.win_user.ToLower(); label = $d.win_user; source = 'Windows' }
  }
  return [pscustomobject]@{ key = ''; label = '(khong doc duoc)'; source = '' }
}

# ================== MAIN ==================
Note ""
Note "  === PHASE 0: DO KHA THI - THEO DOI DANG NHAP PC KHU A8 ===" Cyan
Note ""

# Preflight: liet ke IP noi bo + xay danh sach subnet can quet
$locals = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -ExpandProperty IPAddress
$onLan = ($locals | Where-Object { $_ -like '10.*' -or $_ -like '192.168.*' -or $_ -match '^172\.(1[6-9]|2[0-9]|3[01])\.' }).Count -gt 0
Note ("  IP may nay: " + ($locals -join ', '))

# Danh sach subnet: SelfTest | Auto (moi dai may dang noi) | -Subnet (nhan nhieu, ngan bang dau phay)
$subnets = New-Object System.Collections.Generic.List[string]
if ($SelfTestSubnet) {
  $subnets.Add($SelfTestSubnet)
  Note "  [SELF-TEST] Quet $SelfTestSubnet chi de kiem co che - KHONG phai khu A8." Yellow
} elseif ($AutoSubnet) {
  foreach ($ipx in (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' })) {
    $bb = ([System.Net.IPAddress]::Parse($ipx.IPAddress)).GetAddressBytes(); [array]::Reverse($bb)
    $base = [System.BitConverter]::ToUInt32($bb, 0); $pfx = [int]$ipx.PrefixLength
    if ($pfx -lt 22) { $pfx = 24 }  # dia chi don le /16-/8 -> gioi han /24 cho khoi qua rong
    $cnt = [uint64][math]::Pow(2, 32 - $pfx); $net = [uint64]$base - ([uint64]$base % $cnt)
    $sn = (IntToIp $net) + "/" + $pfx
    if (-not $subnets.Contains($sn)) { $subnets.Add($sn) }
  }
  Note ("  [AUTO] Quet cac dai may dang noi: " + ($subnets -join ', ')) Cyan
} else {
  foreach ($s in ($Subnet -split '[,; ]+' | Where-Object { $_ })) { $subnets.Add($s.Trim()) }
}
$scanLabel = ($subnets -join ', ')

# Canh bao neu KHONG dai nao trung dai cua may nay (co the dang o mang khac voi PC dich)
$cungDai = $false
foreach ($s in $subnets) {
  $sp = ($s -split '/')[0].Split('.')[0..2] -join '.'
  foreach ($lip in $locals) { if ($sp -eq ($lip.Split('.')[0..2] -join '.')) { $cungDai = $true } }
}
if (-not $SelfTestSubnet) {
  if (-not $onLan) {
    Note "  [!] May nay khong co dia chi mang noi bo nao (chua noi mang / chua bat VPN)." Yellow
    if (-not $Force) { Note "      (Them -Force, hoac -SelfTestSubnet de thu co che.)" Gray; Note ""; exit 2 }
  } elseif (-not $cungDai -and -not $Force) {
    Note "  [!] Dai quet ($scanLabel) KHAC dai cua may nay ($($locals -join ',')) - co the KHONG toi duoc." Yellow
    Note "      Chay TREN may cung mang voi PC A8, dung -AutoSubnet de tu quet dai dang noi, hoac -Force." Gray
    Note ""; exit 2
  }
}

# 1) Kiem ke
Note ""
Note "  [1/3] Quet $scanLabel cong $($Ports -join ',') (timeout ${Timeout}ms, song song $Concurrency)..." Cyan
$ipSet = New-Object System.Collections.Generic.HashSet[string]
foreach ($sn in $subnets) {
  try { foreach ($ip in (Expand-Cidr $sn)) { [void]$ipSet.Add($ip) } }
  catch { Note ("  (bo qua subnet loi: $sn - " + $_.Exception.Message + ")") Yellow }
}
$ips = @($ipSet)
Note ("  Tong dia chi host can quet: " + $ips.Count)
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$aliveRaw = Invoke-PortScan -ips $ips -ports $Ports -timeout $Timeout -conc $Concurrency
$sw.Stop()
Note ("  May song: " + $aliveRaw.Count + " (trong " + [int]$sw.Elapsed.TotalSeconds + "s)") Green

Note "  Lay hostname..." Cyan
$inv = New-Object System.Collections.Generic.List[object]
foreach ($a in ($aliveRaw | Sort-Object { [version]($_.ip) })) {
  $hn = Resolve-HostName $a.ip
  $inv.Add([pscustomobject]@{
    ip = $a.ip; hostname = $hn; ports = $a.ports
    smb = ($a.ports -contains 445); winrm = ($a.ports -contains 5985); rdp = ($a.ports -contains 3389)
  })
}
$invBody = ($inv | ConvertTo-Json -Depth 5)
if ($inv.Count -le 1) { $invBody = "[`r`n" + $invBody + "`r`n]" }  # luon la mang cho Node doc
Write-Utf8NoBom $invJson $invBody
Note ("  -> Da ghi kiem ke: " + $invJson) Green
$inv | Format-Table ip, hostname, @{n='cong'; e={ $_.ports -join ',' }} -AutoSize | Out-String -Width 100 | Write-Host

# 2) Thu dinh danh tu xa
$idResults = @()
if ($CredTest) {
  Note ""
  Note "  [2/3] Thu quyen admin + doc dinh danh tu xa (mau $Sample may)..." Cyan
  $pr = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Note "  [!] -CredTest nen chay 'Run as administrator' (WinRM client + TrustedHosts)." Yellow
  }
  if (Test-Path $credPath) {
    $cred = Import-Clixml $credPath
    Note ("  Dung cred da luu: " + $cred.UserName + "  (xoa: Remove-Item '$credPath')")
  } else {
    Note "  Nhap tai khoan admin cua may A8 (vd: MAYA8-01\Administrator hoac tai khoan admin chung):" Cyan
    $cred = Get-Credential -Message "Admin cua may A8 (chi doc, luu ma hoa DPAPI)"
    $cred | Export-Clixml -Path $credPath
    Note ("  Da luu cred ma hoa: " + $credPath) Green
  }
  # dam bao TrustedHosts co cac may mau (workgroup + WinRM)
  try {
    Start-Service WinRM -ErrorAction SilentlyContinue
    $th = (Get-Item WSMan:\localhost\Client\TrustedHosts -ErrorAction SilentlyContinue).Value
    if ($th -ne '*') { Set-Item WSMan:\localhost\Client\TrustedHosts -Value '*' -Force; Note "  TrustedHosts=* (tam, workgroup)." Gray }
  } catch { Note "  (Khong dat duoc TrustedHosts - can Admin.)" Yellow }

  $reachable = @($inv | Where-Object { $_.smb -or $_.winrm })
  if ($All) {
    $targets = $reachable
    Note ("  -All: do TAT CA " + $reachable.Count + " may cham duoc (SMB/WinRM), khong chi mau $Sample.") Yellow
  } else {
    $targets = @($reachable | Select-Object -First $Sample)
    if ($reachable.Count -gt $Sample) { Note ("  (Chi do mau $Sample/" + $reachable.Count + " may. Them -All de do het va ra bang day du.)") Gray }
  }
  $i = 0
  foreach ($t in $targets) {
    $i++
    Note ("  - [{0}/{1}] Do may {2} ({3})..." -f $i, @($targets).Count, $t.ip, $t.hostname)
    $idResults += (Test-RemoteIdentity -ip $t.ip -name $t.hostname -cred $cred)
  }

  # ---- Tong hop danh tinh + BANG may->tai khoan + phat hien trung tai khoan ----
  $acc = @()
  foreach ($d in $idResults) {
    $ai = Resolve-AccountInfo $d
    $acc += [pscustomobject]@{ ip = $d.ip; hostname = $d.hostname; label = $ai.label; source = $ai.source; key = $ai.key }
  }
  Note ""
  Note "  ===== BANG: MAY -> TAI KHOAN =====" Cyan
  $acc | Sort-Object label, hostname | Format-Table -AutoSize `
      @{ n = 'Hostname'; e = { if ($_.hostname) { $_.hostname } else { '?' } } }, `
      @{ n = 'IP'; e = { $_.ip } }, `
      @{ n = 'Tai khoan (nguoi)'; e = { $_.label } }, `
      @{ n = 'Nguon'; e = { $_.source } } | Out-String -Width 120 | Write-Host

  $withKey  = @($acc | Where-Object { $_.key })
  $readCount = $withKey.Count
  $distinct  = @($withKey | Select-Object -ExpandProperty key -Unique).Count
  $dups = @($withKey | Group-Object key | Where-Object { $_.Count -gt 1 })
  if ($dups.Count) {
    Note ""
    Note ("  [!] CANH BAO TRUNG TAI KHOAN: " + $dups.Count + " tai khoan dung tren nhieu may.") Yellow
    foreach ($g in ($dups | Sort-Object Count -Descending)) {
      $lbl = ($g.Group | Select-Object -First 1).label
      $mays = ($g.Group | ForEach-Object { if ($_.hostname) { $_.hostname } else { $_.ip } })
      Note ("      - " + $lbl + "  ->  " + $g.Count + " may: " + ($mays -join ', ')) Yellow
    }
    Note ""
    Note "      => Neu nhieu may chung 1 tai khoan thi 'tai khoan nao' khong tach duoc NGUOI." Yellow
    Note "         Xet nhanh B (user Windows ca nhan hoa) hoac ghep cham cong truoc khi phu 100 may." Gray
  } elseif ($readCount) {
    Note ""
    Note ("  [OK] " + $readCount + " may doc duoc tai khoan, tat ca KHAC nhau (" + $distinct + " tai khoan). Tin hieu 'ai' co gia tri.") Green
  }
} else {
  Note ""
  Note "  [2/3] Bo qua do dinh danh (them -CredTest de thu doc tai khoan tu xa)." DarkGray
}

# 3) Bao cao
Note ""
Note "  [3/3] Viet bao cao..." Cyan
$now = Get-Date -Format 'yyyy-MM-dd HH:mm'
$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# SOI-PC-A8 - Phase 0: do kha thi theo doi dang nhap PC khu A8")
$lines.Add("")
$lines.Add("- Thoi diem: $now")
$lines.Add("- May chay: $($env:COMPUTERNAME) / IP $($locals -join ', ')")
$lines.Add("- Subnet quet: $scanLabel" + $(if ($SelfTestSubnet) { "  (SELF-TEST, khong phai A8)" } else { "" }))
$lines.Add("- O mang cong ty (172.16.x): " + $(if ($onLan) { "CO" } else { "KHONG" }))
$lines.Add("- May song: $($inv.Count)")
$lines.Add("")
$lines.Add("## Kiem ke (chi tiet: .exports/pc-a8-inventory.json)")
$lines.Add("")
$lines.Add("| IP | Hostname | SMB445 | WinRM5985 | RDP3389 |")
$lines.Add("|----|----------|--------|-----------|---------|")
foreach ($x in $inv) {
  $lines.Add("| $($x.ip) | $($x.hostname) | $(if($x.smb){'x'}else{''}) | $(if($x.winrm){'x'}else{''}) | $(if($x.rdp){'x'}else{''}) |")
}
$lines.Add("")
if ($CredTest) {
  $modeLbl = if ($All) { "TAT CA may cham duoc" } else { "mau $($idResults.Count) may" }
  # --- Tom tat + BANG may -> tai khoan (sap theo tai khoan de trung nhau nam canh nhau) ---
  $lines.Add("## May -> tai khoan ($modeLbl)")
  $lines.Add("")
  $lines.Add("- Doc duoc tai khoan: **$readCount / $($idResults.Count)** may. So tai khoan khac nhau: **$distinct**.")
  if ($dups.Count) {
    $lines.Add("- **CANH BAO: $($dups.Count) tai khoan dung chung tren nhieu may** (xem muc duoi) -> tin hieu 'tai khoan' KHONG tach duoc nguoi.")
  } elseif ($readCount) {
    $lines.Add("- Cac tai khoan doc duoc deu KHAC nhau -> tin hieu 'ai' co gia tri.")
  }
  $lines.Add("")
  $lines.Add("| Hostname | IP | Tai khoan (nguoi) | Nguon |")
  $lines.Add("|----------|----|-------------------|-------|")
  foreach ($x in ($acc | Sort-Object label, hostname)) {
    $hn = if ($x.hostname) { $x.hostname } else { '?' }
    $lines.Add("| $hn | $($x.ip) | $($x.label) | $($x.source) |")
  }
  $lines.Add("")
  if ($dups.Count) {
    $lines.Add("### Canh bao trung tai khoan")
    $lines.Add("")
    foreach ($g in ($dups | Sort-Object Count -Descending)) {
      $lbl = ($g.Group | Select-Object -First 1).label
      $mays = ($g.Group | ForEach-Object { if ($_.hostname) { $_.hostname } else { $_.ip } })
      $lines.Add("- **$lbl** -> $($g.Count) may: " + ($mays -join ', '))
    }
    $lines.Add("")
    $lines.Add("> Neu nhieu may chung 1 tai khoan thi biet 'tai khoan nao' khong cho biet 'NGUOI nao' dang o may do.")
    $lines.Add("> Xet nhanh B (user Windows ca nhan hoa) hoac ghep cham cong truoc khi phu 100 may.")
    $lines.Add("")
  }
  # --- Chi tiet 3 nguon (de chot Phase 1 doc/cai tu xa) ---
  $lines.Add("## Chi tiet 3 nguon dinh danh (feasibility)")
  $lines.Add("")
  $lines.Add("| IP | Admin | (a) User Windows | (b) Tai khoan WMS @hasaki | (c) Email Edge/Chrome |")
  $lines.Add("|----|-------|------------------|---------------------------|------------------------|")
  foreach ($d in $idResults) {
    $admin = if ($d.winrm) { 'WinRM' } elseif ($d.wmi) { 'WMI' } elseif ($d.cshare) { 'C$only' } else { 'KHONG' }
    $b = if ($d.wms_token_found) { $(if ($d.wms_account) { $d.wms_account + $(if ($d.wms_name) { " ($($d.wms_name))" } else { "" }) } else { "sub=$($d.wms_token_sub)" }) } else { "khong" }
    $lines.Add("| $($d.ip) | $admin | $($d.win_user) | $b | $((@($d.edge_emails) -join ', ')) |")
  }
  $lines.Add("")
  foreach ($d in $idResults) {
    if ($d.notes.Count) { $lines.Add("- $($d.ip) notes: " + (($d.notes | Select-Object -First 4) -join ' ; ')) }
  }
  $lines.Add("")
  # Goi y nhanh
  $anyWmsDisk = ($idResults | Where-Object { $_.wms_token_found }).Count -gt 0
  $anyAdmin   = ($idResults | Where-Object { $_.winrm -or $_.wmi }).Count -gt 0
  $anyWinUser = ($idResults | Where-Object { $_.win_user }).Count -gt 0
  $anyEmail   = ($idResults | Where-Object { $_.edge_emails.Count }).Count -gt 0
  $lines.Add("## Goi y nhanh (chot Phase 1)")
  $lines.Add("")
  if (-not $anyAdmin) {
    $lines.Add("- **Khong may mau nao cho admin tu xa** -> Nhanh A/B/C deu vuong. Kiem tra: tai khoan dung dung khong,")
    $lines.Add("  UAC-remote (LocalAccountTokenFilterPolicy), firewall 445/5985. Neu that su khong co admin -> chi con")
    $lines.Add("  duong lui suy luan yeu (executed_by_name theo vi tri).")
  } else {
    if ($anyWmsDisk) {
      $lines.Add("- **NHANH A kha thi**: doc duoc token WMS tu ho so trinh duyet tu xa -> poller trung tam, KHONG cai gi.")
    } else {
      $lines.Add("- Token WMS **khong** thay tren dia (nhieu kha nang o sessionStorage/bo nho).")
      if ($anyWinUser) { $lines.Add("  - **NHANH B**: lay tai khoan Windows tu xa (khong cai). CHI dung neu login Windows la ca nhan hoa.") }
      if ($anyEmail)   { $lines.Add("  - Co email ho so Edge/Chrome (thuong @hasakigroup.vn) - dinh danh 'ai' thay the, doc tu xa duoc.") }
      $lines.Add("  - **NHANH C**: muon DUNG tai khoan WMS -> day tu xa 1 lan reporter/extension (khong di bo).")
    }
  }
  $lines.Add("")
  $lines.Add("> Luu y tai khoan dung chung: neu nhieu may ra CUNG mot tai khoan WMS thi 'tai khoan nao' vo nghia,")
  $lines.Add("> tin hieu can la 'nguoi nao' - dang nhap web khong cho biet. Xac nhan bang du lieu that o buoc sau.")
} else {
  $lines.Add("## Do dinh danh: chua chay (them -CredTest).")
}
Write-Utf8NoBom $repMd (($lines -join "`r`n") + "`r`n")
Note ("  -> Da ghi bao cao: " + $repMd) Green
Note ""
Note "  XONG PHASE 0." Cyan
if (-not $CredTest -and $inv.Count) { Note "  Buoc tiep: chay lai kem -CredTest de biet nguon dinh danh nao doc duoc tu xa." Gray }
Note ""
