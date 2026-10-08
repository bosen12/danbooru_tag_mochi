@echo off
rem Installs what pose reference needs. Started by pose-assets-check.bat.
rem Console text is ASCII on purpose: cmd's code page is not UTF-8.
setlocal
cd /d "%~dp0.."
if not defined PY set "PY=python"
title pose assets
%PY% scripts\fetch_pose_assets.py
if errorlevel 1 (
  echo.
  echo Pose reference setup did not finish.
  echo It will be tried again the next time you start.
  timeout /t 60 >nul
  exit /b 1
)
echo.
echo Done. If a node was installed, restart ComfyUI once.
timeout /t 30 >nul
exit /b 0
