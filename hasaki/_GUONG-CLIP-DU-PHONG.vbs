' _GUONG-CLIP-DU-PHONG.vbs - (laptop) moi 15 phut: day clip/anh bang chung sang may chu Xac minh DU PHONG tren PC qua duong ham cua PC
' (22/10 user: laptop tat van xem duoc clip o Theo tac vu / Theo may). guong-clip-du-phong.mjs tu ghi log guong-clip-du-phong.log
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c node guong-clip-du-phong.mjs > nul 2>> guong-clip-du-phong.log", 0, True
