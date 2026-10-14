' _DONG-BO-XM.vbs - (laptop) moi 5 phut: day du lieu xac minh laptop sinh len kho Drive, keo ket qua may tram ve (dong-bo-xm.mjs dinh-ky)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c node dong-bo-xm.mjs dinh-ky >> dong-bo-xm-dinh-ky.log 2>&1", 0, True
