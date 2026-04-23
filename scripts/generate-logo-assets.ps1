$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = "C:\Users\USER\Desktop\Quiks\assets\images"
$iconPath = Join-Path $root "quiks-icon-1024.png"
$foregroundPath = Join-Path $root "quiks-adaptive-foreground.png"

function New-RoundedRectPath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-Star {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Brush]$Brush,
    [float]$CenterX,
    [float]$CenterY,
    [float]$OuterRadius,
    [float]$InnerRadius
  )

  $points = New-Object 'System.Collections.Generic.List[System.Drawing.PointF]'
  for ($i = 0; $i -lt 8; $i++) {
    $angle = (-90 + (45 * $i)) * [Math]::PI / 180
    $radius = if ($i % 2 -eq 0) { $OuterRadius } else { $InnerRadius }
    $x = $CenterX + [Math]::Cos($angle) * $radius
    $y = $CenterY + [Math]::Sin($angle) * $radius
    $points.Add([System.Drawing.PointF]::new([float]$x, [float]$y))
  }
  $Graphics.FillPolygon($Brush, $points.ToArray())
}

function Draw-LogoCore {
  param(
    [System.Drawing.Graphics]$Graphics,
    [switch]$TransparentBackground
  )

  $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $Graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $navy = [System.Drawing.Color]::FromArgb(11, 31, 51)
  $navy2 = [System.Drawing.Color]::FromArgb(18, 59, 90)
  $aqua = [System.Drawing.Color]::FromArgb(53, 183, 215)
  $sky = [System.Drawing.Color]::FromArgb(122, 215, 240)
  $mint = [System.Drawing.Color]::FromArgb(15, 157, 116)
  $paper = [System.Drawing.Color]::FromArgb(248, 251, 255)
  $mist = [System.Drawing.Color]::FromArgb(217, 230, 242)
  $warm = [System.Drawing.Color]::FromArgb(242, 184, 81)
  $warm2 = [System.Drawing.Color]::FromArgb(242, 158, 56)

  if (-not $TransparentBackground) {
    $bgRect = New-Object System.Drawing.Rectangle 0, 0, 1024, 1024
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $bgRect, $navy, $aqua, 45
    $blend = New-Object System.Drawing.Drawing2D.ColorBlend
    $blend.Colors = @($navy, $navy2, $aqua)
    $blend.Positions = @(0.0, 0.62, 1.0)
    $bgBrush.InterpolationColors = $blend
    $bgPath = New-RoundedRectPath -X 0 -Y 0 -Width 1024 -Height 1024 -Radius 270
    $Graphics.FillPath($bgBrush, $bgPath)

    $glowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(18, 255, 255, 255))
    $Graphics.FillEllipse($glowBrush, 72, 86, 220, 220)
    $Graphics.FillEllipse($glowBrush, 760, 760, 220, 220)
  }

  $bookLeft = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(348, 360),
    [System.Drawing.PointF]::new(418, 338),
    [System.Drawing.PointF]::new(480, 338),
    [System.Drawing.PointF]::new(512, 346),
    [System.Drawing.PointF]::new(512, 670),
    [System.Drawing.PointF]::new(480, 662),
    [System.Drawing.PointF]::new(418, 662),
    [System.Drawing.PointF]::new(348, 684)
  )
  $bookRight = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(676, 338),
    [System.Drawing.PointF]::new(606, 338),
    [System.Drawing.PointF]::new(544, 338),
    [System.Drawing.PointF]::new(512, 346),
    [System.Drawing.PointF]::new(512, 670),
    [System.Drawing.PointF]::new(544, 662),
    [System.Drawing.PointF]::new(606, 662),
    [System.Drawing.PointF]::new(676, 684)
  )

  if (-not $TransparentBackground) {
    $shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(34, 8, 17, 31))
    $Graphics.TranslateTransform(0, 22)
    $shadowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $shadowPath.AddEllipse(278, 242, 510, 510)
    $Graphics.FillPath($shadowBrush, $shadowPath)
    $Graphics.FillPolygon($shadowBrush, $bookLeft)
    $Graphics.FillPolygon($shadowBrush, $bookRight)
    $Graphics.ResetTransform()
  }

  $qPen = New-Object System.Drawing.Pen($sky, 66)
  $qPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $qPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $qPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $Graphics.DrawArc($qPen, 260, 220, 500, 500, 202, 288)

  $tailPen = New-Object System.Drawing.Pen($aqua, 66)
  $tailPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $tailPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $Graphics.DrawLine($tailPen, 626, 710, 744, 844)

  $bookBrush = New-Object System.Drawing.SolidBrush($paper)
  $Graphics.FillPolygon($bookBrush, $bookLeft)
  $Graphics.FillPolygon($bookBrush, $bookRight)

  $bookPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(150, 255, 255, 255), 6)
  $bookPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $Graphics.DrawPolygon($bookPen, $bookLeft)
  $Graphics.DrawPolygon($bookPen, $bookRight)

  $spinePen = New-Object System.Drawing.Pen($mist, 8)
  $spinePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $spinePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $Graphics.DrawLine($spinePen, 512, 348, 512, 676)

  $bookmarkBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    [System.Drawing.Rectangle]::new(556, 338, 56, 148),
    $warm,
    $warm2,
    90
  )
  $bookmark = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(560, 338),
    [System.Drawing.PointF]::new(612, 338),
    [System.Drawing.PointF]::new(612, 482),
    [System.Drawing.PointF]::new(586, 462),
    [System.Drawing.PointF]::new(560, 482)
  )
  $Graphics.FillPolygon($bookmarkBrush, $bookmark)

  $linePen1 = New-Object System.Drawing.Pen($aqua, 24)
  $linePen2 = New-Object System.Drawing.Pen($mint, 20)
  $linePen1.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen1.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen2.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen2.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $Graphics.DrawLine($linePen1, 390, 498, 470, 498)
  $Graphics.DrawLine($linePen2, 390, 560, 456, 560)
  $Graphics.DrawLine($linePen1, 554, 498, 634, 498)
  $Graphics.DrawLine($linePen2, 568, 560, 634, 560)

  $warmBrush = New-Object System.Drawing.SolidBrush($warm)
  $skyBrush = New-Object System.Drawing.SolidBrush($sky)
  Draw-Star -Graphics $Graphics -Brush $warmBrush -CenterX 770 -CenterY 286 -OuterRadius 38 -InnerRadius 16
  Draw-Star -Graphics $Graphics -Brush $skyBrush -CenterX 694 -CenterY 244 -OuterRadius 22 -InnerRadius 9
}

$iconBitmap = New-Object System.Drawing.Bitmap 1024, 1024
$iconGraphics = [System.Drawing.Graphics]::FromImage($iconBitmap)
Draw-LogoCore -Graphics $iconGraphics
$iconBitmap.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)
$iconGraphics.Dispose()
$iconBitmap.Dispose()

$foregroundBitmap = New-Object System.Drawing.Bitmap 1024, 1024
$foregroundGraphics = [System.Drawing.Graphics]::FromImage($foregroundBitmap)
$foregroundGraphics.Clear([System.Drawing.Color]::Transparent)
Draw-LogoCore -Graphics $foregroundGraphics -TransparentBackground
$foregroundBitmap.Save($foregroundPath, [System.Drawing.Imaging.ImageFormat]::Png)
$foregroundGraphics.Dispose()
$foregroundBitmap.Dispose()

Write-Output $iconPath
Write-Output $foregroundPath
