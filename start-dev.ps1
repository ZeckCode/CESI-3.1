<#
.SYNOPSIS
    CESI Project - Start Development Servers (Django + React)
.DESCRIPTION
    This script will:
      1. Create a Python venv if it doesn't exist
      2. Install/update backend Python dependencies
      3. Install/update frontend npm packages
      4. Run Django migrations
      5. Import seed data from db_backup.json (if available)
      6. Set up default school rooms
      7. Start Django dev server (port 8000)
      8. Start Vite/React dev server (port 5173)

    Both servers run side-by-side. Press Ctrl+C in either
    terminal window to stop that server.

    To export database to JSON for version control:
      cd BackEnd
      .\venv\Scripts\Activate.ps1
      python manage.py export_to_json --output db_backup.json

.NOTES
    Run from the project ROOT folder (where BackEnd/ and FrontEnd/ live):
      .\start-dev.ps1

    Prerequisites: Python 3.12+, Node.js 18+
#>

# --- Resolve paths (compatible with PowerShell 5.1 - no 3-arg Join-Path) ---
$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) { $ProjectRoot = (Get-Location).Path }

$BackendDir    = Join-Path $ProjectRoot "BackEnd"
$FrontendDir   = Join-Path (Join-Path $ProjectRoot "FrontEnd") "Main"
$VenvDir       = Join-Path $BackendDir "venv"
$VenvScripts   = Join-Path $VenvDir "Scripts"
$ActivateScript = Join-Path $VenvScripts "Activate.ps1"
$VenvPython    = Join-Path $VenvScripts "python.exe"
$VenvPip       = Join-Path $VenvScripts "pip.exe"
$ReqFile       = Join-Path $ProjectRoot "requirements.txt"

# --- Helper functions ---
function Write-Step  { param($msg) Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "   OK: $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "   !! $msg" -ForegroundColor Yellow }
function Write-Err   { param($msg) Write-Host "   ERROR: $msg" -ForegroundColor Red }

# =============================================
#  PRE-FLIGHT CHECKS
# =============================================
Write-Host ""
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host "   CESI Dev Server Launcher" -ForegroundColor Magenta
Write-Host "=============================================" -ForegroundColor Magenta

# Check Python
Write-Step "Checking Python..."
$pyExe = Get-Command python -ErrorAction SilentlyContinue
if (-not $pyExe) {
    Write-Err "Python not found! Install from https://python.org (check 'Add to PATH')"
    Read-Host "Press Enter to exit"
    exit 1
}
$pyVersion = & python --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "Python failed to run. Reinstall or fix PATH."
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Ok "$pyVersion"

# Check Node
Write-Step "Checking Node.js..."
$nodeExe = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeExe) {
    Write-Err "Node.js not found! Install from https://nodejs.org"
    Read-Host "Press Enter to exit"
    exit 1
}
$nodeVersion = & node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "Node.js failed to run. Reinstall Node.js or fix PATH."
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Ok "Node $nodeVersion"

# Check npm
$npmExe = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmExe) {
    Write-Err "npm not found! It should come with Node.js - reinstall Node."
    Read-Host "Press Enter to exit"
    exit 1
}
$npmVersion = & npm --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "npm failed to run. Reinstall Node.js or fix PATH."
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Ok "npm $npmVersion"

# =============================================
#  BACKEND SETUP
# =============================================
Write-Step "Setting up Backend..."

# Create venv if missing or broken
$venvNeedsRecreate = $false
if (-not (Test-Path $VenvPython)) {
    $venvNeedsRecreate = $true
    Write-Warn "Virtual environment not found"
} else {
    # Test if the venv actually works (catches venvs created on different machines)
    Write-Step "Verifying virtual environment..."
    $testResult = & "$VenvPython" -c "print('ok')" 2>&1
    if ($testResult -ne "ok") {
        Write-Warn "Virtual environment is broken (was created on a different machine)"
        Write-Warn "Error: $testResult"
        $venvNeedsRecreate = $true
    }
}

if ($venvNeedsRecreate) {
    # Remove broken venv if it exists
    if (Test-Path $VenvDir) {
        Write-Warn "Removing broken virtual environment..."
        Remove-Item -Recurse -Force "$VenvDir"
    }
    Write-Warn "Creating new virtual environment..."
    & python -m venv "$VenvDir"
    if (-not (Test-Path $VenvPython)) {
        Write-Err "Failed to create venv at: $VenvDir"
        Write-Err "Try manually: cd BackEnd && python -m venv venv"
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Ok "Virtual environment created"
} else {
    Write-Ok "Virtual environment exists and is valid"
}

# Activate venv
Write-Step "Activating virtual environment..."
try {
    & $ActivateScript
    Write-Ok "Virtual environment activated"
} catch {
    Write-Err "Could not activate venv. Try: .\BackEnd\venv\Scripts\Activate.ps1"
    Write-Err "If you get an execution policy error, run:"
    Write-Err "  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned"
    Read-Host "Press Enter to exit"
    exit 1
}

# Install / update Python deps
Write-Step "Installing/updating Python packages..."
Write-Step "Updating pip..."
& "$VenvPython" -m pip install --upgrade pip --quiet --disable-pip-version-check 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Warn "pip upgrade had warnings - trying again with output..."
    & "$VenvPython" -m pip install --upgrade pip
}
Write-Ok "pip is up to date"
& "$VenvPip" install -r "$ReqFile" --quiet --disable-pip-version-check 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Warn "pip install had warnings - trying again with output..."
    & "$VenvPip" install -r "$ReqFile"
}
Write-Ok "Python packages up to date"

# Run migrations
Write-Step "Applying database migrations..."
Push-Location "$BackendDir"

Write-Step "Creating new migrations (makemigrations)..."
$makemigrationsOutput = & "$VenvPython" manage.py makemigrations --noinput 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "makemigrations failed"
    Write-Err $makemigrationsOutput
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Ok "makemigrations succeeded"

Write-Step "Running migrate..."
$migrateOutput = & "$VenvPython" manage.py migrate --run-syncdb 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "migrate failed"
    Write-Err $migrateOutput
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Ok "Migrations applied"

# Import seed data from JSON if available and database is empty
Write-Step "Checking for seed data..."
$DbBackupFile = Join-Path $BackendDir "db_backup.json"
if (Test-Path $DbBackupFile) {
    Write-Ok "Found db_backup.json - checking for data import..."
    & "$VenvPython" manage.py import_from_json --input "$DbBackupFile" 2>&1 | ForEach-Object { Write-Host "   $_" }
} else {
    Write-Warn "No db_backup.json found - database will use existing data"
}

# Set up default rooms if they don't exist
Write-Step "Setting up default rooms..."
& "$VenvPython" manage.py setup_rooms 2>&1 | ForEach-Object { Write-Host "   $_" }

Pop-Location

# =============================================
#  FRONTEND SETUP
# =============================================
Write-Step "Setting up Frontend..."

Push-Location "$FrontendDir"
if (-not (Test-Path "node_modules")) {
    Write-Warn "node_modules not found - running npm install..."
    & npm install
} else {
    Write-Step "Checking for updated npm packages..."
    & npm install --prefer-offline --no-audit --no-fund 2>&1 | Out-Null
}

# Ensure frontend dependencies are present
Write-Step "Installing react-quill-new, jsPDF and jsPDF-AutoTable (frontend)"
& npm install react-quill-new jspdf@2.5.1 jspdf-autotable@3.5.31 --save

Write-Ok "npm packages up to date"
Pop-Location

# =============================================
#  LAUNCH SERVERS
# =============================================
Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "   Starting development servers..." -ForegroundColor Green
Write-Host "   Backend:  http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "   TIP: Open http://localhost:5173 in your browser" -ForegroundColor Yellow
Write-Host "   Django runs in the OTHER window that just opened." -ForegroundColor Yellow
Write-Host "   Press Ctrl+C here to stop the React server." -ForegroundColor Yellow
Write-Host ""

# Start Django in a NEW PowerShell window (use the venv python directly)
$djangoCmd = @"
Set-Location '$BackendDir'
& '$ActivateScript'
Write-Host '========================================' -ForegroundColor Green
Write-Host '  Django server running on port 8000' -ForegroundColor Green
Write-Host '  Press Ctrl+C to stop' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
& '$VenvPython' manage.py runserver
Read-Host 'Server stopped. Press Enter to close'
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $djangoCmd

# Start Vite in THIS terminal (pinned to port 5173)
Push-Location "$FrontendDir"
& npm run dev -- --port 5173
Pop-Location
