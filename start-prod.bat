@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Need Node.js 20+ from https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules (
  echo npm install...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo.
echo Building production...
call npm run build
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)
echo.
echo Panel:  http://127.0.0.1:8080
echo Comfy:  http://127.0.0.1:8188
echo Phone:  http://THIS-PC-IP:8080
echo.
echo If port 8080 is busy, close start.bat (dev).
echo No hot-reload — run this file again after code changes.
echo.
call node scripts/with-app-env.mjs vite preview --host 0.0.0.0 --port 8080
if errorlevel 1 pause
