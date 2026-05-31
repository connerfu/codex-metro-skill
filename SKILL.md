---
name: replicate-metro-json
description: One-command metro JSON generation. Say "复刻XX地铁" — fully automatic, zero confirmations.
version: 3.6
---

# Metro Replicator v3.6

## Usage
```
复刻XX地铁
```
→ `Downloads/{slug}_metro.json` → 拖进游戏

---

## Pipeline

```
metro_scraper.js v2.3
  └── metroman.cn → lines, colors, stations, coords → builder

post_process.js v1.1 (runs automatically)
  ├── amap_anchors.js v4.0    — track geometry (CONCURRENCY=5)
  ├── fix_transfers.js v9.1    — transfer separation (CONCURRENCY=3)
  ├── fix_names.js v3.1        — line name normalization
  └── split_gapped_lines.js v1 — auto-split lines with unopened middle sections
```

---

## Post-processing Details

### amap_anchors.js v4.0
- AMap transit API → real track polylines
- **Ring lines**: overlapping 8-station windows, wrap-around closing, gap fill
- **Long lines**: if full-line API fails, auto-split into 5-station windows
- **Transfer trim**: anchors within 80m of transfer stations removed
- **Strategy fallback**: transit strategies 0→2→5
- Idempotent: skips cached lines

### fix_transfers.js v9.1
- **2-line**: unify to single point
- **3+ line**: concurrent exit search → group by `address` field → centroid
- **Distance filter**: exits >2km from original station position discarded
- **Spatial fallback**: k-means clustering when exits share addresses
- Multi-keyword: "地铁站出入口" → "地铁站" → "站"

### fix_names.js v3.1
- Unicode-safe name normalization
- 25+ special line names (Foshan, Nanhai, Huangpu, APM, trams, etc.)

### split_gapped_lines.js v1
- **Trigger**: gap >8km AND gap/median-spacing >4x
- Splits into 北段/南段 or 东段/西段 based on coordinate analysis
- Preserves colors, adjusts train counts

---

## Edge Cases Handled

| Issue | Solution |
|-------|----------|
| Long lines fail transit API | 5-station windows fallback (v4.0) |
| Exit POIs from wrong stations | 2km distance filter (v9.1) |
| Exits share line addresses | Spatial k-means clustering |
| Partially opened lines | Auto-split at >8km gaps |
| Ring line closing segment | Wrap-around window processing |
| Station-anchor kinks | 80m transfer trim |
| Garbled line names | Unicode-escaped fix_names |

---

## Lessons from Guangzhou

1. **Line 12 partial opening**: 8.4km gap with 8 unbuilt stations → split into 西段/东段
2. **广州南站 coordinate drift**: metroman.cn data had GZ2 at +4km offset → distance filter + manual fix
3. **西塱站 mismatched centroid**: original coords 1km off → spatial clustering wrong assignment
4. **Foshan/Nanhai/Huangpu naming**: special line IDs must be in SPECIAL_NAMES map
5. **Exit POI pollution**: "广州南站地铁站" search returns exits from 江南西站/广州火车站 → 2km filter critical

---

## 28 Cities

北京 上海 广州 深圳 成都 重庆 杭州 南京 天津 武汉
沈阳 长春 西安 郑州 青岛 苏州 无锡 厦门 大连 哈尔滨
东莞 南宁 佛山 绍兴 珠海 咸阳 乌鲁木齐 中山

Merged: 上海都市圈(39线) 大湾区(47线)

## Environment
- Node: `$env:USERPROFILE\codex-node\node.exe`
- GitHub: `connerfu/codex-metro-skill`