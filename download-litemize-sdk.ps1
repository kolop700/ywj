$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'

$base = 'https://hub.litemob.com/api/v4/projects/2/packages/maven/'
$dest = 'c:\Users\Administrator\Desktop\ywj\nativeplugins\TakuAdsNativePlugin\android'

$files = @(
    'com/ltmb/ltsdk/core/3.4.1/core-3.4.1.aar',
    'com/ltmb/ltsdk/deps/adapter-gromore/2.2.1/adapter-gromore-2.2.1.aar',
    'com/ltmb/ltsdk/deps/adapter-tobid/2.2.4/adapter-tobid-2.2.4.aar',
    'com/ltmb/ltsdk/deps/adapter-topon/2.2.0/adapter-topon-2.2.0.aar',
    'com/ltmb/ltsdk/deps/adapter-beizi/2.1.7/adapter-beizi-2.1.7.aar',
    'com/ltmb/ltsdk/deps/adapter-qc/2.1.1/adapter-qc-2.1.1.aar',
    'com/ltmb/ltsdk/deps/core-sdk-libs-1/2.4.7.3/core-sdk-libs-1-2.4.7.3.aar',
    'com/ltmb/ltsdk/deps/core-sdk-libs-2/4.2.7.3/core-sdk-libs-2-4.2.7.3.aar',
    'com/ltmb/ltsdk/deps/core-sdk-libs-4/3.0.6.1/core-sdk-libs-4-3.0.6.1.aar',
    'com/ltmb/ltsdk/deps/core-sdk-libs-6/2.9.81/core-sdk-libs-6-2.9.81.aar',
    'com/ltmb/ltsdk/deps/core-sdk-libs-7/6.5.68.9/core-sdk-libs-7-6.5.68.9.aar',
    'com/ltmb/ltsdk/deps/core-sdk-libs-8/2.2.6.2/core-sdk-libs-8-2.2.6.2.aar',
    'com/ltmb/ltsdk/deps/core-sdk-libs-9/4.2.56/core-sdk-libs-9-4.2.56.aar',
    'com/ltmb/ltsdk/deps/core-sdk-libs-10/1.0.99.12/core-sdk-libs-10-1.0.99.12.aar',
    'com/ltmb/ltsdk/deps/core-sdk-libs-11/1.9.6/core-sdk-libs-11-1.9.6.aar',
    'com/ltmb/ltsdk/deps/core-sdk-libs-13/2.1.78/core-sdk-libs-13-2.1.78.aar',
    'com/ltmb/ltsdk/deps/core-sdk-libs-14/4.7.5/core-sdk-libs-14-4.7.5.aar',
    'com/ltmb/ltsdk/deps/core-sdk-libs-15/7.00.89/core-sdk-libs-15-7.00.89.aar'
)

Write-Host ''
Write-Host '=================================================='
Write-Host ' Litemize SDK offline download (18 aar files)'
Write-Host (' Target: ' + $dest)
Write-Host '=================================================='
Write-Host ''

if (-not (Test-Path $dest)) {
    Write-Host ('ERROR: target dir not found: ' + $dest)
    exit 1
}

$ok = 0
$fail = @()
foreach ($rel in $files) {
    $name = Split-Path $rel -Leaf
    $url = $base + $rel
    $out = Join-Path $dest $name
    try {
        (New-Object System.Net.WebClient).DownloadFile($url, $out)
        $size = [math]::Round((Get-Item $out).Length / 1KB, 1)
        Write-Host ('  [OK]   ' + $name + '  (' + $size + ' KB)')
        $ok++
    } catch {
        Write-Host ('  [FAIL] ' + $name + '  ' + $_.Exception.Message)
        $fail += $name
    }
}

Write-Host ''
Write-Host ('Result: ' + $ok + ' / ' + $files.Count + ' downloaded')
if ($fail.Count -gt 0) {
    Write-Host ('Failed files: ' + ($fail -join ', '))
} else {
    Write-Host 'All files downloaded successfully.'
}
Write-Host ''
