$ErrorActionPreference = 'Continue'
$env:JAVA_HOME = 'C:\Program Files (x86)\HBuilder X\plugins\amazon-corretto'
$bt = 'c:\Users\Administrator\Desktop\ywj\.toolchain\android-sdk\build-tools\34.0.0'
$apksigner = Join-Path $bt 'apksigner.bat'
$keytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe'

Write-Output '########## 1) APK signatures (ywj - uni-app)'
$roots = @(
  'c:\Users\Administrator\Desktop\ywj - uni-app\unpackage\release\apk',
  'c:\Users\Administrator\Desktop\ywj - uni-app\unpackage\cache\apk',
  'c:\Users\Administrator\Desktop\ywj - uni-app\unpackage\debug'
)
foreach ($root in $roots) {
  Get-ChildItem -Path $root -Filter *.apk | ForEach-Object {
    Write-Output ("================ " + $_.Name + "  (" + $_.Length + "B)")
    & $apksigner verify --print-certs $_.FullName 2>&1 | Select-String -Pattern 'DN:|MD5 digest' | ForEach-Object { Write-Output ('  ' + $_.Line) }
  }
}

Write-Output ''
Write-Output '########## 2) cloudcertificate keystore'
$ks = 'c:\Users\Administrator\Desktop\ywj - uni-app\unpackage\cache\cloudcertificate\package.keystore'
$pass1 = 'Q7tYbzUXIIrsgu7yw197JQ=='
Write-Output '--- try1: default type, pass as-is'
& $keytool -list -v -keystore $ks -storepass $pass1 2>&1 | ForEach-Object { Write-Output ('  ' + $_) }
Write-Output '--- try2: pkcs12 explicit'
& $keytool -list -v -storetype PKCS12 -keystore $ks -storepass $pass1 2>&1 | ForEach-Object { Write-Output ('  ' + $_) }
Write-Output '--- done'
