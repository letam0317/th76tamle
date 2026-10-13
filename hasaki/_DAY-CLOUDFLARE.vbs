' Launcher khong cua so cho DAY-CLOUDFLARE.bat (Task Scheduler goi wscript)
Set sh = CreateObject("WScript.Shell")
thuMuc = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sh.Run """" & thuMuc & "DAY-CLOUDFLARE.bat""", 0, False
