@echo off
chcp 65001 >nul
title Pibo Lab
cd /d "%~dp0"
set PORT=8000

rem 2초 뒤 브라우저 자동 열기 (서버와 병렬)
start "" /min cmd /c "timeout /t 2 >nul & start http://localhost:%PORT%"

rem Python 있으면 Python 서버, 없으면 PowerShell 서버
where python >nul 2>nul
if %errorlevel%==0 ( echo 파이보 랩 서버 시작 — http://localhost:%PORT%  ^(이 창을 닫으면 종료^) & python -m http.server %PORT% & goto :eof )
where py >nul 2>nul
if %errorlevel%==0 ( echo 파이보 랩 서버 시작 — http://localhost:%PORT%  ^(이 창을 닫으면 종료^) & py -m http.server %PORT% & goto :eof )

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port %PORT%
pause
