' Chay agent in tem KHONG hien cua so. Dung cho Task Scheduler (task "Factory agent in tem").
' ---------------------------------------------------------------------------------------------
' VI SAO CO CHOT CHONG CHAY TRUNG: task nay duoc dat lap lai moi 5 phut de lam WATCHDOG — neu agent
' chet (may ngu, node vang, ai do tat) thi 5 phut sau no song lai. Nhung neu khong kiem tra truoc thi
' cu 5 phut lai them MOT agent nua, roi hai agent cung nhat lenh -> tem in doi.
' Ngay 20/08/2026 nguoi dung bam "Xac nhan in" ma khong co tem nao ra, dung vi agent chua bat: cai
' gia cua viec khong co watchdog la nguoi dung dung doi mot to tem khong bao gio ra.
'
' Tat agent: Task Manager -> ket thuc node.exe cua agent (hoac tat task nay roi ket thuc tien trinh).

Dim wmi, procs, pr, dangChay
dangChay = False
On Error Resume Next
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
Set procs = wmi.ExecQuery("SELECT CommandLine FROM Win32_Process WHERE Name = 'node.exe'")
For Each pr In procs
  If InStr(1, pr.CommandLine & "", "in-tem-agent", 1) > 0 Then dangChay = True
Next
On Error GoTo 0

If dangChay Then WScript.Quit 0

Dim sh
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
' Khong truyen --nhip: agent tu chon 1s trong gio lam, 12s ngoai gio.
sh.Run "node in-tem-agent.mjs --dich-vu", 0, False
