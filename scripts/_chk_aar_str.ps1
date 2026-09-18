$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$dir = 'c:\Users\Administrator\Desktop\ywj\nativeplugins\TakuAdsNativePlugin\android'
$outPath = 'c:\Users\Administrator\Desktop\ywj\scripts\_out_aar_str.txt'
function U8([int[]]$a) { [System.Text.Encoding]::UTF8.GetString([byte[]]$a) }
$needles = @(
  (U8 @(0xE4,0xBB,0xA3,0xE7,0xA0,0x81,0xE4,0xBD,0x8D,0xE6,0x97,0xA0,0xE5,0xA1,0xAB,0xE5,0x85,0x85)),
  (U8 @(0xE8,0x8E,0xB1,0xE7,0x89,0xB9,0xE6,0x91,0xA9,0xE6,0xAF,0x94)),
  'Litemize','ltmb','LTAdDeviceManager','dsp166','kuying'
)
$out = New-Object System.Collections.Generic.List[string]
foreach ($f in (Get-ChildItem -Path $dir -Filter '*.aar' | Sort-Object Name)) {
  $out.Add("== " + $f.Name)
  try { $zip = [System.IO.Compression.ZipFile]::OpenRead($f.FullName) } catch { $out.Add("  open fail"); continue }
  $hits = @{}
  foreach ($e in $zip.Entries) {
    if ($e.Name -notlike '*.jar') { continue }
    $ms = New-Object System.IO.MemoryStream
    try { $s = $e.Open(); $s.CopyTo($ms); $s.Close() } catch { continue }
    $jb = $ms.ToArray(); $ms.Dispose()
    $jms = New-Object System.IO.MemoryStream -ArgumentList @(,$jb)
    try { $jar = New-Object System.IO.Compression.ZipArchive($jms) } catch { continue }
    foreach ($je in $jar.Entries) {
      if ($je.Length -eq 0) { continue }
      $m2 = New-Object System.IO.MemoryStream
      try { $js = $je.Open(); $js.CopyTo($m2); $js.Close() } catch { continue }
      $cb = $m2.ToArray(); $m2.Dispose()
      $txt = [System.Text.Encoding]::UTF8.GetString($cb)
      foreach ($n in $needles) {
        if ($txt.IndexOf($n) -ge 0) {
          $k = $e.Name + ' | ' + $n
          if (-not $hits.ContainsKey($k)) { $hits[$k] = 0 }
          $hits[$k] = $hits[$k] + 1
        }
      }
    }
    $jar.Dispose(); $jms.Dispose()
  }
  $zip.Dispose()
  if ($hits.Count -eq 0) { $out.Add("  (no hits)") }
  foreach ($k in ($hits.Keys | Sort-Object)) { $out.Add("  [HIT] " + $k + " x" + $hits[$k]) }
}
$out.Add('--- done')
$out | Out-File -Encoding utf8 $outPath
Write-Output ("lines=" + $out.Count)
Get-Content $outPath | Select-Object -First 120
