@echo off
rem Merge card art baked by an older install into a newer one (cards folder + manifest.json).
rem Cards the new install already has are left alone; only missing ones are copied over.
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul
set "PYTHONUTF8=1"
set "PY="
python -c "import sys; raise SystemExit(sys.version_info < (3, 9))" >nul 2>&1
if not errorlevel 1 set "PY=python"
if not defined PY (
  py -3 -c "import sys; raise SystemExit(sys.version_info < (3, 9))" >nul 2>&1
  if not errorlevel 1 set "PY=py -3"
)
if not defined PY (
  echo Python 3.9 or newer not found.
  pause
  exit /b 1
)
%PY% merge_cards.py %*
echo.
pause
