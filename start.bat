@echo off
setlocal enabledelayedexpansion
title makePNU Workbench (PowerShell Edition)

echo [1/2] Port 8000 cleanup...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    set PID=%%a
    if not "!PID!"=="" (
        echo [System] Found process !PID! using port 8000. Killing it...
        taskkill /F /PID !PID! >nul 2>&1
    )
)

echo [2/2] Starting PowerShell Server...
start /b powershell -ExecutionPolicy Bypass -File server.ps1

echo [Info] Server is initializing. Please wait a moment...
timeout /t 2 /nobreak > nul

echo [Info] Opening browser...
start http://localhost:8000

echo.
echo =======================================================
echo  makePNU Workbench is ACTIVE.
echo  Keep this window open while using the application.
echo  Press Ctrl+C here to stop the server when finished.
echo =======================================================
echo.

:loop
timeout /t 5 > nul
goto loop
