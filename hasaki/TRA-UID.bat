@echo off
REM ============================================================
REM  TRA UID tren Google Sheet — dien SKU / ten SP / kho cho cac dong dang cho.
REM  Task Scheduler goi moi 1 PHUT (qua tra-uid-hidden.vbs). Moi luot o lai canh 51 giay
REM  (--loop 0.85) roi thoat -> cac luot noi duoi nhau = canh gan nhu lien tuc, nguoi go UID
REM  thay ket qua sau ~5-9 giay ke ca luc "nguoi". Thoat truoc nhip ke tiep de khoa khong chan.
REM  Vi sao co lich RIENG (17/08/2026): buoc nay tung nam trong watch-login-request.js,
REM  nhung bo canh do hay ban chay auto-export / sync-guard / stocklocation nhieu phut
REM  -> luot tra UID phai xep hang (do that: 181 giay). Tach ra thi khong ai chan ai.
REM  Log: tra-uid.log — script tu giu khoa .tra-uid.lock nen khong chay chong.
REM ============================================================
cd /d "%~dp0"
call "%~dp0XOAY-LOG.bat" tra-uid.log
node tra-uid-sheet.mjs --dien --loop 0.85 >> tra-uid.log 2>&1
