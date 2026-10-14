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
    ' 13/10: chay qua WMI de lay PID goc -> ghi .dang-chay\<viec>.pid ; nhip tim (nhip-pc.mjs) do cay tien trinh con
    '   tu PID nay de biet viec CON CHAY khong, va de DUNG dung viec khi user bam Dung tren sub-tab May tram.
    Dim cmd, pid, kq, dc
    cmd = "wscript.exe //nologo """ & duAn & "\" & vbsThat & """"
    ' 14/10: qua bo chay chay-xm.mjs (viec xac minh: khoa chung + keo/day du lieu kho Drive; viec khac: chay vbs nhu cu)
    If fso.FileExists(duAn & "\chay-xm.mjs") Then cmd = node & " """ & duAn & "\chay-xm.mjs"" " & tenViec & " " & vbsThat
    pid = 0 : kq = 1
    On Error Resume Next
    kq = GetObject("winmgmts:\\.\root\cimv2").Get("Win32_Process").Create(cmd, duAn, Null, pid)
    On Error GoTo 0
    If kq = 0 And pid > 0 Then
      dc = duAn & "\.dang-chay"
      If Not fso.FolderExists(dc) Then fso.CreateFolder dc
      With fso.CreateTextFile(dc & "\" & tenViec & ".pid", True)
        .Write CStr(pid)
        .Close
      End With
    Else
      sh.Run cmd, 0, False   ' WMI hong -> chay kieu cu (khong theo doi duoc)
    End If
  End If
End If
