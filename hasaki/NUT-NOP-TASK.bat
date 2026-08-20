@echo off
REM ============================================================
REM  NUT NOP BAO CAO 9 TASK HANG NGAY (work.hasaki.vn) — BAM TAY
REM  Chot 19/08/2026: bot KHONG con tu nop. Lich "5S Task hang ngay"
REM  16:00 da TAT. Tu nay chi 2 duong:
REM     * can bot nop  -> BAM NUT NAY (shortcut ngoai Desktop)
REM     * khong can    -> tu bam Hoan thanh tren work.hasaki.vn
REM  Luong nut: lam tuoi so lieu neu mocs cu -> in ban nhap tung task
REM             -> HOI (Enter = ca / a = chi nhom A / k = thoi) -> nop.
REM  Bam bao nhieu lan cung vo hai: task da nop se tu bo qua.
REM  Chi tiet: TASK-HANG-NGAY.md      Log: task-hangngay.log
REM ============================================================
chcp 65001 > nul
cd /d "%~dp0"
title Nop bao cao task hang ngay - work.hasaki.vn
call "%~dp0XOAY-LOG.bat" task-hangngay.log
call "%~dp0XOAY-LOG.bat" nut.log
echo [%date% %time%] NGUOI BAM NUT NUT-NOP-TASK.bat >> task-hangngay.log
node task-hangngay.mjs --nut
echo.
echo ============================================================
echo  Xong. Nhan phim bat ky de dong cua so.
pause > nul
