@echo off
setlocal
chcp 65001 > nul

cd /d "%~dp0"
echo Starting PlusZveno admin server...
start "PlusZveno Admin Server" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0admin_server.ps1" -Port 8788
timeout /t 2 /nobreak > nul
start http://localhost:8788/

echo.
echo Admin UI: http://localhost:8788/
echo Login: +7 000 00 00 000, SMS code: any 4 digits
echo.
