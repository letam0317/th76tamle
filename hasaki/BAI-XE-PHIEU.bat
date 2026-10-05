@echo off
rem BAI-XE-PHIEU.bat - doc quyet dinh tren g-sheet BAI XE NCC roi lap phieu 5S + chuyen B1.1 (luat BX-01). Log: bai-xe-phieu.log
cd /d "%~dp0"
call "%~dp0XOAY-LOG.bat" runner-gio.log
node runner-gio.mjs "BAI-XE-PHIEU.bat" >> runner-gio.log 2>&1 || exit /b 0
call "%~dp0XOAY-LOG.bat" bai-xe-phieu.log
python sheet-bai-xe.py --doc >> bai-xe-phieu.log 2>&1 || exit /b 0
node bai-xe-phieu.mjs --lam >> bai-xe-phieu.log 2>&1
