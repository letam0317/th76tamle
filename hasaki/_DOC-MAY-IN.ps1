# _DOC-MAY-IN.ps1 — CHI DOC, KHONG SUA GI TREN MAY NAY.
#
# Muc dich: doc ra dung 4 thu ma tu may khac khong lay duoc:
#   1. May in tem: ten, driver, cong (USB/COM/LAN), trang thai san sang
#   2. KHO GIAY dang set trong driver (PaperSize + kich thuoc thuc theo 0,1mm)
#   3. May in co Bluetooth / LAN khong (thiet bi + cong)
#   4. Danh sach form BarTender (.btw) + khu giay luu trong tung form + file du lieu Excel
#
# Script KHONG in thu, KHONG doi cai dat, KHONG gui gi ra internet.
# Ket qua ghi ra file "_ket-qua-doc-may-in.txt" ngay canh script.

$ErrorActionPreference = 'SilentlyContinue'
$out = Join-Path $PSScriptRoot '_ket-qua-doc-may-in.txt'
$L = New-Object System.Collections.Generic.List[string]
function W($s) { $L.Add([string]$s) }

W "=============================================================="
W " DOC CAU HINH IN TEM"
W " may: $env:COMPUTERNAME   user: $env:USERNAME   luc: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')"
W "=============================================================="

W ""
W "----- 1. MAY IN -----"
foreach ($p in Get-Printer) {
  W ("  [{0}]" -f $p.Name)
  W ("     driver : {0}" -f $p.DriverName)
  W ("     cong   : {0}" -f $p.PortName)
  W ("     trang thai: {0} | shared={1} | published={2} | job dang cho={3}" -f $p.PrinterStatus, $p.Shared, $p.Published, $p.JobCount)
  $w = Get-CimInstance Win32_Printer -Filter ("Name='" + ($p.Name -replace "'","''") + "'")
  if ($w) { W ("     WorkOffline={0} | PrinterStatus={1} | DetectedErrorState={2} | Default={3}" -f $w.WorkOffline, $w.PrinterStatus, $w.DetectedErrorState, $w.Default) }
  $cfg = Get-PrintConfiguration -PrinterName $p.Name
  if ($cfg) { W ("     KHO GIAY (driver): PaperSize={0} | huong={1} | mau={2} | 2 mat={3}" -f $cfg.PaperSize, $cfg.PaperOrientation, $cfg.Color, $cfg.DuplexingMode) }
  $pc = Get-CimInstance Win32_PrinterConfiguration -Filter ("Name='" + ($p.Name -replace "'","''") + "'")
  if ($pc) {
    $wmm = if ($pc.PaperWidth) { [math]::Round($pc.PaperWidth / 10, 1) } else { '?' }
    $hmm = if ($pc.PaperLength) { [math]::Round($pc.PaperLength / 10, 1) } else { '?' }
    W ("     KICH THUOC THUC: {0} x {1} mm  (PaperSize code={2}, dpi={3}x{4})" -f $wmm, $hmm, $pc.PaperSize, $pc.XResolution, $pc.YResolution)
  }
  W ""
}

W "----- 2. CONG IN (de biet USB / COM / LAN) -----"
foreach ($pt in Get-PrinterPort) {
  if ($pt.Name -match '^(COM|LPT|FILE|PORTPROMPT|SHRFAX)') { continue }
  W ("  {0,-42} {1} {2}" -f $pt.Name, $pt.Description, $(if ($pt.PrinterHostAddress) { "-> " + $pt.PrinterHostAddress + ":" + $pt.PortNumber } else { "" }))
}

W ""
W "----- 3. MAY IN CO BLUETOOTH / MANG KHONG -----"
W "  -- thiet bi Bluetooth tren may:"
$bt = Get-PnpDevice -Class Bluetooth | Where-Object { $_.Status -eq 'OK' }
if ($bt) { $bt | Select-Object -First 12 | ForEach-Object { W ("     {0}  [{1}]" -f $_.FriendlyName, $_.Status) } } else { W "     (khong co thiet bi Bluetooth nao dang chay)" }
W "  -- thiet bi co ten giong may in tem:"
$mi = Get-PnpDevice | Where-Object { $_.FriendlyName -match 'TSC|Zebra|Godex|Xprinter|PE200|TE200|label|printer' }
if ($mi) { $mi | Select-Object -First 15 | ForEach-Object { W ("     [{0}] {1}  ({2})" -f $_.Status, $_.FriendlyName, $_.Class) } } else { W "     (khong thay)" }
W "  -- cong COM ao (may in Bluetooth thuong hien ra day):"
$com = Get-PnpDevice -Class Ports | Where-Object { $_.Status -eq 'OK' }
if ($com) { $com | Select-Object -First 10 | ForEach-Object { W ("     {0}" -f $_.FriendlyName) } } else { W "     (khong co)" }

W ""
W "----- 4. BARTENDER + FORM TEM -----"
$bar = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' |
  Where-Object { $_.DisplayName -match 'BarTender|Seagull|NiceLabel' } | Select-Object -ExpandProperty DisplayName | Sort-Object -Unique
W ("  phan mem: {0}" -f ($(if ($bar) { $bar -join ' | ' } else { '(khong thay)' })))

$dirs = @("$env:USERPROFILE\Desktop", "$env:USERPROFILE\Documents", "$env:USERPROFILE\Downloads", 'C:\barcode', 'D:\barcode', 'D:\')
W "  -- form .btw tim thay (khu giay doc thang tu file):"
$n = 0
foreach ($d in $dirs) {
  if (-not (Test-Path $d)) { continue }
  foreach ($f in Get-ChildItem $d -Filter *.btw -Recurse -Depth 2 -File) {
    if ($n -ge 40) { break }
    $n++
    $head = ''
    try {
      $fs = [System.IO.File]::OpenRead($f.FullName)
      $buf = New-Object byte[] 4096
      $read = $fs.Read($buf, 0, 4096); $fs.Close()
      $head = [System.Text.Encoding]::ASCII.GetString($buf, 0, $read)
    } catch {}
    $pr = [regex]::Match($head, 'Printer: Name=([^;]+); Model=([^;]+)')
    $all = ''
    try { $all = [System.Text.Encoding]::ASCII.GetString([System.IO.File]::ReadAllBytes($f.FullName)) } catch {}
    $sz = [regex]::Match($all, '<TemplateSize>([^<]+)<')
    $ti = [regex]::Match($all, '<Title>([^<]*)')
    $mm = ''
    if ($sz.Success) {
      $m2 = [regex]::Match($sz.Groups[1].Value, '([\d.]+)" x ([\d.]+)"')
      if ($m2.Success) { $mm = "  => {0} x {1} mm" -f [math]::Round([double]$m2.Groups[1].Value * 25.4, 1), [math]::Round([double]$m2.Groups[2].Value * 25.4, 1) }
    }
    W ("     {0}" -f $f.FullName)
    W ("        sua {0} | {1}KB | may in={2} | kho={3}{4} | title={5}" -f $f.LastWriteTime.ToString('dd/MM/yyyy'), [math]::Round($f.Length/1KB,1),
        $(if ($pr.Success) { $pr.Groups[1].Value } else { '?' }), $(if ($sz.Success) { $sz.Groups[1].Value } else { '(khong luu)' }), $mm,
        $(if ($ti.Success) { $ti.Groups[1].Value } else { '' }))
  }
}
if ($n -eq 0) { W "     (khong thay file .btw nao trong cac thu muc da xem)" }

W "  -- file du lieu Excel dung de in (10 file moi nhat):"
$xl = foreach ($d in $dirs) { if (Test-Path $d) { Get-ChildItem $d -Include *.xls,*.xlsx,*.csv -Recurse -Depth 2 -File } }
$xl | Sort-Object LastWriteTime -Descending | Select-Object -First 10 | ForEach-Object {
  W ("     {0}  ({1}KB, {2})" -f $_.FullName, [math]::Round($_.Length/1KB,1), $_.LastWriteTime.ToString('dd/MM/yyyy'))
}

W ""
W "----- 5. MANG -----"
Get-NetIPConfiguration | Where-Object { $_.IPv4Address } | ForEach-Object {
  W ("  {0}: {1}/{2}" -f $_.InterfaceAlias, $_.IPv4Address.IPAddress, $_.IPv4Address.PrefixLength)
}
W ("  share cua may nay: {0}" -f ((Get-SmbShare | Where-Object { $_.Name -notmatch '\$' } | ForEach-Object { $_.Name + '=' + $_.Path }) -join ' | '))

W ""
W "=== HET ==="
$L -join "`r`n" | Out-File -FilePath $out -Encoding utf8
Write-Host ""
Write-Host "  Xong. Ket qua da ghi vao:" -ForegroundColor Green
Write-Host "  $out" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Khong co gi bi thay doi tren may nay (chi doc)." -ForegroundColor Gray
Write-Host ""
Start-Sleep -Seconds 2
