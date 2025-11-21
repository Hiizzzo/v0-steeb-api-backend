@echo off
echo 🚀 STEEB Backend Status Check
echo ==============================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Default values
set BASE_URL=http://localhost:3001
set VERBOSE=false

REM Parse command line arguments
:parse_args
if "%~1"=="" goto :run_check
if "%~1"=="--base-url" (
    shift
    set BASE_URL=%~1
    shift
    goto :parse_args
)
if "%~1"=="--verbose" (
    set VERBOSE=true
    shift
    goto :parse_args
)
if "%~1"=="--help" (
    goto :show_help
)
shift
goto :parse_args

:show_help
echo STEEB Backend Status Check Script
echo.
echo Usage: %~nx0 [options]
echo.
echo Options:
echo   --base-url ^<url^>    Base URL to test (default: http://localhost:3001)
echo   --verbose           Show detailed output
echo   --help              Show this help
echo.
echo Examples:
echo   %~nx0
echo   %~nx0 --base-url https://your-app.vercel.app
echo   %~nx0 --base-url https://your-backend.vercel.app --verbose
echo.
pause
exit /b 0

:run_check
echo 🔍 Starting backend status check...
echo Base URL: %BASE_URL%
echo Verbose: %VERBOSE%
echo.

REM Run the status check
if "%VERBOSE%"=="true" (
    node check-backend-status.js --base-url "%BASE_URL%" --verbose
) else (
    node check-backend-status.js --base-url "%BASE_URL%"
)

echo.
echo ✨ Status check completed!
echo.
pause