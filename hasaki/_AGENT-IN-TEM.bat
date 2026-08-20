@echo off
title Agent in tem SKU - Audit Factory
cd /d "%~dp0"
echo.
echo   Agent in tem dang chay: quet hang doi IN-TEM-CHO moi 6 giay
echo   roi in ra may in tem cua kho. Cu de cua so nay chay.
echo.
echo   Dong cua so = tat agent (lenh in van nam trong hang doi, in lai khi bat lai).
echo.
node in-tem-agent.mjs --dich-vu --nhip 6
echo.
echo   Agent da dung. Bam phim bat ky de dong.
pause >nul
