@echo off
rem CANH-BAI-XE.bat - chup cac luot gui xe o bai bao ve/NCC (luat BX-01) : thu muc Videos/5S-bang-chung/bai-xe/NGAY/BAO-CAO.html
rem (goi tu task "5S Canh bai xe sang/chieu"; chay tay cung duoc). Log: canh-bai-xe.log
cd /d "%~dp0"
call "%~dp0XOAY-LOG.bat" runner-gio.log
node runner-gio.mjs "CANH-BAI-XE.bat" >> runner-gio.log 2>&1 || exit /b 0
call "%~dp0XOAY-LOG.bat" canh-bai-xe.log
node canh-bai-xe.mjs >> canh-bai-xe.log 2>&1
python sheet-bai-xe.py --lam >> canh-bai-xe.log 2>&1
