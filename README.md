# 🚇 Codex Metro Skill v3.0

<div align="center">

**一句话复刻全国地铁 · 拖进游戏直接玩**

[![Version](https://img.shields.io/badge/version-3.0-blue)](https://github.com/connerfu/codex-metro-skill)
[![Cities](https://img.shields.io/badge/cities-28-green)]()
[![License](https://img.shields.io/badge/license-MIT-yellow)]()

</div>

---

## 💡 这是什么？

对着 [Codex CLI](https://github.com/openai/codex) 说一句 **"复刻北京地铁"**，十几秒后，一份完整的 [Cities Designers](https://www.citiesdesigners.com/) 存档就出现在你的下载文件夹里。

> 不用手动画线。不用查坐标。不用算班次。不用纠结换乘站。

---

## 📱 版本迭代

| 版本 | 核心突破 | 速度 | 准确度 | 城市 |
|------|----------|------|--------|------|
| v1.0 | 逐站地理编码 | 20分钟/城 | ★★★ | 1个 |
| v1.5 | 逐站POI搜索 | 2分钟/城 | ★★★ | 5个 |
| v1.7 | +异常检测+缓存 | 1分钟/城 | ★★★★ | 8个 |
| v2.0 | 线路批量POI | 25秒/城 | ★★★★ | 28个 |
| **v3.0** | **metroman数据源 + 自动支线 + S线** | **8秒/城** | **★★★★★** | **28个** |

### v3.0 新特性

- 🔀 **自动支线检测**：Haversine算法自动识别分叉（上海5/10/11号线、杭州3/6号线等）
- 🅰️ **S线支持**：南京S1-S9、北京S1等城郊线正确映射
- 🔵 **环线修复**：LID级别环线判断，重庆空港线/国博线不再误标为环线
- 📛 **特殊线名**：杭海城际、绍兴地铁、资阳线、宁滁线、蓉2号线等
- ⚡ **速度提升**：metroman.cn直接抓取，8秒完成一座城

---

## 🗺 支持城市（28个）

| 北京 | 上海 | 广州 | 深圳 | 成都 | 重庆 | 杭州 |
| 南京 | 天津 | 武汉 | 沈阳 | 长春 | 西安 | 郑州 |
| 青岛 | 苏州 | 无锡 | 厦门 | 佛山 | 南宁 | 大连 |
| 哈尔滨 | 东莞 | 珠海 | 绍兴 | 咸阳 | 乌鲁木齐 | 中山 |

---

## ⚡ 快速开始

对着 Codex 说：**"复刻北京地铁"**

→ `下载/beijing_metro.json` → 拖进游戏 → 🎃

---

## 🧠 原理

```
"复刻XX地铁"
      ↓
metro_scraper.js v2.2 (~5s)
   metroman.cn → 线路/站点/颜色/坐标
   24h缓存 → 二次运行秒出
      ↓
metro_builder.js v7.11 (~3s)
   坐标100%匹配 → 异常检测 → 换乘匹配 → 班次计算
      ↓
  {城市}_metro.json 🎃
```

---

## 📦 安装

```bash
git clone https://github.com/connerfu/codex-metro-skill.git
```

---

## 🙏 致谢

metroman.cn · 高德地图 · Cities Designers
