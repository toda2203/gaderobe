# Image Validation & Repair Script für Windows/PowerShell
# Überprüft und repariert imageUrl-Einträge nach einem Restore

param(
    [string]$BackendPath = "backend",
    [string]$UploadPath = "uploads"
)

$ErrorActionPreference = "Stop"

$dbPath = Join-Path $BackendPath "data/bekleidung.db"
$uploadsDir = $uploadPath

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Image Validation & Repair Tool (Windows)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $dbPath)) {
    Write-Host "Error: Database not found at $dbPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $uploadsDir)) {
    Write-Host "Error: Uploads directory not found at $uploadsDir" -ForegroundColor Red
    exit 1
}

Write-Host "Database: $dbPath"
Write-Host "Uploads: $uploadsDir"
Write-Host ""

# Ensure subdirectories exist
@(
    "clothing-images",
    "protocols"
) | ForEach-Object {
    $dir = Join-Path $uploadsDir $_
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "Created directory: $_"
    }
}

Write-Host ""
Write-Host "1. Finding all clothing types with imageUrl..." -ForegroundColor Yellow

# Try using sqlite3 if available, otherwise use PowerShell
$hasImageUrl = $false
try {
    $result = & sqlite3 $dbPath "SELECT id, name, imageUrl FROM clothing_types WHERE imageUrl IS NOT NULL AND imageUrl != '';" 2>$null
    if ($result) {
        $hasImageUrl = $true
        $result | ForEach-Object {
            $parts = $_ -split '\|'
            if ($parts.Length -eq 3) {
                $id, $name, $imageUrl = $parts
                $localPath = $imageUrl -replace '^/', ''
                $fullPath = Join-Path $uploadsDir $localPath
                
                if (Test-Path $fullPath) {
                    Write-Host "   ✓ $name - $(Split-Path $imageUrl -Leaf)" -ForegroundColor Green
                } else {
                    Write-Host "   ✗ MISSING: $name - $imageUrl" -ForegroundColor Red
                }
            }
        }
    }
} catch {
    Write-Host "Note: sqlite3 not available, skipping DB check" -ForegroundColor Yellow
}

if (-not $hasImageUrl) {
    Write-Host "   No clothing types with images found or DB check skipped." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "2. Checking uploads directory structure..." -ForegroundColor Yellow
Write-Host ""

Write-Host "Files in uploads directory:" -ForegroundColor Yellow
Get-ChildItem $uploadsDir -Recurse -File | ForEach-Object {
    $relPath = $_.FullName -replace [regex]::Escape($uploadsDir + '\'), ''
    Write-Host "   - $relPath"
}

Write-Host ""
Write-Host "3. Moving misplaced images to correct folders..." -ForegroundColor Yellow

$imageExtensions = @("*.jpg", "*.png", "*.jpeg", "*.gif", "*.webp")
$movedCount = 0

$imageExtensions | ForEach-Object {
    Get-ChildItem $uploadsDir -MaxDepth 1 -Filter $_ -File | ForEach-Object {
        $targetDir = Join-Path $uploadsDir "clothing-images"
        Move-Item -Path $_.FullName -Destination $targetDir -Force
        Write-Host "   Moved: $($_.Name)"
        $movedCount++
    }
}

if ($movedCount -gt 0) {
    Write-Host "   Moved $movedCount image(s) to clothing-images/"
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Validation Complete" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If images are still missing:" -ForegroundColor Yellow
Write-Host "1. Check if backup archive contains images:"
Write-Host "   tar -tzf backups/uploads_*.tar.gz | head -20"
Write-Host ""
Write-Host "2. List your backups:"
Write-Host "   Get-ChildItem backups -Filter 'uploads_*.tar.gz'"
Write-Host ""
Write-Host "3. Manually restore from backup (WSL or Git Bash):"
Write-Host "   tar -xzf backups/uploads_YYYYMMDD_HHMMSS.tar.gz -C uploads"
Write-Host ""
Write-Host "4. Restart Docker containers:"
Write-Host "   docker-compose restart backend"

