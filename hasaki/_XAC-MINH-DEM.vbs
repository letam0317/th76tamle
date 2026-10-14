' Launcher khong cua so cho XAC-MINH-DEM.bat (Task Scheduler goi wscript de khoi bat man hinh den)
Set sh = CreateObject("WScript.Shell")
thuMuc = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sh.Run """" & thuMuc & "XAC-MINH-DEM.bat""", 0, False
