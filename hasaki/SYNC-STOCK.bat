@echo off
REM ============================================================
REM  CUM DONG BO TON KHO FACTORY (3 buoc) - duoc goi tu 2 noi:
REM   1) AUTO-EXPORT.bat  (lich 8h40 - doi tu 7h00 ngay 22/07/2026, chay sau buoc auto-export 5S)
REM   2) sync-guard.js    (watchdog: khi logon +5', moi gio 7-17h,
REM      va khi co co "Tai lai du lieu" tu dashboard)
REM  Cac script ben trong tu tuan thu session-rules.js (uu tien token
REM  bridge, chi re-login SSO trong khung gio an toan; exit 75 = hoan).
REM  Log rieng tung buoc: stocklocation.log / kiemke.log / tonbatthuong.log
REM ============================================================
cd /d "%~dp0"
REM Xoay log truoc khi ghi (log ghi bang >> nen khong tu nho lai - xem XOAY-LOG.bat)
call "%~dp0XOAY-LOG.bat" stocklocation.log
call "%~dp0XOAY-LOG.bat" kiemke.log
call "%~dp0XOAY-LOG.bat" vesinh.log
call "%~dp0XOAY-LOG.bat" tonbatthuong.log

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

echo [%date% %time%] Dong bo VE SINH GOP (Phu trach + Doi chieu cham cong + Yeu cau/Nhat ky, SHOP-170, 1 luot quet)... >> vesinh.log
node sync-vesinh-all.js >> vesinh.log 2>&1
echo [%date% %time%] Ket thuc. >> vesinh.log
echo. >> vesinh.log

REM Bang phan cong phu trach (g-sheet goc + bu bang bao cao gan nhat 30 ngay).
REM Chay SAU sync-vesinh-all vi lay PHU-TRACH-QUAY-KE lam nguon bu. Chi doc Google,
REM khong can token WMS. GAS chua whitelist VESINH-PHANCONG thi tu thoat, khong ghi gi.
echo [%date% %time%] Dong bo BANG PHAN CONG (g-sheet phu trach goc + bu tu planogram)... >> vesinh.log
node sync-phancong.mjs >> vesinh.log 2>&1
echo [%date% %time%] Ket thuc phan cong. >> vesinh.log
echo. >> vesinh.log

echo [%date% %time%] AI xet duyet anh ve sinh (Claude cham request Cho duyet - tu bo qua neu thieu ANTHROPIC_API_KEY)... >> vesinh.log
node sync-vesinh-ai.mjs >> vesinh.log 2>&1
echo [%date% %time%] Ket thuc AI. >> vesinh.log
echo. >> vesinh.log
