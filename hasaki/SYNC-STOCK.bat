@echo off
REM ============================================================
REM  CUM DONG BO TON KHO FACTORY (3 buoc) — duoc goi tu 2 noi:
REM   1) AUTO-EXPORT.bat  (lich 7h00, chay sau buoc auto-export 5S)
REM   2) sync-guard.js    (watchdog: khi logon +5', moi gio 7-17h,
REM      va khi co co "Tai lai du lieu" tu dashboard)
REM  Cac script ben trong tu tuan thu session-rules.js (uu tien token
REM  bridge, chi re-login SSO trong khung gio an toan; exit 75 = hoan).
REM  Log rieng tung buoc: stocklocation.log / kiemke.log / tonbatthuong.log
REM ============================================================
cd /d "%~dp0"

echo [%date% %time%] Dong bo Ton ma vi tri (stock-location)... >> stocklocation.log
node sync-stocklocation.js >> stocklocation.log 2>&1
echo [%date% %time%] Ket thuc. >> stocklocation.log
echo. >> stocklocation.log

echo [%date% %time%] Dong bo Kiem ke (physical-count)... >> kiemke.log
node push-pc-to-sheet.mjs >> kiemke.log 2>&1
echo [%date% %time%] Ket thuc. >> kiemke.log
echo. >> kiemke.log

echo [%date% %time%] Dong bo Ton kho bat thuong... >> tonbatthuong.log
node sync-tonbatthuong.js >> tonbatthuong.log 2>&1
echo [%date% %time%] Ket thuc. >> tonbatthuong.log
echo. >> tonbatthuong.log
