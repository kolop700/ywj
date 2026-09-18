# 从 APK 的 v1 签名块（META-INF/*.RSA）提取证书并计算 MD5（微信"应用签名"）
param([Parameter(Mandatory=$true)][string]$Apk)

Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Security

$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $Apk))
try {
  $entry = $zip.Entries | Where-Object { $_.FullName -match '^META-INF/.*\.(RSA|DSA|EC)$' } | Select-Object -First 1
  if (-not $entry) { Write-Output "NO_V1_SIGNATURE"; exit 1 }
  $ms = New-Object System.IO.MemoryStream
  $s = $entry.Open(); $s.CopyTo($ms); $s.Close()
  $bytes = $ms.ToArray()

  $cms = New-Object System.Security.Cryptography.Pkcs.SignedCms
  $cms.Decode($bytes)
  $cert = $cms.Certificates[0]

  $md5 = [System.Security.Cryptography.MD5]::Create().ComputeHash($cert.RawData)
  $sha1 = [System.Security.Cryptography.SHA1]::Create().ComputeHash($cert.RawData)
  $md5hex = ($md5 | ForEach-Object { $_.ToString('x2') }) -join ''
  $sha1hex = ($sha1 | ForEach-Object { $_.ToString('x2') }) -join ''
  Write-Output ("APK: " + $Apk)
  Write-Output ("  cert MD5 : " + $md5hex)
  Write-Output ("  cert SHA1: " + $sha1hex)
} finally { $zip.Dispose() }
