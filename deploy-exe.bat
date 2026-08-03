@echo off
title Pibo Lab exe build
cd /d "%~dp0"

where go >nul 2>nul
if not %errorlevel%==0 (
  echo Go is not installed. Install it from https://go.dev/dl/ then run this again.
  pause
  exit /b 1
)

set STAGE=%TEMP%\pibolab-exe
if exist "%STAGE%" rmdir /s /q "%STAGE%"
mkdir "%STAGE%\site"

rem copy site files only (exclude repo/deploy stuff)
robocopy . "%STAGE%\site" /e /xd .git dist tools /xf deploy.bat deploy-exe.bat run.bat server.ps1 *.zip *.exe index.html.bak .gitignore README.md >nul

copy /y tools\portable\main.go "%STAGE%" >nul
copy /y tools\portable\go.mod "%STAGE%" >nul

if not exist dist mkdir dist

rem embed icon if rsrc is available (go install github.com/akavel/rsrc@latest)
where rsrc >nul 2>nul
if %errorlevel%==0 rsrc -ico tools\portable\icon.ico -o "%STAGE%\rsrc.syso"

pushd "%STAGE%"
go build -ldflags="-s -w" -o "%~dp0dist\PiboLab.exe" .
set ERR=%errorlevel%
popd
rmdir /s /q "%STAGE%"

if %ERR%==0 (
  echo Done: dist\PiboLab.exe
  echo Copy this single file to any Windows PC and double-click.
) else (
  echo Build failed
)
pause
