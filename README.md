# 🚇 Codex Metro Skill v2.0

<div align="center">

**一句话复刻全国地铁 · 拖进游戏直接玩**

[![Version](https://img.shields.io/badge/version-2.0-blue)](https://github.com/connerfu/codex-metro-skill)
[![Cities](https://img.shields.io/badge/cities-28-green)]()
[![License](https://img.shields.io/badge/license-MIT-yellow)]()

</div>

---

## 💡 这是什么

对着 [Codex CLI](https://github.com/openai/codex) 说一句 **"复刻北京地铁"**，十几秒后，一份完整的 [Cities Designers](https://www.citiesdesigners.com/) 存档就出现在你的下载文件夹里。

> 不用手动画线。不用查坐标。不用算班次。不用纠结换乘站。
>
> 真实地铁网络 → 可玩游戏存档，全自动。

---

## 🌍 支持城市

<div align="center">

| | | | | | | |
|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 🏛️ 北京 | 🌃 上海 | 🌺 广州 | 💻 深圳 | 🐼 成都 | 🌶️ 重庆 | 🌊 杭州 |
| 🏯 南京 | 🎡 天津 | 🏗️ 武汉 | ⚙️ 沈阳 | 🌲 长春 | 🏺 西安 | 🚂 郑州 |
| 🍺 青岛 | 🏯 苏州 | 🌉 无锡 | 🏝️ 厦门 | 🦁 佛山 | 🌿 南宁 | 🚢 大连 |
| ❄️ 哈尔滨 | 🏭 东莞 | 🌴 珠海 | 🏛️ 绍兴 | 🏛️ 咸阳 | 🏔️ 乌鲁木齐 | 🔴 中山 |

</div>

**全部 28 个城市，一行命令即可生成。**

---

## ⚡ 快速开始

```bash
# 对着 Codex 说：
复刻北京地铁
```

→ `下载/beijing_metro.json` → 拖进游戏 → 🎮

> 💡 需要高德地图 API Key（[免费注册](https://lbs.amap.com)）

---

## 🧠 原理

```
  "复刻XX地铁"
       │
       ▼
  ┌─────────────────────────────────┐
  │  discover_lines.js  (~10s)      │
  │  高德 POI 自动发现全部线路 + 站点  │
  └──────────────┬──────────────────┘
                 │
                 ▼
  ┌─────────────────────────────────┐
  │  metro_builder.js  (~15s)       │
  │  线路批量POI → 坐标填充          │
  │  异常检测 → 插值修复             │
  │  换乘匹配 → 班次计算             │
  └──────────────┬──────────────────┘
                 │
                 ▼
       {城市}_metro.json  🎯
```

### 🔑 v2.0 核心突破

| 方案 | 速度 | 准确 | 致命伤 |
|------|:----:|:----:|--------|
| ~~逐站地理编码~~ | 🐌 | ★★★ | 544个请求 = 20分钟，还查错站 |
| ~~逐站 POI~~ | 🚀 | ★☆ | 站名模糊匹配到100km外 |
| **线路批量 POI** ✅ | 🚀 | ★★★★ | 一条线一次查，AMap 本来就知道 |

> **教训**：不要一站一站查。一条线一条线查。把 AMap 当线路数据库用。

---

## 📦 安装

```bash
git clone https://github.com/connerfu/codex-metro-skill.git
cd codex-metro-skill
npm install   # 无额外依赖，仅需 Node.js 内置模块
```

设置 API Key：
```powershell
$env:AMAP_KEY = "你的高德Key"
```

---

## 🛠️ 工具链

| 文件 | 功能 |
|------|------|
| `metro_builder.js` | 核心引擎：坐标填充 → 异常检测 → 输出 |
| `discover_lines.js` | 自动发现：线路 + 站点 → 生成 reference |
| `quick_start.ps1` | 一键脚本 |
| `warm_osm_cache.ps1` | OSM 缓存预热 |
| `references/` | 各城市线路数据 |

---

## 📊 班次计算

```
往返时间 = (总里程×2 ÷ 时速) × 60 + 站点数 × 0.5
高峰班次 = 往返时间 ÷ 2    （≈2分钟一班）
平峰班次 = 往返时间 ÷ 4    （≈4分钟一班）
低峰班次 = 往返时间 ÷ 6    （≈6分钟一班）
```

---

## 🙏 致谢

- [高德地图开放平台](https://lbs.amap.com) — API 数据源
- [OpenStreetMap](https://www.openstreetmap.org) + Overpass API — 坐标回退
- [Cities Designers](https://www.citiesdesigners.com) — 游戏本体

---

<div align="center">

**Made with ❤️ by [connerfu](https://github.com/connerfu)**

</div>