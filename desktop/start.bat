@echo off
title Clearview
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is needed once. Opening the download page...
  start https://nodejs.org
  pause
  exit /b
)
start "" http://localhost:8080
node "%~dp0server.js"
pause
