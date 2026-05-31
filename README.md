<div align="center">

<img src="https://img.shields.io/badge/Codex_Metro_Skill-v3.5-blue?style=for-the-badge" alt="version">
<img src="https://img.shields.io/badge/28_Cities-8K_Stations-8A2BE2?style=for-the-badge" alt="cities">
<img src="https://img.shields.io/badge/Real_Track_Geometry-AMap_API-ff6600?style=for-the-badge" alt="track">
<img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="license">

<br>
<br>

# 🚇 Codex Metro Skill v3.5

### 🎯 真正还原现实地铁走向 · 拖进游戏直接玩

[![Stars](https://img.shields.io/github/stars/connerfu/codex-metro-skill?style=social)](https://github.com/connerfu/codex-metro-skill)

</div>

---

## 🔥 v3.5 重磅更新：真实轨道走向

v3.5 最大的突破是**不再用直线连接站点**。通过高德地图公交路径规划 API，每条线路的站点之间都按真实轨道走向生成曲线锚点，让地铁线路在游戏中**沿着现实中的轨道蜿蜒**，而不是生硬的直线。

> **北京 10 号线环线**：185 个轨道锚点，完美还原东三环到西三环的真实弧度
> **广州 3 号线**：166 个锚点，65km 超长线路不再是拉面
> **换乘站分离**：97% 换乘站自动根据出入口位置分离各线路站点

### 技术亮点
- 📡 **AMap 公交路径 API** 实时抓取轨道 polyline
- 🔄 **环线专用算法** 8 站重叠窗口 + 闭合段处理
- 🎯 **换乘站出口质心** 自动匹配线路归属
- 📏 **智能拆分** 中间未开通段的线路自动分段命名
- 🧹 **换乘站锚点裁剪** 消除站口视觉畸变

---

## 📌 这是什么？

对着 [Codex CLI](https://github.com/openai/codex) 说一句 **"复刻北京地铁"**，几秒钟后，一份包含完整站点、换乘、轨道锚点和班次的 [Cities Designers](https://www.citiesdesigners.com/) 存档就出现在你的下载文件夹。

> 🎯 **零手动**：不画线、不查坐标、不算班次
> 🛤️ **真实走向**：不是直线，是现实轨道的曲线
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

---

## 🛠️ 管线架构

```
metro_scraper.js → 抓取 metroman.cn 线路+站点+坐标
       ↓
metro_builder.js → 组装 JSON（换乘、班次、颜色）
       ↓
post_process.js  → 一站式后处理：
  ├── amap_anchors.js    → 高德公交API抓取真实轨道走向
  ├── fix_transfers.js   → 出口质心分离换乘站
  ├── fix_names.js       → 线路名标准化
  └── split_gapped_lines → 中间未开通段自动拆分
```

---

## 🚀 快速开始

```bash
# 安装 Codex CLI
npm install -g @openai/codex

# 安装本 skill
codex skills install connerfu/codex-metro-skill

# 复刻！
复刻北京地铁
复刻广州地铁
复刻上海地铁
```

---

<div align="center">
<br>
Made with ❤️ by <a href="https://github.com/connerfu">connerfu</a>
<br>
<sub>Powered by <a href="https://www.metroman.cn">MetroMan</a> + <a href="https://lbs.amap.com">AMap API</a></sub>
</div>