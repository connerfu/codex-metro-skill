---
name: replicate-metro-json
description: >
  Generate Cities Designers-compatible metro JSON for Chinese cities.
  Say "复刻北京地铁" / "复刻广州地铁" / "复刻XX地铁" to auto-discover
  lines, stations, transfers, headways, colors, and real track geometry
  (AMap polyline). Supports 28 cities with local cache. Output goes to
  Downloads/{slug}_metro.json — drag & drop into game.
keywords:
  - 复刻地铁
  - metro
  - 城市设计师
  - Cities Designers
  - amap
  - metroman
version: 4.1
---

# Metro Replicator v4.1

高精度中国地铁 JSON 生成工具。支持 28 城、真实轨道走向（AMap polyline）、换乘分离。
车型统一 A 型 8 编组。

---

## 使用方法

### 一句话触发
> **"复刻{城市名}地铁"**

**示例：**
| 用户输入 | 输出文件 |
|---------|---------|
| `复刻北京地铁` | `Downloads/beijing_metro.json` |
| `复刻广州地铁` | `Downloads/guangzhou_metro.json` |
| `复刻上海地铁` | `Downloads/shanghai_metro.json` |
| `复刻成都地铁` | `Downloads/chengdu_metro.json` |

**支持的城市（28 个）：**
北京、上海、广州、深圳、武汉、成都、重庆、杭州、南京、西安、天津、郑州、苏州、青岛、大连、沈阳、长春、东莞、南宁、厦门、无锡、佛山、哈尔滨、绍兴、乌鲁木齐、咸阳、中山、珠海、上海都市圈、大湾区

---

## 速度优化：三级加速策略

根据缓存命中情况，自动选择最快的执行路径：

### 🚀 P0 — 秒级路径（存档命中）
```
条件: archives/{slug}_metro.json 存在
耗时: ~0.1 秒
操作: 直接复制到 Downloads/{slug}_metro.json
跳过: 整个管线（discover → builder → post-process）
```

### ⚡ P1 — 快速路径（缓存命中）
```
条件: references/{slug}_lines.json 存在
      cache/{slug}_coords.json 存在（可选）
      cache/{slug}_lines.json 存在（可选）
耗时: ~15-30 秒
操作: 跳过 discover_lines.js，直接跑 metro_builder.js + post_process.js
跳过: 线路发现（最耗时的网络爬取）
```

### 🐢 P2 — 完整路径（新城市）
```
条件: 以上缓存均未命中
耗时: ~60-120 秒
操作: 全管线运行
```

### 执行决策树

```
用户说 "复刻XX地铁"
├→ 解析城市名 → 查找 city_config.json slug
│
├→ 检查 archives/{slug}_metro.json
│  ✅ 存在 → 直接复制到 Downloads → 完成（P0）
│
├→ 检查 references/{slug}_lines.json
│  ✅ 存在 → 跳过 Step 1，从 Step 2 开始（P1）
│
└→ ❌ 都不存在 → 全流程（P2）
```

---

## 工作流程

### Step 1: 线路发现 — discover_lines.js
```
🛑 CHECKPOINT: 确认城市名 slug（仅 P2 路径执行）
条件: 仅在 references/{slug}_lines.json 不存在时运行

输入:  slug, cnName
输出:  references/{slug}_lines.json（线路+站点+坐标元数据）
方法:  从 metroman.cn 爬取线路数据 + AMap POI 补充坐标
耗时:  ~30-60s（网络爬取）

🔴 失败: metroman.cn 不可用 → 提示手动提供 metroman 页面 URL
🔴 失败: 找不到该城市线路 → 提示用户确认城市名拼写
```

### Step 2: 构建 JSON — metro_builder.js
```
条件: 始终需要 references/{slug}_lines.json（来自 Step 1 或缓存）
     如果 cache/{slug}_coords.json 存在 → 自动跳过坐标填充（节省 ~20s）

输入:  slug, cnName, bbox 四至
输出:  Downloads/{slug}_metro.json（含站点、线路、换乘、班次、颜色）
方法:  从 metroman + AMap POI 获取坐标 → 组装完整 JSON
耗时:  ~10-20s（含 AMap POI 填充 + 异常检测 + 插值）

🔴 失败: AMap API 限频 → 增加延迟自动重试
🔴 失败: JSON 生成不完整 → 检查网络后重试
```

### Step 3: 后处理 — post_process.js
```
条件: 始终执行（除非直接从 archives 复制）
通过 post_process.js 一站式运行，包含 4 个子步骤：

┌─ [并行组 A] ─────────────────────────────┐
│  3a. 轨道锚点 ── amap_anchors.js          │  ← 网络 I/O 密集型
│      并发: 4 通道并行 → AMap API
│      窗宽: [7,9,11,5]（环线 8 站重叠窗）
│      🔴 AMap 限频 → 自动 100ms 间隔 + 自动重试
│      🔴 无 polyline → 降级为直线段 + 日志
│     耗时: ~15-30s（网络请求，并发4通道）
└───────────────────────────────────────────┘

┌─ [并行组 B] ─────────────────────────────┐
│  3b. 换乘分离 ── fix_transfers.js         │  ← CPU 密集型
│      智能 k-means 聚类 + 特殊线路映射
│      🔴 聚类异常 → 回退到距离阈值法 50m
│     耗时: ~1-3s
│                                          │
│  3c. 线路名标准化 ── fix_names.js          │  ← CPU 密集型
│      🔴 非常规命名 → 保持原名 + 日志
│     耗时: ~0.5s
│                                          │
│  3d. 未贯通段拆分 ── split_gapped_lines.js │  ← CPU 密集型
│      🔴 拆分冲突 → 手动确认拆分点
│     耗时: ~0.5s
└───────────────────────────────────────────┘

🛑 CHECKPOINT: 生成完成 → 提示输出路径 → 拖入游戏
```

> **性能提示**: 组 A（AMap 网络请求）和组 B（本地计算）可并行运行。
> `post_process.js` 已自动处理并行调度，无需手动干预。

---

## 批量操作

### 批量生成多个城市
```
"生成所有城市地铁存档" → node batch_gen.js
  - Step 1: 所有城市的 metro_builder 顺序执行
  - Step 2: post_process 最大 3 路并行
  - 完成后检查 archives/ 目录
```

### 单个城市预热缓存
```
"预热北京缓存" → 检查 cache/beijing_coords.json
  ✅ 已缓存 → 跳过
  ❌ 未缓存 → 按需抓取
```

---

## 文件结构

| 路径 | 用途 |
|------|------|
| `SKILL.md` | 本文件 — 技能入口 |
| `discover_lines.js` | Step 1: 线路发现（metroman.cn 爬取） |
| `metro_builder.js` | Step 2: JSON 构建（坐标填充 + 组装） |
| `post_process.js` | Step 3: 后处理（并行调度） |
| `amap_anchors.js` | 3a: AMap 轨道 polyline（并发 4 通道） |
| `fix_transfers.js` | 3b: k-means 换乘分离 |
| `fix_names.js` | 3c: 线路名标准化 |
| `split_gapped_lines.js` | 3d: 未贯通段拆分 |
| `batch_gen.js` | 批量生成所有城市（3 路并行） |
| `metro_scraper.js` | 底层爬虫（metroman.cn） |
| `query_station.js` | 站点查询工具 |
| `city_config.json` | 28 城配置 |
| `references/` | 线路元数据缓存 |
| `cache/` | 坐标缓存 |
| `archives/` | 预制 JSON 存档（28 城） |
| `test-prompts.json` | 测试集 |

---

## 输出格式

生成的 JSON 结构：

```json
{
  "slug": "beijing",
  "lines": [
    {
      "name": "1号线",
      "color": "#C23A30",
      "stations": [
        { "name": "建国门", "lat": 39.908, "lng": 116.459, "is_transfer": true }
      ],
      "headways": [120, 180, 240, 300, 360],
      "anchors": [{ "lat": 39.909, "lng": 116.460 }]
    }
  ]
}
```

输出: `Downloads/{slug}_metro.json` → 直接拖入 Cities Designers 游戏。

---

## Runtime 兼容性

| 平台 | Skill 路径 |
|------|-----------|
| Codex | `~/.codex/skills/replicate-metro-json/` |
| Claude Code | `~/.claude/skills/replicate-metro-json/` |

**依赖：** Node.js (>=16)、AMap API Key（默认已配置）、网络连接
**注意：** 所有脚本使用 `__dirname` 自动适配路径
