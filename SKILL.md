---
name: replicate-metro-json
description: One-command metro JSON generation. Say "复刻XX地铁" — fully automatic, zero confirmations.
version: 3.2
---

# Metro Replicator v3.2

## Usage
```
复刻XX地铁
```
→ `Downloads/{slug}_metro.json` → 拖进游戏

---

## Architecture

```
metro_scraper.js v2.3 — unified scraper
  ├── metroman.cn → lines, colors, stations, coords
  ├── auto branch detection (haversine)
  ├── S-line handling (line-s1 → NJ_LINE_S1)
  ├── phase line handling (line-6-phase-ii → TJ6P2)
  ├── parallel fetch (8x concurrent coords, 6x lines)
  ├── 24h cache → cached run <0.5s
  ├── references/ → per-city
  └── archives/ → all 28 city JSONs

metro_builder.js v7.12 — builder
  └── Phase 0 pre-coords → 100%? skip OSM/POI → assemble
```

## Speed Benchmarks (28 cities, first run, cleared cache)

| Tier | Time | Cities |
|------|------|--------|
| Large | 10-19s | 上海(19.2s) 广州(15s) 北京(14.1s) 成都(13s) 深圳(12s) 重庆(11.2s) 杭州(10.7s) 武汉(10.5s) 西安(10.4s) |
| Medium | 4-9s | 南京(9.4s) 天津(8.9s) 郑州(8.1s) 苏州(6.7s) 青岛(4.7s) 沈阳(4s) |
| Small | 1-3s | 南宁(3.2s) 长春(3.1s) 大连(2.8s) 无锡(2.2s) 厦门(1.7s) 东莞(1.3s) |
| Mini | <1s | 哈尔滨 佛山 绍兴 珠海 咸阳 乌鲁木齐 中山 |

**All 28 cities: ~3 minutes** (cached: ~10 seconds)


## v3.2 What's New (AMap Polyline Anchors)

### Track Geometry via AMap Direction API
- **Auto post-build**: after builder, `amap_anchors.js` runs automatically (Step 6)
- Calls AMap `/v3/direction/transit/integrated` for true track geometry
- 100-500 track points per line, fills `segmentAnchors` (was empty `[]`)
- Ring lines auto-skipped; already-anchored lines auto-skipped (idempotent)
- Mismatch detection: skips when first/last station >2km from polyline endpoint
- BATCH_DELAY=300ms between API calls (rate limit friendly)

### Results (tested on Tianjin, Changchun)
- Tianjin: 12/13 lines with anchors, 3294 track points
- Changchun: 5/6 lines with anchors, 867 track points
- Failed lines: TJ4, CC3 — first station coordinate mismatch with AMap route

## v3.1 What's New

### Speed Optimizations
- **Parallel line fetching** (pool=6): stations list fetched concurrently
- **Parallel coord fetching** (pool=8): station coordinates fetched 8 at a time
- **Builder fast-path**: 100% pre-coords? Skip OSM+POI entirely
- **Result**: first run 3-5x faster, cached run 40x faster

### Metro Area Mergers
New `archives/` with merged regional networks:
- **上海都市圈** (39线 916站): 上海+苏州+无锡, 花桥跨城换乘
- **大湾区** (47线 976站): 广州+深圳+东莞, 含广佛线

### Auto Branch Detection
Haversine-based: junction→detour→resume where `ratio > 3`.
Verified: 上海5/10/11号线, 杭州3/6号线, 绍兴1号线, 重庆6号线, 广州3/14号线

## Data Sources
- **Primary**: metroman.cn (lines, stations, colors, coords)
- **Fallback**: AMap API

## 28 Cities Available (archives/)

北京 上海 广州 深圳 成都 重庆 杭州 南京 天津 武汉
沈阳 长春 西安 郑州 青岛 苏州 无锡 厦门 大连 哈尔滨
东莞 南宁 佛山 绍兴 珠海 咸阳 乌鲁木齐 中山

Plus merged: 上海都市圈(39线), 大湾区(47线)

## Environment
- Node: `$env:USERPROFILE\codex-node\node.exe`
- GitHub: `connerfu/codex-metro-skill`
