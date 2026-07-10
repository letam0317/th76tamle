@echo off
REM ============================================================
REM  Keo cham cong (Phat trien cua hang + Dong goi) tu hr.hasaki.vn
REM  -> ghi tab CHAM-CONG. Task Scheduler goi qua cham-cong-hidden.vbs.
REM  Log: cham-cong.log
REM ============================================================
cd /d "%~dp0"
echo [%date% %time%] Bat dau lay cham cong... >> cham-cong.log
node pull-timesheet.js >> cham-cong.log 2>&1
echo [%date% %time%] Ket thuc. >> cham-cong.log
echo. >> cham-cong.log
