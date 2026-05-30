---
name: replicate-metro-json
description: Create Cities Designers importable metro JSON from real-world subway networks. One command, no confirmations.
version: 7.8
---

# Replicate Metro JSON v7.8

## Quick Start
Say "复刻XX地铁" → everything auto, file in Downloads. **Zero confirmations.**

```powershell
$node = "$env:USERPROFILE\codex-node\node.exe"
$env:AMAP_KEY = "c037d67ccb46f69c5f1b7a9b84c61e0e"

# Step 1: Auto-discover lines → references/{city}_lines.json (~10s)
& $node discover_lines.js {slug} "{中文名}"

# Step 2: Review & edit reference (colors, remove false lines, adjust ring/speed)

# Step 3: Build metro JSON → Downloads/{city}_metro.json (~15-30s)
Remove-Item "{city}_coords.json" -Force -ErrorAction SilentlyContinue
& $node metro_builder.js {slug} "{中文名}" {minLat} {maxLat} {minLng} {maxLng}
```

---

## metro_builder.js v7.8 Pipeline

### Phase 1: OSM cache (cache-first, skip Overpass if cache exists)
- Load cached OSM nodes. If no cache, query Overpass with 3-mirror rotation.
- Match OSM station names to reference → WGS84→GCJ02 conversion.
- **Time**: ~0s (cache) or ~15s (Overpass)

### Phase 2: Line-batch POI fill (KEY INNOVATION v7.8)
- **ONE AMap POI search per line**: "城市地铁N号线" returns all stations on that line.
- Match reference station names to POI results by fuzzy name.
- Remaining unmatched → individual geocode with "站名地铁站N号线".
- **Why this works**: POI search by line returns correct stations WITH correct coordinates in one query. No per-station geocoding needed.
- **Time**: ~8-15s for typical city

### Phase 3: Anomaly + Interpolation
- Clear stations where BOTH neighbors >4km (real) or >2km (computed).
- Interpolate remaining gaps.

### Output
- BOM-free UTF8 JSON with GCJ-02 coordinates.
- Frequency: `roundTripMin = (dist*2/speed)*60 + stations*0.5`
- Peak = roundTripMin/2, Off = roundTripMin/4, Low = roundTripMin/6

---

## Key Design Decisions (v7.8)

### Why line-batch POI instead of per-station geocode?
- Per-station geocode: 544 requests × 2-5s each = 20+ minutes, AND returns wrong coordinates for ambiguous names.
- Line-batch POI: 26 requests × 300ms = 8 seconds, AND coordinates are guaranteed to be on the correct line.
- **POI search is both faster AND more accurate** because AMap knows which stations belong to which line.

### Why cache-first Overpass?
- GFW blocks overpass-api.de with TCP hangs (not clean rejects).
- Cache-first avoids the 24-second timeout entirely when cache exists.

---

## Data Sources (priority order)
1. **OSM Cache** — pre-saved Overpass nodes (fastest, free)
2. **Overpass API** — 3-mirror rotation (only when no cache)
3. **AMap Line POI** — one query per line (fast, accurate)
4. **AMap Geocode** — individual station fallback (slow, used only for unmatched)

---

## Core Rules

### NEVER
- Query AMap bare name or `name+站` (returns geography, not station)
- Use per-station geocode as primary method (use line-batch POI)
- Create line reference from memory (use discover_lines.js or AMap POI)
- Wait for Overpass when OSM cache exists
- `Out-File -Encoding UTF8` (adds BOM)
- Skip coordinate monotonicity check after sorting

### ALWAYS
- `站名+地铁站` suffix in geocode queries
- `city=` parameter then retry without for cross-city
- Delete stale `coords.json` before every run
- BOM-free UTF8 (`[System.IO.File]::WriteAllText`)
- Use exact AMap POI names in references

### Thresholds
- Anomaly clear: BOTH neighbors >4km (real) / >2km (computed)
- BBox gate: ±0.3° around city bounds
- Discover filter: 3 < stations < 60

---

## BBox Reference
| City | lat min/max | lng min/max |
|------|-------------|-------------|
| 北京 | 39.4/41.0 | 115.5/117.5 |
| 上海 | 30.5/31.8 | 120.8/122.2 |
| 广州 | 22.3/23.8 | 112.8/114.2 |
| 深圳 | 22.3/22.9 | 113.7/114.6 |
| 成都 | 30.1/31.0 | 103.5/104.8 |
| 重庆 | 28.0/31.5 | 105.0/109.5 |
| 杭州 | 29.8/30.7 | 119.5/121.5 |
| 南京 | 31.0/32.6 | 118.2/119.3 |
| 天津 | 38.5/40.2 | 116.5/118.5 |
| 武汉 | 29.8/31.0 | 113.7/115.5 |
| 沈阳 | 41.5/42.5 | 122.8/124.5 |
| 长春 | 43.5/44.2 | 125.0/125.6 |
| 西安 | 34.0/34.6 | 108.5/109.3 |

## Keys
- AMap: `c037d67ccb46f69c5f1b7a9b84c61e0e`