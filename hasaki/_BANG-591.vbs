' Launcher khong cua so cho bang-591.mjs (dashboard noi bo Viec 5S WF591, http://127.0.0.1:8591/)
Set sh = CreateObject("WScript.Shell")
thuMuc = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sh.CurrentDirectory = thuMuc
sh.Run "cmd /c node bang-591.mjs >> bang-591.log 2>&1", 0, False
