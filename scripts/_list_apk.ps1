$ErrorActionPreference = 'SilentlyContinue'
$dirs = @('c:\Users\Administrator\Desktop\ywj\unpackage','c:\Users\Administrator\Desktop\ywj\shell-android','c:\Users\Administrator\Desktop\ywj\download')
foreach ($d in $dirs) {
  Get-ChildItem $d -Recurse -Filter '*.apk' -ErrorAction SilentlyContinue | Where-Object { $_.Length -gt 1000000 } | ForEach-Object {
    Write-Output ($_.FullName + " | " + $_.Length + " | " + $_.LastWriteTime)
  }
}
Write-Output '--- done'
