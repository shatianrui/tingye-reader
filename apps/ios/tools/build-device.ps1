param([ValidateSet('preview','production')][string]$Profile='preview', [switch]$NoWait)
$ErrorActionPreference='Stop'
$taskProject=Split-Path $PSScriptRoot -Parent
Push-Location $taskProject
try {
  if (!(Test-Path -LiteralPath 'credentials.json')) { throw 'Create credentials.json from credentials.example.json and supply private signing files.' }
  $taskCredentials=Get-Content -LiteralPath 'credentials.json' -Raw | ConvertFrom-Json
  foreach($taskFile in @($taskCredentials.ios.provisioningProfilePath,$taskCredentials.ios.distributionCertificate.path)) {
    if (!$taskFile -or !(Test-Path -LiteralPath $taskFile)) { throw 'A required iOS signing file is missing. Check credentials.json.' }
  }
  & node tools/build-reader-assets.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Reader assets generation failed.' }
  $taskArguments=@('eas-cli@24.6.0','build','--platform','ios','--profile',$Profile,'--non-interactive')
  if($NoWait){$taskArguments+='--no-wait'}
  & npx @taskArguments
  if ($LASTEXITCODE -ne 0) { throw 'EAS build failed.' }
} finally { $taskCredentials=$null; Pop-Location }
