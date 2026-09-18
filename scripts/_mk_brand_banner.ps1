$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$outDir = 'C:\Users\Administrator\Desktop\ywjxcx\images\img'
$c1 = [System.Drawing.ColorTranslator]::FromHtml('#4A6CF7')
$c2 = [System.Drawing.ColorTranslator]::FromHtml('#8B5CF6')
$white = [System.Drawing.Color]::White

# brand strings built from unicode code points (script stays pure ASCII)
$title = "$([char]0x4E91)$([char]0x536B)$([char]0x5BB6)"                                                                          # Yun Wei Jia
$sub = "$([char]0x667A)$([char]0x6167)$([char]0x95E8)$([char]0x7981)  $([char]0x00B7)  $([char]0x667A)$([char]0x4EAB)$([char]0x793E)$([char]0x533A)"  # Zhi Hui Men Jin - Zhi Xiang She Qu

$jpegCodec = $null
foreach ($codec in [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()) {
  if ($codec.MimeType -eq 'image/jpeg') { $jpegCodec = $codec; break }
}
$encParams = New-Object System.Drawing.Imaging.EncoderParameters -ArgumentList 1
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter -ArgumentList ([System.Drawing.Imaging.Encoder]::Quality), 92

function Draw-Banner([int]$W, [int]$H, [int]$titleSize, [int]$subSize, [int]$titleX, [int]$titleY, [int]$subX, [int]$subY, [int]$archX, [int]$archW, [int]$archTop, [int]$dotCx, [int]$dotCy, [int]$dotR, [int]$glowCx, [int]$glowCy, [int]$glowR, [string]$outName) {
  $bmp = New-Object System.Drawing.Bitmap -ArgumentList $W, $H
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  # brand gradient background
  $bgRect = New-Object System.Drawing.RectangleF -ArgumentList 0, 0, $W, $H
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList $bgRect, $c1, $c2, 20
  $g.FillRectangle($bg, 0, 0, $W, $H)

  # decorative glow circle (soft white, top right)
  $glowBrush = New-Object System.Drawing.SolidBrush -ArgumentList ([System.Drawing.Color]::FromArgb(22, 255, 255, 255))
  $g.FillEllipse($glowBrush, ($glowCx - $glowR), ($glowCy - $glowR), ($glowR * 2), ($glowR * 2))

  # arch decoration (echoes brand logo: round-top door shape)
  $archBrush = New-Object System.Drawing.SolidBrush -ArgumentList ([System.Drawing.Color]::FromArgb(48, 255, 255, 255))
  $g.FillPie($archBrush, $archX, $archTop, $archW, $archW, 180, 180)
  $g.FillRectangle($archBrush, $archX, ($archTop + [int]($archW / 2)), $archW, ($H - $archTop - [int]($archW / 2)))

  # small round dot inside arch (brand logo accent)
  $dotBrush = New-Object System.Drawing.SolidBrush -ArgumentList ([System.Drawing.Color]::FromArgb(110, 255, 255, 255))
  $g.FillEllipse($dotBrush, ($dotCx - $dotR), ($dotCy - $dotR), ($dotR * 2), ($dotR * 2))

  # title text
  $fontTitle = New-Object System.Drawing.Font -ArgumentList 'Microsoft YaHei', $titleSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $brushTitle = New-Object System.Drawing.SolidBrush -ArgumentList $white
  $g.DrawString($title, $fontTitle, $brushTitle, $titleX, $titleY)

  # subtitle text
  $fontSub = New-Object System.Drawing.Font -ArgumentList 'Microsoft YaHei', $subSize, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
  $brushSub = New-Object System.Drawing.SolidBrush -ArgumentList ([System.Drawing.Color]::FromArgb(215, 255, 255, 255))
  $g.DrawString($sub, $fontSub, $brushSub, $subX, $subY)

  $g.Dispose()
  $bmp.Save((Join-Path $outDir $outName), $jpegCodec, $encParams)
  $bmp.Dispose()
  Write-Output ("saved: " + $outName)
}

# img_ad.jpg 750x246 (large screens)
Draw-Banner -W 750 -H 246 -titleSize 78 -subSize 30 -titleX 64 -titleY 38 -subX 68 -subY 152 -archX 524 -archW 148 -archTop 40 -dotCx 598 -dotCy 152 -dotR 20 -glowCx 735 -glowCy 55 -glowR 150 -outName 'img_ad.jpg'

# img_min_ad.jpg 1125x216 (small screens)
Draw-Banner -W 1125 -H 216 -titleSize 70 -subSize 28 -titleX 84 -titleY 30 -subX 88 -subY 132 -archX 930 -archW 130 -archTop 28 -dotCx 995 -dotCy 138 -dotR 18 -glowCx 1120 -glowCy 40 -glowR 140 -outName 'img_min_ad.jpg'

Write-Output 'DONE'
