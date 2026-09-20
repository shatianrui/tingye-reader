param([switch]$Unsigned)
$ErrorActionPreference='Stop'
$taskProject=Split-Path $PSScriptRoot -Parent
if (!$env:JAVA_HOME -or !(Test-Path (Join-Path $env:JAVA_HOME 'bin/java.exe'))) { throw 'Set JAVA_HOME to a JDK 17 installation.' }
if (!$env:ANDROID_HOME) { $env:ANDROID_HOME=$env:ANDROID_SDK_ROOT }
if (!$env:ANDROID_HOME -or !(Test-Path $env:ANDROID_HOME)) { throw 'Set ANDROID_HOME to your Android SDK.' }
if (!$Unsigned) {
  foreach($taskName in @('ANDROID_KEYSTORE_PATH','ANDROID_KEY_ALIAS','ANDROID_STORE_PASSWORD','ANDROID_KEY_PASSWORD')) {
    if (![Environment]::GetEnvironmentVariable($taskName)) { throw "Missing signing environment variable: $taskName" }
  }
  if (!(Test-Path -LiteralPath $env:ANDROID_KEYSTORE_PATH)) { throw 'Signing keystore does not exist.' }
}
Push-Location $taskProject
try { & node tools/build-reader-assets.cjs; if($LASTEXITCODE -ne 0){throw 'Reader assets generation failed.'} } finally { Pop-Location }
if (!$env:CMAKE_BUILD_PARALLEL_LEVEL) { $env:CMAKE_BUILD_PARALLEL_LEVEL='2' }
$env:NODE_ENV='production'
Set-Content -LiteralPath (Join-Path $taskProject 'android/local.properties') -Value ('sdk.dir='+$env:ANDROID_HOME.Replace('\','/')) -Encoding utf8
Push-Location (Join-Path $taskProject 'android')
try {
  & .\gradlew.bat :app:assembleRelease --no-daemon --max-workers=1 --console=plain '-Pkotlin.compiler.execution.strategy=in-process'
  if($LASTEXITCODE -ne 0){throw 'Local Gradle build failed; no new APK was signed.'}
} finally {Pop-Location}
if (!$Unsigned) { & (Join-Path $PSScriptRoot 'sign-local-apk.ps1') }
