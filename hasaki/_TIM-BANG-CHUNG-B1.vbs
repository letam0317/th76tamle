' Launcher khong cua so cho tim-bang-chung-b1.mjs (may tu chup khung camera dung gio he thong kho cho phieu B1)
Set sh = CreateObject("WScript.Shell")
thuMuc = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sh.CurrentDirectory = thuMuc
sh.Run "cmd /c node tim-bang-chung-b1.mjs --max=6 >> tim-bang-chung-b1.log 2>&1 & node dai-lui-thoi-gian-b1.mjs --max=6 >> dai-lui.log 2>&1", 0, False
