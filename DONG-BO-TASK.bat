@echo off
REM ============================================================
REM  Dong bo TOAN BO task workflow 591 -> tab 5S-TASKS (cho dashboard)
REM  KHONG tao task, KHONG dung inbox -> khong gay trung lap.
REM  Bam dup de chay tay khi can cap nhat dashboard.
REM ============================================================
cd /d "%~dp0"
echo [%date% %time%] Bat dau dong bo task (tu file Export trong Downloads)...
echo LUU Y: hay bam nut Export tren workflow 591 truoc khi chay file nay.
node sync-board-to-sheet.js
echo.
echo Xong. (Dong cua so sau 8 giay)
timeout /t 8 >nul
