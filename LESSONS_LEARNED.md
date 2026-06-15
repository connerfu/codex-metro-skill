# LESSONS_LEARNED.md

## L1: AMap 限频
- 现象：并发 >2 或间隔 <1s 触发 429
- 对策：CONCURRENCY=2, RATE_LIMIT_MS=1000
- 来源：v4.1 实测

## L2: 换乘站合并导致脱轨
- 现象：多条线共享同一 station 对象 → Cities:Designers 轨道分离
- 对策：每条线独立 station 实例，仅用 same_station+transferGroupId 标记
- 来源：v3.x→v4.0 架构变更

## L3: 坐标系偏移
- 现象：WGS84 坐标直接用 → 偏移 300–500m
- 对策：所有 AMap 返回值已为 GCJ-02；外部数据源需 wgs2gcj 转换
- 来源：metro_builder.js v7.11

## L4: 重构总结
- 现象：项目完成 6 文件极简重构
- 对策：移除冗余脚本，剥离 IO 与计算，植入脏数据拦截与记忆闭环
- 来源：本次重构执行
