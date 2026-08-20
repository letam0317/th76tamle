' ============================================================
'  Chay TIN-NHAN-BOT.bat HOAN TOAN AN (khong popup cmd).
'  Task Scheduler goi: wscript.exe tin-nhan-hidden.vbs  (moi 2 phut)
' ============================================================
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run "cmd /c """ & dir & "\TIN-NHAN-BOT.bat""", 0, True
