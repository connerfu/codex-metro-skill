<div align="center">

<img src="https://img.shields.io/badge/Codex_Metro_Skill-v3.1-blue?style=for-the-badge" alt="version">
<img src="https://img.shields.io/badge/28_Cities-8K_Stations-8A2BE2?style=for-the-badge" alt="cities">
<img src="https://img.shields.io/badge/Speed-%3C1s_(cached)-ff6600?style=for-the-badge" alt="speed">
<img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="license">

<br>
<br>

# 🚇 Codex Metro Skill

### 一句话复刻全国地铁 · 拖进游戏直接玩

[![Stars](https://img.shields.io/github/stars/connerfu/codex-metro-skill?style=social)](https://github.com/connerfu/codex-metro-skill)

</div>

---

## 📌 这是什么？

对着 [Codex CLI](https://github.com/openai/codex) 说一句 **"复刻北京地铁"**，几秒钟后，一份包含完整站点、换乘、班次的 [Cities Designers](https://www.citiesdesigners.com/) 存档就出现在你的下载文件夹。

> 🎯 **零手动**：不画线、不查坐标、不算班次
> ⚡ **亚秒级缓存**：二次跑同一城市 < 1 秒
> 📦 **28城打包**：下表每个城市都已生成，点击即下

---

## 🗺️ 支持城市

### 🏙️ 一线城市

| 城市 | 线路/站点 | 📥 下载 |
|:--|:--|:--|
| 北京 | 28线 / 539站 | [beijing_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/beijing_metro.json) |
| 上海 | 25线 / 544站 | [shanghai_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/shanghai_metro.json) |
| 广州 | 27线 / 503站 | [guangzhou_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/guangzhou_metro.json) |
| 深圳 | 18线 / 433站 | [shenzhen_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/shenzhen_metro.json) |

### 🏘️ 新一线城市

| 城市 | 线路/站点 | 📥 下载 |
|:--|:--|:--|
| 成都 | 19线 / 482站 | [chengdu_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/chengdu_metro.json) |
| 重庆 | 16线 / 342站 | [chongqing_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/chongqing_metro.json) |
| 杭州 | 18线 / 363站 | [hangzhou_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/hangzhou_metro.json) |
| 南京 | 15线 / 293站 | [nanjing_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/nanjing_metro.json) |
| 天津 | 13线 / 274站 | [tianjin_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/tianjin_metro.json) |
| 武汉 | 15线 / 335站 | [wuhan_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/wuhan_metro.json) |
| 西安 | 13线 / 274站 | [xian_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/xian_metro.json) |
| 郑州 | 11线 / 268站 | [zhengzhou_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/zhengzhou_metro.json) |
| 青岛 | 8线 / 176站 | [qingdao_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/qingdao_metro.json) |
| 苏州 | 9线 / 202站 | [suzhou_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/suzhou_metro.json) |
| 沈阳 | 6线 / 146站 | [shenyang_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/shenyang_metro.json) |

### 🏡 二三线城市

| 城市 | 线路/站点 | 📥 下载 |
|:--|:--|:--|
| 长春 | 6线 / 131站 | [changchun_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/changchun_metro.json) |
| 大连 | 5线 / 90站 | [dalian_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/dalian_metro.json) |
| 厦门 | 3线 / 56站 | [xiamen_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/xiamen_metro.json) |
| 无锡 | 5线 / 97站 | [wuxi_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/wuxi_metro.json) |
| 南宁 | 5线 / 101站 | [nanning_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/nanning_metro.json) |
| 东莞 | 2线 / 30站 | [dongguan_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/dongguan_metro.json) |
| 哈尔滨* | 建设中 | [haerbin_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/haerbin_metro.json) |
| 佛山* | 含于广州 | [foshan_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/foshan_metro.json) |
| 绍兴* | 含于杭州 | [shaoxing_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/shaoxing_metro.json) |
| 珠海* | 无运营线路 | [zhuhai_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/zhuhai_metro.json) |
| 咸阳* | 无运营线路 | [xianyang_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/xianyang_metro.json) |
| 乌鲁木齐* | 无运营线路 | [wulumuqi_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/wulumuqi_metro.json) |
| 中山* | 无运营线路 | [zhongshan_metro.json](https://github.com/connerfu/codex-metro-skill/blob/main/archives/zhongshan_metro.json) |

> \* 标记城市暂无运营地铁线路，文件为空档（游戏开新档用）

### 🌐 都市圈合并

| 名称 | 线路 | 站点 | 覆盖城市 | 📥 下载 |
|------|------|------|----------|------|
| **上海都市圈** | 39线 | 916站 | 上海+苏州+无锡 | [下载](https://github.com/connerfu/codex-metro-skill/blob/main/archives/%E4%B8%8A%E6%B5%B7%E9%83%BD%E5%B8%82%E5%9C%88_metro.json) |
| **大湾区** | 47线 | 976站 | 广州+深圳+东莞（含广佛线） | [下载](https://github.com/connerfu/codex-metro-skill/blob/main/archives/%E5%A4%A7%E6%B9%BE%E5%8C%BA_metro.json) |

> 🔗 上海都市圈花桥站实现沪苏跨城换乘

---

## ⚡ 速度基准

> Windows 11 · Node.js v24 · 清空缓存首次跑

```
┌────────────────────┬────────┬─────────────────────────────────────┐
│ 梯队               │ 耗时   │ 城市                                │
├────────────────────┼────────┼─────────────────────────────────────┤
│ 🏙️ 大型 (10-19s)   │ ~15s   │ 上海 广州 北京 成都 深圳 重庆 杭州 武汉│
│ 🏘️ 中型 (4-9s)     │ ~7s    │ 南京 天津 郑州 苏州 青岛 沈阳 西安     │
│ 🏡 小型 (1-3s)     │ ~2s    │ 南宁 长春 大连 无锡 厦门 东莞          │
│ 🏠 微型 (<1s)      │ ~0.5s  │ 哈尔滨 佛山 绍兴 珠海 咸阳 乌市 中山   │
├────────────────────┼────────┼─────────────────────────────────────┤
│ 📦 28城全跑         │ ~3min  │ 首次（清缓存）                       │
│ 🚀 缓存模式         │ ~10s   │ 二次运行全28城                       │
└────────────────────┴────────┴─────────────────────────────────────┘
```

| 优化历程 | 首次 | 缓存 | 提升 |
|----------|------|------|------|
| v2.0（串行） | ~30s/城 | ~8s/城 | - |
| v3.1（并行+快速通道） | **~7s/城** | **<0.5s/城** | 4x / 40x |

---

## 📱 版本进化

| 版本 | 核心突破 | 速度/城 | 准确度 | 亮点 |
|------|----------|---------|--------|------|
| v1.0 | 逐站地理编码 | 20分钟 | ★★★ | 启蒙 |
| v1.5 | 逐站POI搜索 | 2分钟 | ★★★ | 提速10x |
| v1.7 | +异常检测+缓存 | 1分钟 | ★★★★ | 可用了 |
| v2.0 | 线路批量POI | 25秒 | ★★★★ | 28城全通 |
| v3.0 | metroman数据源 | 8秒 | ★★★★★ | 自动支线+S线 |
| **v3.1** | **并行+都市圈** | **<1秒(缓存)** | ★★★★★ | **28城打包** |

**关键功能：**
- 🔀 自动支线检测（上海5/10/11、杭州3/6、广州3/14、重庆6等）
- 🅰️ S线全覆盖（南京S1-S9、北京S1等城郊线）
- 🔵 环线正确识别（北京2/10、上海4、广州11、成都7、重庆环线）
- 📛 特殊线路命名（杭海城际、绍兴地铁、宁滁线、资阳线、蓉2号线）
- 🏗️ 并行抓取（8并发坐标、6并发行车列表）
- ⚡ Builder快速通道（坐标100%跳过OSM/POI）

---

## 🧠 技术架构

```
┌──────────────────────────────────────────────────────────┐
│                     "复刻XX地铁"                          │
└──────────────────────┬───────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────┐
│              metro_scraper.js v2.2                        │
│                                                          │
│  metroman.cn ──→ 线路列表 (1s)                            │
│       │                                                  │
│       ├──→ 并行抓取站点列表 (6并发, ~2s)                    │
│       │    line-1: 32站 · line-2: 38站 · line-3: 24站...  │
│       │                                                  │
│       ├──→ 并行抓取站点坐标 (8并发, ~2s)                    │
│       │    上海火车站(121.45,31.24) · 人民广场(...)...      │
│       │                                                  │
│       ├──→ 自动支线检测 (Haversine)                        │
│       │    ratio > 3 → branch split                       │
│       │                                                  │
│       └──→ 缓存 (24h TTL)                                 │
│            cache/{slug}_lines.json + coords.json          │
└──────────────────────┬───────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────┐
│               metro_builder.js v7.11                      │
│                                                          │
│  Phase 0: 加载预坐标 → 100%匹配? ──YES──→ 快速通道 ──┐    │
│       │                                              │    │
│       NO──→ OSM/POI fallback                          │    │
│       │                                              │    │
│       ├──→ 异常检测 (15km阈值)                         │    │
│       ├──→ 插值修复                                    │    │
│       ├──→ 换乘匹配 (500m坐标半径)                      │    │
│       └──→ 班次计算 (2/4/6分钟间隔)                     │    │
│                           │                          │    │
│                           ▼                          ▼    │
│                    assemble output                        │
└──────────────────────┬───────────────────────────────────┘
                       ▼
            {城市}_metro.json 🎃
```

---

## 📦 快速开始

### 方式一：直接下载存档（推荐）

1. 在上方表格找到你的城市，点击 📥 下载
2. 拖 `*_metro.json` 进 Cities Designers 游戏
3. 🎃 开玩

### 方式二：用 Codex CLI 一键生成

```
复刻北京地铁
复刻上海地铁
复刻广州地铁
# ... 任意28城，文件出现在 Downloads/ 文件夹
```

### 方式三：命令行

```powershell
git clone https://github.com/connerfu/codex-metro-skill.git
$node = "$env:USERPROFILE\codex-node\node.exe"
& $node "metro_scraper.js" beijing "北京"
```

---

## 🔧 环境要求

| 组件 | 说明 |
|------|------|
| Node.js | v24+（Codex 内置） |
| 网络 | 需访问 metroman.cn |
| 高德 API Key | `c037d67ccb46f69c5f1b7a9b84c61e0e`（仅备用修正） |

---

## 📊 项目统计

```
  28 个城市存档     (archives/)
   2 个都市圈合并    (上海都市圈 / 大湾区)
 388 条地铁线路
~8,000 个站点
  4.5 MB 总数据量
```

---

## 🙏 致谢

- [metroman.cn](https://www.metroman.cn) — 地铁线路数据
- [高德地图](https://lbs.amap.com) — 备用坐标修正
- [Cities Designers](https://www.citiesdesigners.com) — 游戏本体
- [Codex CLI](https://github.com/openai/codex) — 运行平台
