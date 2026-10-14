' QC chay-xm: bat 1 tien trinh con chay 25 giay roi THOAT NGAY (giong vbs Run ..., False) -> bo chay phai cho con xong
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c node -e ""setTimeout(()=>require('fs').writeFileSync(process.env.TEMP+'/qcxm/con-xong.txt',String(Date.now())),25000)""", 0, False
