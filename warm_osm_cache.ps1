$node = "$env:USERPROFILE\codex-node\node.exe"
$basePath = "C:/Users/Conner/Documents/New project"
$tmpJs = "$basePath\warm_query.js"

$cities = @(
    @{slug="beijing";  lat="39.4,41.0"; lng="115.5,117.5"},
    @{slug="shanghai"; lat="30.5,31.8"; lng="120.8,122.2"},
    @{slug="guangzhou";lat="22.3,23.8"; lng="112.8,114.2"},
    @{slug="shenzhen"; lat="22.3,22.9"; lng="113.7,114.6"},
    @{slug="chengdu";  lat="30.1,31.0"; lng="103.5,104.8"},
    @{slug="chongqing";lat="28.0,31.5"; lng="105.0,109.5"},
    @{slug="hangzhou"; lat="29.8,30.7"; lng="119.5,121.5"},
    @{slug="nanjing";  lat="31.0,32.6"; lng="118.2,119.3"},
    @{slug="tianjin";  lat="38.5,40.2"; lng="116.5,118.5"},
    @{slug="wuhan";    lat="29.8,31.0"; lng="113.7,115.5"},
    @{slug="shenyang"; lat="41.5,42.5"; lng="122.8,124.5"},
    @{slug="changchun";lat="43.5,44.2"; lng="125.0,125.6"},
    @{slug="xian";     lat="34.0,34.6"; lng="108.5,109.3"}
)

$total = $cities.Count; $done = 0; $cached = 0
Write-Host "=== OSM Cache Pre-Warmer ==="
Write-Host "Target: $total cities"

foreach ($city in $cities) {
    $done++
    $cacheFile = "$basePath\$($city.slug)_osm_cache.json"
    $latVals = $city.lat -split ','
    $lngVals = $city.lng -split ','
    Write-Host -NoNewline "[$done/$total] $($city.slug)... "
    $result = & $node $tmpJs $latVals[0] $latVals[1] $lngVals[0] $lngVals[1] $cacheFile 2>&1
    Write-Host $result
    if ($result -match '\d+ nodes') { $cached++ }
    Start-Sleep -Seconds 3
}

Write-Host "Done: $cached/$total cached"