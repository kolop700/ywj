# Verify H5 bundle inside release APK (miniprogram launch strings in my-page chunk)
param([string]$Apk = "C:\Users\Administrator\Desktop\ywj\shell-android\app\build\outputs\apk\release\app-release.apk")
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead($Apk)
try {
  $e = $z.Entries | Where-Object { $_.FullName -match 'workbench_package-pages-my-index.*\.js$' } | Select-Object -First 1
  if (-not $e) { Write-Output 'MISSING: my chunk not found in APK'; exit 1 }
  $sr = New-Object System.IO.StreamReader($e.Open(), [System.Text.Encoding]::UTF8)
  $c = $sr.ReadToEnd(); $sr.Close()
  Write-Output ("file=" + $e.FullName + "  chars=" + $c.Length)
  Write-Output ("wx4c80533df6184dda: " + $c.Contains('wx4c80533df6184dda'))
  Write-Output ("gh_67863dc191ba   : " + $c.Contains('gh_67863dc191ba'))
  Write-Output ("launchMiniProgram : " + $c.Contains('launchMiniProgram'))
  Write-Output ("fromApp=1         : " + $c.Contains('fromApp=1'))
  Write-Output ("adminLogin        : " + $c.Contains('adminLogin'))
} finally { $z.Dispose() }
