# Alternate compiler for Windows environments where javac ZipFS ancestor lookup is restricted.
# Keeps the same source files, tests, Spring context and dependencies as the normal Maven build.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    if (-not (Test-Path '.tools/apache-maven-3.9.9/bin/mvn.cmd')) { throw 'Run scripts/setup.ps1 first.' }
    & node scripts/verification-tools.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Verification tools failed.' }
    New-Item -ItemType Directory -Path '.cache' -Force | Out-Null
    & '.tools/apache-maven-3.9.9/bin/mvn.cmd' "-Dmaven.repo.local=$projectRoot/.cache/m2" -f backend/pom.xml dependency:build-classpath "-Dmdep.outputFile=$projectRoot/.cache/test-classpath.txt" -q
    if ($LASTEXITCODE -ne 0) { throw 'Dependency resolution failed.' }
    $dependencyPath = (Get-Content -LiteralPath '.cache/test-classpath.txt' -Raw).Trim()
    $sourceFiles = @(Get-ChildItem -LiteralPath 'backend/src/main/java','backend/src/test/java' -Recurse -Filter '*.java' | Select-Object -ExpandProperty FullName)
    $buildDirectory = Join-Path $projectRoot ('.cache/verified-' + [guid]::NewGuid().ToString('N'))
    & java '-Dfile.encoding=UTF-8' -jar .tools/verification/ecj.jar -17 -encoding UTF-8 -parameters -proc:none -cp $dependencyPath -d $buildDirectory @sourceFiles
    if ($LASTEXITCODE -ne 0) { throw 'Source compilation failed.' }
    & java '-Dfile.encoding=UTF-8' -cp ".tools/verification/junit-console.jar;$buildDirectory;backend/src/main/resources;$dependencyPath" org.junit.platform.console.ConsoleLauncher execute --select-class dev.resolvedesk.WorkspaceIntegrationTest --details=tree --disable-ansi-colors
    if ($LASTEXITCODE -ne 0) { throw 'Integration tests failed.' }
    Push-Location frontend
    try { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' } } finally { Pop-Location }
    Write-Host 'Portable compilation, integration tests and frontend build passed.'
} finally { Pop-Location }
