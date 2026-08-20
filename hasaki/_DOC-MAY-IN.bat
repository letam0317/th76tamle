@echo off
title Doc cau hinh in tem (chi doc, khong sua gi)
echo.
echo   Dang doc cau hinh may in + form BarTender tren may nay...
echo   (chi DOC, khong in thu, khong doi cai dat)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_DOC-MAY-IN.ps1"
echo.
echo   Xong. Bam phim bat ky de dong.
pause >nul
