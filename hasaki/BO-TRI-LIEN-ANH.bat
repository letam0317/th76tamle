@echo off
rem BO-TRI-LIEN-ANH.bat - mo cong cu bo tri mat bang kho moi LIEN ANH (CHI NOI BO, khong day len Internet)
rem Can may chu noi bo xem-noi-bo.mjs BAN MOI (co duong /api/3d/lienanh). Neu cua so XEM-BAN-NOI-BO cu dang chay
rem (cong 8123 ban) thi phai dong no truoc - file nay se bao va dung lai thay vi chay chong.
cd /d "%~dp0"
netstat -ano | findstr /R /C:":8123 .*LISTENING" >nul
if %errorlevel%==0 (
  echo.
  echo  CONG 8123 DANG BAN - mot cua so XEM-BAN-NOI-BO (ban cu) dang chay.
  echo  Hay DONG cua so do (Ctrl+C hoac dong cua so) roi chay lai file nay.
  echo  Ban cu KHONG co duong luu Lien Anh: trang mo duoc nhung keo tha se khong luu.
  echo.
  pause
  exit /b 1
)
start "" http://localhost:8123/kiemsoatkho/lienanh-3d.html
node xem-noi-bo.mjs
