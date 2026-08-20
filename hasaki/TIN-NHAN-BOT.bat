@echo off
REM ============================================================
REM  KENH RA LENH BANG TIN NHAN (Telegram) - MOT LUOT NGHE ~100 giay
REM  Task Scheduler "5S Kenh tin nhan" goi moi 2' qua tin-nhan-hidden.vbs
REM  => phu gan lien tuc ma khong can dich vu thuong tru (may tat/bat,
REM     script chet thi luot sau tu len lai).
REM  Chua khai TELEGRAM_BOT_TOKEN trong .env: script thoat em, khong lam gi.
REM  Cai dat lan dau: bam GHEP-NOI-TIN-NHAN.bat
REM  Chi tiet: KENH-TIN-NHAN.md      Log: tin-nhan.log
REM ============================================================
cd /d "%~dp0"
call "%~dp0XOAY-LOG.bat" tin-nhan.log
node tin-nhan-bot.mjs >> tin-nhan.log 2>&1
