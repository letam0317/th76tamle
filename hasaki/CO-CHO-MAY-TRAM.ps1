# ================================================================================================
#  CO-CHO-MAY-TRAM.ps1 — CÒ CHỜ PHÍA LAPTOP (HSK-KHO170-TAML)
#  ----------------------------------------------------------------------------------------------
#  ĐỌC CÁI NÀY TRƯỚC: từ 21/08/2026 agent nhặt lệnh in đã CHUYỂN SANG CHẠY TRÊN CHÍNH MÁY CẮM MÁY IN
#  (Desktop-JE75K38) — xem `CO-CHO-MAY-IN.md` và `_CO-CHO-MAY-IN.ps1`. Chốt: **máy in bật là mọi lượt
#  gửi in đều ra tem, không phụ thuộc laptop này.** File này vì vậy KHÔNG còn nằm trên đường tới hạn;
#  nó còn hai việc: (a) đánh thức máy in bằng Wake-on-LAN, (b) giữ agent DỰ PHÒNG trên laptop sống
#  (`pr_lay` bên GAS chạy trong LockService nên hai agent không bao giờ in đôi).
#  ----------------------------------------------------------------------------------------------
#  VÌ SAO CÓ FILE NÀY — dựng lại từ log sáng 21/08/2026, không phỏng đoán:
#    · 00:32:17  máy trạm TẮT (Event 1074, shutdown.exe, tài khoản lechitam — thói quen tắt cuối
#                ngày; 10 ngày trước đó cũng tắt mỗi chiều, 12:26 → 18:07).
#    · 07:57:35 · 07:57:56 · 07:59:07 · 08:43:34 · 08:46:20 — NĂM lệnh in nằm lại trong hàng đợi GAS.
#    · 09:00:31  máy bật lại → 09:01:24 agent lên → 09:01:43…09:02:27 in hết cả năm lệnh trong 44 giây.
#    Kết luận: đường in KHÔNG hỏng chỗ nào. Máy trạm tắt thì agent tắt theo (task chạy kiểu
#    Interactive — không có phiên đăng nhập là không chạy), nên dashboard chỉ còn đúng một câu để
#    nói: "máy trạm chưa sẵn sàng" — và nó đúng suốt hơn một tiếng.
#
#  BA TẦNG CỦA CÒ CHỜ (file này là tầng ② và ③; tầng ① nằm trong BIOS — xem CO-CHO-MAY-IN.md):
#    ① BIOS "Wake on AC" / "Auto On Time": thứ DUY NHẤT bật được máy đang tắt hẳn (S5). Windows không
#       có cách nào làm việc này — máy tắt thì không còn dòng mã nào của mình chạy để nghe cắm sạc.
#    ② Task "Factory co cho may tram" bắt SỰ KIỆN (cắm/rút sạc · thức dậy · đăng nhập) + lặp 2 phút,
#       nên không phải chờ tới nhịp 5 phút của task agent.
#    ③ Chính file này: mỗi lượt tự chữa những thứ làm "máy in chưa sẵn sàng" DÙ máy trạm đang bật —
#       agent chết hoặc treo, spooler dừng, kết nối máy in bị Offline/Paused, việc in mắc trong queue.
#
#  KHÔNG hỏi máy chủ in (-ComputerName) ở đây: lượt hỏi đó mất 8-10 giây khi bên kia tắt, mà tầng này
#  chạy mỗi 2 phút. Hỏi trạng thái tươi là việc của agent (_MAY-IN-SERVER.ps1) — file này chỉ lo phần
#  BÊN NÀY: cái gì hỏng trên máy trạm thì sửa, không giẫm sang việc của agent.
#
#  Chạy tay để xem nó làm gì:  powershell -ExecutionPolicy Bypass -File CO-CHO-MAY-TRAM.ps1
#  Chạy nền (Task Scheduler):  wscript CO-CHO-MAY-TRAM-AN.vbs
# ================================================================================================
param(
  [switch]$Am,        # chỉ ghi log, không in ra màn hình (Task Scheduler dùng)
  [switch]$EpNguon    # ép áp lại toàn bộ cài đặt nguồn ngay lượt này (bình thường 1 lần/ngày)
)

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$DIR       = Split-Path -Parent $MyInvocation.MyCommand.Path
$LOG       = Join-Path $DIR '.co-cho.log'
$TRANG     = Join-Path $DIR '.co-cho.json'
$GHIM      = Join-Path $DIR '.co-cho-mayin.txt'
$MOC_NGUON = Join-Path $DIR '.co-cho-nguon.txt'
$MAC_MC    = Join-Path $DIR '.co-cho-mayin-mac.txt'   # "<ip> <mac>" của máy chủ in, tự học từ ARP
$MOC_WOL   = Join-Path $DIR '.co-cho-wol.txt'
$MOC_MCLOI = Join-Path $DIR '.co-cho-mcloi.txt'      # số lượt LIỀN NHAU không gọi được máy chủ in
$LOG_AGENT = Join-Path $DIR '.in-tem-agent.log'
$VBS_AGENT = Join-Path $DIR '_AGENT-IN-TEM-AN.vbs'

$daSua = New-Object System.Collections.ArrayList   # việc ĐÃ SỬA trong lượt này
$vande = New-Object System.Collections.ArrayList   # việc THẤY nhưng KHÔNG sửa được từ đây

function Ghi($s) {
  $d = (Get-Date).ToString('HH:mm:ss dd/MM/yyyy')
  try { Add-Content -Path $LOG -Value "[$d] $s" -Encoding UTF8 } catch {}
  if (-not $Am) { Write-Host "[$d] $s" }
}
function Sua($s) { [void]$daSua.Add($s) }
function Ken($s) { [void]$vande.Add($s) }

# Sổ log cắt ở 400KB — cò chờ chạy mỗi 2 phút, không cắt thì vài tháng nữa nó thành file khổng lồ mà
# 99% là dòng vô nghĩa.
try {
  if ((Test-Path $LOG) -and ((Get-Item $LOG).Length -gt 400KB)) {
    $giu = Get-Content $LOG -Tail 1500
    Set-Content -Path $LOG -Value $giu -Encoding UTF8
  }
} catch {}

# ------------------------------------------------------------------------------------------------
# 1. NGUỒN ĐIỆN — máy đang bật thì đừng bao giờ tự ngủ, và phải cho phép hẹn giờ đánh thức
# ------------------------------------------------------------------------------------------------
#  Đo 21/08/2026 trước khi sửa: STANDBYIDLE/HIBERNATEIDLE đã là 0 (tốt), nhưng RTCWAKE = 0 =
#  "Disable wake timers" — dù có hẹn giờ, máy đang ngủ cũng KHÔNG tự dậy. Đó là một cái cửa đóng im
#  lặng: task hẹn 07:00 vẫn hiện đủ trong Task Scheduler, chỉ là không bao giờ nổ.
#
#  Nắp máy: AC = không làm gì (đóng nắp vẫn chạy tiếp — đây là máy trạm, không phải máy xách đi),
#  DC = ngủ (rút điện mà gập nắp thì đúng là đang muốn mang đi thật).
#  Pin kiệt = HIBERNATE chứ không tắt: mất điện thì máy ngủ đông giữ nguyên phiên; có điện lại +
#  "Wake on AC" là dậy đúng chỗ đang đứng, không mất phiên WMS đang giữ.
function ApNguon {
  $bo = @(
    @('/setacvalueindex','SUB_SLEEP','STANDBYIDLE','0'),    @('/setdcvalueindex','SUB_SLEEP','STANDBYIDLE','0'),
    @('/setacvalueindex','SUB_SLEEP','HIBERNATEIDLE','0'),  @('/setdcvalueindex','SUB_SLEEP','HIBERNATEIDLE','0'),
    @('/setacvalueindex','SUB_SLEEP','RTCWAKE','1'),        @('/setdcvalueindex','SUB_SLEEP','RTCWAKE','1'),
    @('/setacvalueindex','SUB_BUTTONS','LIDACTION','0'),    @('/setdcvalueindex','SUB_BUTTONS','LIDACTION','1'),
    @('/setacvalueindex','SUB_BATTERY','BATACTIONCRIT','2'),@('/setdcvalueindex','SUB_BATTERY','BATACTIONCRIT','2')
  )
  foreach ($c in $bo) { & powercfg.exe $c[0] SCHEME_CURRENT $c[1] $c[2] $c[3] 2>$null | Out-Null }
  # powercfg chỉ GHI vào bản mô tả scheme; phải /setactive thì bản ĐANG CHẠY mới nhận. Thiếu dòng
  # này là cái bẫy kinh điển: query thấy đúng, hành vi vẫn cũ.
  & powercfg.exe /setactive SCHEME_CURRENT 2>$null | Out-Null
}
$homNay = (Get-Date).ToString('yyyy-MM-dd')
$mocCu  = ''
try { if (Test-Path $MOC_NGUON) { $mocCu = ([string](Get-Content $MOC_NGUON -TotalCount 1)).Trim() } } catch {}
if ($EpNguon -or ($mocCu -ne $homNay)) {
  ApNguon
  try { Set-Content -Path $MOC_NGUON -Value $homNay -Encoding ASCII } catch {}
  if ($mocCu -ne $homNay) { Sua 'áp lại cài đặt nguồn (không tự ngủ · cho phép hẹn giờ đánh thức · nắp AC không làm gì · pin kiệt thì ngủ đông)' }
}

# ------------------------------------------------------------------------------------------------
# 2. PRINT SPOOLER — dịch vụ này chết thì mọi thứ phía sau vô nghĩa
# ------------------------------------------------------------------------------------------------
try {
  $sv = Get-Service -Name Spooler -ErrorAction Stop
  if ($sv.Status -ne 'Running') {
    try { Start-Service -Name Spooler -ErrorAction Stop; Sua 'bật lại dịch vụ Print Spooler' }
    catch { Ken 'Print Spooler đang DỪNG mà không bật lại được (cần quyền Admin)' }
  }
} catch { Ken 'không đọc được dịch vụ Print Spooler' }

# ------------------------------------------------------------------------------------------------
# 3. KẾT NỐI MÁY IN TEM — còn không · có bị đặt Offline không · queue có bị Pause không
# ------------------------------------------------------------------------------------------------
#  Ba trạng thái dưới đây đều làm agent báo "đang chặn" trong khi máy trạm vẫn bật ngon lành, và cả
#  ba đều sửa được từ máy này mà không cần đụng tới máy chủ in.
$tenMay = ''
$ttMay  = ''
try {
  $p = Get-Printer -ErrorAction Stop | Where-Object { $_.Name -match 'PE200' } | Select-Object -First 1
  if ($p) {
    $tenMay = $p.Name
    $ttMay  = [string]$p.PrinterStatus
    # Ghim tên lại để lượt sau còn biết đường NỐI LẠI nếu kết nối biến mất (xoá nhầm, profile dựng
    # lại sau update). Không ghim thì mất kết nối là mất luôn manh mối.
    try { Set-Content -Path $GHIM -Value $tenMay -Encoding UTF8 } catch {}
  } else {
    $cu = ''
    try { if (Test-Path $GHIM) { $cu = ([string](Get-Content $GHIM -TotalCount 1)).Trim() } } catch {}
    if ($cu -like '\\*') {
      try { Add-Printer -ConnectionName $cu -ErrorAction Stop; $tenMay = $cu; Sua "nối lại máy in $cu" }
      catch { Ken "không thấy máy in PE200 và nối lại $cu cũng hỏng ($($_.Exception.Message))" }
    } else { Ken 'không thấy máy in nào tên chứa PE200 trên máy này' }
  }
} catch { Ken "không hỏi được danh sách máy in: $($_.Exception.Message)" }

if ($tenMay) {
  try {
    $w = Get-CimInstance Win32_Printer -ErrorAction Stop | Where-Object { $_.Name -eq $tenMay } | Select-Object -First 1
    if ($w) {
      # "Use Printer Offline": người bấm nhầm, hoặc Windows tự bật sau một lượt gửi hỏng. Sau đó mọi
      # lệnh in vào queue rồi nằm im — đúng kiểu hỏng im lặng đã làm mất buổi sáng 20/08.
      if ($w.WorkOffline) {
        try { $w.WorkOffline = $false; Set-CimInstance -InputObject $w -ErrorAction Stop; Sua 'bỏ cờ "Use Printer Offline"' }
        catch { Ken 'máy in đang bị đặt OFFLINE mà không gỡ được cờ' }
      }
      if ($ttMay -eq 'Paused') {
        try { Invoke-CimMethod -InputObject $w -MethodName Resume -ErrorAction Stop | Out-Null; Sua 'gỡ TẠM DỪNG cho queue máy in' }
        catch { Ken 'queue máy in đang TẠM DỪNG mà không gỡ được' }
      }
    }
  } catch {}

  # Việc in mắc trong queue: chỉ dọn cái ĐÃ LỖI và đã nằm quá 15 phút. Không dọn theo tuổi đơn thuần —
  # tem đang in dở cũng có tuổi, dọn nhầm là mất tem của người ta mà không ai biết.
  try {
    $now = Get-Date
    $js = Get-PrintJob -PrinterName $tenMay -ErrorAction SilentlyContinue
    foreach ($j in $js) {
      $tuoi = ($now - $j.SubmittedTime).TotalMinutes
      if ($tuoi -gt 15 -and ([string]$j.JobStatus) -match 'Error|Blocked|Offline|PaperOut') {
        try { Remove-PrintJob -InputObject $j -ErrorAction Stop; Sua "dọn việc in mắc #$($j.Id) ($($j.JobStatus), $([int]$tuoi) phút)" } catch {}
      }
    }
  } catch {}
}

# ------------------------------------------------------------------------------------------------
# 4. MÁY CHỦ IN (Desktop-je75k38) — máy in cắm USB vào MÁY ĐÓ, nó tắt là không ai in được
# ------------------------------------------------------------------------------------------------
#  Đường in tem cần HAI máy cùng bật: máy này (chạy agent) và máy đang cắm máy in. Log đêm 20/08 cho
#  thấy máy chủ in tắt từ ~23:26 (mỗi lượt agent khởi động lại đều báo "không gọi được máy chủ in"),
#  còn sáng 21/08 lượt hâm nóng đầu tiên mất 9,6 giây thay vì ~1 giây — dấu vết RPC lần đầu tới một
#  máy vừa khởi động xong.
#
#  Máy này không bật hộ máy khác được — trừ MỘT đường: WAKE-ON-LAN. Gói "magic packet" 102 byte gửi
#  UDP broadcast, card mạng bên kia nghe được cả khi Windows đã tắt, VỚI ĐIỀU KIỆN BIOS + driver card
#  mạng cho phép (bật bằng `_CO-CHO-MAY-IN.ps1` chạy trên chính máy đó). Chưa bật thì gói rơi vào hư
#  không — vô hại, không lỗi.
#
#  CHỈ đánh thức TRONG KHUNG 06:30–19:30, và tối đa 5 phút một lần. Không có khung giờ thì cứ 2 phút
#  một lần suốt đêm mình dựng dậy cái máy người ta vừa cố ý tắt — đó là phá, không phải chữa.
$mayChu = ''
$mcSong = $null
# Tách "\\MAY\Share" bằng thao tác chuỗi chứ không regex: một biểu thức đầy dấu \ là chỗ chắc chắn
# có ngày viết sai một dấu rồi im lặng không khớp gì cả.
if ($tenMay.StartsWith('\\')) { $mayChu = $tenMay.Substring(2).Split('\')[0] }

function MayChuSong($ten) {
  # THĂM CỔNG 445, KHÔNG PING. Đo thật 21/08/2026: lúc 09:38:07 ping trượt nên cò chờ gửi Wake-on-LAN,
  # trong khi chính máy đó nhận việc in bình thường lúc 09:39 — suýt thành "đánh thức" một máy đang
  # bật, và tệ hơn là ghi vào sổ một câu sai. ICMP trên laptop này chập chờn thật (Test-Connection
  # từng trả "Error due to lack of resources"). 445 là ĐÚNG đường mà lệnh in đi qua: nó trả lời được
  # thì mới thật là còn sống. Hai lượt cách nhau 2,5 giây để một cú hụt lẻ không bị kết tội.
  foreach ($lan in 1, 2) {
    try {
      $c = New-Object Net.Sockets.TcpClient
      $r = $c.BeginConnect($ten, 445, $null, $null)
      if ($r.AsyncWaitHandle.WaitOne(1500, $false)) {
        try { $c.EndConnect($r); $c.Close(); return $true } catch {}
      }
      $c.Close()
    } catch {}
    if ($lan -eq 1) { Start-Sleep -Milliseconds 2500 }
  }
  return $false
}

function GuiWol($mac) {
  # 6 byte 0xFF rồi 16 lần địa chỉ MAC — đúng khuôn magic packet.
  $b = [byte[]]($mac -split '[-:]' | ForEach-Object { [Convert]::ToByte($_, 16) })
  if ($b.Length -ne 6) { return $false }
  $goi = New-Object byte[] 102
  for ($i = 0; $i -lt 6; $i++) { $goi[$i] = 0xFF }
  for ($i = 0; $i -lt 16; $i++) { [Array]::Copy($b, 0, $goi, 6 + $i * 6, 6) }
  # Gửi cả broadcast giới hạn lẫn broadcast của từng subnet đang có: card mạng mỗi hãng nhận một kiểu,
  # và 255.255.255.255 không phải lúc nào cũng ra khỏi được adapter Wi-Fi.
  $dich = @('255.255.255.255')
  foreach ($ipc in (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
                    Where-Object { $_.PrefixLength -ge 8 -and $_.PrefixLength -le 30 -and $_.IPAddress -ne '127.0.0.1' })) {
    try {
      $a = ([Net.IPAddress]::Parse($ipc.IPAddress)).GetAddressBytes()
      $m = [uint32]([Math]::Pow(2, 32) - [Math]::Pow(2, 32 - $ipc.PrefixLength))
      $mb = [BitConverter]::GetBytes([uint32]$m); [Array]::Reverse($mb)
      $bc = New-Object byte[] 4
      for ($k = 0; $k -lt 4; $k++) { $bc[$k] = $a[$k] -bor (-bnot $mb[$k] -band 0xFF) }
      $dich += (New-Object Net.IPAddress(,$bc)).IPAddressToString
    } catch {}
  }
  $u = New-Object Net.Sockets.UdpClient
  $u.EnableBroadcast = $true
  $daGui = $false
  foreach ($d in ($dich | Select-Object -Unique)) {
    foreach ($cong in 9, 7) { try { [void]$u.Send($goi, $goi.Length, $d, $cong); $daGui = $true } catch {} }
  }
  $u.Close()
  return $daGui
}

if ($mayChu) {
  $mcSong = MayChuSong $mayChu
  if ($mcSong) {
    try { Remove-Item $MOC_MCLOI -ErrorAction SilentlyContinue } catch {}
    # Còn sống thì nhân tiện HỌC LẠI MAC từ bảng ARP — để lần sau nó tắt còn có cái mà đánh thức.
    # Học lúc nó sống là cách duy nhất: máy đã tắt thì ARP không còn dòng nào.
    try {
      $ip = ([Net.Dns]::GetHostAddresses($mayChu) | Where-Object { $_.AddressFamily -eq 'InterNetwork' } | Select-Object -First 1).IPAddressToString
      $nb = Get-NetNeighbor -IPAddress $ip -ErrorAction SilentlyContinue |
            Where-Object { $_.LinkLayerAddress -match '^([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}$' } | Select-Object -First 1
      if ($nb) {
        $dong = "$ip $($nb.LinkLayerAddress)"
        $cu = ''
        try { if (Test-Path $MAC_MC) { $cu = ([string](Get-Content $MAC_MC -TotalCount 1)).Trim() } } catch {}
        if ($cu -ne $dong) { Set-Content -Path $MAC_MC -Value $dong -Encoding ASCII; if ($cu) { Sua "máy chủ in đổi địa chỉ: $dong" } }
      }
    } catch {}
  } else {
    # Đếm số LƯỢT LIỀN NHAU không gọi được — cùng luật với agent (`_mcLoiLien >= 2` trong
    # in-tem-agent.mjs). Một lượt đơn lẻ có thể chỉ là cú hụt mạng; hai lượt liền (≈2 phút) mới đáng
    # gọi là "máy kia đang tắt". Đếm bằng file vì mỗi lượt cò chờ là một tiến trình mới.
    $mcLoi = 0
    try { if (Test-Path $MOC_MCLOI) { $mcLoi = [int]([string](Get-Content $MOC_MCLOI -TotalCount 1)).Trim() } } catch {}
    $mcLoi++
    try { Set-Content -Path $MOC_MCLOI -Value $mcLoi -Encoding ASCII } catch {}

    $gio = (Get-Date).TimeOfDay.TotalHours
    $trongKhung = ($gio -ge 6.5 -and $gio -le 19.5)
    $mac = ''
    try { if (Test-Path $MAC_MC) { $mac = (([string](Get-Content $MAC_MC -TotalCount 1)).Trim() -split '\s+')[-1] } } catch {}
    $duLau = $true
    try { if (Test-Path $MOC_WOL) { $duLau = ((Get-Date) - (Get-Item $MOC_WOL).LastWriteTime).TotalMinutes -ge 5 } } catch {}
    if ($mcLoi -lt 2) {
      # Lượt hụt đầu tiên: chưa kết luận gì, chưa ghi sổ. Lượt sau 2 phút nữa sẽ quyết.
    } elseif ($trongKhung -and $mac -and $duLau) {
      if (GuiWol $mac) {
        try { Set-Content -Path $MOC_WOL -Value (Get-Date).ToString('s') -Encoding ASCII } catch {}
        Sua "máy chủ in $mayChu không trả lời — đã gửi Wake-on-LAN tới $mac"
      }
    } elseif (-not $mac) {
      Ken "máy chủ in $mayChu không trả lời và CHƯA HỌC ĐƯỢC MAC (chỉ học được lúc nó đang bật) — không đánh thức được"
    } elseif (-not $trongKhung) {
      Ken "máy chủ in $mayChu đang tắt (ngoài khung 06:30-19:30 nên không đánh thức)"
    }
  }
}

# ------------------------------------------------------------------------------------------------
# 5. AGENT IN TEM — còn sống không, và có TRẢ LỜI không (hai chuyện khác nhau)
# ------------------------------------------------------------------------------------------------
#  Chỉ đếm tiến trình là chưa đủ: một agent treo (spooler bên kia sập, node kẹt I/O) vẫn còn trong
#  Task Manager mà không nhặt lệnh nào. Dấu hiệu đọc được: agent ghi sổ ít nhất mỗi ~5 phút ("hàng
#  đợi trống"). Sổ đứng im quá 12 phút trong khi tiến trình vẫn còn = treo → giết, dựng lại.
$pidAgent = 0
$treo = $false
try {
  $ps = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction Stop |
        Where-Object { $_.CommandLine -like '*in-tem-agent*' }
  if ($ps) { $pidAgent = [int]($ps | Select-Object -First 1).ProcessId }
} catch { Ken "không hỏi được tiến trình node: $($_.Exception.Message)" }

if ($pidAgent -gt 0 -and (Test-Path $LOG_AGENT)) {
  $treGiay = ((Get-Date) - (Get-Item $LOG_AGENT).LastWriteTime).TotalSeconds
  if ($treGiay -gt 720) {
    $treo = $true
    try {
      Stop-Process -Id $pidAgent -Force -ErrorAction Stop
      Sua "giết agent TREO (pid $pidAgent, sổ đứng im $([int]($treGiay/60)) phút)"
      $pidAgent = 0
    } catch { Ken "agent treo (pid $pidAgent) mà không giết được" }
  }
}

if ($pidAgent -le 0) {
  if (Test-Path $VBS_AGENT) {
    # Gọi đúng cái vỏ mà task "Factory agent in tem" vẫn gọi — nó đã có chốt chống chạy trùng, nên
    # hai tầng cùng gọi cũng chỉ ra MỘT agent. Dựng đường khởi động riêng ở đây là tự mở lại cái bẫy
    # "hai agent cùng nhặt lệnh → tem in đôi".
    try {
      Start-Process -FilePath "$env:SystemRoot\System32\wscript.exe" -ArgumentList "`"$VBS_AGENT`"" -WindowStyle Hidden -ErrorAction Stop
      Sua 'khởi động lại agent in tem'
    } catch { Ken "không khởi động được agent: $($_.Exception.Message)" }
  } else { Ken "thiếu file $VBS_AGENT" }
}

# ------------------------------------------------------------------------------------------------
# 6. GHI SỔ — im lặng khi mọi thứ bình thường
# ------------------------------------------------------------------------------------------------
#  Cò chờ chạy 720 lượt/ngày. Ghi mỗi lượt = sổ vô dụng. Luật: có SỬA gì hoặc có VẤN ĐỀ thì ghi ngay;
#  còn êm thì mỗi giờ một dòng nhịp tim cho biết cò chờ vẫn thức.
$batDau = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime
$tt = [ordered]@{
  luc       = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  bootLuc   = $batDau.ToString('yyyy-MM-dd HH:mm:ss')
  bootPhut  = [int]((Get-Date) - $batDau).TotalMinutes
  agentPid  = $pidAgent
  agentTreo = $treo
  mayIn     = $tenMay
  mayInTt   = $ttMay
  mayChu    = $mayChu
  mayChuSong= $mcSong
  daSua     = @($daSua)
  vanDe     = @($vande)
}
try { Set-Content -Path $TRANG -Value ($tt | ConvertTo-Json -Depth 4) -Encoding UTF8 } catch {}

if ($daSua.Count -or $vande.Count) {
  foreach ($s in $daSua) { Ghi "OK  $s" }
  foreach ($s in $vande) { Ghi "!!  $s" }
} else {
  $canGhi = $true
  try {
    if (Test-Path $LOG) { $canGhi = ((Get-Date) - (Get-Item $LOG).LastWriteTime).TotalMinutes -ge 60 }
  } catch {}
  if ($canGhi) { Ghi "·   êm — agent pid $pidAgent · máy in: $ttMay · máy bật được $($tt.bootPhut) phút" }
}
