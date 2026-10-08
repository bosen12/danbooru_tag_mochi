@echo off
rem Downloads RealESRGAN_x4plus_anime_6B.pth. Started by upscale-model-check.bat.
rem Console text is ASCII on purpose: cmd's code page is not UTF-8.
setlocal
cd /d "%~dp0.."
if not defined PY set "PY=python"
title upscale model
%PY% scripts\fetch_upscale_model.py
if errorlevel 1 (
  echo.
  echo The upscale model download did not finish.
  echo It will be tried again the next time you start.
  timeout /t 30 >nul
  exit /b 1
)
echo.
echo Done.
timeout /t 15 >nul
exit /b 0
