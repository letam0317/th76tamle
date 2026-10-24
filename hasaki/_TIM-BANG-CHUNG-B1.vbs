' Launcher khong cua so cho tim-bang-chung-b1.mjs (may tu chup khung camera dung gio he thong kho cho phieu B1)
Set sh = CreateObject("WScript.Shell")
thuMuc = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sh.CurrentDirectory = thuMuc
sh.Run "cmd /c node tim-bang-chung-b1.mjs --max=12 >> tim-bang-chung-b1.log 2>&1 & node dai-lui-thoi-gian-b1.mjs --max=6 >> dai-lui.log 2>&1 & node tim-vat-xuat-hien.mjs --tu-dong --max=3 >> tim-vat.log 2>&1", 0, False
' 24/10: tim-vat-xuat-hien = may tu tim luc do vat xuat hien (Gemini khoanh vung + so duong net), thay viec nguoi do dai 9 khung
