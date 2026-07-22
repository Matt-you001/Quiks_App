$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$targets = @(
  @{ Path = 'app\subscription.tsx'; Pattern = 'subscription|purchase|revenuecat|entitlement|restriction|testing|disabled|isPro|upgrade|offering|package' },
  @{ Path = 'lib\revenuecat.ts'; Pattern = 'subscription|purchase|revenuecat|entitlement|restriction|testing|disabled|isPro|upgrade|offering|package' },
  @{ Path = 'app.config.ts'; Pattern = 'subscription|purchase|revenuecat|entitlement|restriction|testing|disabled|isPro|upgrade|offering|package' }
)

$outputLines = New-Object System.Collections.Generic.List[string]
foreach ($target in $targets) {
  $fullPath = Join-Path $root $target.Path
  $outputLines.Add("### $($target.Path)")
  if (-not (Test-Path -LiteralPath $fullPath)) {
    $outputLines.Add('FILE NOT FOUND')
    continue
  }

  $lines = Get-Content -LiteralPath $fullPath
  $matched = New-Object 'System.Collections.Generic.HashSet[int]'
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match $target.Pattern) {
      $start = [Math]::Max(0, $i - 3)
      $end = [Math]::Min($lines.Count - 1, $i + 5)
      for ($j = $start; $j -le $end; $j++) { [void]$matched.Add($j) }
    }
  }

  foreach ($index in ($matched | Sort-Object)) {
    $outputLines.Add(('{0,4}: {1}' -f ($index + 1), $lines[$index]))
  }
  $outputLines.Add('')
}

$font = New-Object System.Drawing.Font('Consolas', 16)
$brush = [System.Drawing.Brushes]::Black
$background = [System.Drawing.Brushes]::White
$pageWidth = 1900
$pageHeight = 1300
$margin = 35
$lineHeight = 24
$linesPerPage = [Math]::Floor(($pageHeight - (2 * $margin)) / $lineHeight)
$pageCount = [Math]::Ceiling($outputLines.Count / $linesPerPage)

for ($page = 0; $page -lt $pageCount; $page++) {
  $bitmap = New-Object System.Drawing.Bitmap($pageWidth, $pageHeight)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.FillRectangle($background, 0, 0, $pageWidth, $pageHeight)
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $startIndex = $page * $linesPerPage
  $endIndex = [Math]::Min($outputLines.Count - 1, $startIndex + $linesPerPage - 1)
  $y = $margin
  for ($i = $startIndex; $i -le $endIndex; $i++) {
    $graphics.DrawString($outputLines[$i], $font, $brush, $margin, $y)
    $y += $lineHeight
  }
  $outputPath = Join-Path $root ('.tmp-subscription-audit-{0}.png' -f ($page + 1))
  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

$font.Dispose()
