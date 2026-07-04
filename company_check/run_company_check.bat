@echo off
setlocal
chcp 65001 > nul

echo PlusZveno company check
echo.
if "%CHECKO_API_KEY%"=="" (
  echo CHECKO_API_KEY is not set. Checko will use public HTML fallback.
  echo To enable Checko API, set CHECKO_API_KEY in the current shell or user environment.
  echo.
)
set /p INN=Enter INN:

if "%INN%"=="" (
  echo INN is required.
  pause
  exit /b 1
)

powershell -ExecutionPolicy Bypass -File "%~dp0company_check.ps1" -Inn "%INN%"

echo.
echo Reports are saved next to this file:
echo %~dp0
echo.
pause
