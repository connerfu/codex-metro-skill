---
name: replicate-metro-json
description: One-command metro JSON generation. Say "复刻XX地铁" — fully automatic, zero confirmations.
version: 8.2
---

# Metro Replicator v8.2

## Usage
```
复刻XX地铁
```
→ `node metro_scraper.js {slug} "{中文名}"` → `node metro_builder.js` → `Downloads/{slug}_metro.json`

Zero confirmations. One sentence, one command.

---

## Architecture

```
metro_scraper.js v2.1 (unified, cached, auto-branch)
  ├── metroman.cn → lines, stations, colors, coords
  ├── cache/ → 24h TTL (line data + coords)
  ├── references/ → {slug}_lines.json
  └── {slug}_coords.json

metro_builder.js v7.11
  └── Phase 0: load coords → 100% match → assemble
```

## Key Features v8.2

### Unified Scraper (v2.1)
One script for all cities: `node metro_scraper.js {slug} "{中文名}"`
- Auto-detects line types (numeric, special, tram, phase-ii/iii)
- **Auto branch detection** — haversine-based: scans each line for junction→detour→resume patterns
- Handles naming conventions per city
- Phase line handling: `line-6-phase-ii` → LID `TJ6P2`, name "天津地铁6号线二期"

### 24h Cache
- Line data: `cache/{slug}_lines.json` (TTL 24h)
- Coordinates: `cache/{slug}_coords.json` (TTL 24h)
- Second run on same city: ~2-5s (skips all HTTP)
- `--nocache` flag to force refresh

### Auto Branch Detection
Haversine-based algorithm in `detectBranches()`:
- Scans each line for junction→detour→resume patterns
- Condition: `detourDist / directDist > 3` AND `directDist < 6km`
- Skips ring lines automatically
- Takes best ratio per line

### Phase Line Detection
`getLid()` auto-detects phase suffixes:
- `line-6-phase-ii` → `TJ6P2`, name "天津地铁6号线二期"
- Handles i/ii/iii/iv/v Roman numerals

---

## Data Sources

### Primary: metroman.cn
- Line list + colors: `https://www.metroman.cn/cities/{slug}/lines`
- Station lists: `https://www.metroman.cn/cities/{slug}/lines/{line-slug}`
- Station coords: individual station pages → `position=lat,lng`
- Station naming: `&#183;` → `·`, `(N号线)` stripped

### Fallback: AMap API
- Key: `c037d67ccb46f69c5f1b7a9b84c61e0e`
- Used only for zero-coord fixes

### Pre-coords System (v7.11)
- Builder loads coords file directly → 100% match
- No OSM/Overpass dependency for coords
- Auto-fallback to AMap for any missing

---

## City Quick Reference

| City | Slug | BBox (lat/lng) |
|------|------|-----------------|
| 北京 | beijing | 39.4-41.0 / 115.5-117.5 |
| 上海 | shanghai | 30.5-31.8 / 120.8-122.2 |
| 广州 | guangzhou | 22.3-23.8 / 112.8-114.2 |
| 深圳 | shenzhen | 22.3-22.9 / 113.7-114.6 |
| 成都 | chengdu | 30.1-31.0 / 103.5-104.8 |
| 重庆 | chongqing | 28.0-31.5 / 105.0-109.5 |
| 杭州 | hangzhou | 29.8-30.7 / 119.5-121.5 |
| 南京 | nanjing | 31.0-32.6 / 118.2-119.3 |
| 天津 | tianjin | 38.5-40.2 / 116.5-118.5 |
| 武汉 | wuhan | 29.8-31.0 / 113.7-115.5 |
| 沈阳 | shenyang | 41.5-42.5 / 122.8-124.5 |
| 长春 | changchun | 43.5-44.2 / 125.0-125.6 |
| 西安 | xian | 34.0-34.6 / 108.5-109.3 |
| 郑州 | zhengzhou | 34.3-35.1 / 113.0-114.3 |
| 青岛 | qingdao | 35.8-36.6 / 119.8-121.2 |
| 苏州 | suzhou | 30.9-31.7 / 120.3-121.3 |
| 无锡 | wuxi | 31.1-31.9 / 119.9-120.8 |
| 厦门 | xiamen | 24.2-24.8 / 117.8-118.5 |
| 大连 | dalian | 38.6-39.3 / 121.1-122.2 |
| 哈尔滨 | haerbin | 45.3-46.2 / 126.1-127.2 |
| 东莞 | dongguan | 22.6-23.3 / 113.4-114.3 |
| 南宁 | nanning | 22.3-23.1 / 107.8-109.0 |
| 佛山 | foshan | 22.6-23.4 / 112.6-113.4 |
| 绍兴 | shaoxing | 29.7-30.5 / 120.1-121.1 |
| 珠海 | zhuhai | 22.0-22.5 / 113.1-113.6 |
| 咸阳 | xianyang | 34.1-34.6 / 108.3-109.1 |
| 乌鲁木齐 | wulumuqi | 43.4-44.2 / 87.1-88.2 |
| 中山 | zhongshan | 22.3-22.8 / 113.1-113.7 |

## Environment
- Node: `$env:USERPROFILE\codex-node\node.exe`
- Git: `C:\Program Files\Git\bin\git.exe`
- GitHub: `connerfu/codex-metro-skill`
- AMap Key: `c037d67ccb46f69c5f1b7a9b84c61e0e`
