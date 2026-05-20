$mongoBin = "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe"
$dbPath = "C:\ALMEAA MAY - codax\local-mongodb\data"
$logPath = "C:\ALMEAA MAY - codax\local-mongodb\logs\mongod.log"

New-Item -ItemType Directory -Force -Path $dbPath | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $logPath -Parent) | Out-Null

& $mongoBin `
  --dbpath $dbPath `
  --bind_ip 127.0.0.1 `
  --port 27017 `
  --logpath $logPath `
  --logappend
