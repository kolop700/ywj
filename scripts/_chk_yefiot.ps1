$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$apk = 'c:\Users\Administrator\Desktop\ywj\unpackage\release\apk\yefiot.apk'
$zip = [System.IO.Compression.ZipFile]::OpenRead($apk)
$soEntries = $zip.Entries | Where-Object { $_.Name -like '*.so' }
Write-Output ("so count=" + $soEntries.Count)
$soNames = $soEntries | ForEach-Object { $_.Name } | Sort-Object -Unique
foreach ($n in $soNames) { Write-Output ("  so: " + $n) }

$markers = @('com/anythink','com/litemize','com/ltmb','bytedance/sdk/openadsdk','com/qq/e/comm','com/kwad/sdk','ad_prod_app','TakuAdBridge','a6aa0d3c3c058d')
$dexEntries = $zip.Entries | Where-Object { $_.Name -like '*.dex' }
Write-Output ("dex count=" + $dexEntries.Count)
$agg = @{}
foreach ($m in $markers) { $agg[$m] = 0 }
foreach ($e in $dexEntries) {
  Write-Output ("  -- " + $e.FullName + " size=" + $e.Length)
  $ms = New-Object System.IO.MemoryStream
  $s = $e.Open(); $s.CopyTo($ms); $s.Close()
  $text = [System.Text.Encoding]::ASCII.GetString($ms.ToArray()); $ms.Close()
  foreach ($m in $markers) {
    $idx = $text.IndexOf($m)
    while ($idx -ge 0) { $agg[$m] = $agg[$m] + 1; $idx = $text.IndexOf($m, $idx + 1) }
  }
}
Write-Output '--- dex totals ---'
foreach ($m in $markers) { Write-Output ("  [dex] " + $m + " x" + $agg[$m]) }

$targets = $zip.Entries | Where-Object { $_.FullName -like 'assets/apps*' -and $_.Length -lt 30000000 }
$agg2 = @{}
foreach ($m in @('a6aa0d3c3c058d','TakuAdBridge','ad_prod_app','showRewardedVideoAd','createRewardedVideoAd')) { $agg2[$m] = 0 }
$scanned = 0
$tot = 0
foreach ($e in $targets) {
  $ms = New-Object System.IO.MemoryStream
  $s = $e.Open(); $s.CopyTo($ms); $s.Close()
  if ($ms.Length -gt 30000000) { $ms.Close(); continue }
  $text = [System.Text.Encoding]::UTF8.GetString($ms.ToArray()); $ms.Close()
  $scanned++
  $tot += $text.Length
  foreach ($m in $agg2.Keys) {
    $idx = $text.IndexOf($m)
    while ($idx -ge 0) { $agg2[$m] = $agg2[$m] + 1; $idx = $text.IndexOf($m, $idx + 1) }
  }
}
Write-Output ("--- h5 scanned files=" + $scanned + " chars=" + $tot + " ---")
foreach ($m in $agg2.Keys) { Write-Output ("  [h5] " + $m + " x" + $agg2[$m]) }
$zip.Dispose()
Write-Output '--- done'
