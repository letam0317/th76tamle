' ============================================================
'  Chay may-chu-du-phong.mjs HOAN TOAN AN (khong popup cmd).
'  19/10/2026: viec "may-chu-xm-du-phong" cua bo dieu phoi PC (ghim QLIT,
'  du phong FOQ5T89) - may chu Xac minh 8591 ban CHI XEM + duong ham, de
'  laptop tat dien thoai van xem duoc 3 muc Xac minh. Log: may-chu-du-phong.log
' ============================================================
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run "cmd /c node may-chu-du-phong.mjs >> may-chu-du-phong.out 2>&1", 0, True
