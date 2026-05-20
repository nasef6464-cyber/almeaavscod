$runnerScript = "C:\ALMEAA MAY - codax\scripts\run-local-mongo.ps1"

if (-not (Test-Path $runnerScript)) {
  Write-Error "MongoDB runner script was not found at $runnerScript"
  exit 1
}

$running = Get-Process mongod -ErrorAction SilentlyContinue
if ($running) {
  Write-Host "MongoDB local is already running."
  exit 0
}

Write-Host "Starting MongoDB local on mongodb://127.0.0.1:27017/the-hundred"
Write-Host "Keep this PowerShell window open while the backend is running."
powershell.exe -ExecutionPolicy Bypass -File $runnerScript
