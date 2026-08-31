@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Нужен Node.js 20+ — поставь с https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules (
  echo Ставлю зависимости…
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo.
echo Собираю production…
call npm run build
if errorlevel 1 (
  echo Сборка упала.
  pause
  exit /b 1
)
echo.
echo Панель (prod):  http://127.0.0.1:8080
echo Comfy:          http://127.0.0.1:8188
echo С телефона:     http://IP-этого-ПК:8080
echo.
echo Если порт 8080 занят — закрой start.bat ^(dev^).
echo Нет hot-reload: после правок в коде снова запусти этот файл.
echo.
call npm run preview:prod
if errorlevel 1 pause
