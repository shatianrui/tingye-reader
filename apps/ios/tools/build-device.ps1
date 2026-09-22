param([ValidateSet('preview','production','production-remote')][string]$Profile='preview', [switch]$NoWait)
$ErrorActionPreference='Stop'
$taskProject=Split-Path $PSScriptRoot -Parent
Push-Location $taskProject
try {
  # production-remote uses EAS-managed (server-side) build credentials instead of a
  # local certificate/provisioning profile; see eas.json. Every other profile still
  # requires the local credentials.json this project has always signed with.
  if ($Profile -ne 'production-remote') {
    if (!(Test-Path -LiteralPath 'credentials.json')) { throw 'Create credentials.json from credentials.example.json and supply private signing files.' }
    $taskCredentials=Get-Content -LiteralPath 'credentials.json' -Raw | ConvertFrom-Json
    foreach($taskFile in @($taskCredentials.ios.provisioningProfilePath,$taskCredentials.ios.distributionCertificate.path)) {
      if (!$taskFile -or !(Test-Path -LiteralPath $taskFile)) { throw 'A required iOS signing file is missing. Check credentials.json.' }
    }
  }
  & node tools/build-reader-assets.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Reader assets generation failed.' }
  $taskArguments=@('eas-cli@24.6.0','build','--platform','ios','--profile',$Profile,'--non-interactive')
  if($NoWait){$taskArguments+='--no-wait'}
  & npx @taskArguments
  if ($LASTEXITCODE -ne 0) { throw 'EAS build failed.' }
} finally { $taskCredentials=$null; Pop-Location }
