// src/amap.js — 网络与缓存 IO 的唯一出口（重构版 v8.0）
// 管辖所有外部网络请求（AMap POI/路径规划、metroman 抓取）及本地文件缓存读写
// 约束：限频 并发2/间隔1s（L1），AMAP_KEY 从 process.env.AMAP_KEY 读取
// 使用 Node.js 内置模块（https, fs, path），不使用第三方包

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ===== 常量 =====
const AMAP_KEY = process.env.AMAP_KEY || "";
const CACHE_TTL = 86400000; // 24h
const RATE_LIMIT_MS = 1000; // L1: 间隔 1s
const CONCURRENCY = 2;      // L1: 最大并发 2

// ===== 技能根目录（src/ 的父目录） =====
const SKILL_DIR = path.resolve(__dirname, "..");

// ===== 限频器 =====
let lastRequestTime = 0;
let activeRequests = 0;
const requestQueue = [];

/**
 * 限频：控制并发数 + 最小请求间隔
 * 每个 HTTP 请求前必须经过此函数
 * @returns {Promise<void>}
 */
async function rateLimit() {
  return new Promise(resolve => {
    const attempt = () => {
      if (activeRequests >= CONCURRENCY) {
        requestQueue.push(attempt);
        return;
      }
      const now = Date.now();
      const elapsed = now - lastRequestTime;
      if (elapsed < RATE_LIMIT_MS) {
        setTimeout(attempt, RATE_LIMIT_MS - elapsed);
        return;
      }
      activeRequests++;
      lastRequestTime = Date.now();
      resolve();
    };
    attempt();
  });
}

/**
 * 释放限频槽位，唤醒下一个排队请求
 */
function releaseRateLimit() {
  activeRequests = Math.max(0, activeRequests - 1);
  if (requestQueue.length > 0) {
    const next = requestQueue.shift();
    next();
  }
}

// ===== 通用 HTTP GET 请求 =====
/**
 * 通用 HTTP GET 请求，超时自动返回空字符串
 * @param {string} url - 请求地址
 * @param {number} timeout - 超时时间（ms），默认 15000
 * @returns {Promise<string>}
 */
function fetchUrl(url, timeout = 15000) {
  return new Promise(resolve => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; resolve(""); }
    }, timeout);
    const protocol = url.startsWith("https") ? https : http;
    protocol.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(data);
      });
    }).on("error", () => {
      if (!done) { done = true; clearTimeout(timer); resolve(""); }
    });
  });
}

// ===== AMap API 请求（带限频+重试） =====
/**
 * AMap API GET 请求（自动拼接 key + 限频 + 重试）
 * @param {string} apiPath - API 路径（如 /v3/place/text）
 * @param {{timeout?: number, retries?: number}} options
 * @returns {Promise<object|null>}
 */
async function amapGet(apiPath, options = {}) {
  if (!AMAP_KEY) {
    console.error("[amap] AMAP_KEY 环境变量未设置");
    return null;
  }
  const { timeout = 10000, retries = 1 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    await rateLimit();
    try {
      const raw = await fetchUrl(
        "https://restapi.amap.com" + apiPath,
        timeout
      );
      if (!raw) throw new Error("Empty response");
      return JSON.parse(raw);
    } catch (e) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      return null;
    } finally {
      releaseRateLimit();
    }
  }
  return null;
}

// ===== AMap 业务接口 =====

/**
 * POI 搜索（/v3/place/text）
 * @param {string} city - 城市名
 * @param {string} keywords - 搜索关键词
 * @param {{types?: string, offset?: number, page?: number}} options
 * @returns {Promise<Array>}
 */
async function searchPOI(city, keywords, options = {}) {
  const { types = "150500", offset = 50, page = 1 } = options;
  const qs = `key=${AMAP_KEY}&keywords=${encodeURIComponent(keywords)}&types=${types}&offset=${offset}&page=${page}&city=${encodeURIComponent(city)}`;
  const result = await amapGet("/v3/place/text?" + qs, { timeout: 8000 });
  return result && result.status === "1" ? (result.pois || []) : [];
}

/**
 * 地理编码（/v3/geocode/geo）
 * @param {string} address - 地址
 * @param {string} city - 城市名
 * @returns {Promise<{lat: number, lng: number}|null>}
 */
async function geocode(address, city) {
  const qs = `key=${AMAP_KEY}&address=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}`;
  const result = await amapGet("/v3/geocode/geo?" + qs, { timeout: 10000 });
  if (result && result.status === "1" && result.geocodes && result.geocodes.length > 0) {
    const [lng, lat] = result.geocodes[0].location.split(",");
    return { lat: parseFloat(lat), lng: parseFloat(lng) };
  }
  return null;
}

/**
 * 公交线路名搜索（/v3/bus/linename）
 * @param {string} keywords - 搜索关键词
 * @param {string} city - 城市名
 * @returns {Promise<Array>}
 */
async function busLineSearch(keywords, city) {
  const qs = `key=${AMAP_KEY}&keywords=${encodeURIComponent(keywords)}&city=${encodeURIComponent(city)}&offset=5&page=1&extensions=all`;
  const result = await amapGet("/v3/bus/linename?" + qs, { timeout: 10000, retries: 2 });
  if (result && result.status === "1" && result.buslines && result.buslines.length > 0) {
    return result.buslines;
  }
  return [];
}

/**
 * 路径规划 — 获取轨道交通 polyline（/v3/direction/transit/integrated）
 * @param {{lat: number, lng: number}} origin - 起点
 * @param {{lat: number, lng: number}} destination - 终点
 * @param {string} city - 城市名
 * @param {number} strategy - 策略（默认0）
 * @param {string} [expectedLine] - 期望线路名（用于过滤）
 * @returns {Promise<Array<{lat: number, lng: number}>|null>}
 */
async function getTransitPolyline(origin, destination, city, strategy = 0, expectedLine) {
  const qs = `key=${AMAP_KEY}&origin=${origin.lng},${origin.lat}&destination=${destination.lng},${destination.lat}&city=${encodeURIComponent(city)}&cityd=${encodeURIComponent(city)}&strategy=${strategy}&nightflag=0`;
  const result = await amapGet("/v3/direction/transit/integrated?" + qs, { timeout: 15000, retries: 1 });

  if (!result || result.status !== "1") return null;

  const transits = result.route && result.route.transits || [];
  for (const transit of transits) {
    for (const segment of (transit.segments || [])) {
      for (const busLine of (segment.bus && segment.bus.buslines || [])) {
        if (!busLine.polyline) continue;
        const type = busLine.type || "";
        // 只取轨道交通类型
        if (!type.includes("地铁") && !type.includes("轨道") && !type.includes("轻轨") &&
            !type.includes("有轨电车") && !type.includes("磁浮") && !type.includes("APM") &&
            !type.includes("云巴") && !type.includes("市域") && !type.includes("市郊") &&
            !type.includes("铁路") && !type.includes("火车") && !type.includes("机场")) continue;
        // 线路名校验
        if (expectedLine) {
          const expNum = expectedLine.match(/\d+/);
          const actNum = (busLine.name || "").match(/\d+/);
          if (expNum && actNum && expNum[0] !== actNum[0]) continue;
        }
        // 解析 polyline 字符串 → 坐标数组
        return busLine.polyline.split(";").map(p => {
          const parts = p.split(",");
          return { lng: parseFloat(parts[0]), lat: parseFloat(parts[1]) };
        });
      }
    }
  }
  return null;
}

// ===== OSM Overpass API =====

/**
 * OSM Overpass API 查询地铁站节点
 * @param {Array<number>} bbox - [minLat, maxLat, minLng, maxLng]
 * @returns {Promise<Array>}
 */
async function queryOverpass(bbox) {
  const [minLat, maxLat, minLng, maxLng] = bbox;
  const body = `[out:json][timeout:15];(
    node["railway"="station"]["station"="subway"](${minLat},${minLng},${maxLat},${maxLng});
    node["railway"="tram_stop"](${minLat},${minLng},${maxLat},${maxLng});
    node["railway"="station"]["station"~"light_rail|monorail|maglev"](${minLat},${minLng},${maxLat},${maxLng});
  );out body;`;

  const mirrors = [
    "overpass-api.de",
    "overpass.kumi.systems",
    "overpass.openstreetmap.fr"
  ];

  for (const host of mirrors) {
    try {
      const raw = await fetchUrl(
        `https://${host}/api/interpreter?data=${encodeURIComponent(body)}`,
        10000
      );
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.elements && parsed.elements.length > 0) return parsed.elements;
      }
    } catch {
      continue;
    }
  }
  return [];
}

// ===== 文件缓存 =====

/**
 * 读取 JSON 文件，支持 TTL 过期检测
 * @param {string} filePath - 文件路径
 * @param {number} [ttl=CACHE_TTL] - 过期时间（ms），0 或负数表示永不过期
 * @returns {object|null}
 */
function readJSON(filePath, ttl = CACHE_TTL) {
  try {
    if (!fs.existsSync(filePath)) return null;
    var raw = fs.readFileSync(filePath, "utf8");
    if (ttl > 0) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed._ts && Date.now() - parsed._ts > ttl) return null;
      var stat = fs.statSync(filePath);
      if (Date.now() - stat.mtimeMs > ttl) return null;
    }
    return JSON.parse(raw);
  } catch (e) { return null; }
}/**
 * 写入 JSON 文件（自动确保目录存在）
 * @param {string} filePath - 文件路径
 * @param {object} data - 数据对象
 */
function writeJSON(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

/**
 * 确保目录存在，不存在则递归创建
 * @param {string} dirPath
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ===== 路径工具 =====

/**
 * 拼接技能根目录下的路径
 * @param {...string} parts - 路径片段
 * @returns {string}
 */
function skillPath(...parts) {
  return path.join(SKILL_DIR, ...parts);
}

/**
 * 拼接用户 Downloads 目录路径
 * @param {string} filename
 * @returns {string}
 */
function downloadPath(filename) {
  return path.join(os.homedir(), "Downloads", filename);
}

/**
 * 拼接 references/{slug}_lines.json 路径
 * @param {string} slug - 城市 slug
 * @returns {string}
 */
function refPath(slug) {
  return skillPath("references", slug + "_lines.json");
}

/**
 * 拼接 cache/{slug}_raw_polylines.json 路径
 * @param {string} slug - 城市 slug
 * @returns {string}
 */
function cachePath(filename) {
  return skillPath("cache", filename);
}

// ===== metroman.cn 爬取 =====

/**
 * 从 metroman.cn 爬取城市线路列表（颜色、编号）
 * @param {string} slug - 城市 slug
 * @returns {Promise<Array<{num: number, color: string, slug: string}>>}
 */
async function fetchMetroLines(slug) {
  const html = await fetchUrl(`https://www.metroman.cn/cities/${slug}/lines`);
  if (!html) return [];

  const lines = [];
  const regex = /href="\/cities\/[^"]+\/lines\/line-(\d+)"[^>]*>[\s\S]*?--line-color:\s*([#0-9A-Fa-f]+)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    lines.push({
      num: parseInt(match[1]),
      color: match[2],
      slug: `line-${match[1]}`
    });
  }
  return lines;
}

/**
 * 从 metroman.cn 爬取某线路的车站列表
 * @param {string} slug - 城市 slug
 * @param {number|string} lineNum - 线路编号
 * @param {string} [cityName] - 城市中文名（用于过滤头部导航）
 * @returns {Promise<Array<{name: string, slug: string}>>}
 */
async function fetchMetroStations(slug, lineNum, cityName) {
  const html = await fetchUrl(`https://www.metroman.cn/cities/${slug}/lines/line-${lineNum}`);
  if (!html) return [];

  const stations = [];
  const seen = new Set();
  const regex = /href="(\/cities\/[^/]+\/stations\/([^"]+))"[^>]*>([^<]+)<\/a>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const name = match[3].trim();
    if (name === cityName || name.length < 2 || seen.has(name)) continue;
    seen.add(name);
    stations.push({ name, slug: match[1] });
  }
  return stations;
}

/**
 * 从 metroman.cn 爬取指定车站的坐标
 * @param {string} stationPath - 车站路径（如 /cities/beijing/stations/...）
 * @returns {Promise<{lng: number, lat: number}|null>}
 */
async function fetchMetroCoord(stationPath) {
  const html = await fetchUrl(`https://www.metroman.cn${stationPath}`);
  if (!html) return null;
  const posMatch = html.match(/position=([\d.]+),([\d.]+)/);
  if (posMatch) {
    return { lng: parseFloat(posMatch[1]), lat: parseFloat(posMatch[2]) };
  }
  return null;
}

// ===== 导出 =====
module.exports = {
  fetchUrl,
  amapGet,
  searchPOI,
  geocode,
  busLineSearch,
  getTransitPolyline,
  queryOverpass,
  readJSON,
  writeJSON,
  skillPath,
  downloadPath,
  refPath,
  cachePath,
  ensureDir,
  rateLimit,
  fetchMetroLines,
  fetchMetroStations,
  fetchMetroCoord
};
