@echo off
title YourName Launcher - Build Release
setlocal

echo.
echo  YOURNAME LAUNCHER - Build Release
echo  ---------------------------------------------------------
echo.

call npm run build:win
if errorlevel 1 (
  echo.
  echo  [FAIL] Build failed.
  echo.
  pause
  exit /b 1
)

echo.
echo  [OK] Build completed.
echo  Output folder:
echo  %CD%\release
echo.
pause
