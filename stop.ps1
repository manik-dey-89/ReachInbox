# stop.ps1 — Stop all ReachInbox services
# Usage: .\stop.ps1
# Run from: d:\Mailora\reachinbox

$ErrorActionPreference = 'SilentlyContinue'

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ReachInbox — Stopping all services    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------------------
# Kill Node.js processes bound to ports 3000 and 3001 on Windows side
# ---------------------------------------------------------------------------
Write-Host "[1/3] Killing Windows Node.js processes on ports 3000 and 3001..." -ForegroundColor Yellow

foreach ($port in @(3000, 3001)) {
    $connections = netstat -ano | Select-String ":$port\s" | Select-String "LISTENING"
    foreach ($line in $connections) {
        if ($line -match '\s+(\d+)$') {
            $pid = $Matches[1]
            $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($proc -and $proc.Name -match 'node') {
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                Write-Host "      Killed PID $pid ($($proc.Name)) on port $port" -ForegroundColor Green
            }
        }
    }
}

# Also stop any node processes whose command line references reachinbox
Get-Process -Name node -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    Write-Host "      Killed node PID $($_.Id)" -ForegroundColor Green
}

Write-Host "      Windows Node.js processes stopped." -ForegroundColor Green

# ---------------------------------------------------------------------------
# Kill WSL API and Worker processes (via fuser on ports 3001 + worker)
# ---------------------------------------------------------------------------
Write-Host "[2/3] Killing WSL processes on ports 3000 and 3001..." -ForegroundColor Yellow
wsl -d Ubuntu -u root -- bash -c "fuser -k 3000/tcp 2>/dev/null; fuser -k 3001/tcp 2>/dev/null; true"
Write-Host "      WSL ports 3000 and 3001 cleared." -ForegroundColor Green

# Kill any lingering node processes in WSL that belong to reachinbox
wsl -d Ubuntu -u root -- bash -c "pkill -f 'reachinbox.*dist/index.js' 2>/dev/null; true"
Write-Host "      WSL reachinbox Node processes stopped." -ForegroundColor Green

# ---------------------------------------------------------------------------
# Confirm
# ---------------------------------------------------------------------------
Write-Host "[3/3] Verifying ports are free..." -ForegroundColor Yellow
$still3000 = netstat -ano | Select-String ":3000\s" | Select-String "LISTENING"
$still3001 = netstat -ano | Select-String ":3001\s" | Select-String "LISTENING"

if ($still3000) {
    Write-Host "      WARNING: Port 3000 still in use." -ForegroundColor DarkYellow
} else {
    Write-Host "      Port 3000: free" -ForegroundColor Green
}

if ($still3001) {
    Write-Host "      WARNING: Port 3001 still in use." -ForegroundColor DarkYellow
} else {
    Write-Host "      Port 3001: free" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ReachInbox — All services stopped     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  PostgreSQL and Redis (WSL) are still running." -ForegroundColor Gray
Write-Host "  To stop them: wsl -d Ubuntu -u root -- bash -c `"service postgresql stop; service redis-server stop`"" -ForegroundColor Gray
Write-Host ""
