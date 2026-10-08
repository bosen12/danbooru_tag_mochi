@echo off
rem LoRA Manager check, called by the launchers.
rem The LoRA panel takes its list, preview images and trigger words from ComfyUI LoRA Manager
rem (and the checkpoint panel its names and previews). If ComfyUI does not have it, install it
rem in a minimized window: git clone into custom_nodes, packages with ComfyUI's own python.
rem The page still opens right away. ComfyUI must be restarted once afterwards.
rem Only a ComfyUI on this machine is touched. Skip with: set NO_LORA_MANAGER_FETCH=1
rem Console text is ASCII on purpose: cmd's code page is not UTF-8.
if defined NO_LORA_MANAGER_FETCH exit /b 0
if not defined PY set "PY=python"
rem The LoRA panel's "details" link opens that LoRA directly: re-applied after LoRA Manager updates.
%PY% "%~dp0fetch_lora_manager.py" --patch >nul 2>&1
%PY% "%~dp0fetch_lora_manager.py" --check
if "%errorlevel%"=="4" goto restart
if not "%errorlevel%"=="3" exit /b 0
echo ComfyUI LoRA Manager is missing; LoRA previews and trigger words come from it.
echo Installing it in a minimized window "lora manager". Restart ComfyUI when it says Done.
start "lora manager" /min "%~dp0fetch-lora-manager-window.bat"
exit /b 0

:restart
echo ComfyUI LoRA Manager is installed, but ComfyUI has not loaded it yet. Restart ComfyUI once.
exit /b 0
