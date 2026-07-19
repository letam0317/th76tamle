@echo off
REM ============================================================
REM  TU DONG 100%: tu Xuat workflow 591 qua API -> tai file -> day 5S-TASKS.
REM  KHONG can bam nut, KHONG can file trong Downloads.
REM  Task Scheduler goi (qua auto-export-hidden.vbs). Log: auto-export.log
REM ============================================================
cd /d "%~dp0"
echo [%date% %time%] Bat dau auto-export... >> auto-export.log
node auto-export-sync.js >> auto-export.log 2>&1
echo [%date% %time%] Ket thuc. >> auto-export.log
echo. >> auto-export.log

REM --- NOI LUONG: Ton ma vi tri (stock-location) WMS -> Sheet stocklocationfactory ---
REM Chay NGAY SAU auto-export: phien SSO + kho token vua duoc lam tuoi -> lay token WMS
REM im lang, khong dang nhap lai. Log rieng: stocklocation.log
echo [%date% %time%] Dong bo Ton ma vi tri (stock-location)... >> stocklocation.log
node sync-stocklocation.js >> stocklocation.log 2>&1
echo [%date% %time%] Ket thuc. >> stocklocation.log
echo. >> stocklocation.log

REM --- NOI LUONG: Kiem ke physical-count THAT (type-sku + type-location) -> tab kiemke-* ---
REM Dung lai token "wms" vua nap o buoc tren (TTL 40') -> KHONG mo Edge, KHONG dang nhap them.
REM Khoang ngay dem DONG: 90 ngay gan nhat (override PC_TU_NGAY / PC_FROM_MS / PC_TO_MS).
echo [%date% %time%] Dong bo Kiem ke (physical-count)... >> kiemke.log
node push-pc-to-sheet.mjs >> kiemke.log 2>&1
echo [%date% %time%] Ket thuc. >> kiemke.log
echo. >> kiemke.log

REM --- NOI LUONG: Ton kho bat thuong (stock-inventories) -> tab stock-inventory-beta ---
REM Cung dung token "wms" trong kho -> van chi 1 lan dang nhap cho ca cum 7h.
echo [%date% %time%] Dong bo Ton kho bat thuong... >> tonbatthuong.log
node sync-tonbatthuong.js >> tonbatthuong.log 2>&1
echo [%date% %time%] Ket thuc. >> tonbatthuong.log
echo. >> tonbatthuong.log
