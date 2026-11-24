@echo off
chcp 65001 >nul 2>&1
REM =============================================
REM  CESI Project - Start Development Servers
REM  Django (port 8000) + React/Vite (port 5173)
REM
REM  Run from the project ROOT folder:
REM    start-dev.bat
REM
REM  Prerequisites: Python 3.12+, Node.js 18+
REM =============================================

setlocal enabledelayedexpansion
set "PROJECT_ROOT=%~dp0"
set "BACKEND=%PROJECT_ROOT%BackEnd"
set "FRONTEND=%PROJECT_ROOT%FrontEnd\Main"
set "VENV=%LOCALAPPDATA%\CESI-Dev\CESI-3.1\venv"
set "VENV_PYTHON=%VENV%\Scripts\python.exe"
set "VENV_PIP=%VENV%\Scripts\pip.exe"
set "VENV_ACTIVATE=%VENV%\Scripts\activate.bat"
set "REQUIREMENTS=%BACKEND%\requirements.txt"

echo.
echo =============================================
echo    CESI Dev Server Launcher
echo =============================================

REM -- Check Python --
echo.
echo ^>^> Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo    ERROR: Python not found!
    echo    Install from https://python.org
    echo    IMPORTANT: Check "Add Python to PATH" during install!
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo    OK: %%v

REM -- Check Node --
echo.
echo ^>^> Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo    ERROR: Node.js not found!
    echo    Install from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version 2^>^&1') do echo    OK: Node %%v

REM -- Backend: Create venv if needed --
echo.
echo ^>^> Setting up Backend...

if not exist "%VENV_PYTHON%" (
    echo    Local virtual environment not found - creating...
    py -3.12 -m venv "%VENV%"
    if not exist "%VENV_PYTHON%" (
        echo    ERROR: Failed to create a Python 3.12 virtual environment!
        echo    Try manually: py -3.12 -m venv "%VENV%"
        pause
        exit /b 1
    )
    echo    OK: venv created outside OneDrive
) else (
    echo    OK: local venv exists
)

REM -- Activate venv --
call "%VENV_ACTIVATE%"
echo    OK: venv activated

REM -- Install Python deps --
echo.
echo ^>^> Installing/updating Python packages...
"%VENV_PYTHON%" -m pip install --upgrade pip --disable-pip-version-check
if %errorlevel% neq 0 (
    echo    ERROR: pip upgrade failed
    pause
    exit /b 1
)
"%VENV_PYTHON%" -m pip install -r "%REQUIREMENTS%" --disable-pip-version-check
if %errorlevel% neq 0 (
    echo    ERROR: Python dependency installation failed
    pause
    exit /b 1
)
echo    OK: Python packages up to date

REM -- Run migrations --
echo.
echo ^>^> Applying database migrations...
cd /d "%BACKEND%"
"%VENV_PYTHON%" manage.py makemigrations --noinput
if %errorlevel% neq 0 (
    echo    ERROR: makemigrations failed
    pause
    exit /b 1
)
"%VENV_PYTHON%" manage.py migrate --run-syncdb
if %errorlevel% neq 0 (
    echo    ERROR: migrate failed
    pause
    exit /b 1
)
echo    OK: Migrations applied

REM -- Frontend: npm install --
echo.
echo ^>^> Setting up Frontend...
cd /d "%FRONTEND%"
if not exist "node_modules" (
    echo    node_modules not found - running npm install...
    call npm install
) else (
    echo    Checking for updated npm packages...
    call npm install --prefer-offline --no-audit --no-fund >nul 2>&1
)
echo    OK: npm packages up to date

REM -- Launch servers --
echo.
echo =============================================
echo    Starting development servers...
echo    Backend:  http://127.0.0.1:8000
echo    Frontend: http://localhost:5173
echo =============================================
echo.
echo    TIP: Open http://localhost:5173 in your browser
echo    Django runs in the OTHER window that just opened.
echo    Press Ctrl+C here to stop the React server.
echo.

REM Start Django in a separate CMD window (use full paths to avoid quote issues)
start "CESI Django Server" cmd /k "cd /d "%BACKEND%" & call "%VENV_ACTIVATE%" & echo. & echo ======================================== & echo   Django server running on port 8000 & echo   Press Ctrl+C to stop & echo ======================================== & echo. & "%VENV_PYTHON%" manage.py runserver"

REM Start Vite in THIS window
cd /d "%FRONTEND%"
call npm run dev

endlocal
