# qc-cai-pc.ps1 - CHAY THU TRON bo cai PC (CAI-PC.ps1) tren may nay, KHONG can quyen admin.
#   14/10/2026 user: "sao loi hoai vay, phai QC lai code" -> truoc moi lan giao bo cai, chay file nay.
#   Chay DUNG file CAI-PC.ps1 trong repo da clone (nhu PC that), chi THAY cac lenh can admin:
#     Register-ScheduledTask : XML -> bo doc XML that cua Task Scheduler (Schedule.Service NewTask.XmlText) - chinh cho tung vo 0x80041318;
#                              dang cmdlet -> kiem trigger/principal/settings co mat.
#     Unregister/Set-ScheduledTask, icacls, powercfg : ghi lai, khong lam.
#   Moi buoc khac chay THAT: git fetch/reset, chep node.exe, npm install, va Edge ngam, nap khoa (.env), nhip tim THAT len GAS.
#   May quan ly (laptop) -> bo cai tu DUNG may nay tren May tram truoc nhip tim (khong nhan viec).
#   Dung:  powershell -NoProfile -ExecutionPolicy Bypass -File cai-pc\qc-cai-pc.ps1 [-KhoaB64 <chuoi>]
param([string]$KhoaB64 = "")
$ErrorActionPreference = "Stop"
$svc = New-Object -ComObject Schedule.Service; $svc.Connect()
$global:QC = [ordered]@{ taskXml = @(); taskCmdlet = @(); loi = @(); lenhAdmin = @() }

function global:Register-ScheduledTask {
  param($Xml, $TaskName, $Action, $Trigger, $Settings, $Principal, [switch]$Force)
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
$caiPs = "C:\AuditFactory\hasaki-repo\hasaki\cai-pc\CAI-PC.ps1"
if (-not (Test-Path $caiPs)) { $caiPs = Join-Path $PSScriptRoot "CAI-PC.ps1" }   # chua clone: chay ban trong kit (no tu clone)
Write-Host "=== QC bo cai: $caiPs ===" -ForegroundColor Cyan
$ketThuc = "het file"
try { & $caiPs } catch { $ketThuc = "VO: $($_.Exception.Message)" }

Write-Host ""
Write-Host "=== KET QUA QC ===" -ForegroundColor Cyan
Write-Host "Task XML (13 viec):"; $global:QC.taskXml | ForEach-Object { Write-Host "   $_" }
Write-Host "Task cmdlet (tu cap nhat + nhip tim):"; $global:QC.taskCmdlet | ForEach-Object { Write-Host "   $_" }
Write-Host "Lenh admin da bo qua: $($global:QC.lenhAdmin.Count)"
Write-Host "Ket thuc: $ketThuc"
if ($global:QC.loi.Count) { Write-Host "LOI:" -ForegroundColor Red; $global:QC.loi | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }; exit 1 }
