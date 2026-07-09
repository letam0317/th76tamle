@echo off
REM ============================================================
REM  Bo day bao cao 5S sang workflow 591 (work.hasaki.vn)
REM  Bam dup file nay de day thu cong, hoac de Task Scheduler goi.
REM  Moi lan chay ghi log vao day-bao-cao-5s.log
REM ============================================================
cd /d "%~dp0"
echo [%date% %time%] Bat dau day bao cao 5S... >> day-bao-cao-5s.log
node push-5s-to-workflow.js >> day-bao-cao-5s.log 2>&1
echo [%date% %time%] Ket thuc. >> day-bao-cao-5s.log
echo. >> day-bao-cao-5s.log
REM Chay xong tu dong dong cua so ngay (log ghi vao day-bao-cao-5s.log).
