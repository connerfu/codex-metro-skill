---
name: replicate-metro-json
description: 28城地铁存档生成 for Cities Designers — AMap真实轨道·6文件极简架构
version: 5.0
---

# Metro Replicator v5.0 (重构版)

## 架构
6文件极简架构 + 1 记忆文件：

`
RefactoringSpecification/
├── LESSONS_LEARNED.md        # AI防呆手册（长期记忆库）
├── config/beijing.json       # 唯一城市数据配置
├── src/amap.js               # 唯一网络与缓存出口（IO）
├── src/transform.js          # 唯一纯业务逻辑（严禁IO）
├── src/pipeline.js           # 唯一业务编排（ETL）
└── bin/run.js                # 唯一CLI入口
`

## 快速开始
`
node bin/run.js --city beijing
node bin/run.js --all
node bin/run.js --city beijing --force
`

## 三级加速策略
| 级别 | 条件 | 耗时 |
|------|------|------|
| P0 | archives/{slug}_metro.json 存在 | ~0.1s 直接复制 |
| P1 | references/{slug}_lines.json 缓存命中 | ~15-30s |
| P2 | 新城市或 --force | ~60-120s |

## 数据源
- metroman.cn — 线路/站点数据
- AMap API — 真实轨道 polyline + 站点坐标
- OSM Overpass — 坐标补充

## 数据契约（不可变）
- slugs: beijing, shanghai, guangzhou, shenzhen, chengdu, chongqing, hangzhou, nanjing, tianjin, wuhan, shenyang, changchun, xian, zhengzhou, qingdao, suzhou, wuxi, xiamen, dalian, harbin, dongguan, nanning, foshan, shaoxing, zhuhai, zhongshan, urumqi, xianyang
