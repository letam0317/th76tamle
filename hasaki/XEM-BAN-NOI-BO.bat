@echo off
rem XEM-BAN-NOI-BO.bat - mo trang duyet ban NOI BO (ban da sua, CHUA push) de kiem tra/QC
rem truoc khi cho phep push live. Dong cua so nay la tat server.
cd /d "%~dp0"
start "" http://localhost:8123/factory/
node xem-noi-bo.mjs
