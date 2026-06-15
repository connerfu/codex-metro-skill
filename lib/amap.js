// lib/amap.js — 统一的高德地图 API 入口模块
// v4.1: 串线过滤 + 内存缓存 + 一次写入

const AMAP_KEY = process.env.AMAP_KEY || "";
const { rawCachePath, skillPath, readJSON, writeJSON, ensureDir } = require("./io");

const RATE_LIMIT_MS = 100;
let lastRequestTime = 0;

// 内存缓存（避免重复读/写磁盘）
let memCache = null;
let memCacheFile = "";
let memCacheDirty = false;
let memCacheMigrated = false;

async function rateLimit() {
  const now = Date.now();
  const waitTime = Math.max(0, RATE_LIMIT_MS - (now - lastRequestTime));
  if (waitTime > 0) await new Promise(r => setTimeout(r, waitTime));
  lastRequestTime = Date.now();
}

function loadCache(slug) {
  const f = rawCachePath(slug);
  if (memCache && memCacheFile === f) return memCache;
  memCache = readJSON(f) || {};
  memCacheFile = f;
  memCacheDirty = false;
  // 一次性迁移旧格式
  if (!memCacheMigrated) {
    let changed = false;
    for (const k of Object.keys(memCache)) {
      if (k === "_version") continue;
      const v = memCache[k];
      if (v === null || Array.isArray(v)) {
        memCache[k] = { polyline: Array.isArray(v) ? v : null, lineName: null, raw: null, ts: 0 };
        changed = true;
      }
    }
    if (changed) { memCache._version = 2; memCacheDirty = true; }
    memCacheMigrated = true;
  }
  return memCache;
}

function flushCache() {
  if (memCacheDirty && memCacheFile) {
    ensureDir(require("path").dirname(memCacheFile));
    writeJSON(memCacheFile, memCache);
    memCacheDirty = false;
  }
}

async function amapRequest(path, options = {}) {
  if (!AMAP_KEY) { console.error("AMAP_KEY 环境变量未设置"); return null; }
  const { timeout = 10000, retries = 1 } = options;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await rateLimit();
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), timeout);
    try {
      const r = await fetch("https://restapi.amap.com" + path, { signal: ac.signal, headers: { "User-Agent": "CodexMetro/5.0" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) {
      if (attempt < retries) { await new Promise(r => setTimeout(r, 500)); continue; }
      return null;
    } finally { clearTimeout(tid); }
  }
  return null;
}

async function searchPOI(city, keywords, options = {}) {
  const { types = "150500", offset = 50, page = 1 } = options;
  const r = await amapRequest("/v3/place/text?key=" + AMAP_KEY + "&keywords=" + encodeURIComponent(keywords) + "&types=" + types + "&offset=" + offset + "&page=" + page + "&city=" + encodeURIComponent(city), { timeout: 8000 });
  return r && r.status === "1" ? (r.pois || []) : [];
}

async function geocode(address, city) {
  const r = await amapRequest("/v3/geocode/geo?key=" + AMAP_KEY + "&address=" + encodeURIComponent(address) + "&city=" + encodeURIComponent(city), { timeout: 10000 });
  if (r && r.status === "1" && r.geocodes && r.geocodes.length > 0) {
    const [lng, lat] = r.geocodes[0].location.split(",");
    return { lat: parseFloat(lat), lng: parseFloat(lng) };
  }
  return null;
}

function isRailTransit(busLine) {
  if (!busLine || !busLine.type) return false;
  const t = busLine.type;
  return t.includes("地铁") || t.includes("轨道") || t.includes("轻轨") ||
         t.includes("有轨电车") || t.includes("市郊") || t.includes("市域") ||
         t.includes("火车") || t.includes("铁路") || t.includes("机场") ||
         t.includes("磁浮") || t.includes("APM") || t.includes("云巴") ||
         t.includes("铁路");
}

function lineSearchPattern(lineName) {
  if (!lineName) return null;
  const m = lineName.match(/(\d+号线|S\d+线|T\d+线)/);
  if (m) return m[1];
  const named = lineName.match(/(亦庄|西郊|房山|燕房|昌平|首都机场|大兴机场|亦庄T|广佛|珠江|海珠|浦江|机场联络|金山|磁浮|坪山|南海|黄埔|空港|国博|环线|江跳|璧铜|津静|蓉二|资阳)线/);
  if (named) return named[0];
  return null;
}

function lineNameMatches(lineName, expectedPattern) {
  if (!lineName || !expectedPattern) return true;
  if (lineName.includes(expectedPattern)) return true;
  const expNum = expectedPattern.match(/\d+/);
  const actNum = lineName.match(/\d+/);
  if (expNum && actNum && expNum[0] === actNum[0]) {
    if (expectedPattern.includes("号线") && lineName.includes("号线")) return true;
  }
  return false;
}

function extractPolyline(result, expectedLine) {
  const resultObj = { polyline: null, lineName: null };
  if (!result || result.status !== "1") return null;
  const pattern = lineSearchPattern(expectedLine);
  const transits = result.route && result.route.transits || [];
  // 优先: 线路名匹配的rail transit
  for (const transit of transits) {
    for (const segment of (transit.segments || [])) {
      for (const busLine of (segment.bus && segment.bus.buslines || [])) {
        if (!busLine.polyline) continue;
        const nameMatch = pattern ? lineNameMatches(busLine.name, pattern) : true;
        if (isRailTransit(busLine) && nameMatch) {
          resultObj.polyline = busLine.polyline.split(";").map(p => { const [lng, lat] = p.split(",").map(Number); return { lng, lat }; });
          resultObj.lineName = busLine.name || null;
          return resultObj;
        }
      }
    }
  }
  // Fallback: 有polyline的rail transit（不检查线路名）
  for (const transit of transits) {
    for (const segment of (transit.segments || [])) {
      for (const busLine of (segment.bus && segment.bus.buslines || [])) {
        if (!busLine.polyline || busLine.polyline.length < 20) continue;
        if (isRailTransit(busLine)) {
          resultObj.polyline = busLine.polyline.split(";").map(p => { const [lng, lat] = p.split(",").map(Number); return { lng, lat }; });
          resultObj.lineName = busLine.name || null;
          return resultObj;
        }
      }
    }
  }
  return null;
}

async function getCachedTransitPolyline(origin, destination, city, strategy, slug, expectedLine) {
  if (!slug) return getTransitPolyline(origin, destination, city, strategy, expectedLine);
  const key = [origin.lat, origin.lng, destination.lat, destination.lng].map(v => v.toFixed(5)).join("|") + "|s" + strategy;
  const cache = loadCache(slug);

  const entry = cache[key];
  if (entry) {
    // 有原始AMap响应 → 可重新提取（不同expectedLine）
    if (entry.raw && entry.raw.status === "1") {
      const extracted = extractPolyline(entry.raw, expectedLine);
      if (extracted && extracted.polyline && extracted.polyline.length >= 4) {
        entry.polyline = extracted.polyline;
        entry.lineName = extracted.lineName;
        cache[key] = entry;
        memCacheDirty = true;
        return extracted.polyline;
      }
      // 有raw但提取失败
      if (entry.polyline !== null) { entry.polyline = null; cache[key] = entry; memCacheDirty = true; }
      return null;
    }
    // 旧缓存无raw → 使用polyline
    if (entry.polyline && entry.polyline.length >= 4) return entry.polyline;
    if (entry.polyline === null) return null;
  }

  // 未命中 → 查AMap
  const rawResult = await amapRequest(
    "/v3/direction/transit/integrated?key=" + AMAP_KEY +
    "&origin=" + origin.lng + "," + origin.lat +
    "&destination=" + destination.lng + "," + destination.lat +
    "&city=" + encodeURIComponent(city) + "&cityd=" + encodeURIComponent(city) +
    "&strategy=" + (strategy || 0) + "&nightflag=0",
    { timeout: 15000, retries: 1 }
  );
  const extracted = rawResult ? extractPolyline(rawResult, expectedLine) : null;
  const hasPolyline = extracted && extracted.polyline && extracted.polyline.length >= 4;
  cache[key] = {
    polyline: hasPolyline ? extracted.polyline : null,
    lineName: extracted ? extracted.lineName : null,
    raw: rawResult || null,
    ts: Date.now()
  };
  cache._version = 2;
  memCacheDirty = true;
  return hasPolyline ? extracted.polyline : null;
}


/**
 * 用 AMap 公交线路查询API 获取整条地铁线的全量轨道polyline
 * @param {string} lineKeyword - 搜索关键词，如"地铁7号线"、"西郊线"
 * @param {string} city - 城市名
 * @


param {string} slug - 城市slug（用于缓存）
 * @returns {{polyline: Array<{lat,lng}>, name: string}|null}
 */
async function getLinePolyline(lineKeyword, city, slug) {
  const cacheFile = skillPath("cache", slug + "_line_polylines.json");
  let cache = readJSON(cacheFile) || {};
  if (cache._version !== 2) { cache._version = 2; }

  if (cache[lineKeyword] !== undefined) {
    const cached = cache[lineKeyword];
    if (cached && cached.polyline && cached.polyline.length >= 4) {
return { polyline: cached.polyline, name: cached.name };
    }
    return null;
  }

  // QPS安全: bus/linename API 限流更严，内置重试
  for (let attempt = 0; attempt < 3; attempt++) {
    // 每次查询间至少等 500ms
    await new Promise(r => setTimeout(r, attempt > 0 ? 2000 : 500));
    await rateLimit();

    const url = "/v3/bus/linename?key=" + AMAP_KEY + "&keywords=" + encodeURIComponent(lineKeyword) + "&city=" + encodeURIComponent(city) + "&offset=1&page=1";
    const result = await amapRequest(url, { timeout: 10000, retries: 0 });

    if (!result) continue;

    // QPS超限 → 等待更长再试
    if (result.info && (result.info.includes("CUQPS_HAS_EXCEEDED") || result.info.includes("QPS"))) {
      console.log("    QPS limit hit, retrying in 3s...");
      await new Promise(r => setTimeout(r, 3000));
      continue;
    }

    if (result.status === "1" && result.buslines && result.buslines.length > 0) {
      // 取第一个匹配的线路（通常是最相关的）
      for (const bl of result.buslines) {
        if (bl.polyline && bl.polyline.length > 20) {
          const polyline = bl.polyline.split(";").map(function(p) {
            const parts = p.split(",");
            return { lng: parseFloat(parts[0]), lat: parseFloat(parts[1]) };
          });
          cache[lineKeyword] = { polyline: polyline, name: bl.name };
          cache._version = 2;
          ensureDir(require("path").dirname(cacheFile));
          writeJSON(cacheFile, cache);
return { polyline: polyline, name: bl.name };
        }
      }
    }
    break; // 非QPS错误不重试
  }

  cache[lineKeyword] = null;
  cache._version = 2;
  ensureDir(require("path").dirname(cacheFile));
  writeJSON(cacheFile, cache);
  return null;
}

async function getTransitPolyline(origin, destination, city, strategy, expectedLine) {
  const path = "/v3/direction/transit/integrated?key=" + AMAP_KEY +
    "&origin=" + origin.lng + "," + origin.lat +
    "&destination=" + destination.lng + "," + destination.lat +
    "&city=" + encodeURIComponent(city) + "&cityd=" + encodeURIComponent(city) +
    "&strategy=" + (strategy || 0) + "&nightflag=0";
  const result = await amapRequest(path, { timeout: 15000, retries: 1 });
  const extracted = extractPolyline(result, expectedLine);
  return extracted ? extracted.polyline : null;
}

module.exports = {
  amapRequest, searchPOI, geocode,
  getTransitPolyline, getCachedTransitPolyline, getLinePolyline,
  isRailTransit, extractPolyline, lineSearchPattern, lineNameMatches,
  flushCache
};






