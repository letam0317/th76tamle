param(
  [Parameter(Mandatory=$true)][string]$TepNoiDung,
  [string]$HoiThoai = "My Documents",
  [switch]$Thu,
  [string]$AnhRa = "C:\Users\lechitam\AppData\Local\Temp\claude\C--Users-lechitam-New-folder\ccdf4416-8149-4cff-8acf-d54c135b3b45\scratchpad\zalo-buoc.png"
)
Add-Type @"
using System;using System.Runtime.InteropServices;
public class Z {
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int c);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RC r);
 [DllImport("user32.dll")] public static extern IntPtr FindWindowEx(IntPtr p, IntPtr c, string cls, string win);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(int f,int dx,int dy,int d,int e);
 public struct RC { public int L,T,R,B; }
}
"@
Add-Type -AssemblyName System.Windows.Forms,System.Drawing

function Chup([string]$duong) {
  $h=[Z]::FindWindowEx([IntPtr]::Zero,[IntPtr]::Zero,"Chrome_WidgetWin_1","Zalo")
  $r=New-Object Z+RC; [Z]::GetWindowRect($h,[ref]$r) | Out-Null
  $w=$r.R-$r.L; $ht=$r.B-$r.T
  $bmp=New-Object System.Drawing.Bitmap($w,$ht)
  [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($r.L,$r.T,0,0,(New-Object System.Drawing.Size($w,$ht)))
  $bmp.Save($duong,[System.Drawing.Imaging.ImageFormat]::Png)
  return $r
}
function Bam([int]$x,[int]$y) {
  [Z]::SetCursorPos($x,$y); Start-Sleep -Milliseconds 250
  [Z]::mouse_event(2,0,0,0,0); [Z]::mouse_event(4,0,0,0,0); Start-Sleep -Milliseconds 600
}

$h=[Z]::FindWindowEx([IntPtr]::Zero,[IntPtr]::Zero,"Chrome_WidgetWin_1","Zalo")
if($h -eq [IntPtr]::Zero){ Write-Output "LOI: khong thay cua so Zalo"; exit 1 }
[Z]::ShowWindow($h,3) | Out-Null
[Z]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 1200
$r=Chup $AnhRa
Write-Output ("cua so: " + $r.L + "," + $r.T + " " + ($r.R-$r.L) + "x" + ($r.B-$r.T))

Bam ($r.L + 250) ($r.T + 77)
Set-Clipboard -Value $HoiThoai
[System.Windows.Forms.SendKeys]::SendWait("^a")
[System.Windows.Forms.SendKeys]::SendWait("^v")
Start-Sleep -Milliseconds 1800
Chup $AnhRa | Out-Null
Write-Output "buoc 1: da go tu khoa tim kiem"

Bam ($r.L + 250) ($r.T + 205)
Start-Sleep -Milliseconds 1500
Chup $AnhRa | Out-Null
Write-Output "buoc 2: da chon hoi thoai"

$noi = Get-Content -Raw -Encoding UTF8 $TepNoiDung
Set-Clipboard -Value $noi
Bam ($r.L + 900) ($r.B - 60)
[System.Windows.Forms.SendKeys]::SendWait("^v")
Start-Sleep -Milliseconds 1800
Chup $AnhRa | Out-Null
Write-Output "buoc 3: da dan noi dung"

if($Thu){ Write-Output "CHAY KHO - dung truoc khi gui"; exit 0 }
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Milliseconds 2500
Chup $AnhRa | Out-Null
Write-Output "DA GUI"
