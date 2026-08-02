@echo off
title Pibo Lab
cd /d "%~dp0"
set PORT=50030

start "" /min cmd /c "timeout /t 2 >nul & start http://localhost:%PORT%"

where python >nul 2>nul
if %errorlevel%==0 goto usepython
where py >nul 2>nul
if %errorlevel%==0 goto usepy

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port %PORT%
pause
goto :eof

:usepython
echo Pibo Lab server - http://localhost:%PORT%  (close this window to stop)
python -m http.server %PORT%
goto :eof

:usepy
echo Pibo Lab server - http://localhost:%PORT%  (close this window to stop)
py -m http.server %PORT%
