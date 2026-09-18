$ErrorActionPreference = 'Continue'
$env:JAVA_HOME = 'C:\Program Files (x86)\HBuilder X\plugins\amazon-corretto'
$apksigner = 'c:\Users\Administrator\Desktop\ywj\.toolchain\android-sdk\build-tools\34.0.0\apksigner.bat'
$apks = @(
  'c:\Users\Administrator\Desktop\ywj\shell-android\app\build\outputs\apk\debug\app-debug.apk',
  'c:\Users\Administrator\Desktop\ywj\shell-android\app\build\outputs\apk\release\app-release.apk'
)
foreach ($apk in $apks) {
  Write-Output "================ $apk"
  & $apksigner verify --print-certs $apk 2>&1 | Select-String -Pattern 'DN|digest' | ForEach-Object { Write-Output ('  ' + $_.Line) }
  Write-Output ''
}
Write-Output '--- done'
