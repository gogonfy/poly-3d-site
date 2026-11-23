@echo off
chcp 65001 >nul
title POLY — доступ по Wi-Fi
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo Нужны права администратора. Откроется запрос UAC...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo.
echo Разрешаю входящие подключения к сайту в брандмауэре Windows...
echo Правило действует только для устройств в этой же локальной сети,
echo порты 8080-8090.
echo.

netsh advfirewall firewall delete rule name="POLY local site 8080-8090" >nul 2>&1
netsh advfirewall firewall add rule name="POLY local site 8080-8090" dir=in action=allow protocol=TCP localport=8080-8090 profile=any remoteip=localsubnet

if errorlevel 1 (
  echo.
  echo Не удалось добавить правило. Проверьте брандмауэр вручную.
) else (
  echo.
  echo Готово. Теперь запустите start-server.bat и откройте адрес
  echo вида http://192.168.x.x:8080 на телефоне в той же Wi-Fi.
  echo.
  echo Правило не открывает сайт в интернет — только в локальной сети.
)

echo.
pause
