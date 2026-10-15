# _CAP-NHAT-PC.ps1 - TU DONG BO + TU THEM/BOT VIEC cho PC (task SYSTEM 'Audit cap nhat PC').
#   git pull -> npm install neu lock doi -> va Edge ngam -> DongBo-DieuPhoi (dang ky viec moi/go viec bo
#   theo dieu-phoi.json vua keo ve, theo hostname) -> bo sung khoa .env thieu -> nhip tim.
#   KHONG dung upstream (chi GitHub). KHONG xoa .env. Loi mang -> giu ban cu, ghi log.
$ErrorActionPreference = "Continue"
$kit = $PSScriptRoot                                  # ...\hasaki-repo\hasaki\cai-pc
$duAn = Split-Path -Parent $kit                       # ...\hasaki-repo\hasaki
$gitDir = Split-Path -Parent $duAn                    # ...\hasaki-repo
$log = "$duAn\.cap-nhat-pc.log"
function Ghi($m){ "$("{0:yyyy-MM-dd HH:mm:ss}" -f (Get-Date)) $m" | Out-File $log -Append -Encoding utf8 }

$lock = "$duAn\.cap-nhat.lock"
if (Test-Path $lock) { $t = (Get-Date) - (Get-Item $lock).LastWriteTime; if ($t.TotalMinutes -lt 30) { Ghi "bo qua: luot truoc dang chay"; return } }
New-Item $lock -ItemType File -Force | Out-Null
try {
  # git: dung duong da luu luc cai (SYSTEM co the khong thay git tren PATH neu cai per-user)
  $GIT = if (Test-Path "$duAn\.git-exe") { (Get-Content "$duAn\.git-exe" -Raw).Trim() } else { "git" }
  if (-not (Get-Command $GIT -ErrorAction SilentlyContinue)) { Ghi "[X] khong co git ($GIT)"; return }
  $NODE = if (Test-Path "$duAn\node.exe") { "$duAn\node.exe" } else { "node" }
  $cfg = Get-Content "$kit\dieu-phoi.json" -Raw -Encoding UTF8 | ConvertFrom-Json
  $nhanh = $cfg.nhanh

  # 14/10 TU CHUA TASK (moi luot, ke ca khi chua duoc nhan ban moi): QLIT gui nhip tim deu nhung task «5S DP …» KHONG HE goi cong gac
  #   -> kiem du task theo dieu-phoi.json: thieu -> dang ky lai (DongBo-DieuPhoi), bi tat -> bat lai. Ghi ro de xem tu xa (capGan).
  try {
    $thieu = @(); $tat = @()
    foreach ($v in $cfg.viec) {
      $t = Get-ScheduledTask -TaskName ("5S DP " + $v.ten) -ErrorAction SilentlyContinue
      if (-not $t) { $thieu += $v.ten } elseif ($t.State -eq "Disabled") { Enable-ScheduledTask -TaskName $t.TaskName -ErrorAction SilentlyContinue | Out-Null; $tat += $v.ten }
    }
    if ($tat.Count) { Ghi ("tu chua: bat lai task bi tat: " + ($tat -join ",")) }
    if ($thieu.Count) {
      Ghi ("tu chua: THIEU task " + ($thieu -join ",") + " -> dang ky lai")
      . "$kit\dong-bo-task.ps1"; $kq0 = DongBo-DieuPhoi $kit $cfg $duAn "C:\Users\lechitam\New folder\hasaki"
      $con = @($cfg.viec | Where-Object { -not (Get-ScheduledTask -TaskName ("5S DP " + $_.ten) -ErrorAction SilentlyContinue) } | ForEach-Object { $_.ten })
      Ghi ("tu chua: nap " + $kq0.nap + $(if ($con.Count) { " · VAN THIEU: " + ($con -join ",") } else { " · du task" }))
    }
  } catch { Ghi "[X] tu chua task loi: $_" }

  $truoc = (& $GIT -C $gitDir rev-parse HEAD 2>$null)
  $lockTruoc = if (Test-Path "$duAn\package-lock.json") { (Get-FileHash "$duAn\package-lock.json").Hash } else { "" }
  & $GIT -C $gitDir fetch --depth 1 origin $nhanh 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Ghi "fetch loi (mang?) - giu ban cu"; return }
  # CANARY (chong push hong giet ca 3): may MANH NHAT (diem cao nhat trong bang) adopt NGAY;
  #   may khac chi adopt khi commit da du 'canaryGio' tuoi -> push hong chi dính canary, co gio sua/revert.
  $canaryGio = if ($cfg.capNhat.canaryGio) { [double]$cfg.capNhat.canaryGio } else { 2 }
  $laCanary = $false
  try {
    $bangF = "$duAn\.nhip-bang-cache.json"
    if (Test-Path $bangF) {
      $bang = (Get-Content $bangF -Raw | ConvertFrom-Json).bang
      # 14/10: QLIT va FOQ5T89 cung 415 diem -> moi may tuong may kia la canary (khong ai nhan ban moi ngay). Nay: bo may DUNG / mat nhip,
      #   hoa diem -> ten may nho hon. Moi may tinh cung 1 ket qua.
      $bangSong = @($bang | Where-Object { -not $_.dung -and $_.luc -and ((Get-Date).ToUniversalTime() - ([datetime]$_.luc).ToUniversalTime()).TotalMinutes -lt 15 })
      if (-not $bangSong.Count) { $bangSong = @($bang) }
      $top = $bangSong | Sort-Object @{ Expression = { [int]$_.diem }; Descending = $true }, @{ Expression = { [string]$_.may }; Descending = $false } | Select-Object -First 1
      if ($top -and $top.may -eq [System.Net.Dns]::GetHostName()) { $laCanary = $true }
    } else { $laCanary = $true }   # chua co bang (may don) -> tu lam canary
  } catch { $laCanary = $true }
  # 15/10 lenh "Cap nhat ngay" tu tab May tram (nhip tim dat co .cap-nhat-ngay) -> nhan ban moi nhat ngay, bo cho canary
  if (Test-Path "$duAn\.cap-nhat-ngay") { $laCanary = $true; Remove-Item "$duAn\.cap-nhat-ngay" -Force -ErrorAction SilentlyContinue; Ghi "lenh cap nhat NGAY tu May tram -> bo cho canary" }
  $dich = "origin/$nhanh"
  if (-not $laCanary -and $canaryGio -gt 0) {
    # 14/10: truoc day doi CA NHANH im $canaryGio gio (HEAD du tuoi) - 3 phien day lien tuc => JE/FOQ khong bao gio nhan ban moi.
    #   Nay: lay commit MOI NHAT da du $canaryGio gio tuoi (an toan y nhu cu: chi chay ma da on dinh tren canary), khong lui ban.
    & $GIT -C $gitDir fetch --depth 80 origin $nhanh 2>&1 | Out-Null
    $moc = (Get-Date).ToUniversalTime().AddHours(-$canaryGio).ToString("yyyy-MM-ddTHH:mm:ssZ")
    $dich = (& $GIT -C $gitDir rev-list -1 "--before=$moc" FETCH_HEAD 2>$null)
    if (-not $dich) { Ghi ("cho canary: chua co commit nao du " + $canaryGio + "h tuoi"); return }
    & $GIT -C $gitDir merge-base --is-ancestor $dich HEAD 2>$null
    if ($LASTEXITCODE -eq 0) { Ghi ("cho canary: ban dang chay da moi hon/bang ban du " + $canaryGio + "h (" + $dich.Substring(0,7) + ")"); return }
  }
  & $GIT -C $gitDir reset --hard $dich 2>&1 | Out-Null
  $sau = (& $GIT -C $gitDir rev-parse HEAD 2>$null)
  $sha = (& $GIT -C $gitDir rev-parse --short HEAD 2>$null)

  if ($truoc -eq $sau) { Ghi "khong doi ($sha)" }
  else {
    Ghi "cap nhat $($truoc.Substring(0,7)) -> $sha"
    $cfg = Get-Content "$kit\dieu-phoi.json" -Raw -Encoding UTF8 | ConvertFrom-Json   # doc lai ban moi
    $lockSau = if (Test-Path "$duAn\package-lock.json") { (Get-FileHash "$duAn\package-lock.json").Hash } else { "" }
    $NPM = if (Test-Path "$duAn\.npm-exe") { (Get-Content "$duAn\.npm-exe" -Raw).Trim() } else { "npm" }   # 14/10: SYSTEM co the khong thay npm tren PATH
    if ($lockSau -ne $lockTruoc) { Ghi "lock doi -> npm install"; Push-Location $duAn; $env:PUPPETEER_SKIP_DOWNLOAD="true"; $env:PUPPETEER_SKIP_CHROMIUM_DOWNLOAD="true"; & $NPM install --omit=dev --no-audit --no-fund --loglevel=error 2>&1 | Out-Null; if ($LASTEXITCODE -ne 0) { Ghi "[X] npm install loi (ma $LASTEXITCODE)" }; Pop-Location }
    if (Test-Path "$duAn\va-puppeteer-ho-so.mjs") { Push-Location $duAn; & $NODE va-puppeteer-ho-so.mjs 2>&1 | Out-Null; Pop-Location }
    # TU THEM/BOT VIEC theo dieu-phoi.json moi (khong cai lai tay)
    . "$kit\dong-bo-task.ps1"
    $kq = DongBo-DieuPhoi $kit $cfg $duAn "C:\Users\lechitam\New folder\hasaki"
    # bo sung khoa .env thieu cho viec moi (giu khoa cu, khong xoa)
    $envF = "$duAn\.env"; $dong = @{}
    if (Test-Path $envF) { foreach($l in Get-Content $envF){ if($l -match '^\s*([A-Z0-9_]+)\s*='){ $dong[$matches[1]] = $l } } }
    $themKhoa = @()
    foreach($k in $kq.envKeys){ if(-not $dong.ContainsKey($k)){ $dong[$k] = "$k="; $themKhoa += $k } }
    foreach($p in $cfg.envCung.PSObject.Properties){ $dong[$p.Name] = "$($p.Name)=$($p.Value)" }
    ($dong.Values | Sort-Object) -join "`r`n" | Out-File $envF -Encoding utf8
    Ghi "dong bo viec: nap $($kq.nap), go $($kq.xoa)$(if($themKhoa){', .env them khoa TRONG: ' + ($themKhoa -join ',')})"
  }
  # VAN DON DIA dinh ky (PC xoa-ngay raw da dinh phieu + van dia thap; laptop no-op). Khong de dia day lam may tu "yeu".
  if (Test-Path "$duAn\don-clip.mjs") { Push-Location $duAn; try { & $NODE don-clip.mjs --im 2>&1 | Out-Null } catch {}; Pop-Location }
  @{ may = [System.Net.Dns]::GetHostName(); luc = (Get-Date).ToString("s"); ban = $sha } | ConvertTo-Json | Out-File "$duAn\.nhip-pc.json" -Encoding utf8
} catch { Ghi "[X] loi: $_" }
finally { Remove-Item $lock -Force -ErrorAction SilentlyContinue }
