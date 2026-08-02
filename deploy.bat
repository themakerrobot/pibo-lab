@echo off
chcp 65001 >nul
title Pibo Lab deploy
cd /d "%~dp0"

set OUT=dist\pibo-lab.zip
if not exist dist mkdir dist
if exist "%OUT%" del "%OUT%"

rem 스테이징 폴더에 배포 대상만 복사 (.git, dist, 배포 산출물 제외)
set STAGE=%TEMP%\pibo-lab-stage
if exist "%STAGE%" rmdir /s /q "%STAGE%"
robocopy . "%STAGE%" /e /xd .git dist "%STAGE%" /xf deploy.bat *.zip index.html.bak .gitignore >nul

powershell -NoProfile -Command "Compress-Archive -Path '%STAGE%\*' -DestinationPath '%OUT%' -Force"
rmdir /s /q "%STAGE%"

if exist "%OUT%" ( echo 완료: %OUT%  — 이 zip을 다른 PC에 복사해 풀고 run.bat 실행 ) else ( echo 실패: zip 생성 오류 )
pause
