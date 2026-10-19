' ============================================================
'  Chay sync-poller.js HOAN TOAN AN (khong popup cmd).
'  19/10/2026: viec "lam-tuoi-vesinh" cua bo dieu phoi PC (ghim QLIT,
'  du phong FOQ5T89) - giu ve sinh/kiem ke/5S tuoi trong ngay khi laptop tat.
'  Task "5S DP lam-tuoi-vesinh" goi moi 5' qua _DP-CHAY.vbs; poller tu
'  quyet co viec hay khong (khung 08:45-18:00, moc 15'/30'/45'). Log: poller.log
' ============================================================
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run "cmd /c node sync-poller.js >> poller.log 2>&1", 0, True
