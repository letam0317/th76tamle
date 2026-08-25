# ================================================================================================
#  CAI-CO-CHO.ps1 — CÀI BỘ CÒ CHỜ CHO MÁY TRẠM (chạy 1 lần; chạy lại nhiều lần vô hại)
#  ----------------------------------------------------------------------------------------------
#  Cách chạy:  bấm đúp CAI-CO-CHO.bat  (tự xin quyền Admin — BẮT BUỘC có)
#  Đo 21/08/2026 trên chính máy này: tài khoản lechitam là Admin nhưng token bị UAC lọc, nên
#  Register-ScheduledTask không nâng quyền là "Access is denied" ngay cả với task của chính mình.
#  (Câu "KHÔNG cần quyền Admin" trong SETUP-PC-MOI.ps1 là sai với máy này — chớ tin.)
#
#  Cài bốn thứ, độc lập nhau, hỏng một cái không kéo theo cái khác:
#    ① CÀI ĐẶT NGUỒN — máy đang bật thì không bao giờ tự ngủ; cho phép hẹn giờ đánh thức (trước
#       21/08/2026 cửa này ĐANG ĐÓNG: RTCWAKE = 0, mọi hẹn giờ đều câm); đóng nắp khi cắm điện thì
#       chạy tiếp; pin kiệt thì NGỦ ĐÔNG chứ không tắt.
#    ② HAI TASK — "Factory co cho may tram" (đăng nhập · cắm/rút sạc · máy thức dậy · lặp 2 phút) và
#       "Factory co cho bat may sang" (06:50 hằng ngày, ĐƯỢC PHÉP ĐÁNH THỨC MÁY).
#    ③ TỰ ĐĂNG NHẬP WINDOWS — mắt xích bắt buộc: BIOS bật máy lúc 07:00 mà Windows dừng ở màn hình
#       khoá thì KHÔNG task nào chạy (cả 8 task nền của dự án đều kiểu Interactive), máy in vẫn "chưa
#       sẵn sàng" như thường. Mật khẩu cất bằng LSA secret (đúng cách Windows tự cất), không ghi
#       phơi ra registry.
#    ④ KHOÁ MÀN HÌNH KHI RẢNH — hệ quả bắt buộc của ③: máy tự đăng nhập thì phải tự khoá lại sau 5
#       phút không ai đụng. Agent/task vẫn chạy bình thường dưới màn hình khoá.
#
#  KHÔNG cài được từ đây: "Wake on AC" và "Auto On Time" nằm trong BIOS. Xem CO-CHO-MAY-IN.md §1.
# ================================================================================================
param(
  # Chạy không hỏi gì: chỉ làm ① cài đặt nguồn + ② hai task (hai thứ KHÔNG cần quyết định của người).
  # Mục ③ tự đăng nhập và ④ khoá màn hình luôn phải có người ngồi trước máy trả lời — bỏ qua ở đây.
  [switch]$KhongHoi
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "   CÒ CHỜ MÁY TRẠM — máy có điện là đường in tem sống lại" -ForegroundColor Cyan
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "   Máy: $env:COMPUTERNAME   Tài khoản: $env:USERNAME   Admin: $isAdmin"
Write-Host ""

# ------------------------------------------------------------------------------------------------
# ① CÀI ĐẶT NGUỒN — gọi thẳng cò chờ với -EpNguon, KHÔNG chép lại danh sách powercfg ra đây
# ------------------------------------------------------------------------------------------------
#  Chép lại là chắc chắn có ngày hai nơi trôi khác nhau rồi không ai biết bên nào đúng.
Write-Host "== ① Cài đặt nguồn ..." -ForegroundColor Cyan
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $DIR 'CO-CHO-MAY-TRAM.ps1') -EpNguon | Out-Null
#  Đọc lại để KHOE SỐ THẬT chứ không chỉ nói "đã cài". Một số thiết lập bị hãng ẩn khỏi scheme —
#  `powercfg /setacvalueindex` vẫn trả exit 0 nhưng `/q` không in ra dòng nào (đo 21/08/2026:
#  LIDACTION trên Dell Inspiron 3535 đúng như vậy). Gặp thế thì nói thẳng "ẩn", đừng bịa con số.
$doc = {
  param($sub, $ten)
  $d = & powercfg /q SCHEME_CURRENT $sub $ten 2>$null | Select-String 'Current AC Power Setting Index'
  if ($d) { return ([string]$d).Split(':')[-1].Trim() }
  return 'ẩn trên máy này (hãng gỡ khỏi power scheme)'
}
Write-Host ("  [OK] không tự ngủ (AC)          : " + (& $doc 'SUB_SLEEP' 'STANDBYIDLE'))
Write-Host ("  [OK] cho phép hẹn giờ đánh thức : " + (& $doc 'SUB_SLEEP' 'RTCWAKE') + "   (0x1 = Enable)")
Write-Host ("  [OK] pin kiệt thì ngủ đông      : " + (& $doc 'SUB_BATTERY' 'BATACTIONCRIT') + "   (0x2 = Hibernate)")
Write-Host ("  [--] đóng nắp khi cắm điện      : " + (& $doc 'SUB_BUTTONS' 'LIDACTION'))

# ------------------------------------------------------------------------------------------------
# ② HAI TASK
# ------------------------------------------------------------------------------------------------
Write-Host ""
Write-Host "== ② Đăng ký Scheduled Task ..." -ForegroundColor Cyan
$wscript = "$env:SystemRoot\System32\wscript.exe"
$action  = New-ScheduledTaskAction -Execute $wscript -Argument "`"$DIR\co-cho-hidden.vbs`""
$hom     = (Get-Date).Date
# BẪY đã cắn 19/08/2026 ở SETUP-PC-MOI.ps1: -RepetitionDuration ([TimeSpan]::MaxValue) không đăng ký
# được trên máy này. Các task đang chạy thật đều dùng P3650D — lấy đúng con số đó.
$LAP_MAI = New-TimeSpan -Days 3650

# Trigger sự kiện phải dựng bằng CIM: New-ScheduledTaskTrigger của PS 5.1 không có kiểu "On an event".
function TriggerSuKien($nhaCungCap, $maSuKien) {
  $cls = Get-CimClass -ClassName MSFT_TaskEventTrigger -Namespace Root/Microsoft/Windows/TaskScheduler
  $t = New-CimInstance -CimClass $cls -ClientOnly
  $t.Enabled = $true
  $t.Subscription = "<QueryList><Query Id='0' Path='System'><Select Path='System'>*[System[Provider[@Name='$nhaCungCap'] and EventID=$maSuKien]]</Select></Query></QueryList>"
  return $t
}
#  Kernel-Power 105 = "nguồn điện của hệ thống vừa đổi" — nổ cả lúc CẮM lẫn lúc RÚT sạc. Nổ dư một
#  lượt lúc rút cũng không sao: cò chờ là hàm luỹ đẳng, chạy thừa chỉ tốn 0,4 giây.
#  Power-Troubleshooter 1 = máy vừa THỨC DẬY — đây là lượt quan trọng nhất, vì sau khi ngủ đông rồi
#  dậy thì agent còn nguyên tiến trình nhưng mọi kết nối mạng/RPC đã đứt.
$tgSac   = TriggerSuKien 'Microsoft-Windows-Kernel-Power' 105
$tgDay   = TriggerSuKien 'Microsoft-Windows-Power-Troubleshooter' 1
$tgLogon = New-ScheduledTaskTrigger -AtLogOn
$tgLap   = New-ScheduledTaskTrigger -Once -At ($hom.AddHours(6).AddMinutes(50)) `
           -RepetitionInterval (New-TimeSpan -Minutes 2) -RepetitionDuration $LAP_MAI

$set = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
       -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'Factory co cho may tram' -Action $action `
  -Trigger @($tgLogon, $tgSac, $tgDay, $tgLap) -Settings $set -Force | Out-Null
Write-Host "  [OK] Factory co cho may tram      — đăng nhập · cắm/rút sạc · máy thức dậy · lặp 2'"

#  Task RIÊNG cho lượt đánh thức buổi sáng, vì "được phép đánh thức máy" (WakeToRun) là thuộc tính
#  của CẢ TASK chứ không của từng trigger: gắn chung vào task lặp 2 phút ở trên thì máy bị dựng dậy
#  720 lần/ngày — lúc mất điện đang ngủ đông vì pin kiệt, đó là cách rút cạn nốt cục pin.
$setDay = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
          -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew -WakeToRun
Register-ScheduledTask -TaskName 'Factory co cho bat may sang' -Action $action `
  -Trigger (New-ScheduledTaskTrigger -Daily -At ($hom.AddHours(6).AddMinutes(50))) -Settings $setDay -Force | Out-Null
Write-Host "  [OK] Factory co cho bat may sang  — 06:50 hằng ngày, ĐƯỢC PHÉP đánh thức máy đang ngủ"

# ------------------------------------------------------------------------------------------------
# ③ TỰ ĐĂNG NHẬP WINDOWS
# ------------------------------------------------------------------------------------------------
Write-Host ""
Write-Host "== ③ Tự đăng nhập Windows sau khi máy bật" -ForegroundColor Cyan
Write-Host "     Vì sao cần: BIOS bật máy lúc 07:00 mà Windows dừng ở màn hình khoá thì KHÔNG task"
Write-Host "     nào chạy (agent in tem, đồng bộ 5S, chấm công, kênh tin nhắn — tất cả đều cần một"
Write-Host "     phiên đăng nhập). Không có mục này thì cả bộ cò chờ chỉ bật được cái vỏ máy."
Write-Host "     ĐÁNH ĐỔI: mật khẩu Windows được CẤT trong máy (LSA secret — đúng cách Windows tự"
Write-Host "     cất, không phơi ra registry). Ai có quyền Admin trên máy này vẫn moi lại được."
Write-Host "     Bù lại, mục ④ ngay dưới sẽ khoá màn hình sau 5 phút không ai đụng."
Write-Host ""
$traLoi = if ($KhongHoi) { 'k' } else { Read-Host "     Bật tự đăng nhập? [c/K]" }
if ($traLoi -match '^[cCyY]') {
  if (-not $isAdmin) {
    Write-Host "  [BỎ QUA] cần quyền Admin — chạy lại bằng CAI-CO-CHO.bat (nó tự xin quyền)." -ForegroundColor Yellow
  } else {
    $mk = Read-Host "     Mật khẩu Windows của $env:USERNAME" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($mk)
    $mkPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    # KIỂM TRA TRƯỚC KHI GHI. Ghi nhầm mật khẩu = mỗi lần khởi động Windows thử đăng nhập rồi trượt,
    # và tệ hơn: nó tự xoá cờ AutoAdminLogon nên lần sau không ai hiểu vì sao "cài rồi mà không chạy".
    Add-Type -AssemblyName System.DirectoryServices.AccountManagement
    $ctx = New-Object System.DirectoryServices.AccountManagement.PrincipalContext('Machine')
    if (-not $ctx.ValidateCredentials($env:USERNAME, $mkPlain)) {
      Write-Host "  [DỪNG] Mật khẩu sai — không ghi gì cả. (Chính sách khoá tài khoản: 10 lần sai.)" -ForegroundColor Red
    } else {
      Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class LsaBiMat {
  [StructLayout(LayoutKind.Sequential)] struct US { public ushort Length; public ushort MaximumLength; public IntPtr Buffer; }
  [StructLayout(LayoutKind.Sequential)] struct OA { public int Length; public IntPtr Root; public IntPtr Name; public uint Attr; public IntPtr Sd; public IntPtr Qos; }
  [DllImport("advapi32.dll", SetLastError=true)] static extern uint LsaOpenPolicy(IntPtr sys, ref OA oa, uint acc, out IntPtr h);
  [DllImport("advapi32.dll", SetLastError=true)] static extern uint LsaStorePrivateData(IntPtr h, ref US key, ref US data);
  [DllImport("advapi32.dll")] static extern uint LsaClose(IntPtr h);
  [DllImport("advapi32.dll")] static extern int LsaNtStatusToWinError(uint st);
  static US Str(string s){ US u = new US(); u.Buffer = Marshal.StringToHGlobalUni(s); u.Length = (ushort)(s.Length*2); u.MaximumLength = (ushort)(u.Length+2); return u; }
  public static void Ghi(string khoa, string duLieu){
    OA oa = new OA(); oa.Length = Marshal.SizeOf(typeof(OA));
    IntPtr h;
    uint st = LsaOpenPolicy(IntPtr.Zero, ref oa, 0x00000024, out h);   // CREATE_SECRET | GET_PRIVATE_INFORMATION
    if (st != 0) throw new Exception("LsaOpenPolicy loi " + LsaNtStatusToWinError(st));
    US k = Str(khoa); US d = Str(duLieu);
    try {
      st = LsaStorePrivateData(h, ref k, ref d);
      if (st != 0) throw new Exception("LsaStorePrivateData loi " + LsaNtStatusToWinError(st));
    } finally { Marshal.FreeHGlobal(k.Buffer); Marshal.FreeHGlobal(d.Buffer); LsaClose(h); }
  }
}
'@
      [LsaBiMat]::Ghi('DefaultPassword', $mkPlain)
      $wl = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
      Set-ItemProperty $wl -Name 'AutoAdminLogon'    -Value '1' -Type String
      Set-ItemProperty $wl -Name 'DefaultUserName'   -Value $env:USERNAME -Type String
      Set-ItemProperty $wl -Name 'DefaultDomainName' -Value $env:COMPUTERNAME -Type String
      # Nếu có ai từng ghi mật khẩu THÔ vào registry thì xoá — bí mật đã nằm ở LSA rồi.
      Remove-ItemProperty $wl -Name 'DefaultPassword' -ErrorAction SilentlyContinue
      # AutoLogonCount còn sót lại (Windows Update đặt cho lượt tự đăng nhập MỘT LẦN) sẽ đếm ngược
      # về 0 rồi tự tắt AutoAdminLogon — đúng cái bẫy "hôm nay chạy, mai không".
      Remove-ItemProperty $wl -Name 'AutoLogonCount'  -ErrorAction SilentlyContinue
      # Cho hộp thoại netplwiz hiện lại ô tick (Windows ẩn nó khi = 2) để sau này sửa bằng tay được.
      $pl = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\PasswordLess\Device'
      if (Test-Path $pl) { Set-ItemProperty $pl -Name 'DevicePasswordLessBuildVersion' -Value 0 -Type DWord }
      $mkPlain = $null
      Write-Host "  [OK] Tự đăng nhập đã bật (mật khẩu cất bằng LSA secret)." -ForegroundColor Green
    }
  }
} elseif ($KhongHoi) {
  Write-Host "  [HOÃN] chạy -KhongHoi nên bỏ qua — bấm đúp CAI-CO-CHO.bat để bật." -ForegroundColor Yellow
} else {
  Write-Host "  [BỎ] Không bật tự đăng nhập — nhớ là máy tự bật vẫn sẽ dừng ở màn hình khoá." -ForegroundColor Yellow
}

# ------------------------------------------------------------------------------------------------
# ④ KHOÁ MÀN HÌNH KHI RẢNH (HKCU — không cần Admin)
# ------------------------------------------------------------------------------------------------
Write-Host ""
Write-Host "== ④ Khoá màn hình sau 5 phút không ai đụng" -ForegroundColor Cyan
$traLoi2 = if ($KhongHoi) { 'k' } else { Read-Host "     Bật? [C/k]" }
if ($traLoi2 -notmatch '^[kKnN]') {
  $d = 'HKCU:\Control Panel\Desktop'
  Set-ItemProperty $d -Name 'ScreenSaveActive'   -Value '1'   -Type String
  Set-ItemProperty $d -Name 'ScreenSaverIsSecure' -Value '1'   -Type String
  Set-ItemProperty $d -Name 'ScreenSaveTimeOut'  -Value '300' -Type String
  Set-ItemProperty $d -Name 'SCRNSAVE.EXE'       -Value "$env:SystemRoot\System32\scrnsave.scr" -Type String
  Write-Host "  [OK] 5 phút rảnh -> màn hình đen + đòi mật khẩu. Agent và task vẫn chạy dưới khoá." -ForegroundColor Green
  Write-Host "       Tắt lại: Settings > Personalization > Lock screen > Screen saver settings."
} elseif ($KhongHoi) {
  Write-Host "  [HOÃN] chạy -KhongHoi nên bỏ qua — bấm đúp CAI-CO-CHO.bat để bật." -ForegroundColor Yellow
} else { Write-Host "  [BỎ] Không bật khoá màn hình." -ForegroundColor Yellow }

# ------------------------------------------------------------------------------------------------
# ⑤ VIỆC DUY NHẤT PHẢI LÀM BẰNG TAY — BIOS
# ------------------------------------------------------------------------------------------------
Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Yellow
Write-Host "   CÒN MỘT VIỆC PHẢI LÀM TRONG BIOS (không script nào làm hộ)" -ForegroundColor Yellow
Write-Host "  ============================================================" -ForegroundColor Yellow
Write-Host "   Máy TẮT HẲN thì không còn dòng mã nào của mình chạy — chỉ BIOS nghe được cú cắm sạc."
Write-Host ""
Write-Host "   Tắt máy > bật lên > bấm F2 liên tục > vào mục Power:"
Write-Host "     · Wake on AC    = Enabled     -> cắm sạc vào là máy tự bật (đúng thứ đang cần)"
Write-Host "     · Auto On Time  = Everyday 07:15 -> sáng nào cũng tự bật, kể cả không ai cắm/rút gì"
Write-Host "     · Block Sleep   = giữ nguyên"
Write-Host "   F10 lưu và thoát. Thử: tắt máy, rút sạc, chờ 10 giây, cắm sạc -> máy phải tự bật."
Write-Host ""
Write-Host "   Chi tiết + cách kiểm chứng: hasaki\CO-CHO-MAY-IN.md" -ForegroundColor Cyan
Write-Host ""
