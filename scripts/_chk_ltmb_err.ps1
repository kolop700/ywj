$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.IO.Compression.FileSystem
function U8([int[]]$a) { [System.Text.Encoding]::UTF8.GetString([byte[]]$a) }
$needle = U8 @(0xE4,0xBB,0xA3,0xE7,0xA0,0x81,0xE4,0xBD,0x8D,0xE6,0x97,0xA0,0xE5,0xA1,0xAB,0xE5,0x85,0x85)
$aar = 'c:\Users\Administrator\Desktop\ywj\nativeplugins\TakuAdsNativePlugin\android\core-3.4.1.aar'
$dst = 'c:\Users\Administrator\Desktop\ywj\scripts\_ltmb_cls'
New-Item -ItemType Directory -Force -Path $dst | Out-Null
$zip = [System.IO.Compression.ZipFile]::OpenRead($aar)
foreach ($e in $zip.Entries) {
  if ($e.Name -like '*.jar') {
    $ms = New-Object System.IO.MemoryStream; $s = $e.Open(); $s.CopyTo($ms); $s.Close(); $jb = $ms.ToArray(); $ms.Dispose()
    $jms = New-Object System.IO.MemoryStream -ArgumentList @(,$jb)
    $jar = New-Object System.IO.Compression.ZipArchive($jms)
    foreach ($je in $jar.Entries) {
      if ($je.Length -eq 0) { continue }
      $m2 = New-Object System.IO.MemoryStream; $js = $je.Open(); $js.CopyTo($m2); $js.Close(); $cb = $m2.ToArray(); $m2.Dispose()
      $txt = [System.Text.Encoding]::UTF8.GetString($cb)
      if ($txt.IndexOf($needle) -ge 0) {
        Write-Output ("FOUND: " + $je.FullName + " size=" + $cb.Length)
        $safe = ($je.FullName -replace '/', '_')
        [System.IO.File]::WriteAllBytes((Join-Path $dst $safe), $cb)
      }
    }
    $jar.Dispose(); $jms.Dispose()
  }
}
$zip.Dispose()
Write-Output '--- done'
Get-ChildItem $dst | ForEach-Object { Write-Output ("saved: " + $_.FullName + " " + $_.Length) }
