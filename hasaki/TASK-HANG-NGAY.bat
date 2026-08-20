@echo off
REM ============================================================
REM  LUU Y 19/08/2026: lich "5S Task hang ngay" 16:00 DA TAT (Disabled).
REM   Duong mac dinh bay gio la BAM NUT: NUT-NOP-TASK.bat (co hoi truoc khi nop).
REM   File nay la duong KHONG HOI - giu lai cho luot chay tay hoac khi bat lai lich
REM   (Enable-ScheduledTask -TaskName '5S Task hang ngay').
REM ============================================================
REM  BAO CAO 9 TASK HANG NGAY tren work.hasaki.vn - nhip 16:00
REM   B1: lam tuoi so lieu kiem ke trong ngay (PC_DELTA=1: chi cua so hom nay,
REM       vai luot goi WMS) de con so trong bao cao dung tai thoi diem 16h.
REM       Tat buoc nay: dat TASK_BO_QUA_LAM_TUOI=1 trong .env
REM   B2: nop bao cao (tu bo qua task da nop -> chay lai nhieu lan vo hai)
REM  Chi chay duoc khi phien work cua nguoi dang song (khong tu dang nhap).
REM  Chi tiet: TASK-HANG-NGAY.md      Log: task-hangngay.log
REM ============================================================
cd /d "%~dp0"
call "%~dp0XOAY-LOG.bat" task-hangngay.log
if "%TASK_BO_QUA_LAM_TUOI%"=="1" goto NOP
echo [%date% %time%] Lam tuoi kiem ke (PC_DELTA) truoc khi bao cao... >> task-hangngay.log
set PC_DELTA=1
node push-pc-to-sheet.mjs >> kiemke.log 2>&1
set PC_DELTA=
:NOP
echo [%date% %time%] Nop bao cao task hang ngay... >> task-hangngay.log
node task-hangngay.mjs --nop >> task-hangngay.log 2>&1
echo [%date% %time%] Ket thuc. >> task-hangngay.log
echo. >> task-hangngay.log
