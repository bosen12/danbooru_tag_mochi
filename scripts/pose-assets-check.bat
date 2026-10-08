@echo off
rem Pose reference check, called by start.bat.
rem If comfyui_controlnet_aux or the OpenPose ControlNet is missing, install it in a minimized window.
rem The page still opens right away. Skip with: set NO_POSE_FETCH=1
rem Console text is ASCII on purpose: cmd's code page is not UTF-8.
if defined NO_POSE_FETCH exit /b 0
if not defined PY set "PY=python"
%PY% "%~dp0fetch_pose_assets.py" --check
if not errorlevel 3 exit /b 0
echo Pose reference needs comfyui_controlnet_aux and an OpenPose ControlNet (about 2.5 GB).
echo Installing them in a minimized window "pose assets". The page opens now.
start "pose assets" /min "%~dp0fetch-pose-window.bat"
exit /b 0
