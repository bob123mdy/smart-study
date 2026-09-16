@echo off
setlocal
chcp 65001 >nul
title Smart Study Launcher

set "APP_DIR=C:\Users\LIn\Desktop\smart-study"
set "URL=http://localhost:3000"

netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo [OK] Already running. Opening browser...
  start "" "%URL%"
  exit /b 0
)

echo [..] Starting dev server (first run compiles, please wait)...
start "smart-study-dev" /min cmd /c "cd /d "%APP_DIR%" && npm run dev"

echo [..] Waiting for server to be ready...
set /a n=0
:waitloop
timeout /t 2 /nobreak >nul
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 goto ready
set /a n+=1
if %n% lss 40 goto waitloop

echo [!] Timed out. Run "npm run dev" manually to see errors.
pause
exit /b 1

:ready
echo [OK] Ready. Opening browser...
start "" "%URL%"
exit /b 0
