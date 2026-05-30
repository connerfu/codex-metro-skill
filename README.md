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

---

## 📈 版本迭代

| 版本 | 坐标方案 | 速度 | 准确度 | 城市 |
|------|----------|------|--------|------|
| v1.0 | 逐站地理编码 | 20分钟/城 | ★★☆ | 1个 |
| v1.5 | 逐站POI搜索 | 2分钟/城 | ★☆☆ | 5个 |
| v1.7 | +异常检测+缓存 | 1分钟/城 | ★★★ | 8个 |
| **v2.0** | **线路批量POI** | **25秒/城** | **★★★★** | **28个** |

### 关键转折

- 😤 **坐标灾难**："常营站"能匹配到100公里外的同名地点，整条6号线废掉
- 💡 **换思路**：不查站名，查线路。"北京地铁6号线"一次查出所有站
- 🚀 **质变**：准确度从碰运气变成可控，速度缩短 40 倍

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

---

## ⚡ 快速开始

对着 Codex 说：**"复刻北京地铁"**

→ `下载/beijing_metro.json` → 拖进游戏 → 🎮

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

---

## 📦 安装

```bash
git clone https://github.com/connerfu/codex-metro-skill.git
```

设置 API Key：
```powershell
$env:AMAP_KEY = "你的高德Key"
```

---

## 🙏 致谢

高德地图 · OpenStreetMap · Cities Designers