@echo off
rem Downloads the all-ages card art from the GitHub release in its own window
rem (started by card-art-check.bat), so the page can open right away.
rem Console text is ASCII on purpose: cmd's code page is not UTF-8.
setlocal
cd /d "%~dp0.."
if not defined PY set "PY=python"
title card art download
%PY% scripts\fetch_card_art.py
if errorlevel 1 (
  echo.
  echo The download did not finish. Cards keep the placeholder glyph for now.
  echo It will be tried again the next time you start. With ComfyUI running you can
  echo also bake the art yourself: %PY% scripts\bake_card_art.py --rating general
  timeout /t 30 >nul
  exit /b 1
)
echo.
echo Done. Reload the page (F5) to see the card illustrations.
timeout /t 15 >nul
exit /b 0
