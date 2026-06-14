<div align="center">

<img src="https://img.shields.io/badge/Codex_Metro_Skill-v4.1-blue?style=for-the-badge" alt="version">
<img src="https://img.shields.io/badge/43_Cities-12K_Stations-8A2BE2?style=for-the-badge" alt="cities">
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

通过分析末端站距变化（>1.8x 切断），自动识别并分离支线：
- 上海 5 号线支线（闵行开发区）
- 上海 10 号线支线（航中路）
- 上海 11 号线支线（花桥）
- 成都 1 号线支线（五根松）

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

### 放弃 OSM

完全从 skill 中删除所有 OSM 相关代码，所有数据来源统一为：
- **metroman.cn** — 线路/站点数据
- **AMap API** — 真实轨道 polyline（公交路径规划）+ 站点坐标

---

## 🗺️ 支持城市（43 城）

### 已完成（8 城，166 线，全部有轨道锚点）

| 城市 | 线路/站点 | 📥 下载 |
|:--|:--|:--|
| 北京 | 28线 / 539站 | [beijing_metro.json](archives/beijing_metro.json) |
| 上海 | 25线 / 544站 | [shanghai_metro.json](archives/shanghai_metro.json) |
| 广州 | 27线 / 503站 | [guangzhou_metro.json](archives/guangzhou_metro.json) |
| 深圳 | 18线 / 433站 | [shenzhen_metro.json](archives/shenzhen_metro.json) |
| 成都 | 19线 / 482站 | [chengdu_metro.json](archives/chengdu_metro.json) |
| 重庆 | 16线 / 342站 | [chongqing_metro.json](archives/chongqing_metro.json) |
| 杭州 | 18线 / 363站 | [hangzhou_metro.json](archives/hangzhou_metro.json) |
| 南京 | 15线 / 293站 | [nanjing_metro.json](archives/nanjing_metro.json) |

### 原始 28 城

北京 · 上海 · 广州 · 深圳 · 成都 · 重庆 · 杭州 · 南京 · 天津 · 武汉
沈阳 · 长春 · 西安 · 郑州 · 青岛 · 苏州 · 无锡 · 厦门 · 大连 · 哈尔滨
东莞 · 南宁 · 佛山 · 绍兴 · 珠海 · 咸阳 · 乌鲁木齐 · 中山

### 扩展 15 城

昆明 · 长沙 · 宁波 · 南昌 · 福州 · 合肥 · 贵阳 · 石家庄 · 温州 · 济南
兰州 · 常州 · 徐州 · 太原 · 洛阳

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
| `fix_transfers.js` | 换乘站标记（不做合并） |
| `split_gapped_lines.js` | 大间距分段 |
| `discover_lines.js` | AMap POI 发现线路（备用入口） |
| `post_process.js` | 后处理调度 |
| `references/` | 线路元数据缓存 |
| `archives/` | 预制 JSON 存档 |

---

## ⚙️ 架构原则

1. **轨道优先** — 先有轨道再安站点
2. **不合并换乘** — 各线站点保留在各自轨道上
3. **AMap 唯一** — 放弃 OSM，完全依赖 AMap API
4. **真实优先** — 找不到真实轨道时必须汇报，不允许直线插值替代

---

## 🛠️ 已知遗留问题

1. 支线名称偶有 Unicode 乱码（SH5Z/SH10Z/SH11Z 等）
2. 空路段未全部解决 — 用"线路名+地铁站"后缀查公交 API 可补
3. 有轨电车用通用兜底

---

<div align="center">
<br>
Made with ❤️ by <a href="https://github.com/connerfu">connerfu</a>
<br>
<sub>Powered by <a href="https://www.metroman.cn">MetroMan</a> + <a href="https://lbs.amap.com">AMap API</a></sub>
<br>
<sub>内置 AMap Key: c037d67ccb46f69c5f1b7a9b84c61e0e</sub>
</div>
