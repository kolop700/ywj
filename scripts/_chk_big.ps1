$ErrorActionPreference = 'Continue'
$aapt2 = 'c:\Users\Administrator\Desktop\ywj\.toolchain\android-sdk\build-tools\34.0.0\aapt2.exe'
$apks = @(
  'c:\Users\Administrator\Desktop\ywj\unpackage\release\apk\yefiot.apk',
  'c:\Users\Administrator\Desktop\ywj\unpackage\release\apk\__UNI__1D0A789__20260903204646.apk',
  'c:\Users\Administrator\Desktop\ywj\unpackage\cache\apk\__UNI__1D0A789_cm.apk'
)
foreach ($apk in $apks) {
  Write-Output "================ $apk"
  if (-not (Test-Path $apk)) { Write-Output 'MISSING'; continue }
  Write-Output '--- badging ---'
  & $aapt2 dump badging $apk 2>&1 | Select-String -Pattern 'package:|launchable' | ForEach-Object { Write-Output $_.Line }
  Write-Output '--- ad components in manifest ---'
  $out = & $aapt2 dump xmltree --file AndroidManifest.xml $apk 2>&1 | Out-String
  $patterns = @('anythink','ltmb','bytedance','TTAd','qq.e','kwad')
  foreach ($p in $patterns) {
    $hit = ($out -split "`n") | Select-String -Pattern $p -SimpleMatch
    Write-Output ("  " + $p + " : " + @($hit).Count)
    $hit | Select-Object -First 3 | ForEach-Object { Write-Output ("     " + $_.Line.Trim()) }
  }
}
Write-Output '--- done'
