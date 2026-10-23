' Launcher khong cua so cho soan-hang-b1.mjs (luot SOAN hang theo o, Redash truy van 188, 0 luot API WMS) - 23/10/2026
' 23/10: chay xong thi doi soat ket qua chia viec cat clip 2 may tram (kiem-chia-clip.mjs -> .exports/kiem-chia-clip.json)
' Chi chay tren LAPTOP (chi laptop co REDASH_API_KEY). Lich de xuat: 08:15 roi moi 2 gio toi 18:15 (truoc tim-bang-chung-b1 15 phut).
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c node soan-hang-b1.mjs >> soan-hang-b1.log 2>&1 & node kiem-chia-clip.mjs >> kiem-chia-clip.log 2>&1", 0, False
