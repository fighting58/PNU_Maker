# Startup Script Builder

A specialized skill to generate robust, production-grade Windows startup scripts (`.bat`) for portable PowerShell-based applications. It ensures a seamless user experience by managing privileges, cleaning up resources, and handling the application lifecycle.

## 🎯 Strict Requirements

When generating a startup script, this skill MUST strictly adhere to:

1.  **[Strict] All-English:** Every command, message, and comment must be in English to prevent character encoding issues (Mojibake) across different Windows environments.
2.  **[Strict] Admin Check:** The script must verify administrative privileges at the start and warn the user if they are missing (needed for port management).
3.  **[Strict] File Integrity:** Verify the existence of the primary backend file (e.g., `server.ps1`) before attempting to start.
4.  **[Strict] Port Cleanup:** Identify and terminate any existing processes using the target port (e.g., 8000) to prevent "Address already in use" errors.
5.  **[Strict] Background Execution:** Launch the backend server in a hidden window (`-WindowStyle Hidden`) and automatically open the default browser to the application URL.
6.  **[Added] Graceful Shutdown:** Implement logic to detect the script's own PID and pass it to the backend server, enabling the server to self-terminate when the launcher window is closed.

## 🛠️ Usage Workflow

### 1. Analysis
*   Identify the target port (default 8000).
*   Identify the backend script name (default `server.ps1`).
*   Identify the local URL (default `http://localhost:8000`).

### 2. Implementation Template

The generated `start.bat` should follow this structure:

```batch
@echo off
setlocal enabledelayedexpansion
title [Project Name] Launcher

:: 1. Admin Check
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARN] Admin rights might be required for port cleanup.
)

:: 2. File Check
if not exist "server.ps1" (
    echo [ERROR] server.ps1 not found.
    pause & exit /b
)

:: 3. Port Cleanup
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: 4. Start Backend with PID for Graceful Shutdown
set "UTITLE=Launcher_%RANDOM%"
title %UTITLE%
for /f "tokens=2" %%a in ('tasklist /nh /fi "WINDOWTITLE eq %UTITLE%*"') do set "MY_PID=%%a"
start /b powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File server.ps1 -ParentPid %MY_PID%

:: 5. Launch Browser
timeout /t 2 /nobreak > nul
start http://localhost:8000

:: 6. Monitor Loop
:loop
timeout /t 10 > nul
goto loop
```

## ⚠️ Server-Side Requirement

For **Graceful Shutdown** to work, the `server.ps1` MUST include a monitoring thread that checks if the `ParentPid` is still alive. Ensure the following logic exists in the backend:

```powershell
param([int]$ParentPid = 0)
if ($ParentPid -gt 0) {
    $currentPid = $PID
    $monitor = {
        param($ppid, $cpid)
        while ($true) {
            if (-not (Get-Process -Id $ppid -ErrorAction SilentlyContinue)) {
                Stop-Process -Id $cpid -Force
                break
            }
            Start-Sleep -Seconds 2
        }
    }
    [PowerShell]::Create().AddScript($monitor).AddArgument($ParentPid).AddArgument($currentPid).BeginInvoke()
}
```
