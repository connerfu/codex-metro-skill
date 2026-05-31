---
name: replicate-metro-json
description: One-command metro JSON generation. Say "复刻XX地铁" — fully automatic, zero confirmations.
version: 3.0
---

# Metro Replicator v3.0

## Usage
```
复刻XX地铁
```
One sentence, zero confirmations. Auto scrapes, builds, outputs to `Downloads/{slug}_metro.json`.

---

## Architecture

```
metro_scraper.js v2.2 — unified scraper
  ├── metroman.cn → lines, stations, colors, coords
  ├── auto branch detection (haversine)
  ├── S-line handling (line-s1 → NJ_LINE_S1)
  ├── phase line handling (line-6-phase-ii → TJ6P2)
  ├── cache/ → 24h TTL
  └── references/{slug}_lines.json + coords

metro_builder.js v7.11 — builder
  └── Phase 0 pre-coords → 100% match → anomaly detection → assemble
```

---

## v3.0 What's New

### S-Line Support
- `line-s1` through `line-s9` auto-detected per city
- LID format: `{prefix}_LINE_S{n}` (e.g., `NJ_LINE_S1`)
- City-specific LINE_NAMES: 南京S1(机场线), S2(宁马线), etc.

### Ring Line Fix
- `isRing()` now uses LID-based detection, not num-based
- Only true ring lines (环线/loop-line) marked as ring
- Fixes false ring detection on num=0 special lines

### Expanded LINE_NAMES
- Hangzhou: 杭海城际, 绍兴地铁1/2号线
- Nanjing: S1-S9, 宁滁线
- Chengdu: 资阳线(S3), 蓉2号线
- Chongqing: 空港线, 国博线, 环线, 江跳线, 璧铜线, 云巴
- Tianjin: 津静线, Z4线, 6号线二期

### Auto Branch Detection
Haversine-based: junction→detour→resume where `detourDist / directDist > 3`

Verified on:
- Shanghai: 5/10/11号线支线 ✓
- Hangzhou: 3/6号线支线, 绍兴1号线支线 ✓
- Chongqing: 6号线支线 ✓

---

## Supported Cities (28 total)

| City | Slug | BBox |
|------|------|------|
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

## Data Sources
- **Primary**: metroman.cn (lines, stations, colors, coords)
- **Fallback**: AMap API (`c037d67ccb46f69c5f1b7a9b84c61e0e`)

## Environment
- Node: `$env:USERPROFILE\codex-node\node.exe`
- GitHub: `connerfu/codex-metro-skill`
