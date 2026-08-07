@echo off
REM ============================================================
REM  Bo canh: kiem tra co "Yeu cau dang nhap" (bam tu email) moi 2 phut.
REM  Co -> tu mo man hinh dang nhap tren may nay. Task Scheduler goi file nay.
REM ============================================================
cd /d "%~dp0"
REM Xoay log truoc khi ghi (log ghi bang >> nen khong tu nho lai - xem XOAY-LOG.bat)
call "%~dp0XOAY-LOG.bat" watch-login.log
call "%~dp0XOAY-LOG.bat" poller.log
call "%~dp0XOAY-LOG.bat" sync-guard.log
call "%~dp0XOAY-LOG.bat" session-ledger.log
node watch-login-request.js >> watch-login.log 2>&1
