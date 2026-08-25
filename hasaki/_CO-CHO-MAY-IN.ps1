# =================================================================================================
#  _CO-CHO-MAY-IN.ps1 - CHAY TREN MAY DANG CAM MAY IN TEM (Desktop-je75k38). CAN QUYEN ADMIN.
#  -----------------------------------------------------------------------------------------------
#  VI SAO CAN FILE NAY: mot con tem ra duoc doi HAI may cung bat -
#     may chay agent (laptop HSK-KHO170-TAML)  +  MAY NAY (may in TSC PE200 cam USB vao day).
#  May nay tat thi agent bao "khong goi duoc may chu in" va GAS giu lenh lai trong hang doi. Log dem
#  20/08/2026: tu ~23:26 lan nao agent khoi dong lai cung bao cau do => may nay tat tu khoang gio do.
#
#  Script lam 3 phan, va NOI RO tung viec:
#    PHAN 1 - CHI DOC: may nay la desktop hay laptop, nep tat/bat 10 ngay qua (Event 1074/6005/41),
#             spooler, may in, card mang co ho tro Wake-on-LAN khong. Chua sua gi.
#    PHAN 2 - SUA: khong tu ngu | spooler tu bat lai khi chet | may in khong Offline/Pause | bat
#             Wake-on-LAN tren card mang | tat Fast Startup (WoL tu trang thai TAT can dieu do) |
#             dang ky task tu chua chay bang SYSTEM (KHONG can ai dang nhap may nay).
#    PHAN 3 - IN HUONG DAN BIOS dung theo loai may, va in MAC de may tram danh thuc.
#
#  Cach chay:  bam PHAI vao _CO-CHO-MAY-IN.bat -> Run as administrator
#  Chay lai nhieu lan vo hai. Muon HOAN TAC: xem cuoi file.
#
#  -Chua    = che do TU CHUA (task goi): bo qua phan doc + phan huong dan, chi sua, khong in gi.
#  -ChiDoc  = CHI DOC roi thoat, KHONG sua gi. Dung de xem truoc cho an toan.
# =================================================================================================
param([switch]$Chua, [switch]$ChiDoc)

$ErrorActionPreference = 'SilentlyContinue'
$DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$LOG = Join-Path $DIR '_co-cho-may-in.log'
$daSua = New-Object System.Collections.ArrayList

$daKen = New-Object System.Collections.ArrayList
function OK($s) { if (-not $Chua) { Write-Host "  [OK] $s" -ForegroundColor Green }; [void]$daSua.Add($s) }
function TT($s) { if (-not $Chua) { Write-Host "  [..] $s" -ForegroundColor Gray } }
# Canh bao PHAI vao so nua. Ban dau chi ghi cai DA SUA, nen luc cai xong tren may in that (10:34
# 21/08/2026) khong cach nao biet buoc kiem script.google.com da truot hay chua - dung luc can nhat.
function XX($s) { if (-not $Chua) { Write-Host "  [!!] $s" -ForegroundColor Yellow }; [void]$daKen.Add($s) }
function W($s)  { if (-not $Chua) { Write-Host $s } }
function GhiSo($s) {
  try { Add-Content -Path $LOG -Value ("[" + (Get-Date).ToString('HH:mm:ss dd/MM/yyyy') + "] $s") -Encoding UTF8 } catch {}
}

$pr = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $pr.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host ""
  Write-Host "  CHUA CO QUYEN ADMIN." -ForegroundColor Red
  Write-Host "  Dong cua so nay, bam PHAI vao _CO-CHO-MAY-IN.bat -> Run as administrator" -ForegroundColor Yellow
  Write-Host ""
  Read-Host "  Bam Enter de dong"
  exit 1
}

$cs  = Get-CimInstance Win32_ComputerSystem
$pin = Get-CimInstance Win32_Battery
$laLaptop = ($cs.PCSystemType -eq 2) -or ($pin -ne $null)

# =================================================================================================
#  PHAN 1 - CHI DOC
# =================================================================================================
if (-not $Chua) {
  W ""
  Write-Host "  ============================================================" -ForegroundColor Cyan
  Write-Host "   CO CHO MAY IN - may nay: $env:COMPUTERNAME" -ForegroundColor Cyan
  Write-Host "  ============================================================" -ForegroundColor Cyan
  W ""
  W ("   May      : {0} {1}   ({2})" -f $cs.Manufacturer, $cs.Model, $(if ($laLaptop) { 'LAPTOP - co pin' } else { 'DESKTOP - khong pin' }))
  $os = Get-CimInstance Win32_OperatingSystem
  W ("   Bat luc  : {0}   (da chay {1} gio)" -f $os.LastBootUpTime, [int]((Get-Date) - $os.LastBootUpTime).TotalHours)
  foreach ($n in (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' })) {
    $ad = Get-NetAdapter -InterfaceIndex $n.InterfaceIndex
    W ("   Mang     : {0}  {1}  MAC {2}" -f $n.IPAddress, $ad.Name, $ad.MacAddress)
  }

  W ""
  Write-Host "   --- NEP TAT/BAT 10 NGAY QUA (de biet may nay co bi tat moi toi khong) ---" -ForegroundColor Cyan
  $ev = Get-WinEvent -FilterHashtable @{LogName='System'; Id=1074,6005,6008,41; StartTime=(Get-Date).AddDays(-10)} -ErrorAction SilentlyContinue
  if (-not $ev) { W "   (khong doc duoc Event Log)" }
  else {
    foreach ($e in ($ev | Sort-Object TimeCreated -Descending | Select-Object -First 24)) {
      $mo = switch ($e.Id) {
        1074 { 'TAT   - ' + (($e.Message -split 'The process ')[-1] -split ' \(')[0] }
        6005 { 'BAT   - Event log khoi dong' }
        6008 { 'TAT DOT NGOT - lan truoc khong tat dung cach (mat dien?)' }
        41   { 'MAT DIEN / treo - kernel power 41' }
      }
      W ("   {0:dd/MM HH:mm}  {1}" -f $e.TimeCreated, $mo)
    }
  }

  W ""
  Write-Host "   --- SPOOLER + MAY IN ---" -ForegroundColor Cyan
  $sv = Get-Service Spooler
  W ("   Spooler  : {0}, khoi dong kieu {1}" -f $sv.Status, (Get-CimInstance Win32_Service -Filter "Name='Spooler'").StartMode)
  foreach ($p in Get-Printer) {
    $w = Get-CimInstance Win32_Printer | Where-Object { $_.Name -eq $p.Name }
    W ("   [{0}]  tt={1} shared={2} ({3}) offline={4} job={5}" -f $p.Name, $p.PrinterStatus, $p.Shared, $p.ShareName, $w.WorkOffline, $p.JobCount)
  }

  W ""
  Write-Host "   --- NGU / THUC / WAKE-ON-LAN ---" -ForegroundColor Cyan
  powercfg /a | Where-Object { $_ -match 'available|Hibernate|Standby|Fast' } | Select-Object -First 6 | ForEach-Object { W ("   " + $_.Trim()) }
  foreach ($ad in (Get-NetAdapter | Where-Object { $_.Status -eq 'Up' })) {
    $pm = Get-NetAdapterPowerManagement -Name $ad.Name -ErrorAction SilentlyContinue
    if ($pm) { W ("   {0}: WakeOnMagicPacket={1} | TatDeTietKiemDien={2}" -f $ad.Name, $pm.WakeOnMagicPacket, $pm.AllowComputerToTurnOffDevice) }
    else     { W ("   {0}: card mang KHONG khai bao muc dien (co the khong ho tro WoL)" -f $ad.Name) }
  }
  W ""
  if ($ChiDoc) { W "   (-ChiDoc: dung o day, KHONG sua gi)"; exit 0 }
  Read-Host "   Doc xong. Bam Enter de BAT DAU SUA (Ctrl+C de thoat, khong sua gi)"
  W ""
  Write-Host "  == BAT DAU SUA ==" -ForegroundColor Cyan
}

# =================================================================================================
#  PHAN 2 - SUA
# =================================================================================================

# --- 1. NGUON: may dang bat thi dung bao gio tu ngu -------------------------------------------
#  CHI AP KHI CAI TAY, va toi da MOT LAN MOI NGAY o che do -Chua. Ban dau ap moi luot: task chay 2
#  phut/lan nen 720 lan/ngay goi powercfg + sc.exe + Set-NetAdapterPowerManagement. Do that 10:34-10:42
#  ngay 21/08/2026 tren may in: so ghi lai y het nhau moi 2 phut, va nghi ngo chinh cu dung vao card
#  mang moi luot la thu lam dut mang trong choc lat (agent bao "fetch failed" dung luc vua cai xong).
#  Nhung viec RE nhu "spooler con chay khong", "may in co bi Offline khong" thi van chay moi luot.
$mocNgay = Join-Path $DIR '.co-cho-ngay.txt'
$homNay  = (Get-Date).ToString('yyyy-MM-dd')
$mocCu   = ''
try { if (Test-Path $mocNgay) { $mocCu = ([string](Get-Content $mocNgay -TotalCount 1)).Trim() } } catch {}
$apNang  = (-not $Chua) -or ($mocCu -ne $homNay)
if ($apNang) { try { Set-Content -Path $mocNgay -Value $homNay -Encoding ASCII } catch {} }

if ($apNang) {
$bo = @(
  @('/setacvalueindex','SUB_SLEEP','STANDBYIDLE','0'),   @('/setdcvalueindex','SUB_SLEEP','STANDBYIDLE','0'),
  @('/setacvalueindex','SUB_SLEEP','HIBERNATEIDLE','0'), @('/setdcvalueindex','SUB_SLEEP','HIBERNATEIDLE','0'),
  @('/setacvalueindex','SUB_SLEEP','RTCWAKE','1'),       @('/setdcvalueindex','SUB_SLEEP','RTCWAKE','1')
)
if ($laLaptop) { $bo += ,@('/setdcvalueindex','SUB_BATTERY','BATACTIONCRIT','2') }
foreach ($c in $bo) { & powercfg.exe $c[0] SCHEME_CURRENT $c[1] $c[2] $c[3] 2>$null | Out-Null }
# powercfg chi GHI vao ban mo ta scheme; phai /setactive thi ban DANG CHAY moi nhan.
& powercfg.exe /setactive SCHEME_CURRENT 2>$null | Out-Null
OK "Nguon: khong tu ngu, khong tu ngu dong, cho phep hen gio danh thuc"
}

# --- 2. FAST STARTUP: tat -----------------------------------------------------------------------
#  Fast Startup lam may "tat" thuc ra la ngu dong mot phan. Hai he qua deu xau cho may nay:
#  Wake-on-LAN tu trang thai TAT thuong khong hoat dong, va driver may in doi khi khong nap lai dung.
$hb = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power'
if ((Get-ItemProperty $hb -Name HiberbootEnabled -ErrorAction SilentlyContinue).HiberbootEnabled -ne 0) {
  Set-ItemProperty $hb -Name HiberbootEnabled -Value 0 -Type DWord
  OK "Tat Fast Startup (de Wake-on-LAN chay duoc tu trang thai tat)"
} else { TT "Fast Startup da tat tu truoc" }

# --- 3. SPOOLER BAT TU --------------------------------------------------------------------------
# Cai nay RE, chay moi luot: spooler chet la moi thu phia sau vo nghia.
if ((Get-Service Spooler).Status -ne 'Running') { Start-Service Spooler; OK "Bat lai Print Spooler (dang dung)" }
if ($apNang) {
  Set-Service -Name Spooler -StartupType Automatic
  # sc.exe failure: chet lan 1/2/3 deu tu bat lai sau 5 giay, bo dem loi ve 0 sau 1 ngay.
  # Khong co dong nay thi spooler chet mot lan la nam luon toi khi co nguoi de y.
  & sc.exe failure Spooler reset= 86400 actions= restart/5000/restart/5000/restart/5000 | Out-Null
  OK "Spooler: khoi dong Automatic + tu bat lai 3 lan neu chet"
}

# --- 4. MAY IN LUON O TRANG THAI SAN SANG -------------------------------------------------------
foreach ($p in (Get-Printer | Where-Object { $_.Name -match 'PE200' })) {
  $w = Get-CimInstance Win32_Printer | Where-Object { $_.Name -eq $p.Name } | Select-Object -First 1
  if ($w -and $w.WorkOffline) { $w.WorkOffline = $false; Set-CimInstance -InputObject $w; OK "[$($p.Name)] bo co Use Printer Offline" }
  if ($p.PrinterStatus -eq 'Paused') { Invoke-CimMethod -InputObject $w -MethodName Resume | Out-Null; OK "[$($p.Name)] go TAM DUNG cho queue" }
  if (-not $p.Shared) { Set-Printer -Name $p.Name -Shared $true; OK "[$($p.Name)] bat lai chia se (may tram in qua share nay)" }
  # Viec in DA LOI ma nam qua 15 phut thi don. Chi don cai da loi - don theo tuoi don thuan la mat
  # tem cua nguoi ta ma khong ai biet.
  foreach ($j in (Get-PrintJob -PrinterName $p.Name -ErrorAction SilentlyContinue)) {
    if (((Get-Date) - $j.SubmittedTime).TotalMinutes -gt 15 -and ([string]$j.JobStatus) -match 'Error|Blocked|Offline|PaperOut') {
      Remove-PrintJob -InputObject $j; OK "[$($p.Name)] don viec in mac #$($j.Id) ($($j.JobStatus))"
    }
  }
}

# --- 5. MANG: Private + Wake-on-LAN -------------------------------------------------------------
foreach ($c in (Get-NetConnectionProfile | Where-Object { $_.IPv4Connectivity -ne 'Disconnected' })) {
  if ($c.NetworkCategory -eq 'Public') {
    Set-NetConnectionProfile -InterfaceIndex $c.InterfaceIndex -NetworkCategory Private
    OK "Doi '$($c.InterfaceAlias)' tu Public sang Private (mang Public chan chia se may in)"
  }
}
# CARD MANG: CHI dung toi khi cai tay. Do that 21/08/2026 tren may in - dat xong doc lai VAN thay
# WakeOnMagicPacket khac 'Enabled', nghia la card khong nhan; ma may nay chay WI-FI, va Wake-on-LAN
# tu trang thai TAT HAN qua Wi-Fi thi gan nhu khong bao gio chay (card Wi-Fi khong duoc cap dien o
# S5). Nen: thu MOT lan, khong duoc thi noi thang va thoi - dung dung vao card moi 2 phut, vi moi cu
# dung la mot lan card reset, mang dut trong choc lat.
if ($apNang) {
  foreach ($ad in (Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and -not $_.Virtual })) {
    $pm = Get-NetAdapterPowerManagement -Name $ad.Name -ErrorAction SilentlyContinue
    if (-not $pm) { continue }
    $doi = $false
    if ($pm.WakeOnMagicPacket -ne 'Enabled')            { $pm.WakeOnMagicPacket = 'Enabled'; $doi = $true }
    # "Cho phep may tat card nay de tiet kiem dien" = card ngu thi khong nghe duoc goi danh thuc.
    if ($pm.AllowComputerToTurnOffDevice -ne 'Disabled') { $pm.AllowComputerToTurnOffDevice = 'Disabled'; $doi = $true }
    if (-not $doi) { continue }
    Set-NetAdapterPowerManagement -InputObject $pm -ErrorAction SilentlyContinue
    $lai = Get-NetAdapterPowerManagement -Name $ad.Name -ErrorAction SilentlyContinue
    if ($lai -and $lai.WakeOnMagicPacket -eq 'Enabled') { OK "[$($ad.Name)] bat Wake-on-LAN (magic packet)" }
    else { XX "[$($ad.Name)] KHONG bat duoc Wake-on-LAN (card khong ho tro, hoac la card Wi-Fi) -> chi con trong vao BIOS 'Restore on AC Power Loss'" }
  }
}

# --- 6. AGENT IN TEM CHAY NGAY TREN MAY NAY -----------------------------------------------------
#  DAY LA MUC QUAN TRONG NHAT, va la ly do bo co cho nay khac han ban chay tren laptop.
#  Truoc 21/08/2026: agent nhat lenh chay tren LAPTOP roi in qua may in share => laptop tat la khong
#  ai in duoc, du may nay bat va may in san sang. Nay agent chay ngay tren may nay:
#      MAY NAY BAT  =  moi luot gui in deu ra tem, KHONG phu thuoc laptop.
#  Agent la tien trinh nen (node), khong can cua so, khong can ai dang nhap - task chay bang SYSTEM
#  goi no duoc. No in bang winspool tren may in NOI BO nen quyen SYSTEM la du.
$fMay   = Join-Path $DIR '.agent-may-in.txt'
$fLogAg = Join-Path $DIR '.in-tem-agent.log'
$vbsAg  = Join-Path $DIR '_AGENT-IN-TEM-AN.vbs'

function TimNode {
  # Uu tien node.exe di kem goi (may nay khong cai Node), roi moi toi node trong PATH.
  $kem = Join-Path (Split-Path -Parent $DIR) 'node.exe'
  if (Test-Path $kem) { return $kem }
  $c = Get-Command node -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  return ''
}
$node = TimNode

if (-not $Chua) {
  # 6a. CHOT TEN MAY IN. May nay co HAI queue cung ten chua "PE200" (USB031 va USB003) - de agent tu
  #     doan la co ngay no chon nham cai cong khong co may. Thu MO thu tung cai bang chinh duong ma
  #     agent se dung (_IN-RAW.ps1 -ChiMo: mo roi dong handle, KHONG tao viec in, khong ton tem).
  $chot = ''
  foreach ($p in (Get-Printer | Where-Object { $_.Name -match 'PE200' } | Sort-Object { $_.Name -notmatch 'Copy' })) {
    $kq = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $DIR '_IN-RAW.ps1') -File 'x' -ChiMo -Printer $p.Name 2>$null
    W ("   thu mo [{0}] -> {1}" -f $p.Name, ($kq -join ' '))
    if ("$kq" -match 'OK mo') { $chot = $p.Name; break }
  }
  if ($chot) { Set-Content -Path $fMay -Value $chot -Encoding ASCII; OK "Chot may in cho agent: $chot" }
  else { XX "Khong mo duoc queue PE200 nao - agent se tu do, kiem tra lai may in" }

  # 6b. HAI THU AGENT KHONG CHAY DUOC NEU THIEU: node va .env (APPSCRIPT_URL + APPSCRIPT_KEY).
  if (-not $node) { XX "KHONG THAY NODE: thieu node.exe di kem goi va may nay cung chua cai Node -> agent khong chay duoc" }
  else { OK "Node: $node" }
  $fEnv = Join-Path $DIR '.env'
  if (-not (Test-Path $fEnv)) { XX "THIEU file .env (APPSCRIPT_URL + APPSCRIPT_KEY) - agent khong goi duoc hang doi" }
  elseif (-not ((Get-Content $fEnv -Raw) -match 'APPSCRIPT_URL')) { XX ".env khong co APPSCRIPT_URL" }
  else { OK "Da co .env" }

  # 6c. MAY NAY CO RA INTERNET KHONG - hang doi nam tren Apps Script cua Google.
  try {
    $r = Invoke-WebRequest -Uri 'https://script.google.com/' -Method Head -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop
    OK "Ra duoc script.google.com (HTTP $($r.StatusCode)) - goi duoc hang doi"
  } catch {
    XX "KHONG ra duoc script.google.com: $($_.Exception.Message)"
    XX "  -> agent tren may nay se khong nhat duoc lenh. Kiem tra mang/proxy truoc khi cai tiep."
  }
}

# 6d. AGENT CON SONG KHONG - va co TRA LOI khong (hai chuyen khac nhau). So dung im qua 12 phut
#     trong khi tien trinh van con = treo -> giet, dung lai. Agent ghi so it nhat moi ~5 phut.
$pidAg = 0
$ps = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -like '*in-tem-agent*' }
if ($ps) { $pidAg = [int]($ps | Select-Object -First 1).ProcessId }
if ($pidAg -gt 0 -and (Test-Path $fLogAg)) {
  $tre = ((Get-Date) - (Get-Item $fLogAg).LastWriteTime).TotalSeconds
  if ($tre -gt 720) {
    try { Stop-Process -Id $pidAg -Force -ErrorAction Stop; OK "Giet agent TREO (pid $pidAg, so dung im $([int]($tre/60)) phut)"; $pidAg = 0 } catch {}
  }
}
if ($pidAg -le 0 -and $node -and (Test-Path $vbsAg)) {
  # Goi dung cai vo ma watchdog van goi - no da co chot chong chay trung. Dung duong khoi dong rieng
  # o day la mo lai bay "hai agent cung nhat lenh -> tem in doi".
  Start-Process -FilePath "$env:SystemRoot\System32\wscript.exe" -ArgumentList "`"$vbsAg`"" -WindowStyle Hidden -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 3
  $ps2 = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
         Where-Object { $_.CommandLine -like '*in-tem-agent*' }
  if ($ps2) { OK "Khoi dong agent in tem (pid $(($ps2 | Select-Object -First 1).ProcessId))" }
  else { XX "Goi agent roi ma khong thay tien trinh - xem $fLogAg" }
} elseif ($pidAg -gt 0 -and -not $Chua) { OK "Agent in tem dang chay (pid $pidAg)" }

# --- 7. TASK TU CHUA, CHAY BANG SYSTEM ----------------------------------------------------------
#  Chay bang SYSTEM + trigger AtStartup la mau chot: may nay KHONG can ai dang nhap thi may in van
#  san sang - spooler la dich vu, con agent la tien trinh nen. Ca hai deu khong doi phien nguoi dung.
$tenTask = 'Co cho may in tem'
$act = New-ScheduledTaskAction -Execute 'powershell.exe' `
       -Argument ("-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$DIR\_CO-CHO-MAY-IN.ps1`" -Chua")
$tgBoot = New-ScheduledTaskTrigger -AtStartup
$tgLap  = New-ScheduledTaskTrigger -Once -At (Get-Date).Date `
          -RepetitionInterval (New-TimeSpan -Minutes 2) -RepetitionDuration (New-TimeSpan -Days 3650)
$set = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
       -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew
$prin = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
# Chi dang ky khi cai TAY. Che do -Chua chay moi 2 phut, dang ky lai moi luot la ghi de task dang
# chay boi chinh no - vua thua vua de sinh chuyen.
if (-not $Chua) {
  Register-ScheduledTask -TaskName $tenTask -Action $act -Trigger @($tgBoot, $tgLap) -Settings $set -Principal $prin -Force | Out-Null
  OK "Task '$tenTask' - chay bang SYSTEM khi khoi dong may + moi 2 phut (khong can ai dang nhap)"
}

if ($daSua.Count) { GhiSo ('SUA: ' + ($daSua -join ' | ')) }
if ($daKen.Count) { GhiSo ('CANH: ' + ($daKen -join ' | ')) }

# --- 8. NHIP TIM DOC DUOC TU MAY KHAC -----------------------------------------------------------
#  May nay chua mo WinRM nen tu laptop khong hoi duoc "agent con song khong". Nhung task SYSTEM o day
#  chay moi 2 phut, va thu muc goi doc duoc qua SMB - nen cho no tu ghi mot dong trang thai. Do la
#  con mat duy nhat nhin duoc vao may nay ma khong phai xin them quyen gi.
#  Ghi ca khi CHAY TAY (de nguoi cai cung thay), file tu cat con 200 dong.
$nhip = Join-Path $DIR '_nhip.txt'
$agPid = 0
$q = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
     Where-Object { $_.CommandLine -like '*in-tem-agent*' }
if ($q) { $agPid = [int]($q | Select-Object -First 1).ProcessId }
$agTre = -1
if (Test-Path $fLogAg) { $agTre = [int]((Get-Date) - (Get-Item $fLogAg).LastWriteTime).TotalSeconds }
$mIn = Get-Printer -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'PE200' } | Select-Object -First 1
$spool = (Get-Service Spooler -ErrorAction SilentlyContinue).Status

#  MANG: chay khi co file co `_CHAN-DOAN-MANG.txt` trong thu muc (tao/xoa tu xa qua SMB de bat/tat).
#  Khong de chay mai: moi luot la mot lan phan giai DNS + mot cu HTTPS, 2 phut mot lan ca ngay la thua.
$mang = ''
if (Test-Path (Join-Path $DIR '_CHAN-DOAN-MANG.txt')) {
  $dns = ''; $tcp = ''; $http = ''
  try { $dns = (([Net.Dns]::GetHostAddresses('script.google.com') | Select-Object -First 2).IPAddressToString) -join ',' } catch { $dns = 'HONG: ' + $_.Exception.Message }
  try {
    $c = New-Object Net.Sockets.TcpClient
    $r = $c.BeginConnect('script.google.com', 443, $null, $null)
    $tcp = if ($r.AsyncWaitHandle.WaitOne(6000, $false)) { $c.EndConnect($r); 'mo' } else { 'QUA HAN' }
    $c.Close()
  } catch { $tcp = 'HONG: ' + $_.Exception.Message }
  try { $http = 'HTTP ' + (Invoke-WebRequest -Uri 'https://script.google.com/' -Method Head -TimeoutSec 15 -UseBasicParsing -ErrorAction Stop).StatusCode }
  catch { $http = 'HONG: ' + ($_.Exception.Message -replace '\s+', ' ') }
  $px = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue)
  $mang = " | dns=$dns tcp443=$tcp $http proxy=$($px.ProxyEnable)/$($px.ProxyServer)$($px.AutoConfigURL)"
}

$dongCuoi = ''
try { if (Test-Path $fLogAg) { $dongCuoi = ' | agentLog: ' + (([IO.File]::ReadAllLines($fLogAg, [Text.Encoding]::UTF8) | Select-Object -Last 1) -replace '\s+', ' ') } } catch {}
# Ghi luon HANG + MODEL + kieu card mang: tu laptop khong hoi duoc WMI cua may nay, ma khong biet
# hang thi khong noi duoc buoc BIOS cho dung ten muc (moi hang goi mot kieu).
$card = (Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' -and -not $_.Virtual } |
         Select-Object -First 1)
# Ghi luon TAI KHOAN dang chay task va TAI KHOAN so huu tien trinh agent. Day la bang chung cho cau
# hoi "may co mat khau dang nhap thi in co bi gian doan khong": neu ca hai deu la SYSTEM thi duong in
# khong dinh dang gi toi phien nguoi dung - man hinh khoa hay chua ai dang nhap deu in duoc.
$toiLa = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$agChu = ''
if ($q) { try { $o = Invoke-CimMethod -InputObject ($q | Select-Object -First 1) -MethodName GetOwner -ErrorAction Stop; $agChu = ($o.Domain + '\' + $o.User) } catch { $agChu = '?' } }
Add-Content -Path $nhip -Encoding UTF8 -Value (
  "[{0}] {1} {2} | card={3} ({4}) | task chay boi={5} | agent={6} chu={7} soTre={8}s mayIn={9}/{10}job spooler={11}{12}{13}" -f `
  (Get-Date).ToString('HH:mm:ss dd/MM'), $cs.Manufacturer, $cs.Model,
  $(if ($card) { $card.Name } else { '?' }), $(if ($card) { $card.InterfaceDescription } else { '?' }),
  $toiLa, $(if ($agPid) { "pid $agPid" } else { 'KHONG CHAY' }), $agChu,
  $agTre, $(if ($mIn) { $mIn.PrinterStatus } else { 'khong thay' }), $(if ($mIn) { $mIn.JobCount } else { '?' }),
  $spool, $mang, $dongCuoi)
try {
  if ((Get-Item $nhip).Length -gt 200KB) { Set-Content -Path $nhip -Value (Get-Content $nhip -Tail 200) -Encoding UTF8 }
} catch {}

# GUONG NHIP TIM ra C:\Users\Public - cho duy nhat may khac doc duoc qua SMB. Sau khi goi chuyen sang
# C:\AuditFactory thi khong con duong nao nhin vao may nay tu xa nua, ma hai loi that hom nay (card
# mang reset, canh bao khong vao so) deu la nho nhin tu xa moi thay. Guong CHI CO TRANG THAI, khong
# co khoa/bi mat gi; con xoa luon email trong dong so agent cho chac.
try {
  $dongCuoiNhip = (Get-Content $nhip -Tail 1)
  $dongCuoiNhip = [regex]::Replace($dongCuoiNhip, '[\w\.\-]+@[\w\.\-]+', '<nguoi>')
  Add-Content -Path 'C:\Users\Public\_nhip-mayin.txt' -Encoding UTF8 -Value $dongCuoiNhip
  if ((Get-Item 'C:\Users\Public\_nhip-mayin.txt').Length -gt 200KB) {
    Set-Content -Path 'C:\Users\Public\_nhip-mayin.txt' -Value (Get-Content 'C:\Users\Public\_nhip-mayin.txt' -Tail 200) -Encoding UTF8
  }
} catch {}

# --- 8c. CHUYEN GOI SANG C:\AuditFactory ---------------------------------------------------------
#  Bat bang file co `_CHUYEN.txt`. Ly do phai chuyen: goi dang nam trong C:\Users\Public - cho ma
#  Everyone co Full Control - ma trong goi co .env chua APPSCRIPT_KEY.
#  Lam bang task SYSTEM chu khong bat nguoi dung tu keo tha: SYSTEM co du quyen, va thu tu cac buoc
#  RAT DE SAI (xoa thu muc cu truoc khi task tro sang cho moi = tu ban vao chan).
#  Thu tu an toan: chep -> DOI TASK -> DOC LAI TASK de xac nhan -> siet quyen -> giet agent cu ->
#  moi xoa thu muc cu. Buoc nao truot thi DUNG, khong xoa gi ca.
if (Test-Path (Join-Path $DIR '_CHUYEN.txt')) {
  $bc = New-Object System.Collections.ArrayList
  function CG($s) { [void]$bc.Add($s) }          # dat ten 2 chu: `R`/`C`... de trung alias san co
  $goc  = Split-Path -Parent $DIR                # goi hien tai (thu muc chua node.exe)
  $dich = 'C:\AuditFactory'
  CG "=== CHUYEN GOI - $(Get-Date -Format 'HH:mm:ss dd/MM/yyyy') - chay boi $toiLa ==="
  CG "goc : $goc"
  CG "dich: $dich"

  if ($goc -ieq $dich) {
    CG "[OK] Da nam dung cho roi, khong phai lam gi."
  } else {
    Set-Location 'C:\'                            # dung dung chan len thu muc sap xoa
    $rc = 0
    & robocopy $goc $dich /E /R:1 /W:1 /XF '_CHUYEN.txt' /NFL /NDL /NJH /NJS /NP | Out-Null
    $rc = $LASTEXITCODE
    CG "robocopy rc=$rc  (0-7 la thanh cong)"

    $canCo = @('node.exe', 'hasaki\in-tem-agent.mjs', 'hasaki\_CO-CHO-MAY-IN.ps1', 'hasaki\.env',
               'hasaki\_AGENT-IN-TEM-AN.vbs', 'hasaki\_IN-RAW.ps1', 'factory\index.html')
    $thieu = @($canCo | Where-Object { -not (Test-Path (Join-Path $dich $_)) })
    if ($rc -ge 8 -or $thieu.Count) {
      CG "[!!] CHEP CHUA DU - DUNG LAI, khong dong vao gi them. Thieu: $($thieu -join ', ')"
    } else {
      CG "[OK] chep du $($canCo.Count) file moc"
      $dirMoi = Join-Path $dich 'hasaki'
      $act2 = New-ScheduledTaskAction -Execute 'powershell.exe' `
              -Argument ("-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$dirMoi\_CO-CHO-MAY-IN.ps1`" -Chua")
      $tg1 = New-ScheduledTaskTrigger -AtStartup
      $tg2 = New-ScheduledTaskTrigger -Once -At (Get-Date).Date `
             -RepetitionInterval (New-TimeSpan -Minutes 2) -RepetitionDuration (New-TimeSpan -Days 3650)
      $st2 = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
             -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew
      $pr2 = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
      Register-ScheduledTask -TaskName 'Co cho may in tem' -Action $act2 -Trigger @($tg1, $tg2) `
        -Settings $st2 -Principal $pr2 -Force | Out-Null

      # DOC LAI task: chi khi no that su tro sang duong dan moi thi moi dam xoa thu muc cu.
      $kt = (Get-ScheduledTask -TaskName 'Co cho may in tem' -ErrorAction SilentlyContinue).Actions.Arguments
      if ("$kt" -like "*$dich*") {
        CG "[OK] task da tro sang: $kt"

        # Siet quyen: bo Users/Everyone khoi thu muc moi (day la ly do cua ca viec chuyen).
        # BAY DA CAN 13:00 21/08/2026: ban dau viet
        #     icacls ... /inheritance:r /grant 'SYSTEM:(OI)(CI)F' /grant 'Administrators:(OI)(CI)F'
        # -> tu do task khong chay nua. `/inheritance:r` BO SACH quyen ke thua NGAY, con phan /grant
        # thi phu thuoc TEN NHOM (doi theo ngon ngu Windows) nen co the truot im lang -> thu muc
        # thanh khong ai doc noi, ke ca SYSTEM. Nay: CAP QUYEN TRUOC bang SID (khong dinh ngon ngu),
        # DOC LAI de xac nhan, roi MOI bo ke thua. Sai o buoc nao thi giu nguyen ke thua cu.
        #   *S-1-5-18 = NT AUTHORITY\SYSTEM   |   *S-1-5-32-544 = BUILTIN\Administrators
        # THU TU RAT QUAN TRONG - lam sai la khoa chet chinh minh (da khoa that luc 13:00 21/08/2026):
        #   1. cap o GOC bang SID, loai KE THUA XUONG (OI)(CI)
        #   2. `<goc>\* /reset /T` : TRA KE THUA cho tat ca file con de chung nhan quyen tu goc
        #   3. `/inheritance:r` CHI o GOC : chan quyen thua tu C:\ (bo Users) - dung muc dich
        #   4. DOC THU mot file de xac nhan; khong doc duoc thi TRA LAI ke thua ngay
        # Ban dau viet `/inheritance:r ... /T` -> tat ke thua o TUNG FILE CON, ma quyen cap o goc lai
        # la loai ke thua xuong => file con co DACL RONG, khong ai mo noi ke ca SYSTEM. Nhin `icacls`
        # o goc van thay dep, nen mat gan mot tieng moi tim ra.
        try {
          & icacls.exe $dich /grant '*S-1-5-18:(OI)(CI)F' /C | Out-Null
          & icacls.exe $dich /grant '*S-1-5-32-544:(OI)(CI)F' /C | Out-Null
          & icacls.exe "$dich\*" /reset /T /C | Out-Null
          & icacls.exe $dich /inheritance:r /C | Out-Null
          $thu = Join-Path $dich 'hasaki\_CO-CHO-MAY-IN.ps1'
          $docDuoc = $false
          try { [void][IO.File]::ReadAllBytes($thu); $docDuoc = $true } catch {}
          if ($docDuoc) { CG "[OK] siet quyen: chi SYSTEM + Administrators doc/ghi duoc (.env khong con lo) - da doc thu file de xac nhan" }
          else {
            & icacls.exe $dich /inheritance:e /C | Out-Null
            & icacls.exe "$dich\*" /reset /T /C | Out-Null
            CG "[!!] siet quyen xong thi KHONG doc duoc file -> da TRA LAI ke thua. Thu muc van chay, chi la chua siet."
          }
        } catch { CG "[!!] khong siet duoc quyen: $($_.Exception.Message)" }

        foreach ($a in @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
                         Where-Object { $_.CommandLine -like '*in-tem-agent*' })) {
          try { Stop-Process -Id $a.ProcessId -Force -ErrorAction Stop; CG "[OK] dung agent cu pid $($a.ProcessId) (luot task ke tiep se dung lai tu cho moi)" } catch {}
        }
        Start-Sleep -Seconds 3
        try {
          Remove-Item $goc -Recurse -Force -ErrorAction Stop
          CG "[OK] da xoa thu muc cu $goc"
        } catch {
          CG "[!!] chua xoa duoc thu muc cu ($($_.Exception.Message)) - khong sao, xoa tay sau. Task da tro sang cho moi roi."
        }
      } else {
        CG "[!!] DOI TASK KHONG AN (van la: $kt) - GIU NGUYEN thu muc cu, khong xoa gi."
      }
    }
  }
  CG "=== HET ==="
  # Bao cao ghi ra C:\Users\Public - cho duy nhat may khac con doc duoc sau khi goi da di.
  Set-Content -Path 'C:\Users\Public\_CHUYEN-KETQUA.txt' -Value $bc -Encoding UTF8
  Remove-Item (Join-Path $DIR '_CHUYEN.txt') -Force -ErrorAction SilentlyContinue
}

# --- 8b. QC MOT LUOT ------------------------------------------------------------------------------
#  Bat bang cach tao file `_QC.txt` trong thu muc hasaki (tao duoc tu xa qua SMB). Luot chay ke tiep
#  cua task SYSTEM se soi TOAN BO duong in tem tren may nay roi ghi ra `_QC-KETQUA.txt` va tu xoa co.
#  Vi sao lam kieu nay: may nay chua mo WinRM nen tu laptop khong chay duoc lenh; nhung task SYSTEM
#  chay san moi 2 phut, con thu muc thi doc/ghi duoc qua SMB - muon tay ngay do lam QC ho.
if (Test-Path (Join-Path $DIR '_QC.txt')) {
  $r = New-Object System.Collections.ArrayList
  function QG($s) { [void]$r.Add($s) }
  QG "==================================================================="
  QG " QC DUONG IN TEM TU DONG - $env:COMPUTERNAME - $(Get-Date -Format 'HH:mm:ss dd/MM/yyyy')"
  QG " chay boi: $toiLa"
  QG "==================================================================="

  QG ""
  QG "--- A. TIEN TRINH AGENT (node chay ngam) ---"
  $ags = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
           Where-Object { $_.CommandLine -like '*in-tem-agent*' })
  if ($ags.Count -eq 0) { QG "  [!!] KHONG CO agent nao dang chay" }
  elseif ($ags.Count -gt 1) { QG "  [!!] CO $($ags.Count) AGENT CUNG CHAY -> nguy co in doi. pid: $(($ags.ProcessId) -join ', ')" }
  else { QG "  [OK] dung 1 agent" }
  foreach ($a in $ags) {
    $o = try { $x = Invoke-CimMethod -InputObject $a -MethodName GetOwner -ErrorAction Stop; "$($x.Domain)\$($x.User)" } catch { '?' }
    $t = try { [int]((Get-Date) - $a.CreationDate).TotalMinutes } catch { -1 }
    QG "       pid $($a.ProcessId) | chu=$o | song $t phut"
    QG "       lenh: $($a.CommandLine)"
  }
  $tatCaNode = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue)
  QG "  node.exe tren may (moi loai): $($tatCaNode.Count)"

  QG ""
  QG "--- B. TASK TU CHAY ---"
  $tk = Get-ScheduledTask -TaskName 'Co cho may in tem' -ErrorAction SilentlyContinue
  if (-not $tk) { QG "  [!!] KHONG THAY task 'Co cho may in tem'" }
  else {
    $ti = $tk | Get-ScheduledTaskInfo
    QG "  [OK] trang thai=$($tk.State) | chay bang=$($tk.Principal.UserId) ($($tk.Principal.LogonType))"
    QG "       lan cuoi=$($ti.LastRunTime) ket qua=$($ti.LastTaskResult) | lan toi=$($ti.NextRunTime)"
    $coBoot = $false
    foreach ($g in $tk.Triggers) {
      $ten = $g.CimClass.CimClassName
      if ($ten -eq 'MSFT_TaskBootTrigger') { $coBoot = $true }
      QG "       trigger: $ten $(if($g.Repetition.Interval){'lap '+$g.Repetition.Interval})"
    }
    if ($coBoot) { QG "  [OK] CO trigger khi KHOI DONG MAY -> khong can ai dang nhap" }
    else { QG "  [!!] THIEU trigger khoi dong may -> bat may len agent se khong tu chay" }
  }

  QG ""
  QG "--- C. SPOOLER + MAY IN ---"
  $sv = Get-Service Spooler -ErrorAction SilentlyContinue
  $svc = Get-CimInstance Win32_Service -Filter "Name='Spooler'" -ErrorAction SilentlyContinue
  QG "  Spooler: $($sv.Status) | khoi dong=$($svc.StartMode)"
  if ($sv.Status -ne 'Running') { QG "  [!!] spooler khong chay" }
  QG "  tu bat lai khi chet:"
  foreach ($l in (& sc.exe qfailure Spooler 2>&1 | Where-Object { $_ -match 'RESTART|RESET_PERIOD|FAILURE_ACTIONS' })) { QG "       $($l.Trim())" }
  foreach ($p in (Get-Printer -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'PE200' })) {
    $w = Get-CimInstance Win32_Printer -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq $p.Name } | Select-Object -First 1
    QG "  [$($p.Name)] tt=$($p.PrinterStatus) cong=$($p.PortName) shared=$($p.Shared) offline=$($w.WorkOffline) loi=$($w.DetectedErrorState) job=$($p.JobCount)"
    foreach ($j in (Get-PrintJob -PrinterName $p.Name -ErrorAction SilentlyContinue)) {
      QG "       [!!] job ket #$($j.Id) $($j.JobStatus) $([int](((Get-Date)-$j.SubmittedTime).TotalMinutes)) phut"
    }
  }
  $chot = ''
  if (Test-Path $fMay) { $chot = ([string](Get-Content $fMay -TotalCount 1)).Trim() }
  QG "  may in da chot cho agent: '$chot'"
  if (-not $chot) { QG "  [!!] chua chot ten may in" }
  else {
    $mo = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $DIR '_IN-RAW.ps1') -File 'x' -ChiMo -Printer $chot 2>&1
    QG "  thu MO may in (khong ton tem): $($mo -join ' ')"
    if ("$mo" -notmatch 'OK mo') { QG "  [!!] khong mo duoc may in bang dung duong agent dung" }
  }

  QG ""
  QG "--- D. MOI TRUONG AGENT ---"
  $nodeQC = TimNode
  QG "  node: $nodeQC"
  if ($nodeQC) { QG "  phien ban: $(& $nodeQC -v 2>&1)" } else { QG "  [!!] khong thay node" }
  $fEnvQC = Join-Path $DIR '.env'
  if (Test-Path $fEnvQC) {
    $en = Get-Content $fEnvQC -Raw
    QG "  .env: co APPSCRIPT_URL=$([bool]($en -match 'APPSCRIPT_URL\s*=\s*\S')) co APPSCRIPT_KEY=$([bool]($en -match 'APPSCRIPT_KEY\s*=\s*\S'))"
  } else { QG "  [!!] THIEU .env" }
  $fHtml = Join-Path (Split-Path -Parent $DIR) 'factory\index.html'
  if (Test-Path $fHtml) {
    # Doc thang ca file roi .Contains(): `Select-String -SimpleMatch -Quiet` bao KHONG THAY trong khi
    # muc E ngay duoi dung tem thanh cong tu chinh file do (QC 12:50 21/08/2026) - mot canh bao GIA
    # con te hon khong canh bao, vi lan sau se khong ai tin bang QC nua.
    $coMoc = ([IO.File]::ReadAllText($fHtml, [Text.Encoding]::UTF8)).Contains('/*<PR-TEM>*/')
    QG "  factory\index.html: $([int]((Get-Item $fHtml).Length/1KB)) KB | moc PR-TEM=$coMoc | sua luc $((Get-Item $fHtml).LastWriteTime)"
    if (-not $coMoc) { QG "  [!!] khong thay moc PR-TEM -> agent se thoat ngay luc khoi dong" }
  } else { QG "  [!!] THIEU factory\index.html" }
  $o2 = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" -ErrorAction SilentlyContinue
  QG "  o C: con trong $([int]($o2.FreeSpace/1GB)) GB"

  QG ""
  QG "--- E. DUNG THU MOT CON TEM (che do --thu: dung anh roi bo, KHONG in) ---"
  if ($nodeQC) {
    $t0 = Get-Date
    # Dat console ve UTF-8 truoc khi goi node, khong thi chu tieng Viet cua agent ra thanh rac trong
    # bao cao QC (da thay o luot 12:50 21/08/2026) - bao cao doc khong noi thi bao cao de lam gi.
    $encCu = [Console]::OutputEncoding
    try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
    $ra = & $nodeQC (Join-Path $DIR 'in-tem-agent.mjs') --thu '422430797x2' 2>&1
    try { [Console]::OutputEncoding = $encCu } catch {}
    QG "  mat $([int]((Get-Date)-$t0).TotalSeconds)s"
    foreach ($l in ($ra | Select-Object -Last 8)) { QG "       $l" }
    if ("$ra" -match 'chua g|byte') { QG "  [OK] dung duoc tem (sharp + loi PR-TEM chay tot)" } else { QG "  [!!] dung tem HONG" }
  }

  QG ""
  QG "--- F. MANG RA HANG DOI (Apps Script) ---"
  try { QG "  DNS script.google.com -> $((([Net.Dns]::GetHostAddresses('script.google.com')|Select-Object -First 2).IPAddressToString) -join ',')" } catch { QG "  [!!] DNS hong: $($_.Exception.Message)" }
  try { QG "  HTTPS -> HTTP $((Invoke-WebRequest -Uri 'https://script.google.com/' -Method Head -TimeoutSec 15 -UseBasicParsing).StatusCode)" } catch { QG "  [!!] HTTPS hong: $($_.Exception.Message)" }

  QG ""
  QG "--- G. SO AGENT: co dau hieu hong lap lai khong ---"
  if (Test-Path $fLogAg) {
    $ln = [IO.File]::ReadAllLines($fLogAg, [Text.Encoding]::UTF8)
    $loi = @($ln | Where-Object { $_ -match 'LOI|fetch failed|khong g' })
    QG "  so dong: $($ln.Count) | dong loi: $($loi.Count)"
    foreach ($l in ($loi | Select-Object -Last 5)) { QG "       $l" }
    QG "  5 dong cuoi:"
    foreach ($l in ($ln | Select-Object -Last 5)) { QG "       $l" }
  } else { QG "  [!!] khong thay so agent" }

  QG ""
  QG "--- H. NGUON / TU BAT LAI ---"
  foreach ($m in @(@('SUB_SLEEP','STANDBYIDLE','tu ngu'), @('SUB_SLEEP','HIBERNATEIDLE','tu ngu dong'), @('SUB_SLEEP','RTCWAKE','hen gio danh thuc'))) {
    $d2 = & powercfg /q SCHEME_CURRENT $m[0] $m[1] 2>$null | Select-String 'Current AC Power Setting Index'
    QG "  $($m[2]): $(if($d2){([string]$d2).Split(':')[-1].Trim()}else{'an tren may nay'})"
  }
  $hb2 = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power' -Name HiberbootEnabled -ErrorAction SilentlyContinue).HiberbootEnabled
  QG "  Fast Startup: $(if($hb2 -eq 0){'da TAT (dung)'}else{'CON BAT (!!)'})"
  QG "  BIOS AC BACK / Resume by Alarm: KHONG doc duoc tu Windows tren bo mach nay - phai vao BIOS xem."
  QG "  10 lan bat/tat gan nhat:"
  foreach ($e2 in (Get-WinEvent -FilterHashtable @{LogName='System'; Id=1074,6005,6008,41; StartTime=(Get-Date).AddDays(-7)} -ErrorAction SilentlyContinue | Sort-Object TimeCreated -Descending | Select-Object -First 10)) {
    $mo2 = switch ($e2.Id) { 1074 {'TAT   '} 6005 {'BAT   '} 6008 {'TAT DOT NGOT'} 41 {'MAT DIEN/treo'} }
    QG "       $($e2.TimeCreated.ToString('dd/MM HH:mm'))  $mo2"
  }

  QG ""
  QG "=== HET QC ==="
  Set-Content -Path (Join-Path $DIR '_QC-KETQUA.txt') -Value $r -Encoding UTF8
  Remove-Item (Join-Path $DIR '_QC.txt') -Force -ErrorAction SilentlyContinue
}

# --- 9. BIOS: THU DAT TU DONG TRUOC KHI BAT NGUOI VAO F2 ----------------------------------------
#  KHONG phai may nao cung dat duoc BIOS tu Windows. Chi cac hang co "BIOS WMI" moi cho:
#     HP     : root\hp\instrumentedBIOS  (HP_BIOSSettingInterface.SetBIOSSetting)
#     Lenovo : root\wmi  (Lenovo_SetBiosSetting + Lenovo_SaveBiosSettings)
#     Dell   : can Dell Command | Configure (cctk.exe) cai san - khong co WMI san
#  Bo mach pho thong (Asus/Gigabyte/MSI/Intel...) KHONG co duong nao: phai bam F2.
#  Neu may co mat khau BIOS thi lenh tra ma loi - noi thang chu khong im lang coi nhu xong.
#
#  Hai thiet lap can dat, va ten cua chung moi hang goi mot kieu nen phai DO tim theo mau chu:
#     (a) co dien vao la may tu bat : "After Power Loss" / "AC Power Recovery" / "AC Recovery"
#     (b) danh thuc qua mang        : "Wake On LAN" / "Wake on LAN Power" / "PME"
$biosXong = $false
if (-not $Chua) {
  W ""
  Write-Host "   --- THU DAT BIOS TU DONG ---" -ForegroundColor Cyan

  # ---- HP ----
  $hpIf = Get-CimInstance -Namespace 'root\hp\instrumentedBIOS' -ClassName HP_BIOSSettingInterface -ErrorAction SilentlyContinue
  if ($hpIf) {
    $ds = Get-CimInstance -Namespace 'root\hp\instrumentedBIOS' -ClassName HP_BIOSEnumeration -ErrorAction SilentlyContinue
    foreach ($m in @(@('After Power Loss|AC Power Recovery|Power Loss', '^(Power On|On)$'),
                     @('Wake On LAN|Wake-On LAN',                        '^(Boot to Hard Drive|Enable|Enabled|Boot to Network)$'))) {
      $s = $ds | Where-Object { $_.Name -match $m[0] } | Select-Object -First 1
      if (-not $s) { XX "BIOS: khong thay muc khop '$($m[0])'"; continue }
      $v = @($s.PossibleValues) | Where-Object { $_ -match $m[1] } | Select-Object -First 1
      if (-not $v) { XX "BIOS [$($s.Name)]: khong co gia tri khop (dang co: $($s.PossibleValues -join ', '))"; continue }
      if ($s.CurrentValue -eq $v) { TT "BIOS [$($s.Name)] da la '$v'"; $biosXong = $true; continue }
      $r = Invoke-CimMethod -InputObject $hpIf -MethodName SetBIOSSetting -Arguments @{ Name = $s.Name; Value = $v; Password = '<utf-16/>' } -ErrorAction SilentlyContinue
      if ($r -and $r.Return -eq 0) { OK "BIOS [$($s.Name)] = '$v'  (co hieu luc sau lan khoi dong toi)"; $biosXong = $true }
      else { XX "BIOS [$($s.Name)]: dat khong duoc (ma $($r.Return)) - thuong la may co MAT KHAU BIOS" }
    }
  }

  # ---- Lenovo ----
  $lenSet = Get-CimInstance -Namespace 'root\wmi' -ClassName Lenovo_SetBiosSetting -ErrorAction SilentlyContinue
  if ($lenSet) {
    $ds = Get-CimInstance -Namespace 'root\wmi' -ClassName Lenovo_BiosSetting -ErrorAction SilentlyContinue
    $doi = $false
    foreach ($m in @(@('AfterPowerLoss|ACPowerRecovery', 'Power On'), @('WakeOnLAN', 'Enable'))) {
      $s = $ds | Where-Object { ($_.CurrentSetting -split ',')[0] -match $m[0] } | Select-Object -First 1
      if (-not $s) { XX "BIOS: khong thay muc khop '$($m[0])'"; continue }
      $ten = ($s.CurrentSetting -split ',')[0]
      $r = Invoke-CimMethod -InputObject $lenSet -MethodName SetBiosSetting -Arguments @{ parameter = "$ten,$($m[1])" } -ErrorAction SilentlyContinue
      if ($r -and $r.return -eq 'Success') { OK "BIOS [$ten] = '$($m[1])'"; $doi = $true }
      else { XX "BIOS [$ten]: dat khong duoc ($($r.return)) - thuong la may co MAT KHAU BIOS" }
    }
    if ($doi) {
      $sv = Get-CimInstance -Namespace 'root\wmi' -ClassName Lenovo_SaveBiosSettings -ErrorAction SilentlyContinue
      $r = Invoke-CimMethod -InputObject $sv -MethodName SaveBiosSettings -Arguments @{ parameter = '' } -ErrorAction SilentlyContinue
      if ($r -and $r.return -eq 'Success') { OK "BIOS: da LUU (co hieu luc sau lan khoi dong toi)"; $biosXong = $true }
      else { XX "BIOS: dat duoc nhung LUU khong duoc - vao F2 luu tay" }
    }
  }

  # ---- Dell (can Dell Command | Configure) ----
  if ($cs.Manufacturer -match 'Dell') {
    $cctk = @("${env:ProgramFiles(x86)}\Dell\Command Configure\X86_64\cctk.exe",
              "$env:ProgramFiles\Dell\Command Configure\X86_64\cctk.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($cctk) {
      foreach ($c in @('--AcPwrRcvry=On', '--WakeOnLan=LanOnly')) {
        $o = & $cctk $c 2>&1
        if ("$o" -match 'is set to|successfully') { OK "BIOS $c"; $biosXong = $true } else { XX "BIOS $c -> $o" }
      }
    } else {
      XX "May Dell nhung chua cai 'Dell Command | Configure' -> khong dat BIOS tu Windows duoc, phai bam F2."
    }
  }

  if (-not $biosXong) {
    XX "KHONG dat duoc BIOS tu Windows tren may nay - lam tay theo huong dan ngay duoi."
  }
}

# =================================================================================================
#  PHAN 3 - VIEC PHAI LAM TRONG BIOS
# =================================================================================================
if (-not $Chua) {
  $mac = (Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and -not $_.Virtual } | Select-Object -First 1).MacAddress
  W ""
  Write-Host "  ============================================================" -ForegroundColor Yellow
  if ($biosXong) { Write-Host "   BIOS: DA DAT DUOC TU WINDOWS o muc 9 - phan duoi chi de DOI CHIEU" -ForegroundColor Green }
  else           { Write-Host "   CON MOT VIEC PHAI LAM TRONG BIOS (may nay khong dat duoc tu Windows)" -ForegroundColor Yellow }
  Write-Host "  ============================================================" -ForegroundColor Yellow
  W "   May TAT HAN thi khong con dong ma nao cua Windows chay - chi BIOS nghe duoc cu cam dien"
  W "   va goi danh thuc qua mang. Khoi dong lai, bam F2 (hoac Del) vao BIOS Setup:"
  W ""
  if ($laLaptop) {
    W "     | Power > Wake on AC        = Enabled    -> cam sac vao la may tu bat"
    W "     | Power > Auto On Time      = Everyday 07:15"
  } elseif ($cs.Manufacturer -match 'Gigabyte') {
    # Bo mach Gigabyte goi ten KHAC han cac hang khac - do that 21/08/2026 tren Gigabyte H97-D3H.
    # Ai di tim chu "Restore on AC Power Loss" tren bo mach nay se khong bao gio thay.
    W "   >>> Bo mach GIGABYTE $($cs.Model): vao BIOS bang phim  Del  (khong phai F2)."
    W ""
    W "     | BIOS Features / Power Management > AC BACK       = Always On"
    W "       (3 lua chon: Memory / Always On / Always Off - PHAI chon Always On)"
    W "       -> CO DIEN VAO LA MAY TU BAT. Day dung la thu dang can."
    W "     | Power Management > ErP                            = Disabled"
    W "       -> ErP=Enabled thi bo mach cat sach dien cho, AC BACK va hen gio deu chet theo."
    W "     | Power Management > Resume by Alarm                = Enabled"
    W "         Every Day, 07:15:00   -> sang nao may cung tu bat, khong can ai cham vao."
  } else {
    W "     | Power > Restore on AC Power Loss / AC Recovery = Power On"
    W "       (BIOS khac goi khac: 'After Power Failure', Gigabyte goi 'AC BACK = Always On',"
    W "        ASRock goi 'Restore on AC/Power Loss' -> chon 'Power On', KHONG chon 'Last State')"
    W "       -> co dien vao la may TU BAT. Day dung la thu dang can."
    W "     | Power > Auto Power On / RTC Alarm / Resume by Alarm = Everyday 07:15   (neu BIOS co)"
    W "     | Neu BIOS co ERP / EuP Ready = Enabled thi TAT no di - no cat dien cho khi may tat."
  }
  # Wake-on-LAN chi noi khi card mang THAT SU nghe duoc. Card Wi-Fi (nhat la USB) khong duoc cap dien
  # luc may tat -> khuyen bat WoL o day chi lam nguoi ta mat cong vao BIOS tim mot muc vo dung.
  if ($card -and $card.InterfaceDescription -notmatch 'Wireless|Wi-?Fi|WLAN|802\.11') {
    W "     | Power > Wake on LAN / PME / 'Power On by PCI-E'   = Enabled"
    W "       -> may tram gui goi danh thuc toi MAC $mac la may nay tu bat."
  } else {
    W ""
    W "   Card mang cua may nay la WI-FI ($($card.InterfaceDescription)) -> Wake-on-LAN KHONG dung"
    W "   duoc (card khong co dien luc may tat). Nen 'AC BACK / Resume by Alarm' o tren la duong DUY"
    W "   NHAT bat duoc may nay khi no da tat. Muon co them WoL thi phai cam day mang."
  }
  W ""
  W "   F10 luu va thoat. Thu: tat may han, rut dien 10 giay, cam lai -> may phai tu bat."
  W ""
  Write-Host "   MAC cua may nay: $mac" -ForegroundColor Cyan
  W "   May tram da hoc MAC nay tu bang ARP, khong phai go tay. Kiem tra ben may tram:"
  W "     type `"C:\Users\lechitam\New folder\hasaki\.co-cho-mayin-mac.txt`""
  W ""
  W "   HOAN TAC neu can:"
  W "     Unregister-ScheduledTask -TaskName '$tenTask' -Confirm:`$false"
  W "     sc.exe failure Spooler reset= 0 actions= none"
  W "     Set-ItemProperty '$hb' -Name HiberbootEnabled -Value 1"
  W ""
  Read-Host "   Bam Enter de dong"
}
