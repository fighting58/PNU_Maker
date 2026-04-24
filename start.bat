@echo off
setlocal enabledelayedexpansion
title makePNU Workbench (Portable Edition)

:: ============================================================================
:: 1. Administrative Privileges Check
:: ============================================================================
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Privileges: Administrative rights confirmed.
) else (
    echo [WARN] Administrative rights might be required for port cleanup.
    echo        If you encounter issues, please 'Run as Administrator'.
)

:: ============================================================================
:: 2. Essential File Check
:: ============================================================================
echo [INFO] Checking essential files...
if not exist "server.ps1" (
    echo [ERROR] server.ps1 not found.
    pause
    exit /b
)

:: ============================================================================
:: 3. Port 8000 Cleanup
:: ============================================================================
echo [INFO] Checking port 8000 status...
set FOUND_PID=0
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    set PID=%%a
    if not "!PID!"=="0" if not "!PID!"=="" (
        echo [INFO] Process !PID! is using port 8000. Terminating...
        taskkill /F /PID !PID! >nul 2>&1
        set FOUND_PID=1
    )
)
if !FOUND_PID! == 0 (
    echo [OK] Port 8000 is clear.
)

:: ============================================================================
:: 4. Start PowerShell Backend
:: ============================================================================
echo [INFO] Starting Backend Server (PowerShell)...

:: Detect own PID for graceful shutdown
set "UNIQUE_TITLE=makePNU_Launcher_%RANDOM%"
title %UNIQUE_TITLE%
for /f "tokens=2" %%a in ('tasklist /nh /fi "WINDOWTITLE eq %UNIQUE_TITLE%*"') do set "MY_PID=%%a"

:: Starting in background with hidden window, passing MY_PID
start /b powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File server.ps1 -ParentPid %MY_PID%

:: ============================================================================
:: 5. Start Frontend (Browser)
:: ============================================================================
echo [INFO] Waiting for server and launching browser...
timeout /t 2 /nobreak > nul

echo [INFO] Opening: http://localhost:8000
start http://localhost:8000

:: ============================================================================
:: 6. Monitoring & Footer
:: ============================================================================
echo.
echo ==========================================================================
echo   makePNU Workbench is now RUNNING.
echo.
echo   - Backend: PowerShell (Hidden Mode)
echo   - URL: http://localhost:8000
echo.
echo   * Closing this window will stop monitoring the server.
echo   * To stop the server, press Ctrl+C in this window or close it.
echo ==========================================================================
echo.

:loop
timeout /t 10 > nul
goto loop
