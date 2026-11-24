# start.ps1 — Start all ReachInbox services
# Usage: .\start.ps1
# Run from: d:\Mailora\reachinbox

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ReachInbox — Starting all services    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------------------
# 1. Start PostgreSQL and Redis in WSL
# ---------------------------------------------------------------------------
Write-Host "[1/9] Starting PostgreSQL and Redis in WSL..." -ForegroundColor Yellow
wsl -d Ubuntu -u root -- bash -c "service postgresql start; service redis-server start"
Write-Host "      Services started." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 2. Wait for services to initialise
# ---------------------------------------------------------------------------
Write-Host "[2/9] Waiting 2 seconds for services to initialise..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# ---------------------------------------------------------------------------
# 3. Verify PostgreSQL and Redis are up
# ---------------------------------------------------------------------------
Write-Host "[3/9] Verifying PostgreSQL..." -ForegroundColor Yellow
$pgReady = wsl -d Ubuntu -u root -- bash -c "pg_isready -q && echo OK || echo FAIL"
if ($pgReady -notmatch 'OK') {
    Write-Host "      ERROR: PostgreSQL is not ready. Aborting." -ForegroundColor Red
    exit 1
}
Write-Host "      PostgreSQL: OK" -ForegroundColor Green

Write-Host "      Verifying Redis..." -ForegroundColor Yellow
$redisPing = wsl -d Ubuntu -u root -- bash -c "redis-cli ping"
if ($redisPing -notmatch 'PONG') {
    Write-Host "      ERROR: Redis is not responding. Aborting." -ForegroundColor Red
    exit 1
}
Write-Host "      Redis: OK" -ForegroundColor Green

# ---------------------------------------------------------------------------
# 4. Kill any stale process on port 3001
# ---------------------------------------------------------------------------
Write-Host "[4/9] Clearing port 3001..." -ForegroundColor Yellow
wsl -d Ubuntu -u root -- bash -c "fuser -k 3001/tcp 2>/dev/null; true"
Write-Host "      Port 3001 clear." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 5. Load environment variables from .env
# ---------------------------------------------------------------------------
Write-Host "[5/9] Loading environment from .env..." -ForegroundColor Yellow
$envFile = Join-Path $scriptDir '.env'
if (-not (Test-Path $envFile)) {
    Write-Host "      ERROR: .env file not found at $envFile" -ForegroundColor Red
    exit 1
}

$envVarParts = @()
foreach ($line in Get-Content $envFile) {
    # Skip blank lines and comments
    $trimmed = $line.Trim()
    if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
    # Expect KEY=VALUE format
    if ($trimmed -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $key   = $Matches[1]
        $value = $Matches[2]
        # Remove surrounding quotes if present
        if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'$") {
            $value = $Matches[1]
        }
        # Escape single quotes for the bash -c string
        $valueSafe = $value -replace "'", "'\'''"
        $envVarParts += "${key}='${valueSafe}'"
    }
}
$envVarString = $envVarParts -join ' '
Write-Host "      Loaded $($envVarParts.Count) environment variables." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 6. Start the API in background
# ---------------------------------------------------------------------------
Write-Host "[6/9] Starting API server (port 3001)..." -ForegroundColor Yellow
$apiCmd = "${envVarString} node /mnt/d/Mailora/reachinbox/apps/api/dist/index.js"
Start-Process wsl `
    -ArgumentList "-d", "Ubuntu", "-u", "root", "--", "bash", "-c", $apiCmd `
    -WindowStyle Hidden
Write-Host "      API process launched." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 6b. Start the Worker in background
# ---------------------------------------------------------------------------
Write-Host "      Starting Worker..." -ForegroundColor Yellow
$workerCmd = "${envVarString} node /mnt/d/Mailora/reachinbox/apps/worker/dist/index.js"
Start-Process wsl `
    -ArgumentList "-d", "Ubuntu", "-u", "root", "--", "bash", "-c", $workerCmd `
    -WindowStyle Hidden
Write-Host "      Worker process launched." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 7. Wait for Prisma warmup
# ---------------------------------------------------------------------------
Write-Host "[7/9] Waiting 25 seconds for API/Worker Prisma warmup..." -ForegroundColor Yellow
for ($i = 25; $i -gt 0; $i--) {
    Write-Host -NoNewline "`r      $i seconds remaining...   "
    Start-Sleep -Seconds 1
}
Write-Host "`r      Warmup complete.                " -ForegroundColor Green

# ---------------------------------------------------------------------------
# 8. Start the Next.js frontend
# ---------------------------------------------------------------------------
Write-Host "[8/9] Starting Next.js frontend (port 3000)..." -ForegroundColor Yellow
Start-Process node `
    -ArgumentList "../../node_modules/next/dist/bin/next", "dev", "-p", "3000" `
    -WorkingDirectory "d:\Mailora\reachinbox\apps\web" `
    -WindowStyle Normal
Write-Host "      Next.js process launched." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 9. Wait and verify API health
# ---------------------------------------------------------------------------
Write-Host "[9/9] Waiting 5 seconds then verifying API health..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

try {
    $health = Invoke-RestMethod http://localhost:3001/api/health/queues -TimeoutSec 10
    Write-Host "      API health: OK" -ForegroundColor Green
} catch {
    Write-Host "      WARNING: API health check failed — API may still be starting up." -ForegroundColor DarkYellow
    Write-Host "      Error: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

# ---------------------------------------------------------------------------
# Final status
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ReachInbox — All services started     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Frontend   : http://localhost:3000" -ForegroundColor White
Write-Host "  API        : http://localhost:3001" -ForegroundColor White
Write-Host "  Bull Board : http://localhost:3001/admin/queues" -ForegroundColor White
Write-Host "  API Health : http://localhost:3001/api/health" -ForegroundColor White
Write-Host ""
Write-Host "  Run .\stop.ps1 to shut everything down." -ForegroundColor Gray
Write-Host ""
