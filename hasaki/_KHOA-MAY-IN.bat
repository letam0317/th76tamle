@echo off
title Khoa may in tem (chi doi Spooler + chia se, khong in thu)
net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo   CAN QUYEN ADMIN: bam PHAI vao file nay -^> Run as administrator
  echo.
  pause
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_KHOA-MAY-IN.ps1"
