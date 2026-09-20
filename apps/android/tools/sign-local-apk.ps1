param([string]$InputApk,[string]$OutputApk)
$ErrorActionPreference='Stop'
$taskProject=Split-Path $PSScriptRoot -Parent
foreach($taskName in @('JAVA_HOME','ANDROID_HOME','ANDROID_KEYSTORE_PATH','ANDROID_KEY_ALIAS','ANDROID_STORE_PASSWORD','ANDROID_KEY_PASSWORD')) {
  if (![Environment]::GetEnvironmentVariable($taskName)) { throw "Missing environment variable: $taskName" }
}
if(!$InputApk){$InputApk=Join-Path $taskProject 'android/app/build/outputs/apk/release/app-release-unsigned.apk'}
if(!$OutputApk){$taskConfig=Get-Content -LiteralPath (Join-Path $taskProject 'app.json') -Raw | ConvertFrom-Json; $OutputApk=Join-Path $taskProject ('releases/wereader-'+$taskConfig.expo.version+'-'+$taskConfig.expo.android.versionCode+'-local.apk')}
$taskVersion=if($env:ANDROID_BUILD_TOOLS_VERSION){$env:ANDROID_BUILD_TOOLS_VERSION}else{'36.0.0'}
$taskBuildTools=Join-Path $env:ANDROID_HOME ('build-tools/'+$taskVersion)
$taskJava=Join-Path $env:JAVA_HOME 'bin/java.exe'
$taskSigner=Join-Path $taskBuildTools 'lib/apksigner.jar'
New-Item -ItemType Directory -Force (Split-Path $OutputApk -Parent) | Out-Null
$taskAligned=Join-Path (Split-Path $OutputApk -Parent) 'unsigned-aligned.apk'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskArchive=[System.IO.Compression.ZipFile]::Open($InputApk,[System.IO.Compression.ZipArchiveMode]::Update)
try {
 foreach($taskPackage in @('pdfjs-dist','css-tree','react-native-webview','expo-image')){
  $taskEntry='assets/licenses/'+$taskPackage+'.txt'
  $taskExisting=$taskArchive.GetEntry($taskEntry)
  if($taskExisting){$taskExisting.Delete()}
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskArchive,(Join-Path $taskProject ('node_modules/'+$taskPackage+'/LICENSE')),$taskEntry) | Out-Null
 }
} finally {$taskArchive.Dispose()}
& (Join-Path $taskBuildTools 'zipalign.exe') -f -P 16 4 $InputApk $taskAligned
if($LASTEXITCODE -ne 0){throw 'APK alignment failed.'}
& $taskJava -jar $taskSigner sign --ks $env:ANDROID_KEYSTORE_PATH --ks-key-alias $env:ANDROID_KEY_ALIAS --ks-pass env:ANDROID_STORE_PASSWORD --key-pass env:ANDROID_KEY_PASSWORD --out $OutputApk $taskAligned
if($LASTEXITCODE -ne 0){throw 'Local APK signing failed.'}
& $taskJava -jar $taskSigner verify --verbose --print-certs $OutputApk
if($LASTEXITCODE -ne 0){throw 'APK signature verification failed.'}
Get-FileHash -LiteralPath $OutputApk -Algorithm SHA256
