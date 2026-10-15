# qc-cai-pc.ps1 - CHAY THU TRON bo cai PC (CAI-PC.ps1) tren may nay, KHONG can quyen admin.
#   14/10/2026 user: "sao loi hoai vay, phai QC lai code" -> truoc moi lan giao bo cai, chay file nay.
#   Chay DUNG file CAI-PC.ps1 trong repo da clone (nhu PC that), chi THAY cac lenh can admin:
#     Register-ScheduledTask : XML -> bo doc XML that cua Task Scheduler (Schedule.Service NewTask.XmlText) - chinh cho tung vo 0x80041318;
#                              dang cmdlet -> kiem trigger/principal/settings co mat.
#     Unregister/Set-ScheduledTask, icacls, powercfg : ghi lai, khong lam.
#   Moi buoc khac chay THAT: git fetch/reset, chep node.exe, npm install, va Edge ngam, nap khoa (.env), nhip tim THAT len GAS.
#   May quan ly (laptop) -> bo cai tu DUNG may nay tren May tram truoc nhip tim (khong nhan viec).
#   Dung:  powershell -NoProfile -ExecutionPolicy Bypass -File cai-pc\qc-cai-pc.ps1 [-KhoaB64 <chuoi>]
#   -XinKhoa : gia lap PC tai bo cai CONG KHAI (khong khoa): xoa khoa Apps Script khoi .env ban cai thu, khong truyen KhoaB64;
#              1 tien trinh nen dong vai nguoi bam DUYET tren laptop (/api/may-tram/duyet-khoa cua 8591) -> kiem tron luong xin khoa that.
param([string]$KhoaB64 = "", [switch]$XinKhoa)
# 14/10: cai vao thu muc RIENG (C:\AuditFactory that da khoa SYSTEM+Admin sau lan cai admin) — CAI-PC.ps1 doc HSK_CAI_VAO
$GOC = "$env:LOCALAPPDATA\qc-auditfactory"; $env:HSK_CAI_VAO = $GOC
$ErrorActionPreference = "Stop"
$svc = New-Object -ComObject Schedule.Service; $svc.Connect()
# Register-/Get-ScheduledTask la HAM cua module ScheduledTasks: module tu nap SAU se DE ham gia -> nap TRUOC roi moi dat ham gia (bay 14/10)
Import-Module ScheduledTasks
$global:QC = [ordered]@{ taskXml = @(); taskCmdlet = @(); loi = @(); lenhAdmin = @() }

function global:Register-ScheduledTask {
  param($Xml, $TaskName, $Action, $Trigger, $Settings, $Principal, $User, $ErrorAction, [switch]$Force)
  if ($Xml) {
    try { $d = $svc.NewTask(0); $d.XmlText = $Xml; $global:QC.taskXml += "$TaskName OK ($($d.Principal.UserId))" }
    catch { $global:QC.loi += "$TaskName : $($_.Exception.Message)"; throw }   # nem loi y nhu Windows -> bo cai vo dung cho that
  } else {
    $thieu = @(); if (-not $Action) { $thieu += "Action" }; if (-not $Trigger) { $thieu += "Trigger" }; if (-not $Principal) { $thieu += "Principal" }
    foreach ($t in @($Trigger)) { if ($t.Repetition -and $t.Repetition.Interval -and -not $t.Repetition.Duration) { $thieu += "Duration" } }
    if ($thieu) { $global:QC.loi += "$TaskName thieu: $($thieu -join ',')" } else { $global:QC.taskCmdlet += "$TaskName OK (user=$($Principal.UserId), $(@($Trigger).Count) trigger)" }
  }
}
function global:Unregister-ScheduledTask { param($TaskName) $global:QC.lenhAdmin += "Unregister $TaskName" }
function global:Set-ScheduledTask { param($InputObject) }
function global:Get-ScheduledTask {
  param($TaskName, $ErrorAction)
  if ($TaskName -eq "5S Bang xac minh (8591)") { return (ScheduledTasks\Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) }
  return [pscustomobject]@{ TaskName = $TaskName; Settings = [pscustomobject]@{ WakeToRun = $false; StartWhenAvailable = $false; DisallowStartIfOnBatteries = $true; StopIfGoingOnBatteries = $true } }
}
function global:icacls { $global:QC.lenhAdmin += "icacls $($args -join ' ')" }
function global:powercfg { $global:QC.lenhAdmin += "powercfg $($args -join ' ')" }

if ($KhoaB64) { $env:HSK_KHOA_B64 = $KhoaB64 }
# giong CAI-PC-1LAN.bat: keo ban moi TRUOC roi moi chay CAI-PC.ps1 (khong thi chay ban cu da nam tren dia)
if (Test-Path "$GOC\hasaki-repo\.git") {
  $ErrorActionPreference = "Continue"
  git -C "$GOC\hasaki-repo" fetch --depth 1 origin cai-tien/bo-sung-factory 2>&1 | Out-Null
  git -C "$GOC\hasaki-repo" reset --hard origin/cai-tien/bo-sung-factory 2>&1 | Out-Null
  $ErrorActionPreference = "Stop"
  Write-Host "Da keo ban moi: $(git -C "$GOC\hasaki-repo" log --oneline -1)"
}
$tuDuyet = $null
if ($XinKhoa) {
  $KhoaB64 = ""; $env:HSK_KHOA_B64 = ""
  $envThu = "$GOC\hasaki-repo\hasaki\.env"
  if (Test-Path $envThu) { (Get-Content $envThu | Where-Object { $_ -notmatch '^(APPSCRIPT_|TOPREVIEW_|GEMINI_)' }) | Set-Content $envThu -Encoding ascii; Write-Host "XinKhoa: da xoa khoa khoi .env ban cai thu" }
  $may = [System.Net.Dns]::GetHostName()
  $tuDuyet = Start-Job -ArgumentList $may -ScriptBlock { param($may)
    $js = "const M=process.argv[1];for(let i=0;i<120;i++){const j=await (await fetch('http://127.0.0.1:8591/api/may-tram')).json().catch(()=>({}));const x=(j.xin||[]).find(a=>a.may===M&&!a.daDuyet);if(x){const r=await fetch('http://127.0.0.1:8591/api/may-tram/duyet-khoa',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({may:M,dongY:true})});console.log('TU DUYET '+M+' ma '+x.maXN+' -> HTTP '+r.status);process.exit(0)}await new Promise(r=>setTimeout(r,5000))}console.log('TU DUYET: khong thay yeu cau sau 10 phut')"
    node --input-type=module -e $js $may }
}
$caiPs = "$GOC\hasaki-repo\hasaki\cai-pc\CAI-PC.ps1"
if (-not (Test-Path $caiPs)) { $caiPs = Join-Path $PSScriptRoot "CAI-PC.ps1" }   # chua clone: chay ban trong kit (no tu clone)
Write-Host "=== QC bo cai: $caiPs ===" -ForegroundColor Cyan
$ketThuc = "het file"
try { & $caiPs } catch { $ketThuc = "VO: $($_.Exception.Message)`n" + $_.InvocationInfo.PositionMessage + "`n" + $_.ScriptStackTrace }

Write-Host ""
Write-Host "=== KET QUA QC ===" -ForegroundColor Cyan
Write-Host "Task XML (13 viec):"; $global:QC.taskXml | ForEach-Object { Write-Host "   $_" }
Write-Host "Task cmdlet (tu cap nhat + nhip tim):"; $global:QC.taskCmdlet | ForEach-Object { Write-Host "   $_" }
Write-Host "Lenh admin da bo qua: $($global:QC.lenhAdmin.Count)"
Write-Host "Ket thuc: $ketThuc"
if ($tuDuyet) { $kd = Receive-Job $tuDuyet -Wait -AutoRemoveJob 2>&1 | Out-String; Write-Host "Nguoi duyet gia lap: $($kd.Trim())" }
if ($global:QC.loi.Count) { Write-Host "LOI:" -ForegroundColor Red; $global:QC.loi | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }; exit 1 }
