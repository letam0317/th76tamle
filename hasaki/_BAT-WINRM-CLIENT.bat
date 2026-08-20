@echo off
title Bat WinRM chi doc (CLIENT)
net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo   CAN QUYEN ADMIN: bam PHAI vao file nay -^> Run as administrator
  echo.
  pause
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_BAT-WINRM-CLIENT.ps1"
