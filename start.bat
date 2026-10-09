@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if not defined PORT set "PORT=8796"
if not defined HOST set "HOST=0.0.0.0"
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
  echo Opening the download page. Install Python 3.9 or newer and tick
  echo "Add python.exe to PATH" in the installer, then run start.bat again.
  start "" "https://www.python.org/downloads/windows/"
  pause
  exit /b 1
)
echo Mochi  card workbench for Danbooru tags + ComfyUI
echo local     http://127.0.0.1:%PORT%/
set "TSIP="
if exist "%ProgramFiles%\Tailscale\tailscale.exe" for /f %%I in ('"%ProgramFiles%\Tailscale\tailscale.exe" ip -4 2^>nul') do set "TSIP=%%I"
if defined TSIP echo Tailscale http://%TSIP%:%PORT%/
echo bind      0.0.0.0:%PORT%/
rem First-time setup (card art, LoRA Manager, upscale model, pose reference, card baking)
rem runs inside the server and shows progress and questions in the page, so one launch
rem finishes it even if ComfyUI is started later (setup_tasks.py).
rem The server opens the browser once it accepts connections (OPEN_BROWSER=1);
rem opening it here first used to show "can't reach this page" on fast machines.
set "OPEN_BROWSER=1"
%PY% server.py
if errorlevel 1 pause
