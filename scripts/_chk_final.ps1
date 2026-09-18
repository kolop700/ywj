$ErrorActionPreference = 'Continue'
$env:JAVA_HOME = 'C:\Program Files (x86)\HBuilder X\plugins\amazon-corretto'
$bt = 'c:\Users\Administrator\Desktop\ywj\.toolchain\android-sdk\build-tools\34.0.0'
$apk = 'c:\Users\Administrator\Desktop\ywj\shell-android\app\build\outputs\apk\release\app-release.apk'
$fi = Get-Item $apk
Write-Output ("APK: " + $fi.Length + " bytes, " + $fi.LastWriteTime)
Write-Output '--- package info ---'
& "$bt\aapt2.exe" dump badging $apk 2>&1 | Select-String -Pattern "^package:|^application-label:" | ForEach-Object { Write-Output $_.Line }
Write-Output '--- signature ---'
& "$bt\apksigner.bat" verify --print-certs $apk 2>&1 | Select-String -Pattern 'DN:|SHA-1 digest|SHA-256 digest|MD5 digest' | ForEach-Object { Write-Output $_.Line }
Write-Output '--- done'
