' _LAPTOP-NHUONG.vbs <tenViec> <vbsThat> - vo boc task co goc tren LAPTOP (14/10).
'   1) node nhuong-pc.mjs <tenViec> -> exit 75 = da co PC ban moi nhan viec nay -> laptop NHUONG (khong chay trung)
'   2) exit 0 (hoac loi) -> chay <vbsThat> nhu cu (laptop la may du phong).
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
sh.Run "wscript.exe //nologo """ & dir & "\" & args(1) & """", 0, True
