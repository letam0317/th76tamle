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
if (-not (CoLenh node)) { Write-Host "  [X] Chua co Node.js. Cai Node LTS (>=18) roi chay lai." -ForegroundColor Red; exit 1 }
if (-not (CoLenh git))  { Write-Host "  [X] Chua co Git. Cai Git roi chay lai." -ForegroundColor Red; exit 1 }
if (-not (Test-Path "$gitDir\.git")) {
  Write-Host "  - Clone repo (giu .git)..." ; New-Item -ItemType Directory -Force $caiVao | Out-Null
  if (Test-Path $gitDir) { Remove-Item $gitDir -Recurse -Force }
  git clone --branch $cfg.nhanh $repo $gitDir 2>&1 | Out-Null
} else {
  Write-Host "  - Da co repo, dong bo ban moi..." ; git -C $gitDir fetch --depth 1 origin $cfg.nhanh 2>&1 | Out-Null; git -C $gitDir reset --hard "origin/$($cfg.nhanh)" 2>&1 | Out-Null
}
# doc lai dieu-phoi.json tu repo vua keo (co the moi hon ban trong kit chep tay)
$kit = "$duAn\cai-pc"; if (Test-Path "$kit\dieu-phoi.json") { $cfg = Get-Content "$kit\dieu-phoi.json" -Raw -Encoding UTF8 | ConvertFrom-Json }

# ---- npm install + va Edge ngam ----
Push-Location $duAn
Write-Host "  - npm install (lan dau hoi lau)..." ; npm install --no-audit --no-fund --loglevel=error 2>&1 | Out-Null
if (Test-Path "$duAn\va-puppeteer-ho-so.mjs") { node va-puppeteer-ho-so.mjs 2>&1 | Out-Null; Write-Host "    va Edge ngam: $(node va-puppeteer-ho-so.mjs --kiem 2>&1)" }
Pop-Location

# ---- Dong bo task theo dieu-phoi.json (ham chung) ----
. "$kit\dong-bo-task.ps1"
$kq = DongBo-DieuPhoi $kit $cfg $duAn "C:\Users\lechitam\New folder\hasaki"

# ---- .env: giu khoa cu + bo sung khoa cac viec can + khoa cung ----
$envF = "$duAn\.env"; $dong = @{}
if (Test-Path $envF) { foreach($l in Get-Content $envF){ if($l -match '^\s*([A-Z0-9_]+)\s*='){ $dong[$matches[1]] = $l } } }
foreach($k in $kq.envKeys){ if(-not $dong.ContainsKey($k)){ $dong[$k] = "$k=" } }
foreach($p in $cfg.envCung.PSObject.Properties){ $dong[$p.Name] = "$($p.Name)=$($p.Value)" }
($dong.Values | Sort-Object) -join "`r`n" | Out-File $envF -Encoding utf8
$trong = $kq.envKeys | Where-Object { $dong[$_] -match '=\s*$' }
if ($trong) { Write-Host "  [!] .env CON TRONG: $($trong -join ', ') - dien gia tri truoc khi chay that." -ForegroundColor Yellow }

# ---- Khoa quyen thu muc chi SYSTEM + Administrators ----
icacls $caiVao /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" | Out-Null
icacls "$caiVao\*" /reset /T /C /Q 2>&1 | Out-Null
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
Write-Host "  1. Dien .env con trong (neu co canh bao o tren): $envF  (may KHONG lam camera thi de TOPREVIEW/GEMINI TRONG)"
Write-Host "  2. Nen cam DAY LAN + tat ngu. May WiFi/ngu VAN CHAY: ngu = tam nghi, may khac ganh thay; bat lai la chay bu."
Write-Host "  3. (Neu may lam bridge) mo Edge dang nhap WMS + cai extension wms-bridge."
