# Temp script: verify bridge & ad code presence in release APK assets/www (ASCII only)
Add-Type -AssemblyName System.IO.Compression.FileSystem

$apk = 'c:\Users\Administrator\Desktop\ywj\shell-android\app\build\outputs\apk\release\app-release.apk'
$markers = @(
  'NativeBridge',
  '__nativeCallback',
  '__nativeEmit',
  'native bridge unavailable',
  'ad.init',
  'ad.banner.show',
  'ad.loadRewarded',
  'a6aa0d3c3c058d',
  'installUniShims',
  'h5-native-bridge',
  'WWW_INDEX'
)

$fi = Get-Item $apk
Write-Output ('apk size=' + $fi.Length + '  mtime=' + $fi.LastWriteTime)

$zip = [System.IO.Compression.ZipFile]::OpenRead($apk)
try {
  $www = $zip.Entries | Where-Object { $_.FullName -like 'assets/www/*' -and $_.Length -gt 0 }
  Write-Output ('www entries=' + $www.Count)
  Write-Output 'www file list:'
  foreach ($e in ($www | Sort-Object FullName)) {
    Write-Output ('  ' + $e.FullName + '  (' + $e.Length + ')')
  }

  $blob = New-Object System.Text.StringBuilder
  foreach ($e in $www) {
    if ($e.FullName -match '\.(js|html|css|json)$') {
      $s = $e.Open(); $ms = New-Object System.IO.MemoryStream
      $s.CopyTo($ms); $s.Close()
      [void]$blob.Append([System.Text.Encoding]::UTF8.GetString($ms.ToArray()))
      $ms.Dispose()
    }
  }
  $text = $blob.ToString()
  Write-Output ('scanned chars=' + $text.Length)
  foreach ($m in $markers) {
    $c = ([regex]::Matches($text, [regex]::Escape($m))).Count
    $flag = if ($c -gt 0) { '[OK]' } else { '[!!]' }
    Write-Output ('  ' + $flag + ' ' + $m + '  x' + $c)
  }

  # dump index.html content
  $idx = $www | Where-Object { $_.FullName -eq 'assets/www/index.html' }
  if ($idx) {
    $s = $idx.Open(); $ms = New-Object System.IO.MemoryStream
    $s.CopyTo($ms); $s.Close()
    Write-Output '---- index.html ----'
    Write-Output ([System.Text.Encoding]::UTF8.GetString($ms.ToArray()))
    $ms.Dispose()
  }
  $text = $null
} finally {
  $zip.Dispose()
}
Write-Output '--- done'
