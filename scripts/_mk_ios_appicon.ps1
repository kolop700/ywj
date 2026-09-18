# Regenerate iOS AppIcon (1024, no alpha channel) into Assets.xcassets
Add-Type -AssemblyName System.Drawing

$src = 'C:\Users\Administrator\Desktop\ywj\unpackage\res\icons\1024x1024.png'
$dir = 'C:\Users\Administrator\Desktop\ywj\shell-ios\CloudGuard\Assets.xcassets\AppIcon.appiconset'
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$srcImg = [System.Drawing.Image]::FromFile($src)
$bmp = New-Object System.Drawing.Bitmap -ArgumentList 1024, 1024, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($srcImg, 0, 0, 1024, 1024)
$g.Dispose()

$out = Join-Path $dir 'Icon-1024.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$srcImg.Dispose()

Write-Host "saved: $out"
