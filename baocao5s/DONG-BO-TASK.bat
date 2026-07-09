@echo off
REM ============================================================
REM  Dong bo TOAN BO task workflow 591 -> tab 5S-TASKS (cho dashboard)
REM  KHONG tao task, KHONG dung inbox -> khong gay trung lap.
REM  Bam dup de chay tay khi can cap nhat dashboard.
REM ============================================================
cd /d "%~dp0"
echo [%date% %time%] Bat dau dong bo task (tu file Export trong Downloads)... >> dong-bo-task.log
node sync-board-to-sheet.js >> dong-bo-task.log 2>&1
echo [%date% %time%] Ket thuc. >> dong-bo-task.log
echo. >> dong-bo-task.log
REM Chay xong tu dong dong cua so ngay (log ghi vao dong-bo-task.log).
