@echo off
REM ============================================================
REM  TAT 2 tac vu "co cho" cua Factory (dang ky o quyen cao -> can UAC)
REM    · Factory co cho may tram      (moi 2', + khi dang nhap / cam sac / thuc day)
REM    · Factory co cho bat may sang  (6h50 hang ngay)
REM  Ca hai chi lam 2 viec: danh thuc may in bang Wake-on-LAN va nuoi agent in tem
REM  DU PHONG tren laptop. Agent THAT chay tren may cam may in (Desktop-JE75K38),
REM  nen tat o day KHONG lam mat duong in tem.
REM  Bat lai: BAT-LAI-FACTORY.bat
REM ============================================================
title Tat co cho Factory
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Dang xin quyen quan tri...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
echo.
powershell -NoProfile -Command "@('Factory co cho may tram','Factory co cho bat may sang') | ForEach-Object { try { Disable-ScheduledTask -TaskName $_ -ErrorAction Stop | Out-Null; Write-Host ('  TAT OK : ' + $_) } catch { Write-Host ('  TAT LOI: ' + $_ + ' -> ' + $_.Exception.Message) } }"
echo.
powershell -NoProfile -Command "Get-ScheduledTask | Where-Object TaskName -like 'Factory*' | Select-Object TaskName, State | Format-Table -AutoSize"
pause
