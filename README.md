<div align="center">

<img src="https://img.shields.io/badge/Codex_Metro_Skill-v4.1-blue?style=for-the-badge" alt="version">
<img src="https://img.shields.io/badge/28_Cities-265_Lines-8A2BE2?style=for-the-badge" alt="cities">
<img src="https://img.shields.io/badge/Real_Track_Geometry-AMap_API-ff6600?style=for-the-badge" alt="track">
<img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="license">

<br>
<br>

# 🚇 Codex Metro Skill v4.1

### 🎯 真正还原现实地铁走向 · 拖进游戏直接玩

[![Stars](https://img.shields.io/github/stars/connerfu/codex-metro-skill?style=social)](https://github.com/connerfu/codex-metro-skill)

</div>

---

## 🔥 v4.1 重磅更新

### 轨道优先架构

v4.1 最大的架构变革是 **"先有轨道，再安站点"**：

1. 先用 AMap 公交路径规划 API 获取真实轨道 polyline
2. 站点吸附到轨道上（每条线各保留自己的站点位置）
3. 换乘关系只做标记（`same_station` + `transferGroupId`），不做站点合并
4. Catmull-Rom 样条简化锚点，保持曲线平滑

> **效果**：每条线都在现实轨道上蜿蜒，换乘站不再"吸到一起"，彻底解决脱轨问题

### 三级加速策略

| 级别 | 条件 | 耗时 | 说明 |
|------|------|------|------|
| 🚀 P0 | 存档命中 | ~0.1s | 直接复制预制存档 |
| ⚡ P1 | 缓存命中 | ~15-30s | 跳过线路发现，直接构建 |
| 🐢 P2 | 新城市 | ~60-120s | 全流程运行 |

### 智能支线检测

通过分析末端站距变化（>1.8x 切断），自动识别并分离支线。

### 完整管线流程

```
metro_scraper.js v2.3 — 6步串联执行：

Step 1: 抓取线路 — metroman.cn 爬取（线路、颜色、站点）
Step 2: 抓取坐标 — metroman.cn 站点页 position=lat,lng
Step 3: 支线检测 — detectBranches() 末端站距分析
Step 4: 生成参考 — references/{slug}_lines.json
Step 5: 构建JSON — metro_builder.js（游戏存档格式）
Step 6: 轨道锚点 — amap_anchors.js（AMap polyline + Catmull-Rom）
```

### 数据源

- **metroman.cn** — 线路/站点数据
- **AMap API** — 真实轨道 polyline（公交路径规划）+ 站点坐标

---

## 🗺️ 28 城全部生成

### ✅ 全部锚点完成（18 城）

| 城市 | 线路 | 下载 |
|:--|:--|:--|
| 北京 | 28线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/beijing_metro.json) |
| 上海 | 25线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/shanghai_metro.json) |
| 广州 | 27线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/guangzhou_metro.json) |
| 深圳 | 18线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/shenzhen_metro.json) |
| 成都 | 17线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/chengdu_metro.json) |
| 重庆 | 16线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/chongqing_metro.json) |
| 杭州 | 14线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/hangzhou_metro.json) |
| 南京 | 15线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/nanjing_metro.json) |
| 天津 | 13线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/tianjin_metro.json) |
| 武汉 | 14线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/wuhan_metro.json) |
| 沈阳 | 6线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/shenyang_metro.json) |
| 长春 | 6线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/changchun_metro.json) |
| 西安 | 14线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/xian_metro.json) |
| 郑州 | 14线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/zhengzhou_metro.json) |
| 青岛 | 8线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/qingdao_metro.json) |
| 苏州 | 9线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/suzhou_metro.json) |
| 无锡 | 5线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/wuxi_metro.json) |
| 厦门 | 3线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/xiamen_metro.json) |
| 大连 | 6线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/dalian_metro.json) |
| 哈尔滨 | 3线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/harbin_metro.json) |
| 东莞 | 2线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/dongguan_metro.json) |
| 南宁 | 5线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/nanning_metro.json) |
| 乌鲁木齐 | 2线 | [📥](https://github.com/connerfu/codex-metro-skill/raw/main/output/urumqi_metro.json) |

> **注意**：部分特殊线路（有轨电车、云巴、磁悬浮等）因 AMap API 无法获取 polyline，轨道锚点缺失，但不影响普通线路使用。

### ⚪ 无地铁数据（5 城）
佛山 · 绍兴 · 珠海 · 咸阳 · 中山 — metroman.cn 上无线路数据

---

## 🚀 快速开始

```powershell
# 设置 AMap API Key
$env:AMAP_KEY = "你的高德API Key"

# 复刻一城
& "$env:USERPROFILE\codex-node\node.exe" metro_scraper.js shanghai "上海"

# 输出文件：Downloads/{slug}_metro.json → 拖入 Cities Designers 游戏
```

### 一句话触发（对 Codex 说）
> **"复刻北京地铁"** / **"复刻广州地铁"** / **"复刻XX地铁"**

---

## 📦 文件结构

| 路径 | 用途 |
|------|------|
| `metro_scraper.js` | 主入口，6步管线串联 |
| `metro_builder.js` | 生成游戏存档格式 JSON |
| `amap_anchors.js` | AMap polyline 锚点 + Catmull-Rom 简化 |
| `fix_names.js` | 线路名称 Unicode 修复 |
| `split_gapped_lines.js` | 大间距分段 |
| `discover_lines.js` | AMap POI 发现线路（备用入口） |
| `output/` | 预制 28 城 JSON 存档（拖入即玩） |
| `references/` | 线路元数据缓存 |

---

## ⚙️ 架构原则

1. **轨道优先** — 先有轨道再安站点
2. **不合并换乘** — 各线站点保留在各自轨道上
3. **AMap 唯一** — 放弃 OSM，完全依赖 AMap API
4. **真实优先** — 找不到真实轨道时必须汇报，不允许直线插值替代

---

<div align="center">
<br>
Made with ❤️ by <a href="https://github.com/connerfu">connerfu</a>
<br>
<sub>Powered by <a href="https://www.metroman.cn">MetroMan</a> + <a href="https://lbs.amap.com">AMap API</a></sub>
<br>
<sub>内置 AMap Key: c037d67ccb46f69c5f1b7a9b84c61e0e</sub>
</div>
