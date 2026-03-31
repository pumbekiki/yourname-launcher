@echo off
chcp 65001 >nul
title YourName Launcher - Setup
color 0F
echo.
echo  YOURNAME LAUNCHER - Setup
echo  ---------------------------------------------------------
echo.

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js not found! Download: https://nodejs.org
    pause
    exit /b 1
)
echo  [OK] Node.js found

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python not found! Download: https://python.org
    pause
    exit /b 1
)
echo  [OK] Python found

echo.
echo  [1/3] Installing Node dependencies...
call npm install
if errorlevel 1 (
    echo  [ERROR] npm install failed
    pause
    exit /b 1
)
echo  [OK] Node dependencies installed

echo.
echo  [2/3] Installing Python dependencies...
python -m pip install minecraft-launcher-lib --quiet --upgrade
if errorlevel 1 (
    echo  [WARN] Auto-install failed. Run manually: python -m pip install minecraft-launcher-lib
) else (
    echo  [OK] minecraft-launcher-lib installed
)

echo.
echo  [3/3] Starting launcher...
echo.
call npm start

pause
