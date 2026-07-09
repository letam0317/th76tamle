' ============================================================
'  Chay AUTO-EXPORT.bat HOAN TOAN AN (khong popup cmd).
'  Task Scheduler goi: wscript.exe auto-export-hidden.vbs
'  Tu Xuat qua API -> tai file cong khai -> day tab 5S-TASKS. Log: auto-export.log
' ============================================================
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run "cmd /c """ & dir & "\AUTO-EXPORT.bat""", 0, True
