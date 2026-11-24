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

Set-Location $ProjectRoot

$BackendDir = Join-Path $ProjectRoot "BackEnd"
$FrontendSourceDir = Join-Path (Join-Path $ProjectRoot "FrontEnd") "Main"
$LocalDevRoot = Join-Path $env:LOCALAPPDATA "CESI-Dev"
$FrontendDir = Join-Path $LocalDevRoot "CESI-3.1\FrontEnd\Main"
$VenvDir = Join-Path $LocalDevRoot "CESI-3.1\venv"
$VenvScripts = Join-Path $VenvDir "Scripts"
$ActivateScript = Join-Path $VenvScripts "Activate.ps1"
$VenvPython = Join-Path $VenvScripts "python.exe"
$VenvPip = Join-Path $VenvScripts "pip.exe"
$ReqFile = Join-Path $BackendDir "requirements.txt"

# --- Helper functions ---
function Write-Step { param($msg) Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Ok { param($msg) Write-Host "   OK: $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "   !! $msg" -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host "   ERROR: $msg" -ForegroundColor Red }

# =============================================
#  PRE-FLIGHT CHECKS
# =============================================
Write-Host ""
Write-Host "=============================================" -ForegroundColor Magenta
Write-Host "   CESI Dev Server Launcher" -ForegroundColor Magenta
Write-Host "=============================================" -ForegroundColor Magenta

# Prefer Python 3.12 for compatible Django/Pillow dependencies.
Write-Step "Checking Python..."
$PythonLauncher = $null
$PythonArgs = @()
$pyLauncher = Get-Command py -ErrorAction SilentlyContinue
if ($pyLauncher) {
    & py -3.12 --version 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $PythonLauncher = "py"
        $PythonArgs = @("-3.12")
    }
}
if (-not $PythonLauncher) {
    $pythonExe = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonExe) {
        $PythonLauncher = $pythonExe.Source
    }
}
if (-not $PythonLauncher) {
    Write-Err "Python not found! Install Python 3.12 and add it to PATH."
    Read-Host "Press Enter to exit"
    exit 1
}
$pyVersion = & $PythonLauncher @PythonArgs --version 2>&1
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

$venvNeedsRecreate = $false
if (-not (Test-Path $VenvPython)) {
    $venvNeedsRecreate = $true
    Write-Warn "Local virtual environment not found"
}
else {
    Write-Step "Verifying virtual environment..."
    $testResult = & "$VenvPython" -c "import pip, django; print('ok')" 2>&1
    if ($testResult -ne "ok") {
        Write-Warn "Virtual environment is incomplete or broken"
        Write-Warn "Error: $testResult"
        $venvNeedsRecreate = $true
    }
}

if ($venvNeedsRecreate) {
    if (Test-Path $VenvDir) {
        Write-Warn "Removing broken local virtual environment..."
        Remove-Item -Recurse -Force "$VenvDir" -ErrorAction SilentlyContinue
    }
    Write-Warn "Creating a fresh virtual environment outside OneDrive..."
    & $PythonLauncher @PythonArgs -m venv "$VenvDir"
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $VenvPython)) {
        Write-Err "Failed to create venv at: $VenvDir"
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Ok "Virtual environment created"
}
else {
    Write-Ok "Virtual environment exists and is valid"
}

# Directly use the venv interpreter; activation is not required.
Write-Step "Installing/updating Python packages..."
& "$VenvPython" -m pip install --upgrade pip --disable-pip-version-check
if ($LASTEXITCODE -ne 0) {
    Write-Err "pip upgrade failed"
    Read-Host "Press Enter to exit"
    exit 1
}
& "$VenvPython" -m pip install -r "$ReqFile" --disable-pip-version-check
if ($LASTEXITCODE -ne 0) {
    Write-Err "Python dependency installation failed"
    Read-Host "Press Enter to exit"
    exit 1
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
    Pop-Location
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
}
else {
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

Write-Step "Preparing local frontend mirror..."
New-Item -ItemType Directory -Path $FrontendDir -Force -ErrorAction Stop | Out-Null

$excludeDirs = @("node_modules", ".vite", "dist")
& robocopy "$FrontendSourceDir" "$FrontendDir" /E /XD $excludeDirs /XF "*.log" /R:2 /W:1
if ($LASTEXITCODE -gt 7) {
    Write-Warn "Robocopy encountered a problem. Retrying with PowerShell copy..."
    Get-ChildItem -LiteralPath $FrontendSourceDir -Force | ForEach-Object {
        if ($excludeDirs -contains $_.Name) { return }
        if ($_.PSIsContainer) {
            Copy-Item -LiteralPath $_.FullName -Destination $FrontendDir -Recurse -Force -ErrorAction Stop
        }
        else {
            Copy-Item -LiteralPath $_.FullName -Destination $FrontendDir -Force -ErrorAction Stop
        }
    }
}

if (-not (Test-Path (Join-Path $FrontendDir "package.json"))) {
    Write-Err "Could not create the local frontend mirror at: $FrontendDir"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Ok "Frontend mirrored locally at $FrontendDir"

# Remove stale Vite artifacts in the local mirror.
$viteCacheDir = Join-Path $FrontendDir "node_modules/.vite"
if (Test-Path $viteCacheDir) {
    Remove-Item -Recurse -Force $viteCacheDir -ErrorAction SilentlyContinue
}

function Test-NpmPackageInstalled {
    param(
        [string]$PackageName
    )

    & npm ls $PackageName --depth=0 *> $null
    return ($LASTEXITCODE -eq 0)
}

Push-Location "$FrontendDir"

$packageJsonPath = Join-Path $FrontendDir "package.json"
$packageLockPath = Join-Path $FrontendDir "package-lock.json"
$nodeModulesPath = Join-Path $FrontendDir "node_modules"
$dejaVuFontPath = Join-Path $FrontendDir "node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf"

if (-not (Test-Path $packageJsonPath)) {
    Write-Err "package.json not found in frontend: $FrontendDir"
    Pop-Location
    Read-Host "Press Enter to exit"
    exit 1
}

$needsNpmInstall = $false

if (-not (Test-Path $nodeModulesPath)) {
    Write-Warn "node_modules not found - frontend dependencies need install"
    $needsNpmInstall = $true
}
elseif (Test-Path $packageLockPath) {
    $lockTime = (Get-Item $packageLockPath).LastWriteTime
    $modulesTime = (Get-Item $nodeModulesPath).LastWriteTime
    if ($lockTime -gt $modulesTime) {
        Write-Warn "package-lock.json is newer than node_modules - refreshing frontend packages"
        $needsNpmInstall = $true
    }
}

if ($needsNpmInstall) {
    Write-Step "Installing frontend packages..."
    & npm install --legacy-peer-deps --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        Write-Err "npm install failed"
        Pop-Location
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Ok "Frontend packages installed"
}
else {
    Write-Ok "Frontend packages already installed - skipping npm install"
}

# Ensure required libraries exist, but do NOT reinstall every run
$missingFrontendPackages = @()

if (-not (Test-NpmPackageInstalled "react-quill-new")) {
    $missingFrontendPackages += "react-quill-new"
}
if (-not (Test-NpmPackageInstalled "jspdf")) {
    $missingFrontendPackages += "jspdf@2.5.1"
}
if (-not (Test-NpmPackageInstalled "jspdf-autotable")) {
    $missingFrontendPackages += "jspdf-autotable@3.5.31"
}
if (-not (Test-NpmPackageInstalled "html2canvas")) {
    $missingFrontendPackages += "html2canvas"
}
if (-not (Test-NpmPackageInstalled "dejavu-fonts-ttf")) {
    $missingFrontendPackages += "dejavu-fonts-ttf"
}

if ($missingFrontendPackages.Count -gt 0) {
    Write-Step "Installing missing frontend libraries: $($missingFrontendPackages -join ', ')"
    & npm install --save --legacy-peer-deps --no-audit --no-fund $missingFrontendPackages
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to install required frontend libraries"
        Pop-Location
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Ok "Required frontend libraries installed"
}
else {
    Write-Ok "react-quill-new, jspdf, jspdf-autotable, html2canvas and dejavu-fonts-ttf already installed"
}

if (-not (Test-Path $dejaVuFontPath)) {
    Write-Err "DejaVu font file not found at: $dejaVuFontPath"
    Write-Err "Reinstall dejavu-fonts-ttf in FrontEnd/Main or delete node_modules and rerun start-dev.ps1"
    Pop-Location
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Ok "DejaVuSans.ttf found for PDF export"

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
