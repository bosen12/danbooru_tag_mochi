@echo off
rem Bakes card illustrations with the local ComfyUI. Started by card-art-check.bat.
rem Args: general^|all [extras]. Closing the window stops it; finished cards are kept.
cd /d "%~dp0.."
set "PYTHONUTF8=1"
if not defined PY set "PY=python"
title card art bake
echo Baking missing and out-of-date card illustrations with your local ComfyUI.
echo Cards that already match their prompt are skipped.
echo You can keep using the page. Reload it to see new cards.
echo Close this window to stop; finished cards are kept and the next launch continues.
echo.
if /i "%~1"=="all" (
  %PY% scripts\bake_card_art.py
) else (
  %PY% scripts\bake_card_art.py --rating general
)
if /i "%~2"=="extras" %PY% scripts\bake_card_art.py --extras
echo.
echo Finished. Reload the page to see every card.
pause
