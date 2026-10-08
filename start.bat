@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "PORT=8796"
set "HOST=0.0.0.0"
set "PYTHONUTF8=1"
set "PY="
python -c "import sys; raise SystemExit(sys.version_info.major != 3)" >nul 2>&1
if not errorlevel 1 set "PY=python"
if not defined PY (
  py -3 -c "import sys; raise SystemExit(sys.version_info.major != 3)" >nul 2>&1
  if not errorlevel 1 set "PY=py -3"
)
if not defined PY (
  echo Python 3 not found.
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
call "%~dp0scripts\card-art-check.bat"
call "%~dp0scripts\upscale-model-check.bat"
call "%~dp0scripts\pose-assets-check.bat"
call "%~dp0scripts\lora-manager-check.bat"
start "" "http://127.0.0.1:%PORT%/"
%PY% server.py
if errorlevel 1 pause
