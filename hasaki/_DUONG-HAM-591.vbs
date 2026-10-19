' Launcher khong cua so cho duong-ham-591.mjs (Cloudflare tunnel -> may chu Xac minh 8591, 19/10)
Set sh = CreateObject("WScript.Shell")
thuMuc = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sh.CurrentDirectory = thuMuc
sh.Run "cmd /c node duong-ham-591.mjs >> duong-ham-591.out 2>&1", 0, False
