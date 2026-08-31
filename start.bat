@echo off
setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo Нужен Node.js 20+ — поставь с https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules (
  echo Ставлю зависимости…
  call npm install
  if errorlevel 1 exit /b 1
)
echo.
echo Панель:  http://127.0.0.1:8080
echo Comfy:   сама подключится к http://127.0.0.1:8188
echo.
call npm run dev
