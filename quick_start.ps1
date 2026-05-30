# Quick Start: Replicate Metro for Cities Designers
# Usage: .\quick_start.ps1 {slug} "{中文名}" {minLat} {maxLat} {minLng} {maxLng}
# Example: .\quick_start.ps1 changchun "长春" 43.5 44.2 125.0 125.6

param(
    [string]$slug,
    [string]$cnName,
    [double]$minLat,
    [double]$maxLat,
    [double]$minLng,
    [double]$maxLng
)

$node = "$env:USERPROFILE\codex-node\node.exe"
$env:AMAP_KEY = "c037d67ccb46f69c5f1b7a9b84c61e0e"
$skillDir = "C:/Users/Conner/Documents/New project/codex-metro-skill"
$refFile = "$skillDir/references/${slug}_lines.json"

# Step 1: Discover lines (skip if reference already exists)
if (-not (Test-Path $refFile)) {
    Write-Host "=== Step 1: Discovering lines ===" -ForegroundColor Cyan
    & $node "$skillDir/discover_lines.js" $slug $cnName
    if ($LASTEXITCODE -ne 0) { throw "Discover failed" }
    Write-Host "Review & edit: $refFile" -ForegroundColor Yellow
    Write-Host "Press Enter to continue with build..." -ForegroundColor Yellow
    Read-Host
} else {
    Write-Host "=== Reference exists: $refFile ===" -ForegroundColor Green
}

# Step 2: Build
Write-Host "`n=== Step 2: Building ===" -ForegroundColor Cyan
Remove-Item "C:/Users/Conner/Documents/New project/${slug}_coords.json" -Force -ErrorAction SilentlyContinue
& $node "$skillDir/metro_builder.js" $slug $cnName $minLat $maxLat $minLng $maxLng

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nDone! Output: C:/Users/Conner/Downloads/${slug}_metro.json" -ForegroundColor Green
} else {
    Write-Host "`nBuild failed!" -ForegroundColor Red
}