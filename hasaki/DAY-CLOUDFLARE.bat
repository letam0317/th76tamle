@echo off
rem DAY-CLOUDFLARE.bat - 13/10/2026: dong bo 2 dashboard (repo GitHub kiemsoatkho + stocklocationfactory) len audit-dc.pages.dev
rem (goi tu task "5S Day Cloudflare audit-dc" MOI 60 PHUT - 14/10 user; khong doi thi bo qua). --lich = luot DUY NHAT duoc day nhanh main. Log: day-cloudflare.log
cd /d "%~dp0"
call "%~dp0XOAY-LOG.bat" day-cloudflare.log
node day-cloudflare.mjs --lich >> day-cloudflare.log 2>&1
