' Launcher khong cua so cho SYNC-PACKER-A8.bat (Task Scheduler goi wscript de khoi bat man hinh den)
Set sh = CreateObject("WScript.Shell")
thuMuc = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sh.Run """" & thuMuc & "SYNC-PACKER-A8.bat""", 0, False
