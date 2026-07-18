' ============================================================
'  Chay DAY-BAO-CAO-5S.bat HOAN TOAN AN (khong popup cmd).
'  Task Scheduler goi:  wscript.exe day-bao-cao-hidden.vbs
'  Bo day chay Puppeteer headless ~20-40s -> chay ngam, khong hien cua so.
' ============================================================
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
' 0 = an cua so hoan toan; True = doi chay xong
sh.Run "cmd /c """ & dir & "\DAY-BAO-CAO-5S.bat""", 0, True
