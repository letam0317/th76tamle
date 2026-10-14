@echo off
rem DAY-CLOUDFLARE.bat - 13/10/2026: dong bo 2 dashboard (repo GitHub kiemsoatkho + stocklocationfactory) len audit-dc.pages.dev
rem (goi tu task "5S Day Cloudflare audit-dc" MOI 10 PHUT - luoi an toan; 14/10 user: goi tay = hen 2 phut day ngay, ngan sach 500 luot/thang). Log: day-cloudflare.log
cd /d "%~dp0"
call "%~dp0XOAY-LOG.bat" day-cloudflare.log
node day-cloudflare.mjs --lich >> day-cloudflare.log 2>&1
