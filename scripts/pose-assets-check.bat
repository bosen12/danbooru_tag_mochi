@echo off
rem Pose reference check, called by start.bat.
rem If comfyui_controlnet_aux or the OpenPose ControlNet is missing, ask first: it is optional,
rem about 2.5 GB, and pip-installs the node's requirements into ComfyUI's own Python.
rem Y installs in a minimized window (the page still opens right away); no answer in 20 s = not now;
rem A = never ask again (creates .no-pose-fetch). Skip with: set NO_POSE_FETCH=1
rem Console text is ASCII on purpose: cmd's code page is not UTF-8.
if defined NO_POSE_FETCH exit /b 0
if exist "%~dp0..\.no-pose-fetch" exit /b 0
if not defined PY set "PY=python"
%PY% "%~dp0fetch_pose_assets.py" --check
if not errorlevel 3 exit /b 0
echo.
echo Pose reference (optional) needs the ComfyUI node comfyui_controlnet_aux and an
echo OpenPose ControlNet: about 2.5 GB, installed into your ComfyUI.
choice /c YNA /t 20 /d N /m "Install now? Y = yes, N = not now, A = never ask again"
rem Exact codes: choice returns 255 when there is no console, which must not mean "never".
if "%errorlevel%"=="3" goto never
if not "%errorlevel%"=="1" exit /b 0
echo Installing in a minimized window "pose assets". The page opens now.
start "pose assets" /min "%~dp0fetch-pose-window.bat"
exit /b 0

:never
type nul > "%~dp0..\.no-pose-fetch"
echo Not asking again. Delete .no-pose-fetch to be asked next time.
exit /b 0
