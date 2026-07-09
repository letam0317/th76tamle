' ============================================================
'  Chay bo canh "yeu cau dang nhap" HOAN TOAN AN (khong popup cmd).
'  Task Scheduler goi:  wscript.exe watch-login-hidden.vbs
'  Lan kiem tra dinh ky = vo hinh. Chi khi CO yeu cau dang nhap thi
'  login-hasaki.js moi mo cua so Edge (dung y muon).
' ============================================================
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
' Tham so 0 = an cua so hoan toan; True = doi chay xong roi thoat
sh.Run "cmd /c """ & dir & "\KIEM-TRA-YEU-CAU-LOGIN.bat""", 0, True
