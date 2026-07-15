@echo off
REM ============================================================
REM  BAN NHAP kiemsoatkho: static server noi bo (KHONG dung file:///)
REM  Mo trinh duyet: http://localhost:8080/?company=factory^&tab=fstock^&dev=1
REM ============================================================
cd /d "%~dp0"
start "" "http://localhost:8080/?company=factory&tab=fstock&dev=1"
node dev-server.mjs
