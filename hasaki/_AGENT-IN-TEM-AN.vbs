' Chay agent in tem KHONG hien cua so. Dung cho Task Scheduler (task "Factory agent in tem").
' ---------------------------------------------------------------------------------------------
' VI SAO CO CHOT CHONG CHAY TRUNG: task nay duoc dat lap lai moi 5 phut de lam WATCHDOG — neu agent
' chet (may ngu, node vang, ai do tat) thi 5 phut sau no song lai. Nhung neu khong kiem tra truoc thi
' cu 5 phut lai them MOT agent nua, roi hai agent cung nhat lenh -> tem in doi.
' Ngay 20/08/2026 nguoi dung bam "Xac nhan in" ma khong co tem nao ra, dung vi agent chua bat: cai
' gia cua viec khong co watchdog la nguoi dung dung doi mot to tem khong bao gio ra.
'
' NODE O DAU (21/08/2026): file nay chay tren CA HAI may —
'   · laptop HSK-KHO170-TAML : Node cai san, goi thang "node"
'   · Desktop-JE75K38 (may cam may in) : KHONG cai Node, dung "node.exe" di kem trong goi
'     (_GOI-MAY-IN\node.exe, nam canh thu muc hasaki). Uu tien node.exe di kem, khong co moi toi PATH.
'   Khong co chot nay thi tren may in agent im lang khong chay, va khong co loi nao de doc.
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

Dim sh, fso, dir, nodeExe, may, fMay
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir

nodeExe = fso.BuildPath(fso.GetParentFolderName(dir), "node.exe")
If Not fso.FileExists(nodeExe) Then nodeExe = "node"

' Ten may in da chot luc cai (xem _CO-CHO-MAY-IN.ps1): may cam may in co HAI queue cung ten PE200,
' chot san cai mo duoc thi khoi de agent doan.
may = ""
fMay = fso.BuildPath(dir, ".agent-may-in.txt")
If fso.FileExists(fMay) Then
  may = Trim(fso.OpenTextFile(fMay, 1).ReadLine())
  If may <> "" Then may = " --may """ & may & """"
End If

' Khong truyen --nhip: agent tu chon 1s trong gio lam, 12s ngoai gio.
sh.Run """" & nodeExe & """ in-tem-agent.mjs --dich-vu" & may, 0, False
