' Launcher khong cua so cho xem-noi-bo.mjs (trang duyet ban noi bo http://localhost:8123/ ? tab Xac minh & Co camera)
Set sh = CreateObject("WScript.Shell")
thuMuc = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sh.CurrentDirectory = thuMuc
sh.Run "cmd /c node xem-noi-bo.mjs >> xem-noi-bo.log 2>&1", 0, False
