' ============================================================
'  Chay sync-guard.js HOAN TOAN AN (khong popup cmd).
'  Task Scheduler "Factory watchdog ton kho" goi: khi logon (+5')
'  va moi gio 7h-17h. Guard tu quyet dinh chay/hoan. Log: sync-guard.log
' ============================================================
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run "cmd /c node sync-guard.js >> sync-guard.log 2>&1", 0, True
