@echo off
REM ============================================================
REM  TU DONG 100%: tu Xuat workflow 591 qua API -> tai file -> day 5S-TASKS.
REM  KHONG can bam nut, KHONG can file trong Downloads.
REM  Task Scheduler goi (qua auto-export-hidden.vbs). Log: auto-export.log
REM ============================================================
cd /d "%~dp0"
REM Xoay log truoc khi ghi (log ghi bang >> nen khong tu nho lai - xem XOAY-LOG.bat)
call "%~dp0XOAY-LOG.bat" auto-export.log
echo [%date% %time%] Bat dau auto-export... >> auto-export.log
node auto-export-sync.js >> auto-export.log 2>&1
echo [%date% %time%] Ket thuc. >> auto-export.log
echo. >> auto-export.log

REM --- NOI LUONG: cum dong bo ton kho factory (stock-location + kiem ke + ton bat thuong) ---
REM Da tach ra SYNC-STOCK.bat de watchdog sync-guard.js goi lai duoc khi that bai
REM (may tat luc 7h / restart giua chung / token chet). Log rieng tung buoc nhu cu.
call "%~dp0SYNC-STOCK.bat"
