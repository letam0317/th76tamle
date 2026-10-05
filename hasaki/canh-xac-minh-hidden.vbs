' 05/10/2026 — chuỗi xác minh WF591 tự động (task "5S Canh xac minh B1", mỗi 2 giờ 07:50–17:50 T2–T7):
' canh-b1 --lam (luật đã duyệt + quyết định sheet) → canh-trung-nv --lam (CH-05/CH-06) → đẩy sheet B1.
Set sh = CreateObject("WScript.Shell")
dir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run "cmd /c (echo ==== %date% %time% & node canh-b1.mjs --lam & node canh-trung-nv.mjs --lam & python sheet-b1-treo.py --lam) >> canh-xac-minh.log 2>&1", 0, True
