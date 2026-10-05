' ============================================================
'  Chay co-canh-planogram.mjs HOAN TOAN AN (khong popup cmd).
'  Task Scheduler "5S Co canh planogram" goi: moi 15' (cua gio
'  07:00-18:00 do .mjs tu quyet). Log: co-canh-planogram.log
'  Dung lai 26/09/2026 sau khi file bi xoa nham (popup WSH
'  "Can not find script file" moi 15').
' ============================================================
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run "cmd /c node co-canh-planogram.mjs >> co-canh-planogram.log 2>&1", 0, True
