$ErrorActionPreference = 'Stop'
$inputPath = 'C:\Users\USER\Desktop\Quiks\artifacts\Quiks_School_Partnership_Updated_Proposal.docx'
$outputDir = 'C:\Users\USER\Desktop\Quiks\artifacts\proposal-review\updated-render'
$pdfPath = Join-Path $outputDir 'Quiks_School_Partnership_Updated_Proposal.pdf'

if (-not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $document = $word.Documents.Open($inputPath, $false, $true)
    $document.Fields.Update() | Out-Null
    foreach ($section in $document.Sections) {
        foreach ($footer in $section.Footers) {
            if ($footer.Exists) {
                $footer.Range.Fields.Update() | Out-Null
            }
        }
    }
    $document.ExportAsFixedFormat($pdfPath, 17)
    $document.Close($false)
}
finally {
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}

Write-Output $pdfPath
