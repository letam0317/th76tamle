' Chay agent in tem KHONG hien cua so (dung khi cho vao Task Scheduler / Startup).
' Tat agent: mo Task Manager -> ket thuc tien trinh node.exe cua agent.
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "node in-tem-agent.mjs --dich-vu --nhip 6", 0, False
