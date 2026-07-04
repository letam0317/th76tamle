' ============================================================
'  Chay DONG-BO-TASK.bat HOAN TOAN AN (khong popup cmd).
'  Task Scheduler goi: wscript.exe day-bo-task-hidden.vbs
'  Doc file Export moi nhat trong Downloads -> day len tab 5S-TASKS.
'  Neu khong co file export moi thi tu bo qua (khong ghi de thua).
' ============================================================
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run "cmd /c """ & dir & "\DONG-BO-TASK.bat""", 0, True
