@echo off
REM SOI-PC-A8.bat - chay cong cu do kha thi Phase 0 (theo doi dang nhap PC khu A8).
REM   - Double-click: chi QUET kiem ke (khong can Admin).
REM   - Muon THU doc dinh danh tu xa: bam phai -> Run as administrator, hoac chay:
REM        SOI-PC-A8.bat -CredTest
REM   - Truyen them tham so tuy y, vd:  SOI-PC-A8.bat -CredTest -Sample 5 -Subnet 172.16.0.0/22
REM PHAI chay TREN MAY DANG O MANG CONG TY (172.16.x) hoac dang bat OpenVPN.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0soi-pc-a8.ps1" %*
echo.
pause
