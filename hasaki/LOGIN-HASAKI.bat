@echo off
REM ============================================================
REM  Dang nhap lai work.hasaki.vn (mo Edge de nhap email + OTP).
REM  Duoc goi khi bam nut trong email canh bao (giao thuc hasaki5s://).
REM  Cua so hien de ban thao tac dang nhap; xong tu dong.
REM ============================================================
cd /d "%~dp0"
echo ================================================================
echo   DANG NHAP LAI work.hasaki.vn
echo   Cua so Edge se mo ra - hay dang nhap (email + OTP) roi dong Edge.
echo ================================================================
echo.
node login-hasaki.js
echo.
echo Xong. Cua so tu dong dong sau 5 giay.
timeout /t 5 >nul
