@echo off
rem ============================================================
rem  CAI-CO-CHO.bat - bam dup de cai bo CO CHO cho may tram.
rem  Tu xin quyen Admin - BAT BUOC: do 21/08/2026 tren may nay,
rem  Register-ScheduledTask khong nang quyen la "Access is denied".
rem  Chay lai nhieu lan vo hai - moi buoc deu ghi de.
rem ============================================================
title Cai bo CO CHO may tram - Audit Factory
cd /d "%~dp0"

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo.
  echo   Dang xin quyen Admin... bam Yes o hop thoai UAC.
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CAI-CO-CHO.ps1"
echo.
echo   Xong. Bam phim bat ky de dong.
pause >nul
