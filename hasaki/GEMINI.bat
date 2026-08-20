@echo off
REM ============================================================
REM  GEMINI PRO TRONG TERMINAL — qua ANTIGRAVITY CLI (agy).
REM  Chot 19/08/2026: Google da TAT Gemini CLI cho moi tai khoan ca nhan
REM  (free / AI Pro / AI Ultra) tu 18/06/2026 -> loi UNSUPPORTED_CLIENT.
REM  Thay the chinh chu la Antigravity CLI: 1 binary, lenh "agy".
REM  Khoa GEMINI_API_KEY trong .env chi la FREE TIER (chi Flash), Pro tra 429
REM  -> muon Pro thi phai DANG NHAP GOOGLE bang tai khoan co AI Pro.
REM     * khong co args  -> mo che do chat tai goc du an (thay ca hasaki + factory)
REM     * co args        -> hoi 1 phat roi thoat:  GEMINI.bat "cau hoi cua toi"
REM  Chua dang nhap? Cua so nay se in link -> mo link, duyet, xong.
REM  Chi tiet + bay: GEMINI-CLI.md
REM ============================================================
chcp 65001 > nul
set "PATH=%PATH%;%LOCALAPPDATA%\agy\bin"
cd /d "%~dp0.."
title Gemini Pro (agy) - %CD%

where agy >nul 2>nul
if errorlevel 1 (
  echo ============================================================
  echo  KHONG THAY "agy". Cai lai bang 1 dong trong PowerShell:
  echo     irm https://antigravity.google/cli/install.ps1 ^| iex
  echo ============================================================
  pause > nul
  goto :eof
)

if "%~1"=="" (
  agy
) else (
  agy -p "%~1"
  echo.
  echo ============================================================
  echo  Xong. Nhan phim bat ky de dong cua so.
  pause > nul
)
