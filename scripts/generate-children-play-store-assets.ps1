$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = "C:\Users\USER\Desktop\Quiks\assets\images"
$iconPath = Join-Path $root "quiks-children-playstore-icon-512.png"
$featurePath = Join-Path $root "quiks-children-feature-graphic-1024x500.png"

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

function Draw-QuiksChildrenMark {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$X,
    [float]$Y,
    [float]$Size
  )

  $ring = [System.Drawing.Color]::FromArgb(255, 201, 238)
  $tail = [System.Drawing.Color]::FromArgb(255, 236, 200)
  $line1 = [System.Drawing.Color]::FromArgb(244, 107, 181)
  $line2 = [System.Drawing.Color]::FromArgb(243, 166, 42)
  $star1 = [System.Drawing.Color]::FromArgb(255, 203, 87)
  $star2 = [System.Drawing.Color]::FromArgb(255, 240, 188)
  $paper = [System.Drawing.Color]::FromArgb(255, 250, 252)
  $mist = [System.Drawing.Color]::FromArgb(247, 220, 243)

  $scale = $Size / 1024.0

  $qPen = New-Object System.Drawing.Pen($ring, (66 * $scale))
  $qPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $qPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $qPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $tailPen = New-Object System.Drawing.Pen($tail, (66 * $scale))
  $tailPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $tailPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $bookBrush = New-Object System.Drawing.SolidBrush($paper)
  $bookPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(168, 255, 255, 255), (6 * $scale))
  $bookPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $spinePen = New-Object System.Drawing.Pen($mist, (8 * $scale))
  $spinePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $spinePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $linePen1 = New-Object System.Drawing.Pen($line1, (24 * $scale))
  $linePen2 = New-Object System.Drawing.Pen($line2, (20 * $scale))
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
    $star1,
    [System.Drawing.Color]::FromArgb(255, 142, 214),
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

  $starBrush1 = New-Object System.Drawing.SolidBrush($star1)
  $starBrush2 = New-Object System.Drawing.SolidBrush($star2)
  Draw-Star -Graphics $Graphics -Brush $starBrush1 -CenterX ($X + (770 * $scale)) -CenterY ($Y + (286 * $scale)) -OuterRadius (38 * $scale) -InnerRadius (16 * $scale)
  Draw-Star -Graphics $Graphics -Brush $starBrush2 -CenterX ($X + (694 * $scale)) -CenterY ($Y + (244 * $scale)) -OuterRadius (22 * $scale) -InnerRadius (9 * $scale)
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

$purple = [System.Drawing.Color]::FromArgb(122, 44, 200)
$pink = [System.Drawing.Color]::FromArgb(244, 107, 181)
$peach = [System.Drawing.Color]::FromArgb(255, 185, 110)
$paper = [System.Drawing.Color]::FromArgb(255, 249, 253)

# 512 x 512 icon
$iconBitmap = New-Object System.Drawing.Bitmap 512, 512
$iconGraphics = [System.Drawing.Graphics]::FromImage($iconBitmap)
$iconGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$iconGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$iconGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$iconGraphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$iconRect = New-Object System.Drawing.Rectangle 0, 0, 512, 512
$iconBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $iconRect, $purple, $peach, 45
$iconBlend = New-Object System.Drawing.Drawing2D.ColorBlend
$iconBlend.Colors = @($purple, $pink, $peach)
$iconBlend.Positions = @(0.0, 0.58, 1.0)
$iconBg.InterpolationColors = $iconBlend
$iconGraphics.FillRectangle($iconBg, $iconRect)

$glowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(18, 255, 255, 255))
$iconGraphics.FillEllipse($glowBrush, 18, 36, 120, 120)
$iconGraphics.FillEllipse($glowBrush, 376, 364, 110, 110)

Draw-QuiksChildrenMark -Graphics $iconGraphics -X 28 -Y 18 -Size 456

Save-Png -Bitmap $iconBitmap -Path $iconPath
$iconGraphics.Dispose()
$iconBitmap.Dispose()

# 1024 x 500 feature graphic
$featureBitmap = New-Object System.Drawing.Bitmap 1024, 500
$featureGraphics = [System.Drawing.Graphics]::FromImage($featureBitmap)
$featureGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$featureGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$featureGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$featureGraphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$featureRect = New-Object System.Drawing.Rectangle 0, 0, 1024, 500
$featureBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $featureRect, $purple, $peach, 14
$featureBlend = New-Object System.Drawing.Drawing2D.ColorBlend
$featureBlend.Colors = @($purple, $pink, $peach)
$featureBlend.Positions = @(0.0, 0.58, 1.0)
$featureBg.InterpolationColors = $featureBlend
$featureGraphics.FillRectangle($featureBg, $featureRect)

$softGlow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(22, 255, 255, 255))
$featureGraphics.FillEllipse($softGlow, -50, -40, 250, 250)
$featureGraphics.FillEllipse($softGlow, 820, 290, 240, 240)

$panelPath = New-RoundedRectPath -X 52 -Y 52 -Width 348 -Height 394 -Radius 88
$panelBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(34, 255, 255, 255))
$featureGraphics.FillPath($panelBrush, $panelPath)

Draw-QuiksChildrenMark -Graphics $featureGraphics -X 16 -Y 20 -Size 414

$whiteBrush = [System.Drawing.Brushes]::White
$softWhite = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(234, 255, 244, 250))
$creamBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 255, 240, 210))
$pillBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(38, 255, 255, 255))

$titleFont = New-Object System.Drawing.Font("Segoe UI", 40, [System.Drawing.FontStyle]::Bold)
$subtitleFont = New-Object System.Drawing.Font("Segoe UI", 17, [System.Drawing.FontStyle]::Regular)
$pillFont = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Bold)
$labelFont = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)

$featureGraphics.DrawString("Quiks Children", $titleFont, $whiteBrush, 438, 92)
$featureGraphics.DrawString("Playful learning for ages 5 to 12", $subtitleFont, $softWhite, 440, 150)
$featureGraphics.DrawString("with guided quizzes, progress tracking,", $subtitleFont, $softWhite, 440, 180)
$featureGraphics.DrawString("and friendly AI study support.", $subtitleFont, $softWhite, 440, 208)

$pill1 = New-RoundedRectPath -X 440 -Y 256 -Width 176 -Height 52 -Radius 26
$pill2 = New-RoundedRectPath -X 628 -Y 256 -Width 170 -Height 52 -Radius 26
$pill3 = New-RoundedRectPath -X 810 -Y 256 -Width 152 -Height 52 -Radius 26
$featureGraphics.FillPath($pillBrush, $pill1)
$featureGraphics.FillPath($pillBrush, $pill2)
$featureGraphics.FillPath($pillBrush, $pill3)

$featureGraphics.DrawString("Multi-student", $pillFont, $whiteBrush, 470, 272)
$featureGraphics.DrawString("AI coach", $pillFont, $whiteBrush, 674, 272)
$featureGraphics.DrawString("Quiz levels", $pillFont, $whiteBrush, 840, 272)

$featureGraphics.DrawString("Perfect for early learners", $labelFont, $creamBrush, 442, 346)
$featureGraphics.DrawString("Math  English  History", $subtitleFont, $whiteBrush, 440, 374)
$featureGraphics.DrawString("Geography  Science  PHE", $subtitleFont, $whiteBrush, 440, 404)
$featureGraphics.DrawString("Bright, safe, and confidence-building", $subtitleFont, $softWhite, 440, 438)

Save-Png -Bitmap $featureBitmap -Path $featurePath
$featureGraphics.Dispose()
$featureBitmap.Dispose()

$iconFile = Get-Item $iconPath
$featureFile = Get-Item $featurePath
Write-Output "$iconPath`n$($iconFile.Length) bytes"
Write-Output "$featurePath`n$($featureFile.Length) bytes"
