# 🚇 Codex Metro Skill v2.0

> **"复刻北京地铁"** — 一句话，十几秒，导入文件直接拖进游戏。

## 这是什么

把真实世界的地铁网络，一键变成 [Cities Designers](https://www.citiesdesigners.com/) 可导入的存档。

不用手动画线。不用查坐标。不用算班次。不用纠结换乘站。

## 能复刻的城市

Cities Designers 上有地铁的城市，理论上都能复刻。以下是已验证可用的：

| 已支持 | 一句话即可 |
|--------|-----------|
| 🇨🇳 北京 (26线) | 🇨🇳 广州 | 🇨🇳 长春 |
| 🇨🇳 上海 | 🇨🇳 深圳 | 🇨🇳 西安 |
| 🇨🇳 成都 (含支线) | 🇨🇳 重庆 | 🇨🇳 郑州 |
| 🇨🇳 杭州 | 🇨🇳 南京 | 🇨🇳 青岛 |
| 🇨🇳 天津 | 🇨🇳 武汉 | 🇨🇳 沈阳 |

没有你的城市？`discover_lines.js` 自动发现线路，`metro_builder.js` 一键出图。所有有地铁的中国城市都能做。

---

## 快速开始

```powershell
# 对着 Codex 说：
复刻北京地铁
```

→ 文件出现在 `下载` 文件夹 → 拖进游戏 → 开始运营。

需要高德地图 API Key（免费注册：https://lbs.amap.com）。

---

## 原理

```
"复刻XX地铁"
    │
    ▼
discover_lines.js     发现所有线路+站点（高德 POI，~10s）
    │
    ▼
metro_builder.js      批量坐标、异常检测、插值修复（~15s）
    │
    ▼
{城市}_metro.json     拖进游戏
```

### v2.0 核心突破：线路批量 POI 填充

| 方法 | 速度 | 准确度 | 问题 |
|------|------|--------|------|
| ~~逐站地理编码~~ | 🐌 极慢 | ★★★ | "常营站"能匹配到100km外 |
| ~~逐站 POI 搜索~~ | 🚀 快 | ★☆ | 返回完全不相关的站点 |
| **线路批量 POI** | 🚀 快 | ★★★★ | 一条线一次查询，AMap 知道哪站在哪条线 |

**教训**：不要一站一站查。一条线一条线查。

---

## 文件结构

```
codex-metro-skill/
├── SKILL.md              Codex 技能定义
├── metro_builder.js      核心引擎
├── discover_lines.js     自动发现线路
├── quick_start.ps1       一键脚本
├── warm_osm_cache.ps1    OSM 缓存预热
└── references/           已支持城市的线路数据
```

## 依赖

- **高德地图 API Key**（免费）
- **Node.js** v18+
- 可选：百度地图 API Key（三级回退）

## 致谢

高德地图 · OpenStreetMap · Cities Designers 团队