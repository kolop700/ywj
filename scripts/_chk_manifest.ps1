$ErrorActionPreference = 'Continue'
$aapt2 = 'c:\Users\Administrator\Desktop\ywj\.toolchain\android-sdk\build-tools\34.0.0\aapt2.exe'
$apk = 'c:\Users\Administrator\Desktop\ywj\shell-android\app\build\outputs\apk\release\app-release.apk'
$out = & $aapt2 dump xmltree --file AndroidManifest.xml $apk 2>&1 | Out-String
$out | Out-File -Encoding utf8 'c:\Users\Administrator\Desktop\ywj\scripts\_out_manifest_full.txt'
Write-Output "chars=$($out.Length)"
Write-Output '--- key components ---'
$patterns = @('anythink','bytedance','pangle','qq.e','kwad','ksad','TTAd','taku','usesCleartextTraffic','networkSecurityConfig','Splash','Reward')
foreach ($p in $patterns) {
  $hit = ($out -split "`n") | Select-String -Pattern $p -SimpleMatch
  Write-Output ("=== " + $p + " : " + @($hit).Count)
  $hit | Select-Object -First 12 | ForEach-Object { Write-Output ("   " + $_.Line.Trim()) }
}
Write-Output '--- done'
