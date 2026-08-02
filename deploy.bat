@echo off
title Pibo Lab deploy
cd /d "%~dp0"

set OUT=dist\pibo-lab.zip
if not exist dist mkdir dist
if exist "%OUT%" del "%OUT%"

set STAGE=%TEMP%\pibo-lab-stage
if exist "%STAGE%" rmdir /s /q "%STAGE%"
robocopy . "%STAGE%" /e /xd .git dist /xf deploy.bat *.zip index.html.bak .gitignore >nul

powershell -NoProfile -Command "Compress-Archive -Path '%STAGE%\*' -DestinationPath '%OUT%' -Force"
rmdir /s /q "%STAGE%"

if exist "%OUT%" (
  echo Done: %OUT%
  echo Copy this zip to another PC, unzip, and run run.bat
) else (
  echo Failed to create zip
)
pause
