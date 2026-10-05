' Launcher khong cua so cho BAI-XE-PHIEU.bat
Set sh = CreateObject("WScript.Shell")
thuMuc = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sh.Run """" & thuMuc & "BAI-XE-PHIEU.bat""", 0, False
