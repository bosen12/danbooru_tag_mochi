@echo off
rem Installs ComfyUI LoRA Manager. Started by lora-manager-check.bat.
rem Console text is ASCII on purpose: cmd's code page is not UTF-8.
setlocal
cd /d "%~dp0.."
if not defined PY set "PY=python"
title lora manager
%PY% scripts\fetch_lora_manager.py
if errorlevel 1 (
  echo.
  echo LoRA Manager setup did not finish.
  echo It will be tried again the next time you start.
  timeout /t 60 >nul
  exit /b 1
)
echo.
echo Done. Restart ComfyUI once, then reload the page: LoRAs get previews and trigger words.
timeout /t 30 >nul
exit /b 0
