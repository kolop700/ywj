# 无密码从 keystore(JKS) 二进制中提取明文证书链，输出证书 MD5/SHA1
# 原理：JKS 的 PrivateKeyEntry 中私钥加密，但证书链 DER 为明文存储
param([Parameter(Mandatory=$true)][string]$Ks)

$bytes = [IO.File]::ReadAllBytes((Resolve-Path $Ks))
$found = $false
for ($i = 0; $i -lt $bytes.Length - 3; $i++) {
  if ($bytes[$i] -eq 0x30 -and $bytes[$i+1] -eq 0x82) {
    $len = ([int]$bytes[$i+2] -shl 8) + [int]$bytes[$i+3]
    if (($i + 4 + $len) -le $bytes.Length -and $len -gt 300 -and $len -lt 4000) {
      $slice = New-Object byte[] ($len + 4)
      [Array]::Copy($bytes, $i, $slice, 0, $len + 4)
      try {
        $cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($slice)
        $md5 = [System.Security.Cryptography.MD5]::Create().ComputeHash($cert.RawData)
        $sha1 = [System.Security.Cryptography.SHA1]::Create().ComputeHash($cert.RawData)
        Write-Output ("file   : " + $Ks)
        Write-Output ("offset : " + $i)
        Write-Output ("subject: " + $cert.Subject)
        Write-Output ("  MD5  : " + (($md5 | ForEach-Object { $_.ToString('x2') }) -join ''))
        Write-Output ("  SHA1 : " + (($sha1 | ForEach-Object { $_.ToString('x2') }) -join ''))
        $found = $true
        break
      } catch { }
    }
  }
}
if (-not $found) { Write-Output "NO_CERT_FOUND: $Ks" }
