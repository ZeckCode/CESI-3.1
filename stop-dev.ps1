<#
.SYNOPSIS
    CESI Project - Stop Development Servers & Backup Database
.DESCRIPTION
    This script will:
      1. Backup the SQLite database to db_backup.json
      2. Stop Django dev server (port 8000)
      3. Stop Vite/React dev server (port 5173/5174)

    Run this before shutting down to ensure your data is backed up.

.NOTES
    Run from the project ROOT folder (where BackEnd/ and FrontEnd/ live):
      .\stop-dev.ps1

    The backup file (db_backup.json) can be committed to git.
#>

param(
    [switch]$SkipBackup,
    [switch]$BackupOnly
)

# --- Resolve paths ---
$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) { $ProjectRoot = (Get-Location).Path }

$BackendDir     = Join-Path $ProjectRoot "BackEnd"
$VenvDir        = Join-Path $BackendDir "venv"
$VenvPython     = Join-Path (Join-Path $VenvDir "Scripts") "python.exe"
$DbPath         = Join-Path $BackendDir "db.sqlite3"
$ExportScript   = Join-Path $BackendDir "export_backup.py"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CESI - Stop Dev & Backup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Backup Database ---
if (-not $SkipBackup) {
    Write-Host "[1/2] Backing up database..." -ForegroundColor Yellow
    
    if (Test-Path $DbPath) {
        Push-Location $BackendDir
        try {
            if (Test-Path $VenvPython) {
                & $VenvPython $ExportScript
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "  Database backed up to: db_backup.json" -ForegroundColor Green
                } else {
                    Write-Host "  Backup script returned error code: $LASTEXITCODE" -ForegroundColor Red
                }
            } else {
                # Fallback: use system python
                python $ExportScript
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "  Database backed up to: db_backup.json" -ForegroundColor Green
                } else {
                    Write-Host "  Backup script returned error code: $LASTEXITCODE" -ForegroundColor Red
                }
            }
        } catch {
            Write-Host "  Backup failed: $_" -ForegroundColor Red
        }
        Pop-Location
    } else {
        Write-Host "  No database found at: $DbPath" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "[1/2] Skipping backup (--SkipBackup flag)" -ForegroundColor DarkGray
}

# --- 2. Stop Servers ---
if (-not $BackupOnly) {
    Write-Host ""
    Write-Host "[2/2] Stopping development servers..." -ForegroundColor Yellow
    
    # Find and stop processes on common dev ports
    $ports = @(8000, 5173, 5174)
    $stoppedAny = $false
    
    foreach ($port in $ports) {
        try {
            # Get process using the port
            $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
            if ($connections) {
                foreach ($conn in $connections) {
                    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
                    if ($proc) {
                        $procName = $proc.ProcessName
                        Write-Host "  Stopping $procName (PID: $($proc.Id)) on port $port..." -ForegroundColor DarkYellow
                        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                        $stoppedAny = $true
                    }
                }
            }
        } catch {
            # Port not in use, that's fine
        }
    }
    
    if ($stoppedAny) {
        Write-Host "  Servers stopped." -ForegroundColor Green
    } else {
        Write-Host "  No dev servers found running on ports 8000, 5173, or 5174." -ForegroundColor DarkGray
    }
} else {
    Write-Host ""
    Write-Host "[2/2] Skipping server stop (--BackupOnly flag)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Done!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tip: Commit db_backup.json to git to preserve your data." -ForegroundColor DarkGray
Write-Host ""
