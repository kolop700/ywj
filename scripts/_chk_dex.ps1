$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$apks = @(
  'c:\Users\Administrator\Desktop\ywj\shell-android\app\build\outputs\apk\release\app-release.apk',
  'c:\Users\Administrator\Desktop\ywj\unpackage\release\apk\__UNI__1D0A789__20260909181939.apk'
)

$markers = @(
  'com/anythink/core/api/ATSDK',
  'com/anythink/core/common',
  'com/anythink/rewardvideo',
  'com/anythink/interstitial',
  'com/anythink/banner',
  'com/litemize',
  'bytedance/sdk/openadsdk',
  'com/qq/e/comm',
  'com/kwad/sdk',
  'com/anythink/network/pangle',
  'com/anythink/network/gdt',
  'com/anythink/network/kwad',
  'TakuAdBridge',
  'AdManager'
)

foreach ($apk in $apks) {
  Write-Output "================ $apk"
  if (-not (Test-Path $apk)) { Write-Output "  MISSING"; continue }
  $zip = [System.IO.Compression.ZipFile]::OpenRead($apk)
  $soEntries = $zip.Entries | Where-Object { $_.FullName -like 'lib/*' -and $_.Name -like '*.so' }
  Write-Output ("  so count=" + $soEntries.Count)
  foreach ($so in $soEntries) { Write-Output ("    so: " + $so.FullName + " (" + $so.Length + ")") }

  $dexEntries = $zip.Entries | Where-Object { $_.Name -like '*.dex' }
  Write-Output ("  dex entries=" + $dexEntries.Count)
  $agg = @{}
  foreach ($m in $markers) { $agg[$m] = 0 }
  foreach ($e in $dexEntries) {
    Write-Output ("  -- " + $e.FullName + " size=" + $e.Length)
    $ms = New-Object System.IO.MemoryStream
    $s = $e.Open()
    $s.CopyTo($ms)
    $s.Close()
    $text = [System.Text.Encoding]::ASCII.GetString($ms.ToArray())
    $ms.Close()
    foreach ($m in $markers) {
      $idx = $text.IndexOf($m)
      $cnt = 0
      while ($idx -ge 0) { $cnt = $cnt + 1; $idx = $text.IndexOf($m, $idx + 1) }
      if ($cnt -gt 0) { $agg[$m] = $agg[$m] + $cnt; Write-Output ("     [OK] " + $m + " x" + $cnt) }
    }
  }
  Write-Output "  ---- totals ----"
  foreach ($m in $markers) {
    if ($agg[$m] -gt 0) { Write-Output ("    [OK] " + $m + " x" + $agg[$m]) }
    else { Write-Output ("    [!!] " + $m + " x0") }
  }
  $zip.Dispose()
}
Write-Output "--- done"
