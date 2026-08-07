@echo off
REM ============================================================================
REM  XOAY-LOG.bat <ten-log> [gioi-han-byte]   - goi o DAU moi .bat co ghi log
REM ----------------------------------------------------------------------------
REM  Log cua du an ghi bang ">> ten.log" nen KHONG BAO GIO nho lai. Do thuc
REM  01/08/2026: watch-login.log 1,2MB / 27.500 dong (~13 ngay), day-bao-cao-5s.log
REM  1,0MB / 20.600 dong. Cu vay 1 nam la ~35MB moi file tren may van hanh, va
REM  dong can tra thi nam lan giua rac.
REM  Cach xoay: log vuot gioi han (mac dinh 1MB) thi doi ten thanh <ten>.log.1
REM  (move /y ghi de ban .1 cu) roi bat dau file moi -> luon giu 2 doi gan nhat,
REM  khong mat lich su vua roi, khong can cron don dep.
REM  Dung: call "%~dp0XOAY-LOG.bat" vesinh.log
REM ============================================================================
setlocal
set "F=%~1"
set "MAX=%~2"
if "%F%"=="" goto :eof
if "%MAX%"=="" set "MAX=1048576"
if not exist "%~dp0%F%" goto :eof
for %%A in ("%~dp0%F%") do if %%~zA GTR %MAX% (
  move /y "%~dp0%F%" "%~dp0%F%.1" >nul
  echo [%date% %time%] --- log cu da xoay sang %F%.1 ^(vuot %MAX% byte^) --- >> "%~dp0%F%"
)
endlocal
