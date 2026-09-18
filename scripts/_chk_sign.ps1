$ErrorActionPreference = 'Continue'
$env:JAVA_HOME = 'C:\Program Files (x86)\HBuilder X\plugins\amazon-corretto'
$apksigner = 'c:\Users\Administrator\Desktop\ywj\.toolchain\android-sdk\build-tools\34.0.0\apksigner.bat'
$apks = @(
  'c:\Users\Administrator\Desktop\ywj\shell-android\app\build\outputs\apk\release\app-release.apk',
  'c:\Users\Administrator\Desktop\ywj\unpackage\release\apk\__UNI__1D0A789__20260909181939.apk'
)
Write-Output "java check:"
java -version 2>&1 | Write-Output
Write-Output ""
foreach ($apk in $apks) {
  Write-Output "================ $apk"
  & $apksigner verify --print-certs $apk 2>&1 | Write-Output
  Write-Output ""
}
Write-Output "--- done"
