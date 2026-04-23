$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = "C:\Users\USER\Desktop\Quiks\assets\images"
$iconPath = Join-Path $root "quiks-playstore-icon-512.png"
$featurePath = Join-Path $root "quiks-feature-graphic-1024x500.png"

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

function Draw-QuiksMark {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$X,
    [float]$Y,
    [float]$Size
  )

  $navy = [System.Drawing.Color]::FromArgb(11, 31, 51)
  $aqua = [System.Drawing.Color]::FromArgb(53, 183, 215)
  $sky = [System.Drawing.Color]::FromArgb(122, 215, 240)
  $mint = [System.Drawing.Color]::FromArgb(15, 157, 116)
  $paper = [System.Drawing.Color]::FromArgb(248, 251, 255)
  $mist = [System.Drawing.Color]::FromArgb(217, 230, 242)
  $warm = [System.Drawing.Color]::FromArgb(242, 184, 81)
  $warm2 = [System.Drawing.Color]::FromArgb(242, 158, 56)

  $scale = $Size / 1024.0

  $qPen = New-Object System.Drawing.Pen($sky, (66 * $scale))
  $qPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $qPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $qPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $tailPen = New-Object System.Drawing.Pen($aqua, (66 * $scale))
  $tailPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $tailPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $bookBrush = New-Object System.Drawing.SolidBrush($paper)
  $bookPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(150, 255, 255, 255), (6 * $scale))
  $bookPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $spinePen = New-Object System.Drawing.Pen($mist, (8 * $scale))
  $spinePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $spinePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $linePen1 = New-Object System.Drawing.Pen($aqua, (24 * $scale))
  $linePen2 = New-Object System.Drawing.Pen($mint, (20 * $scale))
  $linePen1.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen1.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen2.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen2.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $Graphics.DrawArc($qPen, $X + (260 * $scale), $Y + (220 * $scale), (500 * $scale), (500 * $scale), 202, 288)
  $Graphics.DrawLine($tailPen, $X + (626 * $scale), $Y + (710 * $scale), $X + (744 * $scale), $Y + (844 * $scale))

  $bookLeft = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($X + (348 * $scale), $Y + (360 * $scale)),
    [System.Drawing.PointF]::new($X + (418 * $scale), $Y + (338 * $scale)),
    [System.Drawing.PointF]::new($X + (480 * $scale), $Y + (338 * $scale)),
    [System.Drawing.PointF]::new($X + (512 * $scale), $Y + (346 * $scale)),
    [System.Drawing.PointF]::new($X + (512 * $scale), $Y + (670 * $scale)),
    [System.Drawing.PointF]::new($X + (480 * $scale), $Y + (662 * $scale)),
    [System.Drawing.PointF]::new($X + (418 * $scale), $Y + (662 * $scale)),
    [System.Drawing.PointF]::new($X + (348 * $scale), $Y + (684 * $scale))
  )
  $bookRight = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($X + (676 * $scale), $Y + (338 * $scale)),
    [System.Drawing.PointF]::new($X + (606 * $scale), $Y + (338 * $scale)),
    [System.Drawing.PointF]::new($X + (544 * $scale), $Y + (338 * $scale)),
    [System.Drawing.PointF]::new($X + (512 * $scale), $Y + (346 * $scale)),
    [System.Drawing.PointF]::new($X + (512 * $scale), $Y + (670 * $scale)),
    [System.Drawing.PointF]::new($X + (544 * $scale), $Y + (662 * $scale)),
    [System.Drawing.PointF]::new($X + (606 * $scale), $Y + (662 * $scale)),
    [System.Drawing.PointF]::new($X + (676 * $scale), $Y + (684 * $scale))
  )
  $Graphics.FillPolygon($bookBrush, $bookLeft)
  $Graphics.FillPolygon($bookBrush, $bookRight)
  $Graphics.DrawPolygon($bookPen, $bookLeft)
  $Graphics.DrawPolygon($bookPen, $bookRight)
  $Graphics.DrawLine($spinePen, $X + (512 * $scale), $Y + (348 * $scale), $X + (512 * $scale), $Y + (676 * $scale))

  $bookmarkBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    [System.Drawing.RectangleF]::new($X + (560 * $scale), $Y + (338 * $scale), (52 * $scale), (144 * $scale)),
    $warm,
    $warm2,
    90
  )
  $bookmark = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($X + (560 * $scale), $Y + (338 * $scale)),
    [System.Drawing.PointF]::new($X + (612 * $scale), $Y + (338 * $scale)),
    [System.Drawing.PointF]::new($X + (612 * $scale), $Y + (482 * $scale)),
    [System.Drawing.PointF]::new($X + (586 * $scale), $Y + (462 * $scale)),
    [System.Drawing.PointF]::new($X + (560 * $scale), $Y + (482 * $scale))
  )
  $Graphics.FillPolygon($bookmarkBrush, $bookmark)

  $Graphics.DrawLine($linePen1, $X + (390 * $scale), $Y + (498 * $scale), $X + (470 * $scale), $Y + (498 * $scale))
  $Graphics.DrawLine($linePen2, $X + (390 * $scale), $Y + (560 * $scale), $X + (456 * $scale), $Y + (560 * $scale))
  $Graphics.DrawLine($linePen1, $X + (554 * $scale), $Y + (498 * $scale), $X + (634 * $scale), $Y + (498 * $scale))
  $Graphics.DrawLine($linePen2, $X + (568 * $scale), $Y + (560 * $scale), $X + (634 * $scale), $Y + (560 * $scale))

  $warmBrush = New-Object System.Drawing.SolidBrush($warm)
  $skyBrush = New-Object System.Drawing.SolidBrush($sky)
  Draw-Star -Graphics $Graphics -Brush $warmBrush -CenterX ($X + (770 * $scale)) -CenterY ($Y + (286 * $scale)) -OuterRadius (38 * $scale) -InnerRadius (16 * $scale)
  Draw-Star -Graphics $Graphics -Brush $skyBrush -CenterX ($X + (694 * $scale)) -CenterY ($Y + (244 * $scale)) -OuterRadius (22 * $scale) -InnerRadius (9 * $scale)
}

function Save-Png {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$Path
  )

  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/png' }
  $encoder = [System.Drawing.Imaging.Encoder]::Quality
  $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter($encoder, 100L)
  $Bitmap.Save($Path, $codec, $params)
}

# 512 x 512 Play Store icon
$iconBitmap = New-Object System.Drawing.Bitmap 512, 512
$iconGraphics = [System.Drawing.Graphics]::FromImage($iconBitmap)
$iconGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$iconGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$iconGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$iconGraphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$navy = [System.Drawing.Color]::FromArgb(11, 31, 51)
$navy2 = [System.Drawing.Color]::FromArgb(18, 59, 90)
$aqua = [System.Drawing.Color]::FromArgb(53, 183, 215)

$iconRect = New-Object System.Drawing.Rectangle 0, 0, 512, 512
$iconBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $iconRect, $navy, $aqua, 45
$blend = New-Object System.Drawing.Drawing2D.ColorBlend
$blend.Colors = @($navy, $navy2, $aqua)
$blend.Positions = @(0.0, 0.62, 1.0)
$iconBg.InterpolationColors = $blend
$iconGraphics.FillRectangle($iconBg, $iconRect)

$glowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(16, 255, 255, 255))
$iconGraphics.FillEllipse($glowBrush, 28, 40, 116, 116)
$iconGraphics.FillEllipse($glowBrush, 382, 372, 110, 110)

Draw-QuiksMark -Graphics $iconGraphics -X 28 -Y 18 -Size 456
Save-Png -Bitmap $iconBitmap -Path $iconPath
$iconGraphics.Dispose()
$iconBitmap.Dispose()

# 1024 x 500 Feature graphic
$featureBitmap = New-Object System.Drawing.Bitmap 1024, 500
$featureGraphics = [System.Drawing.Graphics]::FromImage($featureBitmap)
$featureGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$featureGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$featureGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$featureGraphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$featureRect = New-Object System.Drawing.Rectangle 0, 0, 1024, 500
$featureBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $featureRect, $navy, $aqua, 15
$blend2 = New-Object System.Drawing.Drawing2D.ColorBlend
$blend2.Colors = @($navy, $navy2, $aqua)
$blend2.Positions = @(0.0, 0.56, 1.0)
$featureBg.InterpolationColors = $blend2
$featureGraphics.FillRectangle($featureBg, $featureRect)

$softBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(20, 255, 255, 255))
$featureGraphics.FillEllipse($softBrush, -60, -40, 260, 260)
$featureGraphics.FillEllipse($softBrush, 820, 280, 250, 250)

$panelPath = New-RoundedRectPath -X 54 -Y 55 -Width 348 -Height 390 -Radius 88
$panelBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(28, 255, 255, 255))
$featureGraphics.FillPath($panelBrush, $panelPath)

Draw-QuiksMark -Graphics $featureGraphics -X 20 -Y 18 -Size 420

$whiteBrush = [System.Drawing.Brushes]::White
$softWhite = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(228, 234, 246, 252))
$mintBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(215, 245, 233))

$titleFont = New-Object System.Drawing.Font("Segoe UI", 44, [System.Drawing.FontStyle]::Bold)
$subtitleFont = New-Object System.Drawing.Font("Segoe UI", 17, [System.Drawing.FontStyle]::Regular)
$labelFont = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$pillFont = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)

$featureGraphics.DrawString("Quiks", $titleFont, $whiteBrush, 438, 98)
$featureGraphics.DrawString("Smart learning for every student", $subtitleFont, $softWhite, 440, 158)
$featureGraphics.DrawString("on one device.", $subtitleFont, $softWhite, 440, 188)
$featureGraphics.DrawString("Quizzes, progress tracking,", $subtitleFont, $softWhite, 440, 220)
$featureGraphics.DrawString("and AI-powered study support.", $subtitleFont, $softWhite, 440, 248)

$pill1 = New-RoundedRectPath -X 440 -Y 292 -Width 170 -Height 50 -Radius 25
$pill2 = New-RoundedRectPath -X 624 -Y 292 -Width 168 -Height 50 -Radius 25
$pill3 = New-RoundedRectPath -X 806 -Y 292 -Width 150 -Height 50 -Radius 25

$pillBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(34, 255, 255, 255))
$featureGraphics.FillPath($pillBrush, $pill1)
$featureGraphics.FillPath($pillBrush, $pill2)
$featureGraphics.FillPath($pillBrush, $pill3)

$featureGraphics.DrawString("Multi-student", $pillFont, $whiteBrush, 470, 306)
$featureGraphics.DrawString("AI coach", $pillFont, $whiteBrush, 668, 306)
$featureGraphics.DrawString("Quiz levels", $pillFont, $whiteBrush, 836, 306)

$featureGraphics.DrawString("Subjects", $labelFont, $mintBrush, 442, 374)
$featureGraphics.DrawString("Arithmetic  English  Science", $subtitleFont, $whiteBrush, 440, 400)
$featureGraphics.DrawString("History  Economics  Geography", $subtitleFont, $whiteBrush, 440, 430)
$featureGraphics.DrawString("Built for focused daily practice", $subtitleFont, $softWhite, 440, 462)

Save-Png -Bitmap $featureBitmap -Path $featurePath
$featureGraphics.Dispose()
$featureBitmap.Dispose()

$iconFile = Get-Item $iconPath
$featureFile = Get-Item $featurePath
Write-Output "$iconPath`n$($iconFile.Length) bytes"
Write-Output "$featurePath`n$($featureFile.Length) bytes"
