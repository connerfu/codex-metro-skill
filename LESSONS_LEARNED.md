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

## L5: Spec v2.0 对齐重构
- 现象：架构存在 5 处偏差（IO与计算未彻底分离、配置源冗余、拦截规则弱、无契约校验、路径散落）
- 对策：按 Spec v2.0 剥离纯逻辑至 transform、统一 config 源、强化拦截表与契约校验、收束路径
- 来源：Spec v2.0 终审

## L6: ElectBusLine 首末站匹配 - config乱码修复
- 现象: config/firstStop / lastStop 在非UTF8环境下为乱码，导致1号线选举匹配到支线
- 对策: 改用 metroman 返回的实际站点 metroStations[0].name / metroStations[-1].name 进行匹配
- 来源: v5.5→v5.6 修复

## L7: Polyline方向检测
- 现象: AMap返回的polyline方向与站点列表方向相反(东→西 vs 西→东)，导致全量失败
- 对策: 在匹配前比较首站到polyline首/末10点的距离，若首站更靠近末点则反转polyline
- 来源: v5.5→v5.6 修复

## L8: fixCollapsedCoords 全量重分配破坏原始坐标
- 现象: 原逻辑将所有站点均匀重分配给polyline，导致望京西站偏移1.3km
- 对策: 仅修复相邻collapse的站对(match[i].pi >= match[i+1].pi时给i+1分配pi+2)
- 来源: v5.5→v5.6 修复

## L9: 删除限频器
- 现象: rateLimit + releaseRateLimit 未配对调用，导致第3次请求起死锁，全量管线卡在第2条线
- 对策: 完全删除RATE_LIMIT_MS/CONCURRENCY限频机制，AMap请求不再做人为限频
- 来源: v5.6 修复

## L9: 限频器死锁
- 现象: rateLimit+releaseRateLimit未配对，第3次起队列死锁；AMap服务端自身也有限频，快速请求返回0结果
- 对策: 删除旧限频器，在generateAnchors循环中加800ms延迟避免触发AMap服务端限频
- 来源: v5.6 修复
