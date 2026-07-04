@echo off
REM ============================================================
REM  TU DONG 100%: tu Xuat workflow 591 qua API -> tai file -> day 5S-TASKS.
REM  KHONG can bam nut, KHONG can file trong Downloads.
REM  Task Scheduler goi (qua auto-export-hidden.vbs). Log: auto-export.log
REM ============================================================
cd /d "%~dp0"
echo [%date% %time%] Bat dau auto-export... >> auto-export.log
node auto-export-sync.js >> auto-export.log 2>&1
echo [%date% %time%] Ket thuc. >> auto-export.log
echo. >> auto-export.log
