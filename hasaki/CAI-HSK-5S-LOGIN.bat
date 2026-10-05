@echo off
REM CAI-HSK-5S-LOGIN.bat - cai agent ghi nhan dang nhap (doi chieu 5S) lam scheduled task moi 5 phut.
REM MINH BACH: task ten "HSK 5S - ghi nhan dang nhap", chay ngu canh USER (khong SYSTEM),
REM   CHI doc ho so trinh duyet cua chinh user + gui 1 dong ra GAS. KHONG nhan lenh xa, KHONG tu cap nhat.
REM Cai TAI MAY (option 3): chep ca thu muc nay vao may roi bam chay file nay.
REM Go bo:  schtasks /Delete /TN "HSK 5S - ghi nhan dang nhap" /F
setlocal
set VBS=%~dp0_HSK-5S-LOGIN.vbs
schtasks /Create /TN "HSK 5S - ghi nhan dang nhap" /TR "wscript //nologo \"%VBS%\"" /SC MINUTE /MO 5 /RL LIMITED /F
if %ERRORLEVEL%==0 (
  echo.
  echo [OK] Da cai. Task "HSK 5S - ghi nhan dang nhap" chay moi 5 phut trong ngu canh user.
  echo Nhat ky:  %~dp0.pc-login-agent.log
  echo Go bo:    schtasks /Delete /TN "HSK 5S - ghi nhan dang nhap" /F
) else (
  echo [LOI] Khong tao duoc task. Thu chay lai file nay.
)
echo.
pause
