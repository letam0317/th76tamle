' ============================================================
'  Chay TRA-UID.bat HOAN TOAN AN (khong popup cmd).
'  Task Scheduler goi:  wscript.exe tra-uid-hidden.vbs   (moi 2 phut)
' ============================================================
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
' Tham so 0 = an cua so hoan toan; True = doi chay xong roi thoat
sh.Run "cmd /c """ & dir & "\TRA-UID.bat""", 0, True
