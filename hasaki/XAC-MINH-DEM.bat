@echo off
rem XAC-MINH-DEM.bat - moi toi: xac minh camera <=5 phieu B1 (TB-01/02/03, A1-01) bang xac-minh-tu-dong.mjs -> bang noi bo Viec 5S. Khong ghi phieu.
rem (goi tu task "5S Xac minh camera toi"; chay tay cung duoc). Log: xac-minh-dem.log
cd /d "%~dp0"
call "%~dp0XOAY-LOG.bat" xac-minh-dem.log
node xac-minh-dem.mjs >> xac-minh-dem.log 2>&1
