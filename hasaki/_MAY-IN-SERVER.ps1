# _MAY-IN-SERVER.ps1 — TIẾN TRÌNH POWERSHELL SỐNG LÂU, TRẢ LỜI "MÁY IN ĐANG SAO RỒI?"
#   powershell -File _MAY-IN-SERVER.ps1 [-Printer "<ten may in>"]
#   Giao thức: agent ghi MỘT DÒNG lệnh vào stdin, đọc JSON ở stdout rồi tới dòng mốc <<END>>.
#     TT      -> tinh trang may in (JSON)
#     PING    -> {"ok":1}
#     BYE     -> thoat
#   Hoi MOT LUOT bang tay (chan doan nhanh):  "TT" | powershell -File _MAY-IN-SERVER.ps1
#   (Ban mot-luot rieng `_TRANG-THAI-MAY-IN.ps1` da BO 21/08/2026: hai file cung doc mot thu roi troi
#    khac nhau la bay bao tri; ngoai ra ban do doc qua tien trinh moi nen mat 8-10s.)
#
# VÌ SAO PHẢI SỐNG LÂU (đo thật 21/08/2026, sau khi user báo trạng thái trễ 30s lúc tắt máy in và
# 120s lúc bật lại):
#   · Hỏi KẾT NỐI CỤC BỘ (`Get-Printer -Name "\\may\share"`) chỉ mất 27ms nhưng trả về BẢN CACHE của
#     Windows — chính cache đó gây ra 30s/120s.
#   · Hỏi thẳng MÁY CHỦ IN (`-ComputerName`) thì tươi, nhưng trong một tiến trình MỚI mất tới 8-10
#     giây: PowerShell phải nạp module PrintManagement và dựng phiên RPC lại từ đầu.
#   · Cùng lệnh đó trong phiên ĐÃ NÓNG: 129ms. Nên giữ một tiến trình sống và hỏi qua stdin — trả cái
#     giá khởi động MỘT LẦN.
# Đo lại sau khi làm: một lượt TT ~0,4s (may-chu 129ms + WMI 239ms + job 6ms).

param([string]$Printer = '')
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if (-not $Printer) {
  $mi = Get-Printer | Where-Object { $_.Name -match 'PE200' } | Select-Object -First 1
  if ($mi) { $Printer = $mi.Name }
}
# Tách "\\MAY\Share" một lần cho cả phiên.
$mayChu = ''; $share = ''
if ($Printer -match '^\\\\([^\\]+)\\(.+)$') { $mayChu = $Matches[1]; $share = $Matches[2] }

function DocTinhTrang {
  $o = [ordered]@{ may = $Printer; tt = ''; job = -1; err = -1; ext = -1; off = $false; eps = -1
    js = @(); nguon = ''; mcLoi = 0; loi = '' }
  if (-not $Printer) { $o.loi = 'khong thay may in nao ten chua PE200'; return $o }

  # 1. TRẠNG THÁI — hỏi máy chủ in trước (tươi), rơi về kết nối cục bộ nếu không gọi được.
  $p = $null
  if ($mayChu) {
    $p = Get-Printer -ComputerName $mayChu -Name $share -ErrorAction SilentlyContinue
    if ($p) { $o.nguon = 'may-chu' }
  }
  if (-not $p) {
    # KHONG goi duoc may chu in = mot tin hieu, khong phai chuyen nho: may tram tat / mat mang / spooler
    # ben kia chet. Bao ra bang co `mcLoi` roi roi ve ban cache — de tang tren tu quyet, dung im lang
    # dung so lieu cu (da can 21/08/2026: gui di roi nhan LOI StartDocPrinter 1722 vi may tram dang tat
    # ma probe van bao "san sang").
    if ($mayChu) { $o.mcLoi = 1 }
    $p = Get-Printer -Name $Printer -ErrorAction SilentlyContinue
    if ($p) { $o.nguon = 'cuc-bo' } else { $o.loi = 'khong hoi duoc Get-Printer' }
  }
  if ($p) { $o.tt = [string]$p.PrinterStatus; $o.job = [int]$p.JobCount }

  # 2. MÃ LỖI CỤ THỂ (hết giấy / mở nắp / kẹt) — chỉ WMI phía máy này nói được. Là bản cache nên chỉ
  #    dùng khi nó nói CÓ lỗi; trạng thái "không lỗi" thì tin theo máy chủ ở trên.
  $w = Get-CimInstance Win32_Printer -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq $Printer } | Select-Object -First 1
  if ($w) {
    $o.err = [int]$w.DetectedErrorState
    $o.ext = [int]$w.ExtendedDetectedErrorState
    $o.off = [bool]$w.WorkOffline
    $o.eps = [int]$w.ExtendedPrinterStatus
  }

  # 3. QUEUE — việc in nằm mãi trong queue là dấu hiệu chắc nhất "máy in không rút dữ liệu ra nữa".
  $now = Get-Date
  $js = if ($mayChu) { Get-PrintJob -ComputerName $mayChu -PrinterName $share -ErrorAction SilentlyContinue }
        else { Get-PrintJob -PrinterName $Printer -ErrorAction SilentlyContinue }
  $o.js = @($js | ForEach-Object {
    [ordered]@{ id = [int]$_.Id; st = [string]$_.JobStatus; byte = [int]$_.Size
      tuoi = [int]($now - $_.SubmittedTime).TotalSeconds }
  })
  return $o
}

# Hỏi một lượt ngay lúc khởi động: trả cái giá nạp module + dựng phiên RPC ở đây, trước khi có ai đợi.
DocTinhTrang | Out-Null
Write-Output 'SAN-SANG'
Write-Output '<<END>>'

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $line = $line.Trim()
  if ($line -eq 'BYE') { break }
  elseif ($line -eq 'PING') { Write-Output '{"ok":1}' }
  elseif ($line -eq 'TT') { Write-Output ((DocTinhTrang) | ConvertTo-Json -Compress -Depth 4) }
  elseif ($line -ne '') { Write-Output ('{"loi":"lenh la: ' + ($line -replace '"', "'") + '"}') }
  Write-Output '<<END>>'
}
