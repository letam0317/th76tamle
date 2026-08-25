@echo off
REM ============================================================
REM  BAT LAI cac tac vu "Factory" da tat ngay 23/08/2026
REM  (tat theo yeu cau chu may: cac cua so an mang ten Factory)
REM
REM  Tat bang:  powershell -Command "Disable-ScheduledTask -TaskName '<ten>'"
REM  Xem trang thai: powershell -Command "Get-ScheduledTask | ? TaskName -like 'Factory*'"
REM ============================================================
title Bat lai tac vu Factory
echo Dang bat lai cac tac vu Factory...
echo.
powershell -NoProfile -Command "@('Factory agent in tem','Factory co cho may tram','Factory co cho bat may sang','Factory watchdog ton kho') | ForEach-Object { $t = Get-ScheduledTask -TaskName $_ -ErrorAction SilentlyContinue; if ($t) { if ($t.State -eq 'Disabled') { Enable-ScheduledTask -TaskName $_ | Out-Null; Write-Host ('  BAT LAI : ' + $_) } else { Write-Host ('  dang chay: ' + $_) } } else { Write-Host ('  khong thay: ' + $_) } }"
echo.
echo Xong. Agent in tem se tu len lai trong vong 5 phut (task lap moi 5').
pause
