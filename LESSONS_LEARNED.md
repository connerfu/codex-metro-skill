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

## L9: 限频器死锁 + 并发信号量重写
- 现象: rateLimit+releaseRateLimit 未配对调用，第3次起队列死锁；AMap服务端限频，快速请求返回0结果
- 对策: 1) 删除旧限频器(含RATE_LIMIT_MS/CONCURRENCY/requestQueue) 2) 加3并发信号量concAcquire/concRelease在busLineSearch内部配对使用 3) 去掉pipeline中的800ms延时
- 来源: v5.6 修复

## L10: matchStationsToPolyline 搜索起点不走动导致坍塌
- 现象: searchStart = bestPi 导致多站匹配到 polyline 同一点，fixCollapsedCoords 也修不好
- 对策: searchStart = Math.max(bestPi + 1, searchStart + 3)，强制搜索起点前进
- 补充: fixCollapsedCoords 新增地理距离检测坍塌(50m阈值) + COLLAPSE_GAP=8
- 来源: v5.6 修复

## L11: 环线检测 + polyline缓存
- 现象: metroman数据未标记环线(isRing=undefined)，anchorsFromMatch收不到isRing参数，2/10号线缺闭合段
- 对策: generateAnchors加入er.line.loop==="1"检测环线；pipeline写入polyline缓存(references/{slug}_polylines.json)，AMap不可用时离线回退
- 来源: v5.6 修复

