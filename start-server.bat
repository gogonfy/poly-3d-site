@echo off
chcp 65001 >nul
title POLY — локальный сайт
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Не найден Node.js.
  echo Установите Node.js с https://nodejs.org и запустите этот файл снова.
  echo.
  pause
  exit /b 1
)

echo.
echo Запускаю локальный сервер...
echo.
node server.js
if errorlevel 1 (
  echo.
  echo Сервер завершился с ошибкой.
  pause
)
