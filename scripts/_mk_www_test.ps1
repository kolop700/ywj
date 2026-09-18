# Temp: extract assets/www from release APK for local H5 mock test (ASCII only)
Add-Type -AssemblyName System.IO.Compression.FileSystem

$apk = 'c:\Users\Administrator\Desktop\ywj\shell-android\app\build\outputs\apk\release\app-release.apk'
$dest = 'c:\Users\Administrator\Desktop\ywj\_tmp_www_test'

if (Test-Path $dest) { Remove-Item -Path $dest -Recurse -Force }
New-Item -ItemType Directory -Path $dest -Force | Out-Null

$zip = [System.IO.Compression.ZipFile]::OpenRead($apk)
$count = 0
try {
  foreach ($e in $zip.Entries) {
    if ($e.FullName.StartsWith('assets/www/') -and $e.Length -gt 0) {
      $rel = $e.FullName.Substring('assets/www/'.Length).Replace('/', '\')
      $target = Join-Path $dest $rel
      $dir = Split-Path $target -Parent
      if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
      [System.IO.Compression.ZipFileExtensions]::ExtractToFile($e, $target, $true)
      $count++
    }
  }
} finally {
  $zip.Dispose()
}
Write-Output ('extracted ' + $count + ' files to ' + $dest)
