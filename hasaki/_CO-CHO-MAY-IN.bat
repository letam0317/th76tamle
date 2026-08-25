@echo off
rem ==================================================================
rem  _CO-CHO-MAY-IN.bat - CHAY TREN MAY DANG CAM MAY IN TEM
rem                       (Desktop-je75k38), KHONG phai may chay agent.
rem
rem  Bam PHAI vao file nay -> "Run as administrator".
rem
rem  Script se DOC truoc (nep tat/bat 10 ngay, spooler, may in, card mang)
rem  roi hoi Enter moi bat dau sua. Chay lai nhieu lan vo hai.
rem ==================================================================
title Co cho may in tem - chay tren may cam may in
cd /d "%~dp0"

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo.
  echo   CHUA CO QUYEN ADMIN.
  echo   Dong cua so nay, bam PHAI vao _CO-CHO-MAY-IN.bat -^> Run as administrator
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_CO-CHO-MAY-IN.ps1"
