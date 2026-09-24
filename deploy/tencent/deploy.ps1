param(
  [string]$Server = "root@129.226.201.249",
  [string]$RemoteDirectory = "/opt/tingye-reader",
  [string]$IdentityFile = "$HOME\.ssh\tingye_tencent"
)

$ErrorActionPreference = "Stop"
$deploymentDirectory = $PSScriptRoot
$repositoryRoot = Resolve-Path (Join-Path $deploymentDirectory "..\..")
$environmentFile = Join-Path $deploymentDirectory ".env.server"

if (-not (Test-Path $environmentFile)) {
  throw "Create deploy/tencent/.env.server from .env.server.example and fill in the production secrets first."
}

$required = @("DOMAIN", "POSTGRES_PASSWORD", "S3_ACCESS_KEY", "S3_SECRET_KEY", "AUTH_RATE_SECRET")
$configured = @{}
Get-Content $environmentFile | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
    $configured[$matches[1].Trim()] = $matches[2].Trim()
  }
}
$missing = $required | Where-Object { -not $configured[$_] }
if ($missing) {
  throw "Missing required values in .env.server: $($missing -join ', ')"
}

$archive = Join-Path $env:TEMP "tingye-reader-deploy-$([guid]::NewGuid().ToString('N')).tar.gz"
try {
  Push-Location $repositoryRoot
  try {
    tar -czf $archive --exclude=.git --exclude=node_modules --exclude=.next .
  } finally {
    Pop-Location
  }

  ssh -i $IdentityFile $Server "mkdir -p '$RemoteDirectory/deploy/tencent'"
  if ($LASTEXITCODE -ne 0) { throw "Could not create the remote deployment directory." }
  scp -i $IdentityFile $archive "${Server}:${RemoteDirectory}/release.tar.gz"
  if ($LASTEXITCODE -ne 0) { throw "Could not upload the deployment archive." }
  scp -i $IdentityFile $environmentFile "${Server}:${RemoteDirectory}/deploy/tencent/.env.server"
  if ($LASTEXITCODE -ne 0) { throw "Could not upload the server environment file." }

  ssh -i $IdentityFile $Server "cd '$RemoteDirectory' && tar -xzf release.tar.gz && rm release.tar.gz && docker compose --env-file deploy/tencent/.env.server -f deploy/tencent/compose.yaml up -d --build && docker compose --env-file deploy/tencent/.env.server -f deploy/tencent/compose.yaml ps"
  if ($LASTEXITCODE -ne 0) { throw "Remote Docker deployment failed." }

  $origin = "https://$($configured.DOMAIN)"
  for ($attempt = 1; $attempt -le 12; $attempt++) {
    try {
      $response = Invoke-WebRequest "$origin/login" -TimeoutSec 10 -UseBasicParsing
      if ($response.StatusCode -eq 200) {
        Write-Host "Deployment is healthy: $origin"
        exit 0
      }
    } catch {
      if ($attempt -eq 12) { throw }
      Start-Sleep -Seconds 5
    }
  }
} finally {
  Remove-Item $archive -Force -ErrorAction SilentlyContinue
}
