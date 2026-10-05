@echo off
REM CAI-PC-AGENT-1-CLICK.bat - Cai dat tac vu bao cao dang nhap PC (Agent A8)
REM BAM PHAI CHUOT -> RUN AS ADMINISTRATOR

echo ===================================================
echo   CAI DAT AGENT THEO DOI DANG NHAP PC (1-CLICK)
echo ===================================================

set PS_FILE=%~dp0pc-agent.ps1

REM Kiem tra xem file ps1 co ton tai khong
if not exist "%PS_FILE%" (
    echo [LOI] Khong tim thay file %PS_FILE%
    pause
    exit /b
)

REM Tao tac vu len lich (Scheduled Task) chay moi 5 phut, an hoan toan
schtasks /Create /TN "Hasaki_PC_Login_Agent" /TR "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%PS_FILE%\"" /SC MINUTE /MO 5 /RL LIMITED /F

if %ERRORLEVEL%==0 (
    echo.
    echo [THANH CONG] Da cai dat xong! Agent se chay ngam moi 5 phut.
    echo Khong lam phien nguoi dung. De go bo, dung lenh:
    echo schtasks /Delete /TN "Hasaki_PC_Login_Agent" /F
) else (
    echo.
    echo [LOI] Khong tao duoc tac vu. Vui long kiem tra lai xem ban da 
    echo chay bang quyen "Run as administrator" chua!
)

echo.
pause
