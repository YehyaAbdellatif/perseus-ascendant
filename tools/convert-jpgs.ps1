# Converts the generated images in JPGs/ (JPEG data, often named .png) to real PNGs in PNGs/gen2,
# which tools/build-art.js and tools/build-perseus.js read. The remove.bg previews are skipped.
# Run from the project folder:  powershell -ExecutionPolicy Bypass -File tools/convert-jpgs.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'JPGs'
$dst = Join-Path $root 'PNGs\gen2'
New-Item -ItemType Directory -Force $dst | Out-Null
Get-ChildItem $src -File | Where-Object { $_.Name -notlike '*removebg*' } | ForEach-Object {
  $img = [System.Drawing.Image]::FromFile($_.FullName)
  $bmp = New-Object System.Drawing.Bitmap($img.Width, $img.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.DrawImage($img, 0, 0, $img.Width, $img.Height)
  $g.Dispose()
  $name = [System.IO.Path]::GetFileNameWithoutExtension($_.Name) + '.png'
  $bmp.Save((Join-Path $dst $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose(); $img.Dispose()
  Write-Output $name
}
