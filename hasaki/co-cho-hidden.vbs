' ============================================================
'  Chay CO-CHO-MAY-TRAM.ps1 HOAN TOAN AN (khong popup cua so xanh).
'  Task Scheduler "Factory co cho may tram" goi: khi dang nhap, khi
'  CAM/RUT SAC (Kernel-Power 105), khi may THUC DAY (Power-Troubleshooter 1)
'  va lap moi 2 phut. Script tu ghi so: .co-cho.log + .co-cho.json
'
'  -Am = chi ghi so, khong in ra man hinh (chay nen thi khong ai doc man hinh).
' ============================================================
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -File """ & dir & "\CO-CHO-MAY-TRAM.ps1"" -Am", 0, True
