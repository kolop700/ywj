# Temp script: inspect ad markers in old yu-package APK vs 9/9 debug APK (ASCII only)
Add-Type -AssemblyName System.IO.Compression.FileSystem

$apks = @(
  'c:\Users\Administrator\Desktop\ywj\unpackage\release\apk\__UNI__1D0A789__20260909181939.apk',
  'c:\Users\Administrator\Desktop\ywj\unpackage\debug\android_debug.apk'
)

$markers = @(
  'a6aa0d3c3c058d',
  'b6aa0d4e967667',
  'b6aa0d4e9d081a',
  'b6aa0d4eb27c91',
  'b6aa0d4ea33cec',
  'b6aa0d4eabcca8',
  'TakuAdBridge',
  'ad_prod_app',
  'TakuAdsNativePlugin',
  'showRewardedVideoAd',
  'ATSDK'
)

foreach ($apk in $apks) {
  Write-Output ('================ ' + $apk)
  if (-not (Test-Path $apk)) { Write-Output '  (missing)'; continue }
  $fi = Get-Item $apk
  Write-Output ('  size=' + $fi.Length + '  mtime=' + $fi.LastWriteTime)

  $zip = [System.IO.Compression.ZipFile]::OpenRead($apk)
  try {
    $all = $zip.Entries
    Write-Output ('  total entries=' + $all.Count)
    # top-level asset structure summary
    $tops = @{}
    foreach ($e in $all) {
      $parts = $e.FullName.Split('/')
      if ($parts.Length -ge 2) {
        $key = $parts[0] + '/' + $parts[1]
        if (-not $tops.ContainsKey($key)) { $tops[$key] = 0 }
        $tops[$key] = $tops[$key] + 1
      }
    }
    $tops.GetEnumerator() | Sort-Object Name | ForEach-Object { Write-Output ('    ' + $_.Key + '  (' + $_.Value + ')') }

    # scan js/html/json entries under assets for markers
    $blob = New-Object System.Text.StringBuilder
    $scanned = 0
    foreach ($e in $all) {
      if ($e.Length -eq 0) { continue }
      $n = $e.FullName
      if (-not $n.StartsWith('assets/')) { continue }
      if ($n -notmatch '\.(js|html|css|json|xml|txt)$') { continue }
      if ($e.Length -gt 8MB) { continue }
      try {
        $s = $e.Open(); $ms = New-Object System.IO.MemoryStream
        $s.CopyTo($ms); $s.Close()
        $txt = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
        [void]$blob.Append($txt)
        $ms.Dispose()
        $scanned++
      } catch { }
    }
    $text = $blob.ToString()
    Write-Output ('  scanned files=' + $scanned + '  chars=' + $text.Length)
    foreach ($m in $markers) {
      $c = ([regex]::Matches($text, [regex]::Escape($m))).Count
      $flag = if ($c -gt 0) { '[OK]' } else { '[!!]' }
      Write-Output ('    ' + $flag + ' ' + $m + '  x' + $c)
    }
    $text = $null
  } catch {
    Write-Output ('  ERROR: ' + $_.Exception.Message)
  } finally {
    $zip.Dispose()
  }
  Write-Output ''
}
Write-Output '--- done'
