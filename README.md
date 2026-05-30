# Codex Metro Skill

一键生成 Cities Designers (citiesdesigners.com) 城市地铁导入文件。

## 文件结构
```
codex-metro-skill/
├── SKILL.md              # 技能说明（Codex 读取）
├── metro_builder.js       # 核心构建脚本 v3.1
├── quick_start.ps1        # 一键启动脚本
├── openai.yaml            # 插件元数据
├── README.md              # 本文件
└── references/            # 城市线路定义
    ├── beijing_lines.json
    ├── changchun_lines.json
    ├── chongqing_lines.json
    ├── hangzhou_lines.json
    ├── nanjing_lines.json
    ├── shanghai_lines.json
    ├── shenyang_lines.json
    ├── tianjin_lines.json
    └── wuhan_lines.json
```

## 工作原理
1. **Overpass API** — 批量查询 OpenStreetMap 地铁站坐标（WGS84→GCJ02）
2. **高德 Geocoder** — 浏览器 CDP 批量补充未匹配站点（线号上下文查询）
3. **插值+外推** — 剩余站线性插值，端点方向外推

## 已支持城市
北京、上海、重庆、杭州、南京、天津、武汉、沈阳、长春

## 添加新城市
1. 创建 `references/{city}_lines.json`
2. 运行 `quick_start.ps1 {city} "{中文}" {minLat} {maxLat} {minLng} {maxLng}`
