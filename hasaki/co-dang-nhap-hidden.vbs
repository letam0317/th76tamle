' ============================================================
'  Chay co-dang-nhap.mjs HOAN TOAN AN (khong cua so den).
'  Co nay nghe extension wms-bridge bao "vua co nguoi dang nhap"
'  roi ep sync-poller lam tuoi du lieu ngay (~3-5 giay).
'  Duoc CO-CHO-MAY-TRAM.ps1 (task moi 2 phut) dung day neu chet.
'  So: co-dang-nhap.log
' ============================================================
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run "cmd /c node co-dang-nhap.mjs >> co-dang-nhap.log 2>&1", 0, False
