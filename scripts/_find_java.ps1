$ErrorActionPreference = 'SilentlyContinue'
Write-Output "JAVA_HOME(User): $([Environment]::GetEnvironmentVariable('JAVA_HOME','User'))"
Write-Output "JAVA_HOME(Machine): $([Environment]::GetEnvironmentVariable('JAVA_HOME','Machine'))"
Write-Output "--- top-level dirs of search roots ---"
$roots = @('C:\Program Files','C:\Program Files (x86)','C:\Users\Administrator\AppData\Local','C:\Users\Administrator\AppData\Local\Programs','C:\Users\Administrator\Desktop','D:\')
foreach ($r in $roots) {
  Get-ChildItem $r -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'HBuilder|Java|jdk|jbr|Android|Lite|tool' } | ForEach-Object { Write-Output ("DIR: " + $_.FullName) }
}
Write-Output "--- find java.exe ---"
$found = @()
foreach ($r in $roots) {
  $found += Get-ChildItem $r -Filter 'java.exe' -Recurse -Depth 5 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
}
$found | Select-Object -Unique | ForEach-Object { Write-Output ("JAVA: " + $_) }
Write-Output "--- done"
