# 🚇 Codex Metro Skill v2.0

> 一句话复刻全国地铁！对着 Codex 说"复刻北京地铁"，十几秒后导入文件就到手。

## 这是什么？

一个 Codex CLI 技能，能把真实世界的地铁网络变成 [Cities Designers](https://www.citiesdesigners.com/) 游戏可导入的 JSON 存档。

不用手动画线、不用查坐标、不用调班次——全自动。

## 快速开始

```powershell
# 1. 设置 AMap API Key
$env:AMAP_KEY = "你的高德Key"

# 2. 对着 Codex 说：
复刻北京地铁
```

文件出现在 `下载` 文件夹，拖进游戏即可。

## 支持城市

| 状态 | 城市 |
|------|------|
| ✅ 已支持 | 北京、上海、广州、深圳、成都、重庆、杭州、南京、天津、武汉、沈阳、长春、西安 |
| 🔧 一行命令即可 | 任何 Cities Designers 上有地铁的城市 |

没有你的城市？运行 `discover_lines.js` 自动生成线路数据，然后 `metro_builder.js` 一键出图。

## 原理

```
你说"复刻XX地铁"
    │
    ▼
discover_lines.js    ← 自动发现所有线路 + 站点（高德POI搜索，~10秒）
    │
    ▼
metro_builder.js     ← 批量获取坐标、异常检测、插值修复（~15秒）
    │
    ▼
{城市}_metro.json    ← 拖进游戏，开玩
```

### 坐标获取策略（v2.0 核心突破）

| 方法 | 速度 | 准确度 | 使用场景 |
|------|------|--------|----------|
| OSM 缓存 | ⚡ 即时 | ★★★☆ | 优先使用，免 API 调用 |
| 线路批量 POI | 🚀 ~8秒 | ★★★★ | **主力**——一条线一次查询全搞定 |
| 单站地理编码 | 🐌 慢 | ★★★☆ | 仅用于 POI 漏掉的个别站点 |

**v2.0 的关键发现**：逐站查询又慢又容易错（"常营地铁站"匹配到100公里外）。改成"北京地铁6号线"一次查全线的站点，又快又准。

## 文件结构

```
codex-metro-skill/
├── SKILL.md              ← Codex 技能定义
├── metro_builder.js      ← 核心引擎：坐标填充 → 异常检测 → 输出 JSON
├── discover_lines.js     ← 自动发现：线路 + 站点 → 生成 reference
├── quick_start.ps1       ← 一键脚本
├── warm_osm_cache.ps1    ← OSM 缓存预热
└── references/           ← 13 个城市的线路数据
```

## 输出示例

```json
{
  "app": "Cities Designers",
  "data": {
    "cityKey": "beijing",
    "lines": [
      {
        "id": "BJ1",
        "name": "1号线",
        "color": "#E60012",
        "freqPeak": 48,
        "stations": [
          { "name": "环球度假区站", "lat": 39.85, "lng": 116.67 },
          ...
        ]
      }
    ]
  }
}
```

高峰 2 分钟一班，平峰 4 分钟，低峰 6 分钟——自动根据线路长度计算。

## 依赖

- **高德地图 API Key**（必须，免费注册即可）
- **Node.js**（v18+）
- **百度地图 API Key**（可选，三级回退用）

## 致谢

- 高德地图开放平台
- OpenStreetMap + Overpass API
- Cities Designers 游戏团队