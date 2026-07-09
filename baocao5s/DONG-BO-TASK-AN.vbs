' ============================================================
'  Chay DONG-BO-TASK.bat HOAN TOAN AN (khong hien cua so cmd).
'  Bam dup file nay: no chay ngam, xong tu tat. Xem ket qua o
'  file dong-bo-task.log cung thu muc.
' ============================================================
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
sh.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
' Tham so 0 = an cua so; True = doi chay xong
sh.Run "cmd /c """ & fso.GetParentFolderName(WScript.ScriptFullName) & "\DONG-BO-TASK.bat""", 0, True
