# 扫描 TakuAdsNativePlugin 下所有 aar，找出 res/xml 里的 security/config 类资源及其内容
# 目的：查看莱特摩比(Taku/Litemize) 自带的 network security config 是如何配置的（域名白名单 / cleartext）
$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$dir = 'c:\Users\Administrator\Desktop\ywj\nativeplugins\TakuAdsNativePlugin\android'
$found = 0

Get-ChildItem $dir -Filter *.aar | ForEach-Object {
    $aar = $_.FullName
    try {
        $zip = [System.IO.Compression.ZipFile]::OpenRead($aar)
        $hits = @($zip.Entries | Where-Object { $_.FullName -match 'res/xml/' -and $_.FullName -match 'security|config|network|cleartext' })
        if ($hits.Count -gt 0) {
            Write-Output ('===== AAR: ' + $_.Name)
            foreach ($h in $hits) {
                Write-Output ('--- entry: ' + $h.FullName + '  (size=' + $h.Length + ')')
                $reader = New-Object System.IO.StreamReader($h.Open())
                Write-Output $reader.ReadToEnd()
                $reader.Close()
                $found++
            }
        }
        # 顺便看 manifest 里有没有引用 networkSecurityConfig
        $mf = $zip.Entries | Where-Object { $_.FullName -eq 'AndroidManifest.xml' }
        if ($mf) {
            $r2 = New-Object System.IO.StreamReader($mf.Open())
            $txt = $r2.ReadToEnd()
            $r2.Close()
            if ($txt -match 'networkSecurityConfig|usesCleartextTraffic') {
                Write-Output ('##### MANIFEST-IN-AAR: ' + $_.Name)
                $txt -split "`n" | Where-Object { $_ -match 'networkSecurityConfig|usesCleartextTraffic|application' } | ForEach-Object { Write-Output ('   ' + $_.Trim()) }
            }
        }
        $zip.Dispose()
    } catch {
        Write-Output ('ERR ' + $_.Name + ': ' + $_.Exception.Message)
    }
}
Write-Output ('TOTAL_CFG_ENTRIES=' + $found)
