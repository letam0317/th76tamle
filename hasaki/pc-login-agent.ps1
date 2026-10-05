# pc-login-agent.ps1 - AGENT NATIVE (khong can Node), MUC DICH DUY NHAT:
#   ghi nhan tai khoan @hasaki dang dang nhap TREN CHINH MAY NAY, phuc vu doi chieu 5S.
#
# MINH BACH - KHONG giau:
#   - Chay trong ngu canh USER (khong SYSTEM). Task co ten ro nghia.
#   - CHI doc ho so trinh duyet CUA CHINH MINH. KHONG nhan lenh tu xa. KHONG tu cap nhat.
#   - Gui 1 ban ghi/lan ra GAS: {hostname, ip, ts, winUser, email, sub?}. KHONG gui token.
#
# Dinh danh "ai" = email @hasaki tu ho so trinh duyet; neu trong thi suy ra ma WMS (sub).
#   Token CHI dung tam de lay 'sub', KHONG luu, KHONG gui di.
#
# Chay:
#   powershell -ExecutionPolicy Bypass -File pc-login-agent.ps1 -Once -Dry   # chi in, khong ghi/gui
#   powershell -ExecutionPolicy Bypass -File pc-login-agent.ps1 -Once        # in + ghi log (+ gui neu co GAS)
#   powershell -ExecutionPolicy Bypass -File pc-login-agent.ps1 -Service -Minutes 5
# Cau hinh GAS (uu tien tu tren xuong): -GasUrl <url> | $env:HSK_PC_LOGIN_GAS | file .pc-login-agent.cfg {"gasUrl":"..."}
# Go: schtasks /Delete /TN "HSK 5S - ghi nhan dang nhap" /F

param(
  [switch] $Once,
  [switch] $Dry,
  [switch] $Service,
  [int]    $Minutes = 5,
  [string] $GasUrl = ''
)

$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$LOG  = Join-Path $here '.pc-login-agent.log'
$LAST = Join-Path $here '.pc-login-agent-last.json'
$CFG  = Join-Path $here '.pc-login-agent.cfg'

function Write-Utf8NoBom([string]$path, [string]$content) {
  [System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding($false)))
}
function Append-Utf8([string]$path, [string]$line) {
  [System.IO.File]::AppendAllText($path, $line + "`n", (New-Object System.Text.UTF8Encoding($false)))
}

# ---- IP chinh (IPv4, bo loopback/APIPA) ----
function Get-IpChinh {
  try {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
      Select-Object -First 1 -ExpandProperty IPAddress
    if ($ip) { return $ip }
  } catch {}
  try {
    foreach ($a in [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName())) {
      if ($a.AddressFamily -eq 'InterNetwork' -and "$a" -notlike '127.*' -and "$a" -notlike '169.254.*') { return "$a" }
    }
  } catch {}
  return ''
}

# ---- User Windows dang ngoi (quser). Uu tien phien co dau '>' (chinh minh) ----
function Get-WinUser {
  try {
    $out = & quser 2>$null
    if ($out) {
      $lines = @($out | Select-Object -Skip 1 | Where-Object { $_ })
      $pick = ($lines | Where-Object { $_.TrimStart() -like '>*' } | Select-Object -First 1)
      if (-not $pick) { $pick = $lines | Select-Object -First 1 }
      if ($pick) { return ($pick.Trim() -replace '^>', '').Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries)[0] }
    }
  } catch {}
  if ($env:USERNAME) { return $env:USERNAME }
  return ''
}

# ---- Email @hasaki tu ho so trinh duyet cua chinh user nay (chi doc) ----
function Get-ProfileEmails {
  $emails = New-Object System.Collections.Generic.List[string]
  $loc = $env:LOCALAPPDATA
  $roam = $env:APPDATA
  $bases = @(
    (Join-Path $loc 'Microsoft\Edge\User Data'),
    (Join-Path $loc 'Google\Chrome\User Data'),
    (Join-Path $loc 'CocCoc\Browser\User Data'),
    (Join-Path $loc 'BraveSoftware\Brave-Browser\User Data'),
    (Join-Path $roam 'Opera Software\Opera Stable'),
    (Join-Path $roam 'Opera Software\Opera GX Stable'),
    (Join-Path $loc 'Vivaldi\User Data'),
    (Join-Path $loc 'Yandex\YandexBrowser\User Data')
  )
  foreach ($base in $bases) {
    if (-not (Test-Path $base)) { continue }
    foreach ($pref in (Get-ChildItem $base -Filter 'Preferences' -Recurse -Depth 2 -ErrorAction SilentlyContinue)) {
      try {
        $j = Get-Content $pref.FullName -Raw -ErrorAction Stop | ConvertFrom-Json
        if ($j.account_info) {
          foreach ($a in $j.account_info) { if ($a.email) { $emails.Add([string]$a.email) } }
        }
      } catch {}
    }
  }
  return @($emails | Where-Object { $_ } | Sort-Object -Unique)
}

# ---- base64url decode -> string ----
function ConvertFrom-B64Url([string]$s) {
  $s = $s.Replace('-', '+').Replace('_', '/')
  switch ($s.Length % 4) { 2 { $s += '==' } 3 { $s += '=' } 1 { return '' } }
  try { return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($s)) } catch { return '' }
}

# ---- Fallback: lay 'sub' tu JWT trong leveldb (chi khi khong co email) ----
#   Doc file .ldb/.log moi nhat, regex mau JWT, giai payload lay sub. Token KHONG luu lai.
function Get-WmsSub {
  $lat1 = [System.Text.Encoding]::GetEncoding(28591)
  $rx = [regex]'eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+'
  $loc = $env:LOCALAPPDATA
  $roam = $env:APPDATA
  $bases = @(
    (Join-Path $loc 'Microsoft\Edge\User Data'),
    (Join-Path $loc 'Google\Chrome\User Data'),
    (Join-Path $loc 'CocCoc\Browser\User Data'),
    (Join-Path $loc 'BraveSoftware\Brave-Browser\User Data'),
    (Join-Path $roam 'Opera Software\Opera Stable'),
    (Join-Path $roam 'Opera Software\Opera GX Stable'),
    (Join-Path $loc 'Vivaldi\User Data'),
    (Join-Path $loc 'Yandex\YandexBrowser\User Data')
  )
  foreach ($base in $bases) {
    if (-not (Test-Path $base)) { continue }
    $ldbDirs = Get-ChildItem $base -Recurse -Directory -Filter 'leveldb' -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -like '*Local Storage\leveldb' }
    foreach ($d in $ldbDirs) {
      $files = Get-ChildItem $d.FullName -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '\.(ldb|log)$' } | Sort-Object LastWriteTime -Descending | Select-Object -First 4
      foreach ($f in $files) {
        try {
          $txt = $lat1.GetString([System.IO.File]::ReadAllBytes($f.FullName))
        } catch { continue }
        foreach ($m in $rx.Matches($txt)) {
          $parts = $m.Value.Split('.')
          if ($parts.Count -lt 2) { continue }
          $payload = ConvertFrom-B64Url $parts[1]
          if (-not $payload) { continue }
          try { $pj = $payload | ConvertFrom-Json } catch { continue }
          if ($pj.sub -and ("$($pj.sub)" -match '^\d+$')) { return "$($pj.sub)" }
        }
      }
    }
  }
  return ''
}

function Get-GasUrl {
  if ($GasUrl) { return $GasUrl }
  if ($env:HSK_PC_LOGIN_GAS) { return $env:HSK_PC_LOGIN_GAS }
  if (Test-Path $CFG) {
    try { $c = Get-Content $CFG -Raw | ConvertFrom-Json; if ($c.gasUrl) { return [string]$c.gasUrl } } catch {}
  }
  return ''
}

function Get-Record {
  $ts = (Get-Date).ToString('dd/MM/yyyy HH:mm:ss')
  $emails = Get-ProfileEmails
  # Uu tien email @hasaki (danh tinh cong viec); roi ma WMS 'sub'; cuoi cung email ca nhan (yeu).
  $work = @($emails | Where-Object { $_ -match '(?i)@hasaki(group)?\.vn' })
  $email = ''; $sub = ''; $nguon = ''
  if ($work.Count) {
    $email = ($work -join ', '); $nguon = 'email'
  } else {
    $sub = Get-WmsSub
    if ($sub) { $nguon = 'sub' }
    elseif ($emails.Count) { $email = ($emails -join ', '); $nguon = 'email-ca-nhan' }
  }
  return [ordered]@{
    ts       = $ts
    hostname = $env:COMPUTERNAME
    ip       = Get-IpChinh
    winUser  = Get-WinUser
    email    = $email
    sub      = $sub
    nguon    = $nguon
  }
}

function Send-Gas($rec) {
  $url = Get-GasUrl
  if (-not $url) { return 'no-gas' }
  try {
    $body = ($rec | ConvertTo-Json -Depth 4)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    Invoke-RestMethod -Uri $url -Method Post -Body $bytes -ContentType 'application/json; charset=utf-8' -TimeoutSec 20 | Out-Null
    return 'sent'
  } catch { return 'send-fail: ' + $_.Exception.Message.Split("`n")[0] }
}

function Invoke-Once {
  $rec = Get-Record
  $who = if ($rec.email) { $rec.email } elseif ($rec.sub) { $rec.sub } else { '(chua dinh danh)' }
  $line = $rec.ts + ' | ' + $rec.hostname + ' | ' + $rec.ip + ' | win=' + $rec.winUser + ' | ' + $rec.nguon + '=' + $who
  if ($Dry) { Write-Host ('  [DRY] ' + $line) -ForegroundColor DarkGray; return $rec }
  try {
    if ((Test-Path $LOG) -and ((Get-Item $LOG).Length -gt 512KB)) { Move-Item $LOG ($LOG + '.1') -Force -ErrorAction SilentlyContinue }
    Append-Utf8 $LOG $line
    Write-Utf8NoBom $LAST (($rec | ConvertTo-Json -Depth 4))
  } catch { Write-Host ('  (ghi log loi: ' + $_.Exception.Message + ')') -ForegroundColor Yellow }
  $g = Send-Gas $rec
  Write-Host ('  ' + $line + '  [gas: ' + $g + ']')
  return $rec
}

if ($Service) {
  Write-Host ('  [pc-login-agent] service: ghi moi ' + $Minutes + ' phut. Ctrl+C de dung.') -ForegroundColor Cyan
  Invoke-Once
  while ($true) { Start-Sleep -Seconds ($Minutes * 60); Invoke-Once }
} else {
  Invoke-Once
}
