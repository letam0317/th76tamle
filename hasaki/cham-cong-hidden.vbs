' ============================================================
'  Chay LAY-CHAM-CONG.bat HOAN TOAN AN (khong popup cmd).
'  Task Scheduler goi: wscript.exe cham-cong-hidden.vbs
'  Keo cham cong -> ghi tab CHAM-CONG. Log: cham-cong.log
' ============================================================
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run "cmd /c """ & dir & "\LAY-CHAM-CONG.bat""", 0, True
