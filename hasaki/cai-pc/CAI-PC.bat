@echo off
rem Bam PHAI vao file nay -> Run as administrator (tren PC noi bo can cai).
rem KHONG can nhap vai: may tu lay viec theo hostname trong dieu-phoi.json.
title Cai bo co 5S cho PC noi bo (theo dieu phoi)
cd /d "%~dp0"
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo.
  echo   CHUA CO QUYEN ADMIN. Bam PHAI vao CAI-PC.bat -^> Run as administrator
  echo.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CAI-PC.ps1"
echo.
pause
