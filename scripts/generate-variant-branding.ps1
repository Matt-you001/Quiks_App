$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = "C:\Users\USER\Desktop\Quiks\assets\images"

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
    [hashtable]$Palette,
    [switch]$TransparentBackground
  )

  $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $Graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $bg1 = [System.Drawing.Color]::FromArgb($Palette.BackgroundStart[0], $Palette.BackgroundStart[1], $Palette.BackgroundStart[2])
  $bg2 = [System.Drawing.Color]::FromArgb($Palette.BackgroundMid[0], $Palette.BackgroundMid[1], $Palette.BackgroundMid[2])
  $bg3 = [System.Drawing.Color]::FromArgb($Palette.BackgroundEnd[0], $Palette.BackgroundEnd[1], $Palette.BackgroundEnd[2])
  $ring = [System.Drawing.Color]::FromArgb($Palette.Ring[0], $Palette.Ring[1], $Palette.Ring[2])
  $tail = [System.Drawing.Color]::FromArgb($Palette.Tail[0], $Palette.Tail[1], $Palette.Tail[2])
  $line1 = [System.Drawing.Color]::FromArgb($Palette.Line1[0], $Palette.Line1[1], $Palette.Line1[2])
  $line2 = [System.Drawing.Color]::FromArgb($Palette.Line2[0], $Palette.Line2[1], $Palette.Line2[2])
  $star1 = [System.Drawing.Color]::FromArgb($Palette.Star1[0], $Palette.Star1[1], $Palette.Star1[2])
  $star2 = [System.Drawing.Color]::FromArgb($Palette.Star2[0], $Palette.Star2[1], $Palette.Star2[2])
  $paper = [System.Drawing.Color]::FromArgb(248, 251, 255)
  $mist = [System.Drawing.Color]::FromArgb(217, 230, 242)

  if (-not $TransparentBackground) {
    $bgRect = New-Object System.Drawing.Rectangle 0, 0, 1024, 1024
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $bgRect, $bg1, $bg3, 45
    $blend = New-Object System.Drawing.Drawing2D.ColorBlend
    $blend.Colors = @($bg1, $bg2, $bg3)
    $blend.Positions = @(0.0, 0.58, 1.0)
    $bgBrush.InterpolationColors = $blend
    $Graphics.FillRectangle($bgBrush, $bgRect)

    $glow1 = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(22, 255, 255, 255))
    $glow2 = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(18, 255, 255, 255))
    $Graphics.FillEllipse($glow1, 70, 84, 220, 220)
    $Graphics.FillEllipse($glow2, 760, 760, 220, 220)
  }

  $bookLeft = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(348, 360), [System.Drawing.PointF]::new(418, 338), [System.Drawing.PointF]::new(480, 338),
    [System.Drawing.PointF]::new(512, 346), [System.Drawing.PointF]::new(512, 670), [System.Drawing.PointF]::new(480, 662),
    [System.Drawing.PointF]::new(418, 662), [System.Drawing.PointF]::new(348, 684)
  )
  $bookRight = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(676, 338), [System.Drawing.PointF]::new(606, 338), [System.Drawing.PointF]::new(544, 338),
    [System.Drawing.PointF]::new(512, 346), [System.Drawing.PointF]::new(512, 670), [System.Drawing.PointF]::new(544, 662),
    [System.Drawing.PointF]::new(606, 662), [System.Drawing.PointF]::new(676, 684)
  )

  $qPen = New-Object System.Drawing.Pen($ring, 66)
  $qPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $qPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $qPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $Graphics.DrawArc($qPen, 260, 220, 500, 500, 202, 288)

  $tailPen = New-Object System.Drawing.Pen($tail, 66)
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
    $star1,
    $star2,
    90
  )
  $bookmark = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(560, 338), [System.Drawing.PointF]::new(612, 338), [System.Drawing.PointF]::new(612, 482),
    [System.Drawing.PointF]::new(586, 462), [System.Drawing.PointF]::new(560, 482)
  )
  $Graphics.FillPolygon($bookmarkBrush, $bookmark)

  $linePen1 = New-Object System.Drawing.Pen($line1, 24)
  $linePen2 = New-Object System.Drawing.Pen($line2, 20)
  $linePen1.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen1.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen2.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen2.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $Graphics.DrawLine($linePen1, 390, 498, 470, 498)
  $Graphics.DrawLine($linePen2, 390, 560, 456, 560)
  $Graphics.DrawLine($linePen1, 554, 498, 634, 498)
  $Graphics.DrawLine($linePen2, 568, 560, 634, 560)

  $starBrush1 = New-Object System.Drawing.SolidBrush($star1)
  $starBrush2 = New-Object System.Drawing.SolidBrush($star2)
  Draw-Star -Graphics $Graphics -Brush $starBrush1 -CenterX 770 -CenterY 286 -OuterRadius 38 -InnerRadius 16
  Draw-Star -Graphics $Graphics -Brush $starBrush2 -CenterX 694 -CenterY 244 -OuterRadius 22 -InnerRadius 9
}

function New-VariantAssets {
  param(
    [string]$Variant,
    [hashtable]$Palette
  )

  $iconPath = Join-Path $root "quiks-$Variant-icon-1024.png"
  $foregroundPath = Join-Path $root "quiks-$Variant-adaptive-foreground.png"

  $iconBitmap = New-Object System.Drawing.Bitmap 1024, 1024
  $iconGraphics = [System.Drawing.Graphics]::FromImage($iconBitmap)
  Draw-LogoCore -Graphics $iconGraphics -Palette $Palette
  $iconBitmap.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $iconGraphics.Dispose()
  $iconBitmap.Dispose()

  $foregroundBitmap = New-Object System.Drawing.Bitmap 1024, 1024
  $foregroundGraphics = [System.Drawing.Graphics]::FromImage($foregroundBitmap)
  $foregroundGraphics.Clear([System.Drawing.Color]::Transparent)
  Draw-LogoCore -Graphics $foregroundGraphics -Palette $Palette -TransparentBackground
  $foregroundBitmap.Save($foregroundPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $foregroundGraphics.Dispose()
  $foregroundBitmap.Dispose()

  Write-Output $iconPath
  Write-Output $foregroundPath
}

$childrenPalette = @{
  BackgroundStart = @(122, 44, 200)
  BackgroundMid = @(244, 107, 181)
  BackgroundEnd = @(255, 185, 110)
  Ring = @(255, 201, 238)
  Tail = @(255, 236, 200)
  Line1 = @(244, 107, 181)
  Line2 = @(243, 166, 42)
  Star1 = @(255, 203, 87)
  Star2 = @(255, 240, 188)
}

$teensPalette = @{
  BackgroundStart = @(17, 68, 74)
  BackgroundMid = @(26, 182, 166)
  BackgroundEnd = @(164, 236, 178)
  Ring = @(209, 255, 244)
  Tail = @(126, 226, 217)
  Line1 = @(26, 182, 166)
  Line2 = @(164, 236, 178)
  Star1 = @(242, 178, 61)
  Star2 = @(255, 221, 122)
}

$uniPalette = @{
  BackgroundStart = @(11, 31, 51)
  BackgroundMid = @(18, 59, 90)
  BackgroundEnd = @(53, 183, 215)
  Ring = @(122, 215, 240)
  Tail = @(53, 183, 215)
  Line1 = @(53, 183, 215)
  Line2 = @(15, 157, 116)
  Star1 = @(242, 184, 81)
  Star2 = @(242, 158, 56)
}

New-VariantAssets -Variant "children" -Palette $childrenPalette
New-VariantAssets -Variant "teens" -Palette $teensPalette
New-VariantAssets -Variant "uni" -Palette $uniPalette
