@echo off
REM CAI-PC-LOGIN-AGENT.bat - cai agent theo doi dang nhap (PILOT) lam scheduled task chay moi 5 phut.
REM Bam PHAI vao file nay -> "Run as administrator" (tao task can quyen admin do UAC).
REM Agent CHI doc: may nao / user Windows / tai khoan WMS @hasaki / IP / gio - ghi log cuc bo.
REM Go bo:  schtasks /Delete /TN "PC-login-agent-pilot" /F
setlocal
set VBS=%~dp0_PC-LOGIN-AGENT.vbs
schtasks /Create /TN "PC-login-agent-pilot" /TR "wscript //nologo \"%VBS%\"" /SC MINUTE /MO 5 /RL LIMITED /F
if %ERRORLEVEL%==0 (
  echo.
  echo [OK] Da cai. Task "PC-login-agent-pilot" chay moi 5 phut.
  echo Nhat ky: %~dp0.pc-login-agent.log
  echo Go bo:   schtasks /Delete /TN "PC-login-agent-pilot" /F
) else (
  echo [LOI] Khong tao duoc task. Hay chac chan da "Run as administrator".
)
echo.
pause
