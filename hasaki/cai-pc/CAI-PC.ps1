# CAI-PC.ps1 - Cai bo co 5S cho MOT PC noi bo (chay voi quyen admin).
#   Bam phai CAI-PC.bat -> Run as administrator.  KHONG can nhap vai: may tu lay viec theo HOSTNAME
#   trong cai-pc\dieu-phoi.json (viec nao co hostname may nay trong uuTien thi cai).
#   Sau khi cai: may TU dong bo + TU them/bot viec (git pull) qua task 'Audit cap nhat PC' - KHONG cai lai.
$ErrorActionPreference = "Stop"
$kit = $PSScriptRoot
$cfg = Get-Content "$kit\dieu-phoi.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$repo = "https://github.com/letam0317/th76tamle.git"
$caiVao = "C:\AuditFactory"; $gitDir = "$caiVao\hasaki-repo"; $duAn = "$gitDir\hasaki"
$may = $env:COMPUTERNAME
$nhan = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
$ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
Write-Host ""
Write-Host "=== Cai PC '$may' ($nhan nhan CPU, $ramGB GB RAM) -> $duAn ===" -ForegroundColor Cyan
Write-Host "    Cai HET viec; cong gac tu chon may MANH NHAT + DU KHOA + khoe de chay. Khong can xep hang tay."
Write-Host "    Dieu khien nang luc = khoa .env: may dien TOPREVIEW -> duoc nhan viec camera; khong dien -> khong."

# ---- Node + Git; clone CA repo (giu .git de tu cap nhat) ----
function CoLenh($n){ $null -ne (Get-Command $n -ErrorAction SilentlyContinue) }
# Lenh ngoai (git/npm/node) ghi tien do ra stderr -> PS 5.1 + "Stop" coi la loi. Tam ha "Continue", phan xu bang $LASTEXITCODE.
function ChayNgoai([string]$ten, [scriptblock]$lenh){
  $cu = $ErrorActionPreference; $ErrorActionPreference = "Continue"
  try { $ra = & $lenh 2>&1 | ForEach-Object { "$_" } } finally { $ErrorActionPreference = $cu }
  if ($LASTEXITCODE -ne 0) { Write-Host "  [X] $ten loi (ma $LASTEXITCODE):" -ForegroundColor Red; $ra | Select-Object -Last 15 | ForEach-Object { Write-Host "      $_" }; exit 1 }
}
if (-not (CoLenh node)) { Write-Host "  [X] Chua co Node.js. Cai Node LTS (>=18) roi chay lai." -ForegroundColor Red; exit 1 }
if (-not (CoLenh git))  { Write-Host "  [X] Chua co Git. Cai Git roi chay lai." -ForegroundColor Red; exit 1 }
if (-not (Test-Path "$gitDir\.git")) {
  Write-Host "  - Clone repo (giu .git)..." ; New-Item -ItemType Directory -Force $caiVao | Out-Null
  if (Test-Path $gitDir) { Remove-Item $gitDir -Recurse -Force }
  ChayNgoai "git clone" { git clone --branch $cfg.nhanh $repo $gitDir }
} else {
  Write-Host "  - Da co repo, dong bo ban moi..."
  ChayNgoai "git fetch" { git -C $gitDir fetch --depth 1 origin $cfg.nhanh }
  ChayNgoai "git reset" { git -C $gitDir reset --hard "origin/$($cfg.nhanh)" }
}
# doc lai dieu-phoi.json tu repo vua keo (co the moi hon ban trong kit chep tay)
$kit = "$duAn\cai-pc"; if (Test-Path "$kit\dieu-phoi.json") { $cfg = Get-Content "$kit\dieu-phoi.json" -Raw -Encoding UTF8 | ConvertFrom-Json }

# ---- node.exe + git cho SYSTEM (co chay ngam = SYSTEM; neu Node/Git cai per-user khong vao PATH may thi SYSTEM khong thay) ----
#   Chep node.exe vao duAn -> _DP-CHAY/_NHIP tu dung (khong phu thuoc PATH). Luu duong git -> bo cap nhat dung.
try { Copy-Item (Get-Command node).Source "$duAn\node.exe" -Force } catch { Write-Host "  [!] khong chep duoc node.exe (SYSTEM se dung 'node' tren PATH): $_" }
try { (Get-Command git).Source | Out-File "$duAn\.git-exe" -Encoding ascii -NoNewline } catch {}

# ---- npm install (BO tai Chromium — co dung Edge, khong can) + va Edge ngam ----
Push-Location $duAn
$env:PUPPETEER_SKIP_DOWNLOAD = "true"; $env:PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "true"
Write-Host "  - npm install (bo tai Chromium; lan dau hoi lau)..." ; ChayNgoai "npm install" { npm install --no-audit --no-fund --loglevel=error }
if (Test-Path "$duAn\va-puppeteer-ho-so.mjs") {
  $ErrorActionPreference = "Continue"
  & "$duAn\node.exe" va-puppeteer-ho-so.mjs 2>&1 | Out-Null; Write-Host "    va Edge ngam: $(& "$duAn\node.exe" va-puppeteer-ho-so.mjs --kiem 2>&1)"
  $ErrorActionPreference = "Stop"
}
Pop-Location

# ---- Dong bo task theo dieu-phoi.json (ham chung) ----
. "$kit\dong-bo-task.ps1"
$kq = DongBo-DieuPhoi $kit $cfg $duAn "C:\Users\lechitam\New folder\hasaki"

# ---- .env: giu khoa cu + bo sung khoa cac viec can + khoa cung ----
$envF = "$duAn\.env"; $dong = @{}
if (Test-Path $envF) { foreach($l in Get-Content $envF){ if($l -match '^\s*([A-Z0-9_]+)\s*='){ $dong[$matches[1]] = $l } } }
foreach($k in $kq.envKeys){ if(-not $dong.ContainsKey($k)){ $dong[$k] = "$k=" } }
# Khoa NHUNG SAN trong bo cai tai tu laptop (may chu 8591 dung tu .env laptop, base64) -> dien thang, khong lam tay
if ($env:HSK_KHOA_B64) {
  try {
    $txt = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:HSK_KHOA_B64)); $soKhoa = 0
    foreach($l in ($txt -split "`n")){ $l = $l.TrimEnd("`r"); if($l -match '^([A-Z0-9_]+)=(.+)$'){ $dong[$matches[1]] = $l; $soKhoa++ } }
    Write-Host "  - Da nap $soKhoa khoa co san trong bo cai vao .env" -ForegroundColor Green
  } catch { Write-Host "  [!] Khoa trong bo cai hong: $_" -ForegroundColor Yellow }
}
foreach($p in $cfg.envCung.PSObject.Properties){ $dong[$p.Name] = "$($p.Name)=$($p.Value)" }
($dong.Values | Sort-Object) -join "`r`n" | Out-File $envF -Encoding utf8
$trong = $kq.envKeys | Where-Object { $dong[$_] -match '=\s*$' }
if ($trong) { Write-Host "  [!] .env CON TRONG: $($trong -join ', ') - dien gia tri truoc khi chay that." -ForegroundColor Yellow }

# ---- Khoa quyen thu muc chi SYSTEM + Administrators ----
icacls $caiVao /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" | Out-Null
$ErrorActionPreference = "Continue"; icacls "$caiVao\*" /reset /T /C /Q 2>&1 | Out-Null; $ErrorActionPreference = "Stop"
try { Get-Content "$duAn\package.json" -TotalCount 1 | Out-Null } catch { Write-Host "  [X] Khoa quyen hong - tra lai ke thua." -ForegroundColor Red; icacls $caiVao /inheritance:e | Out-Null }

# ---- Task TU CAP NHAT (SYSTEM, theo capNhat.nhip): git pull + dong bo lai, KHONG cai lai tay ----
$capF = "$duAn\cai-pc\_CAP-NHAT-PC.ps1"
$aCap = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $capF + '"')
$tCap = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(3) -RepetitionInterval ([System.Xml.XmlConvert]::ToTimeSpan($cfg.capNhat.nhip)) -RepetitionDuration ([TimeSpan]::FromDays(3650))
$tBoot = New-ScheduledTaskTrigger -AtStartup
$sCap = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -Priority 8 -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$pCap = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $cfg.capNhat.tenTask -Action $aCap -Trigger @($tCap, $tBoot) -Settings $sCap -Principal $pCap -Force | Out-Null

# ---- Task NHIP TIM (3') de may RANH van bao song -> dieu phoi biet de gan-thay; chay bu khi vua bat lai ----
$aHb = New-ScheduledTaskAction -Execute "wscript.exe" -Argument ('//nologo "' + $duAn + '\cai-pc\_NHIP-AN.vbs"') -WorkingDirectory $duAn
$nhipTim = if ($cfg.capNhat.nhipTim) { [System.Xml.XmlConvert]::ToTimeSpan($cfg.capNhat.nhipTim) } else { [TimeSpan]::FromMinutes(1) }
$tHb = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval $nhipTim -RepetitionDuration ([TimeSpan]::FromDays(3650))
$sHb = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -WakeToRun -Priority 8 -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "Audit nhip tim PC" -Action $aHb -Trigger @($tHb, $tBoot) -Settings $sHb -Principal $pCap -Force | Out-Null

# ---- powercfg BEST-EFFORT (may WiFi/ngu): cam ngu khi cam dien + cho phep danh thuc theo lich (khong ep duoc may pin) ----
try { powercfg /change standby-timeout-ac 0 2>$null; powercfg /change hibernate-timeout-ac 0 2>$null } catch {}

$sha = (git -C $gitDir rev-parse --short HEAD 2>$null)
@{ may = $may; nhan = $nhan; ramGB = $ramGB; luc = (Get-Date).ToString("s"); soTask = $kq.nap; ban = $sha } | ConvertTo-Json | Out-File "$duAn\.nhip-pc.json" -Encoding utf8
Write-Host ""
Write-Host "XONG: $($kq.nap) viec$(if($kq.xoa){", go $($kq.xoa) cu"}) (ban $sha). Tu cap nhat + nhip tim da bat." -ForegroundColor Green
Write-Host "CON LAM TAY:" -ForegroundColor Yellow
if ($trong) { Write-Host "  1. Dien .env con trong: $envF  (de khoi lam tay: tai bo cai bang nut tren dashboard o LAPTOP da dang nhap Xac minh)" }
else { Write-Host "  1. .env da du khoa - khong can lam gi." }
Write-Host "  2. Nen cam DAY LAN + tat ngu. May WiFi/ngu VAN CHAY: ngu = tam nghi, may khac ganh thay; bat lai la chay bu."
Write-Host "  3. (Neu may lam bridge) mo Edge dang nhap WMS + cai extension wms-bridge."
Write-Host ""
Write-Host "  [BAO MAT] .env chua khoa GAS (lay duoc token tamlc) -> CHI cai may TIN CAY." -ForegroundColor Red
Write-Host "            Thu muc da khoa chi SYSTEM+Admin; neu may mat kiem soat -> doi khoa GAS." -ForegroundColor Red
if ($env:COMPUTERNAME -match '^(DESKTOP|PC|WIN|USER|LAPTOP)-') { Write-Host "  [!] Ten may kieu MAC DINH - dam bao 3 may KHAC TEN nhau (tranh dung nhip tim)." -ForegroundColor Yellow }
