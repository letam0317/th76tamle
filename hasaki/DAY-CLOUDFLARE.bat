@echo off
rem DAY-CLOUDFLARE.bat - 13/10/2026: dong bo 2 dashboard (repo GitHub kiemsoatkho + stocklocationfactory) len audit-dc.pages.dev
rem (goi tu task "5S Day Cloudflare audit-dc" moi 2 gio; khong doi thi bo qua, toi da 12 luot/ngay). Log: day-cloudflare.log
cd /d "%~dp0"
call "%~dp0XOAY-LOG.bat" day-cloudflare.log
node day-cloudflare.mjs >> day-cloudflare.log 2>&1
