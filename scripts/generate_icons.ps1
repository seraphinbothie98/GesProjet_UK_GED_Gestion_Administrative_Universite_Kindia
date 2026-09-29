Add-Type -AssemblyName System.Drawing

$workspace = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $workspace "client\public\logo_univ_kindia_officiel.png"
$outDir = Join-Path $workspace "client\public\icons"

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$srcImg = [System.Drawing.Image]::FromFile($sourcePath)

$sizes = @(72, 96, 128, 144, 152, 192, 384, 512)
foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($srcImg, 0, 0, $size, $size)
    $g.Dispose()
    
    $outFile = Join-Path $outDir ("icon-$($size)x$($size).png")
    $bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created: icon-$($size)x$($size).png"
}

# Apple Touch Icon 180x180 with clean #002B49 background
$appleBmp = New-Object System.Drawing.Bitmap(180, 180)
$ag = [System.Drawing.Graphics]::FromImage($appleBmp)
$ag.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$ag.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$ag.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$ag.Clear([System.Drawing.Color]::FromArgb(255, 0, 43, 73))
$pad = 12
$ag.DrawImage($srcImg, $pad, $pad, 180 - ($pad * 2), 180 - ($pad * 2))
$ag.Dispose()
$appleOut = Join-Path $outDir "apple-touch-icon.png"
$appleBmp.Save($appleOut, [System.Drawing.Imaging.ImageFormat]::Png)
$appleBmp.Dispose()
Write-Host "Created: apple-touch-icon.png"

# Maskable Icon 512x512 with safe-zone
$maskBmp = New-Object System.Drawing.Bitmap(512, 512)
$mg = [System.Drawing.Graphics]::FromImage($maskBmp)
$mg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$mg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$mg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$mg.Clear([System.Drawing.Color]::FromArgb(255, 0, 43, 73))
$maskPad = 48
$mg.DrawImage($srcImg, $maskPad, $maskPad, 512 - ($maskPad * 2), 512 - ($maskPad * 2))
$mg.Dispose()
$maskOut = Join-Path $outDir "maskable-icon-512x512.png"
$maskBmp.Save($maskOut, [System.Drawing.Imaging.ImageFormat]::Png)
$maskBmp.Dispose()
Write-Host "Created: maskable-icon-512x512.png"

# Favicon 32x32
$fav32 = New-Object System.Drawing.Bitmap(32, 32)
$fg = [System.Drawing.Graphics]::FromImage($fav32)
$fg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$fg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$fg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$fg.Clear([System.Drawing.Color]::Transparent)
$fg.DrawImage($srcImg, 0, 0, 32, 32)
$fg.Dispose()
$favOut = Join-Path $outDir "favicon-32x32.png"
$fav32.Save($favOut, [System.Drawing.Imaging.ImageFormat]::Png)
$fav32.Dispose()
Write-Host "Created: favicon-32x32.png"

$srcImg.Dispose()
Write-Host "All PWA icons successfully generated!"
