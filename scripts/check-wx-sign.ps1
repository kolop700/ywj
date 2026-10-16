# 核对 APK 签名 MD5（微信开放平台「应用签名」用的就是这个值）
# 原理：keytool 导出证书 PEM -> 取 base64 体 -> 还原 DER 字节 -> 算 MD5
$ErrorActionPreference = 'Stop'

$kt       = 'C:\Program Files (x86)\HBuilder X\plugins\amazon-corretto\bin\keytool.exe'
$ks       = 'c:\Users\Administrator\Desktop\ywj\shell-android\keystore\yefiot-release.keystore'
$alias    = '__uni__1d0a789'
$pass     = 'oacUtp7X'
$expected = 'eda43afa9149bc70c548b77ad7edf09b'   # keystore.properties 注释里登记的微信签名

# 导出证书（-rfc 输出 PEM 文本到 stdout，不落盘，避开沙箱写限制）
$pemLines = & $kt -exportcert -rfc -keystore $ks -alias $alias -storepass $pass 2>$null
$pem = ($pemLines | Where-Object { $_ -notmatch '-----' }) -join ''

if (-not $pem) {
    Write-Output '导出证书失败：请检查 keytool 路径/密码'
    exit 1
}

$der  = [Convert]::FromBase64String($pem)
$md5  = [System.Security.Cryptography.MD5]::Create()
$hash = ($md5.ComputeHash($der) | ForEach-Object { $_.ToString('x2') }) -join ''

Write-Output "证书 DER 字节数 : $($der.Length)"
Write-Output "实际 MD5 签名   : $hash"
Write-Output "微信登记值(注释): $expected"
if ($hash -eq $expected) {
    Write-Output '==> 一致：微信开放平台登记签名仍有效，可直接用 App 支付'
} else {
    Write-Output '==> 不一致：需更新微信开放平台「应用签名」，否则支付会报"签名校验失败"'
}
