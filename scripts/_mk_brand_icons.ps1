$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$outDir = 'C:\Users\Administrator\Desktop\ywjxcx\images\icon'
$c1 = [System.Drawing.ColorTranslator]::FromHtml('#4A6CF7')
$c2 = [System.Drawing.ColorTranslator]::FromHtml('#8B5CF6')
$lightBlue = [System.Drawing.ColorTranslator]::FromHtml('#8A9EFE')
$softBlue = [System.Drawing.ColorTranslator]::FromHtml('#B4C2FB')
$white = [System.Drawing.Color]::White
$trans = [System.Drawing.Color]::Transparent

function New-Graphics($bmp) {
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear($trans)
  return $g
}

# ============ 1. icon_hous_application.png (118x118) two buildings ============
$bmp = New-Object System.Drawing.Bitmap -ArgumentList 118, 118
$g = New-Graphics $bmp
# left building (light periwinkle, rounded top)
$brushL = New-Object System.Drawing.SolidBrush -ArgumentList $lightBlue
$p = New-Object System.Drawing.Drawing2D.GraphicsPath
$p.AddArc(14, 38, 24, 24, 180, 90)
$p.AddLine(26, 38, 38, 38)
$p.AddArc(26, 38, 24, 24, 270, 90)
$p.AddLine(50, 50, 50, 102)
$p.AddLine(50, 102, 14, 102)
$p.CloseFigure()
$g.FillPath($brushL, $p)
# right building (blue-purple gradient, taller)
$rectR = New-Object System.Drawing.RectangleF -ArgumentList 52, 18, 52, 84
$brushR = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList $rectR, $c1, $c2, 90
$p2 = New-Object System.Drawing.Drawing2D.GraphicsPath
$p2.AddArc(52, 18, 28, 28, 180, 90)
$p2.AddLine(66, 18, 90, 18)
$p2.AddArc(76, 18, 28, 28, 270, 90)
$p2.AddLine(104, 32, 104, 102)
$p2.AddLine(104, 102, 52, 102)
$p2.CloseFigure()
$g.FillPath($brushR, $p2)
# white arched windows and doors
$brushW = New-Object System.Drawing.SolidBrush -ArgumentList $white
$g.FillPie($brushW, 24, 56, 16, 16, 180, 180)
$g.FillRectangle($brushW, 24, 64, 16, 12)
$g.FillPie($brushW, 24, 80, 16, 16, 180, 180)
$g.FillRectangle($brushW, 24, 88, 16, 14)
$g.FillPie($brushW, 62, 30, 18, 18, 180, 180)
$g.FillRectangle($brushW, 62, 39, 18, 13)
$g.FillPie($brushW, 70, 74, 16, 16, 180, 180)
$g.FillRectangle($brushW, 70, 82, 16, 20)
$g.Dispose()
$bmp.Save((Join-Path $outDir 'icon_hous_application.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output 'saved: icon_hous_application.png'

# ============ 2. icon_my.png (118x118) business avatar ============
$bmp = New-Object System.Drawing.Bitmap -ArgumentList 118, 118
$g = New-Graphics $bmp
# head
$brushH = New-Object System.Drawing.SolidBrush -ArgumentList $softBlue
$g.FillEllipse($brushH, 38, 16, 42, 42)
# body with rounded shoulders (gradient)
$rectB = New-Object System.Drawing.RectangleF -ArgumentList 20, 60, 78, 44
$brushB = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList $rectB, $c1, $c2, 90
$bp = New-Object System.Drawing.Drawing2D.GraphicsPath
$bp.AddArc(20, 60, 78, 78, 180, 180)
$bp.AddLine(98, 99, 98, 104)
$bp.AddLine(98, 104, 20, 104)
$bp.CloseFigure()
$g.FillPath($brushB, $bp)
# white necktie
$brushT = New-Object System.Drawing.SolidBrush -ArgumentList $white
$pts = @(
  (New-Object System.Drawing.PointF -ArgumentList 55, 62),
  (New-Object System.Drawing.PointF -ArgumentList 63, 62),
  (New-Object System.Drawing.PointF -ArgumentList 66, 84),
  (New-Object System.Drawing.PointF -ArgumentList 59, 95),
  (New-Object System.Drawing.PointF -ArgumentList 52, 84)
)
$g.FillPolygon($brushT, $pts)
$g.Dispose()
$bmp.Save((Join-Path $outDir 'icon_my.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output 'saved: icon_my.png'

# ============ 3. icon_about_us.png (42x42) ring avatar ============
$bmp = New-Object System.Drawing.Bitmap -ArgumentList 42, 42
$g = New-Graphics $bmp
$rectA = New-Object System.Drawing.RectangleF -ArgumentList 4, 4, 34, 34
$brushA = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList $rectA, $c1, $c2, 45
$penA = New-Object System.Drawing.Pen -ArgumentList $brushA, 2.2
$g.DrawEllipse($penA, 4, 4, 34, 34)
$g.FillEllipse($brushA, 16.5, 12, 9, 9)
$g.FillPie($brushA, 12, 24, 18, 18, 180, 180)
$g.Dispose()
$bmp.Save((Join-Path $outDir 'icon_about_us.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output 'saved: icon_about_us.png'

# ============ 4. icon_right.png (36x36) chevron arrow ============
$bmp = New-Object System.Drawing.Bitmap -ArgumentList 36, 36
$g = New-Graphics $bmp
$penR = New-Object System.Drawing.Pen -ArgumentList $c1, 3.4
$penR.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$penR.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$penR.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$ptsR = @(
  (New-Object System.Drawing.PointF -ArgumentList 13, 9),
  (New-Object System.Drawing.PointF -ArgumentList 24, 18),
  (New-Object System.Drawing.PointF -ArgumentList 13, 27)
)
$g.DrawLines($penR, $ptsR)
$g.Dispose()
$bmp.Save((Join-Path $outDir 'icon_right.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output 'saved: icon_right.png'

# ============ 5. icon_login.png <- Yunweijia brand logo ============
Copy-Item 'C:\Users\Administrator\Desktop\ywj\static\logo.png' (Join-Path $outDir 'icon_login.png') -Force
Write-Output 'saved: icon_login.png (copied brand logo)'

Write-Output 'DONE'
