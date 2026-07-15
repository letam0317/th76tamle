@echo off
REM ============================================================
REM  Chay TAY: Dong bo "Ton ma vi tri" (stock-location) WMS
REM  -> Google Sheet stocklocationfactory (2 tab mastige/garment).
REM  Binh thuong KHONG can bam - da noi vao lich 7h00 (AUTO-EXPORT.bat).
REM  Log: stocklocation.log
REM ============================================================
cd /d "%~dp0"
echo [%date% %time%] Dong bo Ton ma vi tri (chay tay)... >> stocklocation.log
node sync-stocklocation.js
echo [%date% %time%] Ket thuc (chay tay). >> stocklocation.log
echo. >> stocklocation.log
echo.
echo Xong. Cua so tu dong dong sau 5 giay.
timeout /t 5 >nul
