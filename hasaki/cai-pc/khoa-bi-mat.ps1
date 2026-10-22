# khoa-bi-mat.ps1 - BI MAT .env TREN MAY TRAM (22/10/2026). Dot-source tu _CAP-NHAT-PC.ps1 moi luot:  Khoa-BiMat $duAn $cfg $NODE
# (1) khoaChiMay (dieu-phoi.json): khoa chi giu tren may duoc chi dinh -> may khac GO dong khoa khoi .env
#     (cong gac tu ne viec thieu khoa: may khong co khoa top-review khong nhan viec camera).
# (2) Dat bien MAY NODE_OPTIONS=--require "<duAn>\nap-bi-mat.cjs" (bo giai khoa chay truoc dotenv).
# (3) Khi CHINH tien trinh nay da nhan NODE_OPTIONS (Task Scheduler da nap bien moi => moi tac vu node deu giai duoc):
#     ma hoa cac khoa trong khoaMaHoa bang DPAPI pham vi MAY -> "KEY=dpapi:<base64>". Tu kiem truoc khi thay: giai thu ban nhap
#     bang dung bo nap cua node, so bam SHA-256 tung khoa; lech -> giu ban ro, ghi log.
# Laptop (may goc, deploy-gas doc .env tho) KHONG BAO GIO bi dong vao: may trong khoaBoQua hoac duAn nam o "C:\Users\lechitam\New folder".
# Chi chan duoc: chep o cung / ban sao luu / thu muc chia se nham. Quan tri vien cua chinh may van giai duoc (gioi han cua DPAPI) -
#   phan con lai la PHAT HIEN: GAS bao Telegram khi phien work bi lay bat thuong.

function KBM-Bam($s) { $h = [Security.Cryptography.SHA256]::Create(); -join ($h.ComputeHash([Text.Encoding]::UTF8.GetBytes([string]$s)) | ForEach-Object { $_.ToString('x2') }) }

function Khoa-BiMat($duAn, $cfg, $NODE) {
  $may = [System.Net.Dns]::GetHostName()
  $boQua = @($cfg.khoaBoQua)
  if ($boQua -contains $may -or $duAn -like 'C:\Users\lechitam\New folder*') { return }
  $envF = Join-Path $duAn '.env'
  if (-not (Test-Path $envF)) { return }
  $lines = @(Get-Content $envF -Encoding UTF8)
  $doi = $false

  # (1) go khoa khong giao cho may nay
  $go = @()
  if ($cfg.khoaChiMay) {
    foreach ($p in $cfg.khoaChiMay.PSObject.Properties) {
      if (@($p.Value) -contains $may) { continue }
      $truoc = $lines.Count
      $lines = @($lines | Where-Object { $_ -notmatch ('^\s*' + [regex]::Escape($p.Name) + '\s*=') })
      if ($lines.Count -lt $truoc) { $go += $p.Name; $doi = $true }
    }
  }

  # (2) bien may NODE_OPTIONS
  $nap = Join-Path $duAn 'nap-bi-mat.cjs'
  $muon = '--require "' + ($nap -replace '\\', '/') + '"'   # BAY: NODE_OPTIONS coi "\" trong ngoac kep la ky tu thoat -> duong dan Windows mat het "\" => dung "/"
  if (Test-Path $nap) {
    if ([Environment]::GetEnvironmentVariable('NODE_OPTIONS', 'Machine') -ne $muon) {
      [Environment]::SetEnvironmentVariable('NODE_OPTIONS', $muon, 'Machine')
      Ghi "bi mat: dat NODE_OPTIONS cho may (bo giai khoa) - ma hoa .env o luot sau, khi tac vu da nhan bien moi"
    }
  }

  # (3) ma hoa DPAPI + tu kiem
  $daKhoa = @()
  $can = @($cfg.khoaMaHoa); if (-not $can.Count) { $can = @('APPSCRIPT_KEY', 'TOPREVIEW_USER', 'TOPREVIEW_PASS', 'GEMINI_API_KEY') }
  if ((Test-Path $nap) -and $env:NODE_OPTIONS -eq $muon) {
    Add-Type -AssemblyName System.Security
    $moi = @(); $bam = @{}
    foreach ($l in $lines) {
      if ($l -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') {
        $k = $matches[1]; $v = $matches[2].Trim().Trim('"')
        if (($can -contains $k) -and $v -and -not $v.StartsWith('dpapi:')) {
          $b = [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($v), $null, 'LocalMachine'))
          $moi += ($k + '=dpapi:' + $b); $bam[$k] = KBM-Bam $v; $daKhoa += $k; continue
        }
      }
      $moi += $l
    }
    if ($daKhoa.Count) {
      $thu = Join-Path $env:TEMP ('kbm-' + [guid]::NewGuid().ToString('N'))
      New-Item -ItemType Directory $thu | Out-Null
      try {
        ($moi -join "`r`n") | Out-File (Join-Path $thu '.env') -Encoding utf8
        $js = "const c=require('crypto');const o={};for(const k of process.argv.slice(1))o[k]=c.createHash('sha256').update(process.env[k]||'').digest('hex');console.log(JSON.stringify(o))"
        Push-Location $thu; $out = & $NODE -e $js @daKhoa 2>$null; Pop-Location
        $kq = $null; try { $kq = ($out | Select-Object -Last 1) | ConvertFrom-Json } catch {}
        $khop = $true; foreach ($k in $daKhoa) { if (-not $kq -or $kq.$k -ne $bam[$k]) { $khop = $false } }
        if ($khop) { $lines = $moi; $doi = $true; Ghi ("bi mat: da ma hoa DPAPI " + ($daKhoa -join ',') + " (tu kiem giai khoa: khop)") }
        else { Ghi ("[X] bi mat: tu kiem giai khoa LECH - giu ban ro (" + ($daKhoa -join ',') + ")") }
      } finally { Remove-Item $thu -Recurse -Force -ErrorAction SilentlyContinue }
    }
  }

  if ($doi) {
    ($lines -join "`r`n") | Out-File $envF -Encoding utf8
    if ($go.Count) { Ghi ("bi mat: go khoa khong giao cho may nay: " + ($go -join ',')) }
  }
}
