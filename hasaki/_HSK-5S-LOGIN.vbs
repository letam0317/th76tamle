' _HSK-5S-LOGIN.vbs - chay pc-login-agent.ps1 nen (khong cua so) cho scheduled task.
' MINH BACH: task co ten ro "HSK 5S - ghi nhan dang nhap", chay ngu canh user, chi doc + gui GAS.
' Duong dan tu tinh theo thu muc chua file nay (chay duoc ca khi cai o C:\ProgramData\HSK-5S-login).
Dim fso, sh, dir
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\pc-login-agent.ps1"" -Once", 0, False
