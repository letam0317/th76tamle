# _TRANG-THAI-MAY-IN.ps1 — ĐỌC TÌNH TRẠNG THẬT CỦA MÁY IN TEM, TRẢ VỀ JSON.
#   powershell -File _TRANG-THAI-MAY-IN.ps1 [-Printer "<ten may in>"]
#
# VÌ SAO CẦN (sự cố 21/08/2026): máy in HẾT GIẤY mà dashboard không báo gì. Người dùng bấm ép in 4
# lần, lắp cuộn decal mới vẫn không ra tem, phải mở nắp máy rồi đóng lại mới in — và chỉ ra 3/5 con.
# Lý do đường in "im lặng": gửi RAW qua spooler thì `WritePrinter` trả về OK ngay khi SPOOLER nhận
# byte, hoàn toàn không liên quan tới việc máy in có giấy hay không. Muốn biết thì phải ĐI HỎI.
#
# Hỏi được ba nguồn, mỗi nguồn thấy một phần:
#   · Get-Printer          -> PrinterStatus (Normal/PaperOut/DoorOpen/Offline/PaperJam...) + JobCount
#   · Win32_Printer (WMI)  -> DetectedErrorState (4 = hết giấy, 7 = mở nắp, 8 = kẹt...), WorkOffline
#   · Get-PrintJob         -> từng việc in đang nằm trong queue + tuổi của nó (giây)
# Việc in nằm mãi trong queue là dấu hiệu chắc chắn nhất: nó nói "máy in KHÔNG rút dữ liệu ra nữa".
#
# ⚠ Giới hạn thật, đã kiểm: đây là máy in SHARE, ta chỉ đọc được trạng thái mà spooler bên kia CHỊU
#   nói ra. Máy in TSC còn có lệnh hỏi trạng thái riêng (`<ESC>!?` trả 1 byte: hết giấy / mở nắp /
#   kẹt) nhưng muốn đọc byte trả về thì phải nói chuyện TRỰC TIẾP với cổng USB — qua queue share thì
#   chỉ ghi được, không đọc lại được.

param([string]$Printer = '')
$ErrorActionPreference = 'SilentlyContinue'

if (-not $Printer) {
  $mi = Get-Printer | Where-Object { $_.Name -match 'PE200' } | Select-Object -First 1
  if ($mi) { $Printer = $mi.Name }
}
$o = [ordered]@{ may = $Printer; tt = ''; job = -1; err = -1; ext = -1; off = $false; eps = -1; js = @(); loi = '' }
if (-not $Printer) { $o.loi = 'khong thay may in nao ten chua PE200'; $o | ConvertTo-Json -Compress -Depth 4; exit 0 }

try {
  $p = Get-Printer -Name $Printer -ErrorAction Stop
  $o.tt = [string]$p.PrinterStatus
  $o.job = [int]$p.JobCount
} catch { $o.loi = 'Get-Printer: ' + $_.Exception.Message }

try {
  $w = Get-CimInstance Win32_Printer -ErrorAction Stop | Where-Object { $_.Name -eq $Printer } | Select-Object -First 1
  if ($w) {
    $o.err = [int]$w.DetectedErrorState
    $o.ext = [int]$w.ExtendedDetectedErrorState
    $o.off = [bool]$w.WorkOffline
    $o.eps = [int]$w.ExtendedPrinterStatus
  }
} catch { }

try {
  $now = Get-Date
  $o.js = @(Get-PrintJob -PrinterName $Printer -ErrorAction Stop | ForEach-Object {
    [ordered]@{ id = [int]$_.Id; st = [string]$_.JobStatus; byte = [int]$_.Size
      tuoi = [int]($now - $_.SubmittedTime).TotalSeconds }
  })
} catch { }

$o | ConvertTo-Json -Compress -Depth 4
