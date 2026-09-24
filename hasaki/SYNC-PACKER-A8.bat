@echo off
rem SYNC-PACKER-A8.bat - dong bo "ai dong goi tai tung ban/camera A8 theo ngay" -> tab PACKER-A8-NGAY
rem (goi tu task "5S Packer A8 sang/chieu"; chay tay cung duoc). Log: packer-a8.log
cd /d "%~dp0"
node sync-packer-a8.mjs >> packer-a8.log 2>&1
