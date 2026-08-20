# _IN-RAW.ps1 — gui MOT FILE nhi phan thang toi may in (datatype RAW), khong qua driver GDI.
#   powershell -File _IN-RAW.ps1 -File "<duong dan>" [-Printer "<ten may in>"]
#
# Vi sao can: lenh TSPL (va bitmap trong do) la nhi phan; muon may in nhan dung tung byte thi phai
# di duong RAW cua spooler. Driver GDI se "ve lai" trang theo kho giay cua driver — dung la sai kho.
#
# BAY DA CAN LUC IN THU DAU TIEN (20/08/2026): may in SHARE chi cho quyen PRINTER_ACCESS_USE, ma
# OpenPrinter voi pd=NULL lai xin PRINTER_ALL_ACCESS nen bi tu choi voi loi 5 (access denied).

param(
  [Parameter(Mandatory=$true)][string]$File,
  [string]$Printer = '',
  # -ChiMo: CHI mo roi dong handle may in, KHONG gui byte nao. Dung de "ham nong" duong ket noi toi
  # spooler may ben kia (luot gui dau tien sau khi agent khoi dong mat ~8s, luot sau ~2s).
  # Vi sao khong ham nong bang mot lenh TSPL rong: moi lan nhu vay tao MOT viec in 0 byte nam lai
  # trong queue o trang thai "Spooling" — chinh ho loi lam moi luot gui sau do doi len toi 22s.
  [switch]$ChiMo
)
$ErrorActionPreference = 'Stop'

if (-not $ChiMo -and -not (Test-Path $File)) { Write-Output "LOI: khong thay file $File"; exit 1 }

if (-not $Printer) {
  $mi = Get-Printer | Where-Object { $_.Name -match 'PE200' } | Select-Object -First 1
  if (-not $mi) { Write-Output "LOI: khong thay may in nao ten chua 'PE200'"; exit 1 }
  $Printer = $mi.Name
}

if (-not ("RawPrintTem" -as [type])) {
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class RawPrintTem {
  [StructLayout(LayoutKind.Sequential)] public class DOCINFO {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
  [StructLayout(LayoutKind.Sequential)] public struct PRINTER_DEFAULTS {
    public IntPtr pDatatype; public IntPtr pDevMode; public int DesiredAccess;
  }
  const int PRINTER_ACCESS_USE = 0x00000008;
  [DllImport("winspool.drv", CharSet=CharSet.Ansi, SetLastError=true)] static extern bool OpenPrinter(string src, out IntPtr h, ref PRINTER_DEFAULTS pd);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet=CharSet.Ansi, SetLastError=true)] static extern bool StartDocPrinterA(IntPtr h, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO di);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)] static extern bool WritePrinter(IntPtr h, IntPtr buf, int n, out int written);

  /* Mo roi dong handle: tra dung cai gia ket noi (RPC/SMB toi spooler may ben kia) ma KHONG tao
     viec in nao. */
  public static string ChiMo(string printer) {
    IntPtr h;
    PRINTER_DEFAULTS pd = new PRINTER_DEFAULTS();
    pd.pDatatype = IntPtr.Zero; pd.pDevMode = IntPtr.Zero; pd.DesiredAccess = PRINTER_ACCESS_USE;
    if (!OpenPrinter(printer, out h, ref pd)) return "LOI OpenPrinter " + Marshal.GetLastWin32Error();
    ClosePrinter(h);
    return "OK mo";
  }
  public static string Send(string printer, byte[] data, string docName) {
    IntPtr h; int written = 0;
    PRINTER_DEFAULTS pd = new PRINTER_DEFAULTS();
    pd.pDatatype = IntPtr.Zero; pd.pDevMode = IntPtr.Zero; pd.DesiredAccess = PRINTER_ACCESS_USE;
    if (!OpenPrinter(printer, out h, ref pd)) return "LOI OpenPrinter " + Marshal.GetLastWin32Error();
    DOCINFO di = new DOCINFO();
    di.pDocName = docName; di.pDataType = "RAW";
    if (!StartDocPrinterA(h, 1, di)) { int e = Marshal.GetLastWin32Error(); ClosePrinter(h); return "LOI StartDocPrinter " + e; }
    if (!StartPagePrinter(h)) { int e = Marshal.GetLastWin32Error(); EndDocPrinter(h); ClosePrinter(h); return "LOI StartPagePrinter " + e; }
    IntPtr p = Marshal.AllocCoTaskMem(data.Length);
    Marshal.Copy(data, 0, p, data.Length);
    bool ok = WritePrinter(h, p, data.Length, out written);
    int err = ok ? 0 : Marshal.GetLastWin32Error();
    Marshal.FreeCoTaskMem(p);
    EndPagePrinter(h); EndDocPrinter(h); ClosePrinter(h);
    return ok ? ("OK " + written) : ("LOI WritePrinter " + err);
  }
}
'@
}

if ($ChiMo) {
  $kq = [RawPrintTem]::ChiMo($Printer)
  Write-Output "$kq | may in: $Printer | 0 byte"
  exit 0
}
$bytes = [System.IO.File]::ReadAllBytes($File)
$kq = [RawPrintTem]::Send($Printer, $bytes, "Audit Factory - in tem")
Write-Output "$kq | may in: $Printer | $($bytes.Length) byte"
