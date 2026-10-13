@echo off
title Cai bo co 5S - MOT PHAT (PC noi bo)
rem ============================================================================
rem  CAI-PC-1LAN.bat - tai tu nut tren dashboard Audit Hasaki, chay MOT PHAT la xong:
rem    tu nang quyen admin -> tu lo Node+Git (winget) -> tu tai ma tu GitHub -> tu cai.
rem  Chi can nho link dashboard, bam nut, chay file nay tren PC bat ky.
rem ============================================================================

rem --- tu nang quyen admin (UAC) ---
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

set "REPO=https://github.com/letam0317/th76tamle.git"
set "NHANH=cai-tien/bo-sung-factory"
set "GOC=C:\AuditFactory\hasaki-repo"
set "PATH=%PATH%;%ProgramFiles%\nodejs;%ProgramFiles%\Git\cmd;%ProgramFiles%\Git\bin"

echo.
echo === Cai bo co 5S cho may %COMPUTERNAME% ===
echo.

rem --- Node ---
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [*] Cai Node LTS bang winget...
  winget install -e --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
)
rem --- Git ---
where git >nul 2>&1
if %errorlevel% neq 0 (
  echo [*] Cai Git bang winget...
  winget install -e --id Git.Git --silent --accept-source-agreements --accept-package-agreements
)

rem --- nap lai PATH sau khi winget vua them (phong truong hop) ---
set "PATH=%PATH%;%ProgramFiles%\nodejs;%ProgramFiles%\Git\cmd;%ProgramFiles%\Git\bin"

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo   [X] Van chua co Node. Cai Node LTS tay roi chay lai file nay.
  pause & exit /b 1
)
where git >nul 2>&1
if %errorlevel% neq 0 (
  echo   [X] Van chua co Git. Cai Git tay roi chay lai file nay.
  pause & exit /b 1
)

rem --- tai ma tu GitHub (clone moi, hoac dong bo ban moi neu da co) ---
if exist "%GOC%\.git" (
  echo [*] Da co ma, dong bo ban moi...
  git -C "%GOC%" fetch --depth 1 origin %NHANH%
  git -C "%GOC%" reset --hard origin/%NHANH%
) else (
  echo [*] Tai ma lan dau...
  if not exist "C:\AuditFactory" mkdir "C:\AuditFactory"
  git clone --branch %NHANH% "%REPO%" "%GOC%"
)
if not exist "%GOC%\hasaki\cai-pc\CAI-PC.ps1" (
  echo   [X] Tai ma that bai - kiem tra mang roi chay lai.
  pause & exit /b 1
)

rem --- chay bo cai chinh (no lo: npm install, cac task, nhip tim, tu cap nhat...) ---
echo [*] Chay bo cai...
powershell -NoProfile -ExecutionPolicy Bypass -File "%GOC%\hasaki\cai-pc\CAI-PC.ps1"

echo.
echo === XONG. Doc dong [CON LAM TAY] o tren (dien .env neu can). ===
pause
