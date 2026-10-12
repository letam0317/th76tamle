' _DP-CHAY.vbs <tenViec> <vbsThat> - vo boc cua moi co chay theo DIEU PHOI.
'   1) chay runner-dieu-phoi.mjs <tenViec> (an) -> hoi GAS: may nay co chay viec nay khong?
'   2) exit 0 -> chay <vbsThat> (an) ; exit 75 -> thoi (may khac gan viec / dang yeu / viec hoan).
' Dat o: <duAn>\cai-pc\_DP-CHAY.vbs ; <duAn> = thu muc hasaki (co node.exe? khong - dung node he thong).
Option Explicit
Dim sh, fso, args, tenViec, vbsThat, kit, duAn, node, ma
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
Set args = WScript.Arguments
If args.Count < 2 Then WScript.Quit 2
tenViec = args(0) : vbsThat = args(1)
kit  = fso.GetParentFolderName(WScript.ScriptFullName)   ' ...\hasaki\cai-pc
duAn = fso.GetParentFolderName(kit)                       ' ...\hasaki
sh.CurrentDirectory = duAn
' node: dung "node" tren PATH (PC noi bo co cai Node). Neu co node.exe di kem thi uu tien.
If fso.FileExists(duAn & "\node.exe") Then node = """" & duAn & "\node.exe""" Else node = "node"
' 1) cong gac (cho chay xong de lay exit code)
ma = sh.Run(node & " runner-dieu-phoi.mjs " & tenViec, 0, True)
If ma = 0 Then
  ' 2) duoc chay -> goi co that (khong cho, de no chay nhu binh thuong)
  If fso.FileExists(duAn & "\" & vbsThat) Then
    sh.Run "wscript //nologo """ & duAn & "\" & vbsThat & """", 0, False
  End If
End If
