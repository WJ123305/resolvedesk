$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    foreach ($tool in @('java','node','npm.cmd')) { if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Required tool missing: $tool (Java 17+, Node 22.18+)." } }
    & node scripts/bootstrap.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Tool bootstrap failed.' }
    if (-not (Test-Path '.tools/apache-maven-3.9.9/bin/mvn.cmd')) { Expand-Archive -LiteralPath '.tools/maven.zip' -DestinationPath '.tools' -Force }
    Push-Location frontend
    try { & npm.cmd --cache ../.cache/npm ci --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { throw 'Frontend install failed.' } } finally { Pop-Location }
    Write-Host 'Setup complete. Run scripts/check.ps1, then scripts/start.ps1.'
} finally { Pop-Location }
