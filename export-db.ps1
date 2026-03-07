<#
.SYNOPSIS
    CESI Project - Export Database to JSON
.DESCRIPTION
    Exports all database tables to a JSON file without BOM.
    This file can be included in version control and will be
    automatically imported when running start-dev.ps1 on a new machine.
.NOTES
    Run from the project ROOT folder:
      .\export-db.ps1
#>

$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) { $ProjectRoot = (Get-Location).Path }

$BackendDir = Join-Path $ProjectRoot "BackEnd"
$VenvPython = Join-Path (Join-Path (Join-Path $BackendDir "venv") "Scripts") "python.exe"
$OutputFile = Join-Path $BackendDir "db_backup.json"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   CESI Database Export" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $VenvPython)) {
    Write-Host "ERROR: Virtual environment not found. Run start-dev.ps1 first." -ForegroundColor Red
    exit 1
}

Push-Location $BackendDir

Write-Host "Exporting database to db_backup.json..." -ForegroundColor Yellow
& $VenvPython manage.py export_to_json --output $OutputFile

Pop-Location

Write-Host ""
Write-Host "Export complete! File saved to: $OutputFile" -ForegroundColor Green
Write-Host "This file can be committed to version control." -ForegroundColor Green
