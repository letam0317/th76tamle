' _LAPTOP-NHUONG.vbs <tenViec> <vbsThat> - vo boc task co goc tren LAPTOP (14/10).
'   1) node nhuong-pc.mjs <tenViec> -> exit 75 = da co PC ban moi nhan viec nay -> laptop NHUONG (khong chay trung)
'   2) exit 0 (hoac loi) -> chay <vbsThat> nhu cu (laptop la may du phong), xong thi bao GAS (--xong).
Option Explicit
Dim sh, fso, args, dir, ma
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
Set args = WScript.Arguments
If args.Count < 2 Then WScript.Quit 2
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
ma = sh.Run("node nhuong-pc.mjs " & args(0), 0, True)
If ma = 75 Then WScript.Quit 0
' 14/10: qua bo chay chay-xm.mjs (viec xac minh: khoa chung + keo/day du lieu kho Drive voi may tram; viec khac: chay vbs nhu cu)
If fso.FileExists(dir & "\chay-xm.mjs") Then
  sh.Run "node chay-xm.mjs " & args(0) & " " & args(1), 0, True
Else
  sh.Run "wscript.exe //nologo """ & dir & "\" & args(1) & """", 0, True
End If
' 14/10: bao GAS viec da xong -> tab May tram bo khoi «Dang chay»
sh.Run "node nhuong-pc.mjs " & args(0) & " --xong", 0, True
