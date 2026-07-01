@echo off
REM ============================================================
REM  Bo canh: kiem tra co "Yeu cau dang nhap" (bam tu email) moi 2 phut.
REM  Co -> tu mo man hinh dang nhap tren may nay. Task Scheduler goi file nay.
REM ============================================================
cd /d "%~dp0"
node watch-login-request.js >> watch-login.log 2>&1
