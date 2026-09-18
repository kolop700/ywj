$ErrorActionPreference = 'Continue'
$env:JAVA_HOME = 'C:\Program Files (x86)\HBuilder X\plugins\amazon-corretto'
$aapt2 = 'c:\Users\Administrator\Desktop\ywj\.toolchain\android-sdk\build-tools\34.0.0\aapt2.exe'
$apks = @(
  'c:\Users\Administrator\Desktop\ywj - uni-app\unpackage\release\apk\yefiot.apk',
  'c:\Users\Administrator\Desktop\ywj - uni-app\unpackage\release\apk\__UNI__1D0A789__20260903204646.apk',
  'c:\Users\Administrator\Desktop\ywj - uni-app\unpackage\release\apk\__UNI__1D0A789__20260909181939.apk',
  'c:\Users\Administrator\Desktop\ywj - uni-app\unpackage\release\apk\__UNI__F8D1DD9__20260903172311.apk',
  'c:\Users\Administrator\Desktop\ywj\shell-android\app\build\outputs\apk\release\app-release.apk',
  'c:\Users\Administrator\Desktop\ywj\shell-android\app\build\outputs\apk\debug\app-debug.apk'
)
foreach ($apk in $apks) {
  Write-Output ("================ " + (Split-Path $apk -Leaf))
  & $aapt2 dump badging $apk 2>&1 | Select-String -Pattern "^package:" | ForEach-Object { Write-Output ('  ' + $_.Line) }
}
Write-Output '--- done'
