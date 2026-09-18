$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$pairs = @(
  @{ name = 'DEBUG  '; path = 'c:\Users\Administrator\Desktop\ywj\shell-android\app\build\outputs\apk\debug\app-debug.apk' },
  @{ name = 'RELEASE'; path = 'c:\Users\Administrator\Desktop\ywj\shell-android\app\build\outputs\apk\release\app-release.apk' }
)
$markers = @('ad.init','ad.loadRewarded','ad.banner.show','ad.showRewarded','__nativeCallback','NativeBridge','createAdBridgeAdapter','ad_prod_app','TakuAds','adControl','getBannerAdId','a6aa0d3c3c058d')
foreach ($p in $pairs) {
  Write-Output ("================ " + $p.name)
  $zip = [System.IO.Compression.ZipFile]::OpenRead($p.path)
  $dexs = $zip.Entries | Where-Object { $_.Name -like '*.dex' }
  $dexSum = ($dexs | Measure-Object -Property Length -Sum).Sum
  Write-Output ("  dex count=" + $dexs.Count + "  totalBytes=" + $dexSum)
  $www = $zip.Entries | Where-Object { $_.FullName -like 'assets/www/*' }
  $wwwSum = ($www | Measure-Object -Property Length -Sum).Sum
  Write-Output ("  www files=" + $www.Count + "  totalBytes=" + $wwwSum)
  $agg = @{}
  foreach ($m in $markers) { $agg[$m] = 0 }
  $totalChars = 0
  foreach ($e in $www) {
    if ($e.Length -gt 15000000) { continue }
    $ms = New-Object System.IO.MemoryStream
    $s = $e.Open(); $s.CopyTo($ms); $s.Close()
    $text = [System.Text.Encoding]::UTF8.GetString($ms.ToArray()); $ms.Close()
    $totalChars += $text.Length
    foreach ($m in $markers) {
      $idx = $text.IndexOf($m)
      while ($idx -ge 0) { $agg[$m] = $agg[$m] + 1; $idx = $text.IndexOf($m, $idx + 1) }
    }
  }
  Write-Output ("  www totalChars=" + $totalChars)
  foreach ($m in $markers) { Write-Output ("    " + $m + " x" + $agg[$m]) }
  $zip.Dispose()
}
Write-Output '--- done'
