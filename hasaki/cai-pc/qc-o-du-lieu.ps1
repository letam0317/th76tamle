$ErrorActionPreference = "Stop"
$GOC_THU = Join-Path $env:TEMP "qc-o-du-lieu"; if (Test-Path $GOC_THU) { cmd /c rmdir /s /q "$GOC_THU" }
$du = "$GOC_THU\du-an"; New-Item -ItemType Directory -Force "$du\.exports\.bai-xe-tam\2026-10-20", "$du\.exports\agy-xm", "$du\.exports\xm-tu-dong\123", "$GOC_THU\o-c\bang-chung\bai-xe\2026-10-20" | Out-Null
"v" | Out-File "$du\.exports\.bai-xe-tam\2026-10-20\a.mp4"; "b" | Out-File "$du\.exports\agy-xm\b.jpg"; "c" | Out-File "$du\.exports\xm-tu-dong\123\BAO-CAO.md"; "k" | Out-File "$GOC_THU\o-c\bang-chung\bai-xe\2026-10-20\k.jpg"
"APPSCRIPT_KEY=x`r`nBAIXE_DIR=C:/AuditFactory/bang-chung/bai-xe" | Out-File "$du\.env" -Encoding utf8
$script:nk = @(); function Ghi($m) { $script:nk += $m }
. "C:\Users\lechitam\New folder\hasaki\cai-pc\o-du-lieu.ps1"
$r1 = Doi-ODuLieu $du $GOC_THU; $r2 = Doi-ODuLieu $du $GOC_THU
$ok = 0; $hong = @(); function K($dk, $ten) { if ($dk) { $script:ok++ } else { $script:hong += $ten } }
foreach ($t in ".bai-xe-tam", "agy-xm", "xm-tu-dong") { $i = Get-Item "$du\.exports\$t" -Force; K ([bool]($i.Attributes -band [IO.FileAttributes]::ReparsePoint)) "junction $t" }
K (Test-Path "$du\.exports\.bai-xe-tam\2026-10-20\a.mp4") "doc file qua junction"
K (Test-Path "$GOC_THU\o-phu\du-lieu\agy-xm\b.jpg") "file nam that o o phu"
K (Test-Path "$GOC_THU\o-phu\bang-chung\bai-xe\2026-10-20\k.jpg") "bang chung cu chuyen sang o phu"
K (-not (Test-Path "$GOC_THU\o-c\bang-chung\bai-xe\2026-10-20\k.jpg")) "o C khong con ban cu"
$env1 = Get-Content "$du\.env"; K ($env1 -contains "BAIXE_DIR=$($r1)" -and $r1 -like "*o-phu/bang-chung/bai-xe") ".env BAIXE_DIR -> $r1"; K ($env1 -contains "APPSCRIPT_KEY=x") ".env giu khoa khac"
K (($env1 | Where-Object { $_ -match '^BAIXE_DIR' }).Count -eq 1) ".env 1 dong BAIXE_DIR"
K (-not ($script:nk -match '^\[X\]')) ("khong loi: " + ($script:nk -join " | "))
K (Test-Path "$du\.exports\cam-baocao") "tao junction cho thu muc chua co (cam-baocao)"
"`n" + $ok + " dat / " + $hong.Count + " hong" ; $hong; "nhat ky: " + ($script:nk -join " | ")
Get-ChildItem -Recurse -Force $GOC_THU | ForEach-Object { $_.FullName.Replace($GOC_THU,"") + $(if ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) {" [J]"}) }; cmd /c rmdir /s /q "$GOC_THU"
