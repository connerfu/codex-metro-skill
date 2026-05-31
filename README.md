# 🚇 Codex Metro Skill v3.1

<div align="center">

**一句话复刻全国地铁 · 拖进游戏直接玩 · 28城一键生成**

[![Version](https://img.shields.io/badge/version-3.1-blue)](https://github.com/connerfu/codex-metro-skill)
[![Cities](https://img.shields.io/badge/cities-28-green)]()
[![Speed](https://img.shields.io/badge/speed-8s/city-orange)]()
[![License](https://img.shields.io/badge/license-MIT-yellow)]()

</div>

---

## 💡 这是什么？

对着 [Codex CLI](https://github.com/openai/codex) 说一句 **"复刻北京地铁"**，几秒钟后一份完整的 [Cities Designers](https://www.citiesdesigners.com/) 存档就出现在你的下载文件夹。拖进游戏直接玩，不用手动画线、查坐标、算班次、纠结换乘站。

**28城已打包，开箱即用：** 直接去 [`archives/`](https://github.com/connerfu/codex-metro-skill/tree/main/archives) 下载任意城市的 `*_metro.json` 文件。

---

## 🏙️ 支持城市（28个 + 2个都市圈）

| | | | | | | |
|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 🏛️ 北京 | 🏙️ 上海 | 🌆 广州 | 🌃 深圳 | 🐼 成都 | 🔥 重庆 | 🌊 杭州 |
| 🏯 南京 | 🎡 天津 | 🚢 武汉 | ❄️ 沈阳 | 🌲 长春 | 🏺 西安 | 🚉 郑州 |
| 🌊 青岛 | 🏘️ 苏州 | 🏭 无锡 | 🎭 厦门 | ⚓ 大连 | 🧊 哈尔滨 | 💼 东莞 |
| 🌴 南宁 | 🏮 佛山 | 🏞️ 绍兴 | 🏖️ 珠海 | 🏛️ 咸阳 | 🕌 乌鲁木齐 | 🏠 中山 |

**都市圈合并：** [`上海都市圈`](https://github.com/connerfu/codex-metro-skill/blob/main/archives/%E4%B8%8A%E6%B5%B7%E9%83%BD%E5%B8%82%E5%9C%88_metro.json) 39线 916站（沪苏锡） · [`大湾区`](https://github.com/connerfu/codex-metro-skill/blob/main/archives/%E5%A4%A7%E6%B9%BE%E5%8C%BA_metro.json) 47线 976站（广深莞含广佛线）

---

## ⚡ 速度基准（首次跑，清缓存，28城实测）

| 梯队 | 耗时 | 城市 |
|------|------|------|
| 🏙️ 大型 | 10~19s | 上海(19s) 广州(15s) 北京(14s) 成都(13s) 深圳(12s) 重庆(11s) 杭州(11s) 武汉(11s) 西安(10s) |
| 🏘️ 中型 | 4~9s | 南京(9s) 天津(9s) 郑州(8s) 苏州(7s) 青岛(5s) 沈阳(4s) |
| 🏡 小型 | 1~3s | 南宁(3s) 长春(3s) 大连(3s) 无锡(2s) 厦门(2s) 东莞(1s) |
| 🏠 微型 | <1s | 哈尔滨 佛山 绍兴 珠海 咸阳 乌鲁木齐 中山 |

**28城全跑完：~3分钟** | **缓存模式：~10秒全搞定**

---

## 📱 版本进化

| 版本 | 核心突破 | 速度 | 城市 | 亮点 |
|------|----------|------|------|------|
| v1.0 | 逐站地理编码 | 20min/城 | 1 | 雏形 |
| v2.0 | 线路批量POI | 25s/城 | 28 | 质变 |
| v3.0 | metroman数据源 | 8s/城 | 28 | 自动支线+S线 |
| **v3.1** | **速度+打包** | **~1s(缓存)** | **28+2** | **并行抓取+都市圈合并** |

---

## 🧠 工作原理

```
"复刻XX地铁"
      ↓
metro_scraper.js v2.2
  ├── metroman.cn → 线路/站点/配色/坐标（并行抓取，8并发）
  ├── 自动支线检测（Haversine算法）
  ├── 24h缓存 → 二次运行亚秒级
      ↓
metro_builder.js v7.11
  ├── 坐标100%匹配 → 跳过OSM/POI快速通道
  ├── 异常检测 → 换乘匹配 → 班次计算
      ↓
  {城市}_metro.json 🎃
```

---

## 📦 安装使用

```bash
git clone https://github.com/connerfu/codex-metro-skill.git

# 方式1：直接下载存档
# → 去 archives/ 下载城市 JSON → 拖进游戏

# 方式2：一键生成（需要 Codex CLI）
# 对着 Codex 说 "复刻北京地铁"
```

---

## 🙏 致谢

metroman.cn · 高德地图 · Cities Designers · Codex CLI
