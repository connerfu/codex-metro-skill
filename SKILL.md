---
name: replicate-metro-json
description: One-command metro JSON generation. Say "复刻XX地铁" — fully automatic.
version: 4.1
---

# Metro Replicator v4.0

## Usage
```
复刻XX地铁
```
→ `Downloads/{slug}_metro.json` → 拖进游戏

## Pipeline (one command)

1. **metro_scraper.js v3.0**: metroman.cn scrape → line topology + coords (8x parallel) → builder
2. **seg_anchors.js v16.1**: AMap transit API → track geometry (2w/250ms, 90%+ coverage)
3. **fix_transfers.js v4.0**: POI entrance matching + geometric offset → 97% transfer separation

## Key Parameters

| Step | Workers | Interval | Coverage |
|------|---------|----------|----------|
| Track geometry | per-line | 350ms | 96%+ |
| Transfer fix | POI: 80ms | Geo: 60m offset | 97% |

## Speed (Beijing: 28 lines)

| Step | Time |
|------|------|
| Scraper + Builder | ~4s |
| Anchors (1st pass) | ~28s |
| Anchors (resume) | ~15s |
| Transfers | ~28s |
| **Total** | **~60-75s** |

## Data Sources
- **Line topology**: metroman.cn
- **Coordinates**: metroman.cn `position=` parameter + AMap geocode fallback
- **Track geometry**: AMap transit direction API (chunked 5-station requests)
- **Transfer positions**: AMap POI search ([station][line]) + geometric offset

## 28 Cities
北京 上海 广州 深圳 成都 重庆 杭州 南京 天津 武汉 沈阳 长春 西安 郑州 青岛 苏州 无锡 厦门 大连 哈尔滨 东莞 南宁 佛山 绍兴 珠海 咸阳 乌鲁木齐 中山

## Environment
- Node: `$env:USERPROFILE\codex-node\node.exe`
- AMap Key: `c037d67ccb46f69c5f1b7a9b84c61e0e`
- GitHub: `connerfu/codex-metro-skill`


## Critical: Unicode Safety
- ALL Chinese strings in JS source MUST use Unicode escapes (e.g., `\u5730\u94C1` for ??)
- PowerShell file writes corrupt UTF-8 Chinese characters → always use Node.js to write source files
- Always verify: `Buffer.from(str).toString("hex")` should match expected UTF-8 bytes