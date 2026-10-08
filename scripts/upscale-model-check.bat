@echo off
rem Upscale model check, called by start.bat.
rem If RealESRGAN_x4plus_anime_6B.pth is missing, download it in a minimized window.
rem The page still opens right away. Skip with: set NO_UPSCALE_FETCH=1
rem Console text is ASCII on purpose: cmd's code page is not UTF-8.
if defined NO_UPSCALE_FETCH exit /b 0
if not defined PY set "PY=python"
%PY% "%~dp0fetch_upscale_model.py" --check
if not errorlevel 3 exit /b 0
echo Upscale model is missing. Downloading it in a minimized window "upscale model".
echo The page opens now. Deep Hires needs the file before it can run.
start "upscale model" /min "%~dp0fetch-upscale-window.bat"
exit /b 0
