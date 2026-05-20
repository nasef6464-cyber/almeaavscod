$running = Get-Process mongod -ErrorAction SilentlyContinue

if (-not $running) {
  Write-Host "MongoDB local is not running."
  exit 0
}

$running | Stop-Process -Force
Write-Host "MongoDB local stopped."
