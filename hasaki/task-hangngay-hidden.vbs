' ============================================================
'  Chay TASK-HANG-NGAY.bat HOAN TOAN AN (khong popup cmd).
'  Task Scheduler goi: wscript.exe task-hangngay-hidden.vbs
'  Nhip 16:00 + lap lai moi 30' toi 18:00 (vet neu 16h chua co phien work).
' ============================================================
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run "cmd /c """ & dir & "\TASK-HANG-NGAY.bat""", 0, True
