$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    if (-not (Test-Path '.tools/apache-maven-3.9.9/bin/mvn.cmd')) { throw 'Run scripts/setup.ps1 first.' }
    & '.tools/apache-maven-3.9.9/bin/mvn.cmd' "-Dmaven.repo.local=$projectRoot/.cache/m2" -f backend/pom.xml test
    if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed.' }
    Push-Location frontend
    try { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' } } finally { Pop-Location }
    Write-Host 'All checks passed.'
} finally { Pop-Location }
