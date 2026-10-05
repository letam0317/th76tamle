' Launcher khong cua so cho CANH-BAI-XE.bat (Task Scheduler goi wscript de khoi bat man hinh den)
Set sh = CreateObject("WScript.Shell")
thuMuc = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sh.Run """" & thuMuc & "CANH-BAI-XE.bat""", 0, False
