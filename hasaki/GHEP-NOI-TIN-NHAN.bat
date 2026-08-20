@echo off
REM ============================================================
REM  GHEP NOI KENH TIN NHAN (chay 1 lan luc cai dat)
REM   B1: tao bot bang @BotFather trong Telegram (script se huong dan)
REM   B2: dan token vao hasaki\.env  ->  TELEGRAM_BOT_TOKEN=...
REM   B3: bam lai file nay, roi nhan 1 tin cho bot -> no tu bat chat_id
REM       va ghi vao .env. Xong la kenh song, khong phai lam gi them.
REM ============================================================
chcp 65001 > nul
cd /d "%~dp0"
title Ghep noi kenh tin nhan
node tin-nhan-bot.mjs --ghepnoi
echo.
echo ============================================================
echo  Nhan phim bat ky de dong.
pause > nul
