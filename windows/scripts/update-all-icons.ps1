Add-Type -AssemblyName System.Drawing

$logoPath = "C:\Users\sudhan\Documents\Projects\DayV1.0.0\logo.png"
$baseDir = "C:\Users\sudhan\Documents\Projects\DayV1.0.0\Day--0.3.0"

if (-not (Test-Path $logoPath)) {
    Write-Error "Logo not found at $logoPath"
    exit 1
}

function Generate-SquarePng {
    param(
        [string]$destPath,
        [int]$size
    )
    $dir = Split-Path -Parent $destPath
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    $src = [System.Drawing.Image]::FromFile($logoPath)
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # Maintain aspect ratio, center in square
    $ratio = [Math]::Min($size / $src.Width, $size / $src.Height)
    $destW = [int]($src.Width * $ratio)
    $destH = [int]($src.Height * $ratio)
    $destX = [int](($size - $destW) / 2)
    $destY = [int](($size - $destH) / 2)

    $g.DrawImage($src, $destX, $destY, $destW, $destH)
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose()
    $bmp.Dispose()
    $src.Dispose()
    Write-Host "Generated: $destPath ($size x $size)"
}

# 1. Tauri (Windows & Linux) icons
$tauriIcons = Join-Path $baseDir "windows\src-tauri\icons"
Generate-SquarePng (Join-Path $tauriIcons "32x32.png") 32
Generate-SquarePng (Join-Path $tauriIcons "128x128.png") 128
Generate-SquarePng (Join-Path $tauriIcons "128x128@2x.png") 256
Generate-SquarePng (Join-Path $tauriIcons "icon.png") 512

# Temp sizes for .ico generation
$tempDir = Join-Path $baseDir "windows\temp_icons"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
$icoSizes = @(16, 24, 32, 48, 64, 128, 256)
foreach ($s in $icoSizes) {
    Generate-SquarePng (Join-Path $tempDir "$s.png") $s
}

# 2. Web & Dist assets
Copy-Item $logoPath (Join-Path $baseDir "windows\public\logo.png") -Force
Copy-Item $logoPath (Join-Path $baseDir "windows\dist\logo.png") -Force
Write-Host "Copied logo.png to windows/public and windows/dist"

# 3. Docs
Generate-SquarePng (Join-Path $baseDir "docs\media\icon.png") 512
Copy-Item $logoPath (Join-Path $baseDir "docs\media\day.png") -Force
Write-Host "Updated docs/media icons"

# 4. macOS NotchBuddy icons
$macIcons = Join-Path $baseDir "NotchBuddy\Assets.xcassets\AppIcon.appiconset"
if (Test-Path $macIcons) {
    Generate-SquarePng (Join-Path $macIcons "icon_16x16.png") 16
    Generate-SquarePng (Join-Path $macIcons "icon_16x16@2x.png") 32
    Generate-SquarePng (Join-Path $macIcons "icon_32x32.png") 32
    Generate-SquarePng (Join-Path $macIcons "icon_32x32@2x.png") 64
    Generate-SquarePng (Join-Path $macIcons "icon_128x128.png") 128
    Generate-SquarePng (Join-Path $macIcons "icon_128x128@2x.png") 256
    Generate-SquarePng (Join-Path $macIcons "icon_256x256.png") 256
    Generate-SquarePng (Join-Path $macIcons "icon_256x256@2x.png") 512
    Generate-SquarePng (Join-Path $macIcons "icon_512x512.png") 512
    Generate-SquarePng (Join-Path $macIcons "icon_512x512@2x.png") 1024
}

$menuBar = Join-Path $baseDir "NotchBuddy\Assets.xcassets\MenuBarIcon.imageset"
if (Test-Path $menuBar) {
    Generate-SquarePng (Join-Path $menuBar "menubar.png") 16
    Generate-SquarePng (Join-Path $menuBar "menubar@2x.png") 32
    Generate-SquarePng (Join-Path $menuBar "menubar@3x.png") 48
}

# 5. iOS PhoneAssets icons
$phoneAppIcon = Join-Path $baseDir "NotchBuddy\PhoneAssets.xcassets\AppIcon.appiconset"
if (Test-Path $phoneAppIcon) {
    Generate-SquarePng (Join-Path $phoneAppIcon "icon-1024.png") 1024
    Generate-SquarePng (Join-Path $phoneAppIcon "icon-1024-Dark.png") 1024
    Generate-SquarePng (Join-Path $phoneAppIcon "icon-1024-Tinted.png") 1024
}

Get-ChildItem -Path (Join-Path $baseDir "NotchBuddy\PhoneAssets.xcassets") -Filter "AppIcon-*.appiconset" | ForEach-Object {
    Generate-SquarePng (Join-Path $_.FullName "icon-1024.png") 1024
}

Write-Host "All PNG icons updated successfully!"
