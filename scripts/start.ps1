param([int]$Port = 8080)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    if (-not (Test-Path '.tools/apache-maven-3.9.9/bin/mvn.cmd')) { & "$PSScriptRoot/setup.ps1" }
    Push-Location frontend
    try { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' } } finally { Pop-Location }
    & '.tools/apache-maven-3.9.9/bin/mvn.cmd' "-Dmaven.repo.local=$projectRoot/.cache/m2" -f backend/pom.xml package
    if ($LASTEXITCODE -ne 0) { throw 'Backend build or tests failed.' }
    Write-Host "ResolveDesk will be available at http://127.0.0.1:$Port"
    & java -jar backend/target/resolvedesk-0.1.0.jar "--server.port=$Port" "--spring.web.resources.static-locations=file:$projectRoot/frontend/dist/"
    if ($LASTEXITCODE -ne 0) { throw 'Application exited with an error.' }
} finally { Pop-Location }
