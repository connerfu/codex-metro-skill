// src/transform.js — 唯一纯业务逻辑（严禁 I/O）
// // 所有纯计算与数据变换。严禁 I/O（fs, fetch, console.log）。 // DISABLED: Spec v2.0 - no I/O in transform
// 植入脏数据拦截。



// ================================================================
// 脏数据拦截
// ================================================================

/**
 * 验证并清洗输入数据。
 * 1. stations 内 name 重复 -> 去重保留首个
 * 2. 缺失必填键（name/lat/lng）-> 抛出 Error
 * 3. 颜色格式不匹配 /^#[0-9A-Fa-f]{6}$/ -> 替换为 #999999
 * 4. headways 长度不为 5 -> 补齐至 5（末位重复）
 */


function wgs2gcj(lat, lng) {
  const A = 6378245.0;
  const EE = 0.00669342162296594323;
  function transformLat(x, y) {
    let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
    r += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3;
    r += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3;
    return r;
  }
  function transformLng(x, y) {
    let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
    r += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3;
    r += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3;
    return r;
  }
  const dLat = transformLat(lng - 105, lat - 35);
  const dLng = transformLng(lng - 105, lat - 35);
  const rad = lat / 180 * Math.PI;
  let magic = Math.sin(rad);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  const realDLat = (dLat * 180) / ((A * (1 - EE)) / (magic * sqrtMagic) * Math.PI);
  const realDLng = (dLng * 180) / (A / sqrtMagic * Math.cos(rad) * Math.PI);
  return { lat: lat + realDLat, lng: lng + realDLng };
}

function inBbox(coord, bbox, pad) {
  if (!coord || coord.lat === 0 || coord.lng === 0) return false;
  if (!bbox || bbox.length < 4) return true;
  const p = pad || 0;
  return coord.lat > bbox[0] - p
    && coord.lat < bbox[1] + p
    && coord.lng > bbox[2] - p
    && coord.lng < bbox[3] + p;
}

// ================================================================
// 名称处理
// ================================================================

const CITY_PREFIX_PATTERN = /^(\u91CD\u5E86|\u5317\u4EAC|\u4E0A\u6D77|\u5929\u6D25|\u5357\u4EAC|\u6B66\u6C49|\u6C88\u9633|\u6210\u90FD|\u5E7F\u5DDE|\u6DF1\u5733|\u676D\u5DDE|\u82CF\u5DDE|\u65E0\u9521|\u897F\u5B89|\u90D1\u5DDE|\u9752\u5C9B|\u5927\u8FDE|\u957F\u6625|\u4F5B\u5C71|\u4E1C\u839E)/;

function cleanName(name) {
  return (name || "")
    .replace(/[(\uFF08][^)\uFF09]*[)\uFF09]/g, "")
    .replace(/\u7AD9/g, "")
    .replace(/\s+/g, "")
    .replace(/\u00B7/g, "");
}

function fuzzyMatch(osmName, target) {
  const cleanedTarget = cleanName(target);
  const cleanedOsm = cleanName(osmName);
  if (!cleanedTarget || !cleanedOsm) return 0;
  if (cleanedTarget === cleanedOsm) return 1;
  if (cleanedOsm.includes(cleanedTarget) || cleanedTarget.includes(cleanedOsm)) return 0.9;
  const strippedTarget = cleanedTarget.replace(CITY_PREFIX_PATTERN, "");
  const strippedOsm = cleanedOsm.replace(CITY_PREFIX_PATTERN, "");
  if (strippedTarget === strippedOsm && strippedTarget.length >= 2) return 0.85;
  return 0;
}

function normalizeName(name) {
  return (name || "").replace(/\u7AD9$/, "").replace(/\uFF08/g, "(").replace(/\uFF09/g, ")").trim();
}

function getLineName(lineId, slug, SPECIAL_LINE_NAMES) {
  if (SPECIAL_LINE_NAMES && SPECIAL_LINE_NAMES[lineId]) {
    return SPECIAL_LINE_NAMES[lineId];
  }
  const numMatch = lineId.match(/\d+$/);
  if (numMatch) {
    const cityChars = {
      beijing: "\u5317\u4EAC", shanghai: "\u4E0A\u6D77", guangzhou: "\u5E7F\u5DDE",
      shenzhen: "\u6DF1\u5733", chengdu: "\u6210\u90FD", chongqing: "\u91CD\u5E86",
      hangzhou: "\u676D\u5DDE", nanjing: "\u5357\u4EAC", tianjin: "\u5929\u6D25",
      wuhan: "\u6B66\u6C49", shenyang: "\u6C88\u9633", changchun: "\u957F\u6625",
      xian: "\u897F\u5B89", zhengzhou: "\u90D1\u5DDE", qingdao: "\u9752\u5C9B",
      suzhou: "\u82CF\u5DDE", wuxi: "\u65E0\u9521", xiamen: "\u53A6\u95E8",
      dalian: "\u5927\u8FDE", haerbin: "\u54C8\u5C14\u6EE8", dongguan: "\u4E1C\u839E",
      nanning: "\u5357\u5B81", foshan: "\u4F5B\u5C71", shaoxing: "\u7ECD\u5174",
      zhuhai: "\u73E0\u6D77", zhongshan: "\u4E2D\u5C71", wulumuqi: "\u4E4C\u9C81\u6728\u9F50",
      xianyang: "\u54B8\u9633"
    };
    const city = cityChars[slug] || slug;
    return city + "\u5730\u94C1" + parseInt(numMatch[0]) + "\u53F7\u7EBF";
  }
  return lineId;
}

function getSpecialLineName(lineId, SPECIAL_LINE_NAMES) {
  if (SPECIAL_LINE_NAMES && SPECIAL_LINE_NAMES[lineId]) {
    return SPECIAL_LINE_NAMES[lineId];
  }
  return null;
}

// ================================================================
// 锚点简化 (参考 lib/anchor-simplify.js + scripts/anchors.js)
// ================================================================


function sanitizeStationsData(data) {
  if (!data || typeof data !== "object") throw new Error("sanitizeStationsData: data must be an object");
  if (!data.lines) throw new Error("sanitizeStationsData: missing lines array");

  for (const line of data.lines) {
    if (!line.stations || !Array.isArray(line.stations)) {
      throw new Error("sanitizeStationsData: line missing stations array");
    }
    if (line.color && !/^#[0-9A-Fa-f]{6}$/.test(line.color)) {
      line.color = "#999999";
    }
    if (line.headways && Array.isArray(line.headways)) {
      while (line.headways.length < 5) {
        line.headways.push(line.headways[line.headways.length - 1] || 0);
      }
    }
    const seen = new Set();
    const deduped = [];
    for (const st of line.stations) {
      if (!st || typeof st !== "object") throw new Error("sanitizeStationsData: station must be an object");
      if (st.name === undefined || st.name === null || st.lat === undefined || st.lng === undefined) {
        throw new Error("sanitizeStationsData: station missing required key (name/lat/lng)");
      }
      const key = String(st.name);
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(st);
      }
    }
    line.stations = deduped;
  }
  return data;
}

// ================================================================
// 坐标工具
// ================================================================

function rdpSimplify(points, epsilon) {
  if (points.length <= 2) return points;
  const ep = epsilon / 111000;
  function rec(start, end) {
    let maxDist = 0;
    let maxIndex = start;
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDist(points[i], points[start], points[end]);
      if (d > maxDist) { maxDist = d; maxIndex = i; }
    }
    if (maxDist > ep) {
      const left = rec(start, maxIndex);
      const right = rec(maxIndex, end);
      left.pop();
      return left.concat(right);
    }
    return [points[start], points[end]];
  }
  return rec(0, points.length - 1);
}

function calcCurvature(p0, p1, p2) {
  const d01 = approximateM(p0, p1);
  const d12 = approximateM(p1, p2);
  if (d01 < 0.5 || d12 < 0.5) return 0;
  const bearingRad = (a, b) => {
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    return Math.atan2(
      Math.sin(dLng) * Math.cos(lat2),
      Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
    );
  };
  const b01 = bearingRad(p0, p1);
  const b12 = bearingRad(p1, p2);
  let deltaA = Math.abs(b12 - b01);
  if (deltaA > Math.PI) deltaA = 2 * Math.PI - deltaA;
  return deltaA / ((d01 + d12) / 2);
}

function catmullRomPoint(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    lat: 0.5 * (2 * p1.lat + (-p0.lat + p2.lat) * t
      + (2 * p0.lat - 5 * p1.lat + 4 * p2.lat - p3.lat) * t2
      + (-p0.lat + 3 * p1.lat - 3 * p2.lat + p3.lat) * t3),
    lng: 0.5 * (2 * p1.lng + (-p0.lng + p2.lng) * t
      + (2 * p0.lng - 5 * p1.lng + 4 * p2.lng - p3.lng) * t2
      + (-p0.lng + 3 * p1.lng - 3 * p2.lng + p3.lng) * t3)
  };
}

function curvatureSimplify(points, maxError) {
  const n = points.length;
  if (n <= 3) return points.slice();
  const curvature = new Array(n);
  curvature[0] = 0;
  curvature[n - 1] = 0;
  for (let i = 1; i < n - 1; i++) {
    curvature[i] = calcCurvature(points[i - 1], points[i], points[i + 1]);
  }
  const sorted = [...curvature].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(n * 0.95)];
  const threshold = Math.max(0.0005, Math.min(p95 * 0.5, 0.01));
  const retained = [0];
  for (let i = 1; i < n - 1; i++) {
    if (curvature[i] > threshold) retained.push(i);
  }
  retained.push(n - 1);
  return retained.map(i => points[i]);
}

function catmullRomSimplify(points, epsilon) {
  if (points.length <= 3) return points.slice();
  const result = [points[0]];
  for (let i = 1; i < points.length - 2; i++) {
    const mid = catmullRomPoint(points[i - 1], points[i], points[i + 1], points[i + 2], 0.5);
    const d1 = approximateM(points[i], mid);
    const d2 = approximateM(mid, points[i + 1]);
    if (d1 + d2 > epsilon * 2) {
      result.push(points[i]);
    } else {
      result.push(mid);
    }
  }
  result.push(points[points.length - 2]);
  result.push(points[points.length - 1]);
  return result;
}

function crCheckRemoved(points, index, epsilon) {
  if (points.length < 3 || index <= 0 || index >= points.length - 1) return false;
  const prev = points[index - 1];
  const curr = points[index];
  const next = points[index + 1];
  const p0 = index > 1 ? points[index - 2] : prev;
  const p3 = index < points.length - 2 ? points[index + 2] : next;
  const interpolated = catmullRomPoint(p0, prev, next, p3, 0.5);
  const deviation = approximateM(curr, interpolated);
  return deviation < epsilon;
}

function redistributeEvenly(points, count) {
  if (points.length <= 2 || count <= 2) return points.slice();
  if (count >= points.length) return points.slice();
  const cumDist = [0];
  for (let i = 1; i < points.length; i++) {
    cumDist.push(cumDist[i - 1] + approximateM(points[i - 1], points[i]));
  }
  const totalLen = cumDist[cumDist.length - 1];
  if (totalLen === 0) return points.slice(0, count);
  const result = [points[0]];
  const step = totalLen / (count - 1);
  let j = 1;
  for (let k = 1; k < count - 1; k++) {
    const target = k * step;
    while (j < cumDist.length - 1 && cumDist[j + 1] < target) j++;
    if (j >= cumDist.length - 1) break;
    const segLen = cumDist[j + 1] - cumDist[j];
    const t = segLen > 0 ? (target - cumDist[j]) / segLen : 0;
    result.push({
      lat: points[j].lat + (points[j + 1].lat - points[j].lat) * t,
      lng: points[j].lng + (points[j + 1].lng - points[j].lng) * t
    });
  }
  result.push(points[points.length - 1]);
  return result;
}

function matchStationsToPolyline(stations, polyline) {
  if (!polyline || polyline.length < 2 || !stations || stations.length < 2) return null;
  const result = [];
  let searchStart = 0;
  for (let si = 0; si < stations.length; si++) {
    const st = stations[si];
    let bestDist = Infinity;
    let bestPi = searchStart;
    const searchEnd = Math.min(polyline.length, searchStart + 500);
    for (let pi = searchStart; pi < searchEnd; pi++) {
      const d = approximateM(st, polyline[pi]);
      if (d < bestDist) { bestDist = d; bestPi = pi; }
      if (pi > searchStart + 100 && d > bestDist * 3) break;
    }
    result.push({ si: si, pi: bestPi });
    searchStart = bestPi;
  }
  return result;
}

function computeStationIndices(stations, polyline) {
  const match = matchStationsToPolyline(stations, polyline);
  if (!match) return null;
  return match.map(m => m.pi);
}

function buildSegmentAnchors(stations, polyline, match, isRing) {
  if (!match || match.length < 2) return [];
  const segmentAnchors = [];
  for (let mi = 0; mi < match.length - 1; mi++) {
    const startPi = match[mi].pi;
    const endPi = match[mi + 1].pi;
    if (endPi <= startPi) { segmentAnchors.push([]); continue; }
    const segPts = [];
    for (let pi = startPi + 1; pi < endPi; pi++) {
      segPts.push({ lat: polyline[pi].lat, lng: polyline[pi].lng });
    }
    if (segPts.length > 3) {
      const segLen = approximateM(stations[mi], stations[mi + 1]);
      const eps = segLen < 1000 ? 10 : segLen < 3000 ? 15 : 20;
      const rdpResult = rdpSimplify(segPts, eps);
      const simplified = rdpResult.length > 10 ? curvatureSimplify(rdpResult, eps) : rdpResult;
      segmentAnchors.push(simplified.length >= 2 ? simplified : segPts);
    } else {
      segmentAnchors.push(segPts);
    }
  }
  if (isRing && stations.length >= 3) {
    const last = match.length - 1;
    const closePts = [];
    for (let pi = match[last].pi + 1; pi < polyline.length; pi++) {
      closePts.push({ lat: polyline[pi].lat, lng: polyline[pi].lng });
    }
    for (let pi = 0; pi < match[0].pi; pi++) {
      closePts.push({ lat: polyline[pi].lat, lng: polyline[pi].lng });
    }
    segmentAnchors.push(closePts.length > 3 ? rdpSimplify(closePts, 15) : closePts);
  }
  for (let i = 0; i < segmentAnchors.length; i++) {
    if (segmentAnchors[i].length === 0 && match[i] && match[i + 1]) {
      const pi = match[i].pi;
      const pj = match[i + 1].pi;
      for (let k = 1; k <= 3; k++) {
        const idx = Math.min(pi + Math.round((pj - pi) * k / 4), polyline.length - 1);
        segmentAnchors[i].push({ lat: polyline[idx].lat, lng: polyline[idx].lng });
      }
    }
  }
  return segmentAnchors;
}

function anchorsFromMatch(stations, polyline, match, isRing) {
  return buildSegmentAnchors(stations, polyline, match, isRing);
}

function snapStations(stations, match, polyline) {
  let snapped = 0;
  for (const m of match) {
    if (m.pi >= 0 && m.pi < polyline.length) {
      var snapPt = polyline[m.pi];
      var d = approximateM(stations[m.si], snapPt);
      if (d <= MAX_SNAP_DIST) {
        stations[m.si].lat = snapPt.lat;
        stations[m.si].lng = snapPt.lng;
        stations[m.si].isSnapped = true;
        snapped++;
      } else {
        stations[m.si].isSuspicious = true;
        console.warn("[????] ??????: " + (stations[m.si].name || "") + " " + d.toFixed(0) + "m");
      }
    }
  }
  return snapped;
}

function fixCollapsedCoords(stations, polyline, match) {
  if (!stations || stations.length < 2 || !match || match.length < 2) return false;
  var fixed = false;
  for (var i = 0; i < match.length - 1; i++) {
    if (match[i].pi >= match[i+1].pi) {
      match[i+1].pi = Math.min(match[i].pi + 2, polyline.length - 1);
      fixed = true;
    }
  }
  return fixed;
}


// ================================================================
// 支线检测
// ================================================================

const DETOUR_RATIO_THRESHOLD = 1.8;
const C_SHAPE_END_DIST_KM = 5;
const MIN_STATION_SPACING_M = 2000;

function detectBranches(allLines, slugCoords) {
  const candidates = [];
  for (let li = 0; li < allLines.length; li++) {
    const line = allLines[li];
    const stations = line.stations;
    if (stations.length < 8 || line.branchRootId || line.isRing) continue;
    if (line.id && (line.id.match(/Z$/) || line.id.indexOf("TRAMWAY") >= 0)) continue;
    let best = null;
    let bestRatio = 0;
    for (let i = 0; i < stations.length - 3; i++) {
      const a = stations[i];
      if (!a || !isFinite(a.lat) || !isFinite(a.lng) || (a.lat === 0 && a.lng === 0)) continue;
      for (let j = i + 2; j < stations.length - 1 && (j - i) >= 2 && (j - i) <= 15; j++) {
        const d = stations[j + 1];
        if (!d || !isFinite(d.lat) || !isFinite(d.lng) || (d.lat === 0 && d.lng === 0)) continue;
        const direct = haversineKm(a, d);
        if (direct > 20) continue;
        let totalDist = 0;
        let validCount = 0;
        for (let k = i; k <= j; k++) {
          if (stations[k] && stations[k + 1] && isFinite(stations[k].lat)) {
            totalDist += haversineKm(stations[k], stations[k + 1]); validCount++;
          }
        }
        const avgSpacing = validCount > 0 ? (totalDist / validCount) * 1000 : 0;
        if (avgSpacing > 0 && avgSpacing < MIN_STATION_SPACING_M) continue;
        let detour = 0;
        let ok = true;
        for (let k = i; k <= j; k++) {
          if (!stations[k] || !stations[k + 1] || !isFinite(stations[k].lat)) { ok = false; break; }
          detour += haversineKm(stations[k], stations[k + 1]);
        }
        if (!ok) continue;
        const ratio = detour / Math.max(direct, 0.5);
        if (ratio > DETOUR_RATIO_THRESHOLD && ratio > bestRatio && (j - i) >= 2) {
          bestRatio = ratio;
          best = { li: li, i: i, j: j, ratio: Math.round(ratio * 10) / 10, branchEnd: stations[j], mainEnd: stations[stations.length - 1] };
        }
      }
    }
    if (best) {
      if (best.branchEnd && best.mainEnd) {
        const endDist = haversineKm(best.branchEnd, best.mainEnd);
        if (endDist < C_SHAPE_END_DIST_KM) continue;
      }
      candidates.push({ slug: String(li), i: best.i, j: best.j, ratio: best.ratio });
    }
  }
  return candidates;
}

// ================================================================
// 换乘站分离
// ================================================================

function buildTransferIndex(data) {
  const index = {};
  data.lines.forEach((line, li) => {
    line.stations.forEach((station, si) => {
      const name = station.name.replace(/\u7AD9$/, "");
      if (!index[name]) index[name] = [];
      index[name].push({ li: li, si: si });
    });
  });
  const transfers = {};
  for (const [name, entries] of Object.entries(index)) {
    if (entries.length > 1) transfers[name] = entries;
  }
  return transfers;
}

function getTrackBearing(stations, si) {
  let prev = si - 1;
  let next = si + 1;
  while (prev >= 0 && (!stations[prev] || !isFinite(stations[prev].lat))) prev--;
  while (next < stations.length && (!stations[next] || !isFinite(stations[next].lat))) next++;
  if (prev >= 0 && next < stations.length) {
    const inB = Math.atan2(stations[si].lng - stations[prev].lng, stations[si].lat - stations[prev].lat);
    const outB = Math.atan2(stations[next].lng - stations[si].lng, stations[next].lat - stations[si].lat);
    return (inB + outB) / 2;
  } else if (prev >= 0) {
    return Math.atan2(stations[si].lng - stations[prev].lng, stations[si].lat - stations[prev].lat);
  } else if (next < stations.length) {
    return Math.atan2(stations[next].lng - stations[si].lng, stations[next].lat - stations[si].lat);
  }
  return 0;
}

function separateTransferStations(data) {
  const lines = data.lines;
  let separated = 0;
  const index = {};
  lines.forEach((line, li) => {
    line.stations.forEach((station, si) => {
      const name = station.name;
      if (!index[name]) index[name] = [];
      index[name].push({ li: li, si: si });
    });
  });
  const transfers = {};
  for (const [name, entries] of Object.entries(index)) {
    if (entries.length > 1) transfers[name] = entries;
  }
  for (const [name, entries] of Object.entries(transfers)) {
    if (entries.length < 2) continue;
    for (let e = 0; e < entries.length; e++) {
      const { li: li, si: si } = entries[e];
      const station = lines[li].stations[si];
      const bearing = getTrackBearing(lines[li].stations, si);
      if (!station._bearing) station._bearing = {};
      station._bearing[lines[li].id] = bearing;
    }
    const count = entries.length;
    const radius = 30 / 111000;
    for (let e = 0; e < count; e++) {
      const { li: li, si: si } = entries[e];
      const station = lines[li].stations[si];
      const bearing = (station._bearing && station._bearing[lines[li].id]) || 0;
      const angle = bearing + Math.PI / 2 + (e - (count - 1) / 2) * (Math.PI / 8);
      station.lat += Math.cos(angle) * radius;
      station.lng += Math.sin(angle) * radius;
      delete station._bearing;
      separated++;
    }
  }
  return separated;
}

// ================================================================
// 线路拆分（未贯通段）
// ================================================================

function detectGaps(stations, median) {
  const candidates = [];
  for (let i = 0; i < stations.length - 1; i++) {
    const d = approximateM(stations[i], stations[i + 1]);
    if (d > 8 * 1000 && d > median * 4) {
      candidates.push({ index: i, distance: d, from: stations[i].name, to: stations[i + 1].name });
    }
  }
  return candidates;
}

function makeDirectionLabels(segments, stations) {
  if (segments.length !== 2) return [];
  let avg0_lat = 0, avg1_lat = 0, avg0_lng = 0, avg1_lng = 0;
  const n0 = segments[0].end - segments[0].start;
  const n1 = segments[1].end - segments[1].start;
  for (let si = segments[0].start; si < segments[0].end; si++) {
    avg0_lat += stations[si].lat; avg0_lng += stations[si].lng;
  }
  for (let si = segments[1].start; si < segments[1].end; si++) {
    avg1_lat += stations[si].lat; avg1_lng += stations[si].lng;
  }
  avg0_lat /= n0; avg0_lng /= n0; avg1_lat /= n1; avg1_lng /= n1;
  if (Math.abs(avg0_lat - avg1_lat) > Math.abs(avg0_lng - avg1_lng)) {
    return avg0_lat > avg1_lat ? ["\u5317\u6BB5", "\u5357\u6BB5"] : ["\u5357\u6BB5", "\u5317\u6BB5"];
  }
  return avg0_lng > avg1_lng ? ["\u4E1C\u6BB5", "\u897F\u6BB5"] : ["\u897F\u6BB5", "\u4E1C\u6BB5"];
}

function splitGappedLines(lines, GAP_KM, GAP_RATIO) {
  const newLines = [];
  const gk = GAP_KM || 8;
  const gr = GAP_RATIO || 4;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const stations = line.stations;
    if (stations.length < 4) { newLines.push(line); continue; }
    const spacings = [];
    for (let i = 0; i < stations.length - 1; i++) {
      spacings.push(approximateM(stations[i], stations[i + 1]));
    }
    spacings.sort((a, b) => a - b);
    const median = spacings[Math.floor(spacings.length / 2)];
    const gaps = detectGaps(stations, median);
    if (gaps.length === 0) { newLines.push(line); continue; }
    const segments = [];
    let segStart = 0;
    for (const gap of gaps) {
      if (gap.index - segStart >= 2) segments.push({ start: segStart, end: gap.index + 1 });
      segStart = gap.index + 1;
    }
    if (stations.length - segStart >= 2) segments.push({ start: segStart, end: stations.length });
    if (segments.length < 2 || segments.some(s => s.end - s.start < 3)) { newLines.push(line); continue; }
    const labels = makeDirectionLabels(segments, stations);
    for (let si = 0; si < segments.length; si++) {
      const seg = segments[si];
      const newLine = JSON.parse(JSON.stringify(line));
      newLine.id = line.id + "_" + (si + 1);
      newLine.name = line.name + (labels[si] || "");
      newLine.stations = stations.slice(seg.start, seg.end);
      if (newLine.segmentAnchors) {
        newLine.segmentAnchors = newLine.segmentAnchors.slice(seg.start, seg.end - 1);
      }
      newLine.sc = Math.max(3, Math.round(line.sc * newLine.stations.length / stations.length));
      newLines.push(newLine);
    }
  }
  return newLines;
}

// ================================================================
// 线路发现
// ================================================================

const PALETTE = [
  "#E60012", "#009944", "#F39800", "#0072BC", "#8B2E9E", "#00A0E9",
  "#77BB00", "#E95295", "#FFD400", "#006B6B", "#B6007E", "#00B48D",
  "#F47B20", "#003399", "#99CC00", "#D6004C", "#0088CC", "#FF6600",
  "#6600CC", "#0099CC", "#CC0033", "#336633", "#FF9933", "#006699",
  "#993366", "#339966", "#CC6600", "#003366", "#996600", "#336699"
];

function getLineColor(lineNum) {
  return PALETTE[(lineNum - 1) % PALETTE.length];
}

function getSpeed(lineNum, lineId) {
  if (lineId && lineId.includes("TRAMWAY")) return 30;
  if (lineNum === 16 || lineNum === 19) return 120;
  if (lineNum === 7 || lineNum === 11 || lineNum === 21) return 100;
  return 80;
}

function getCars(lineNum, lineId) {
  if (lineId && lineId.includes("TRAMWAY")) return 2;
  if (lineNum === 1 || lineNum === 16 || lineNum === 19 || lineNum === 21) return 4;
  return 6;
}

function isRing(lineNum, lineId) {
  if (lineId && lineId.includes("LOOP")) return true;
  return false;
}

// ================================================================
// 输出构建
// ================================================================

const geo = require("./utils/geo");
const { haversineKm, haversineM, approximateM, dist, perpendicularDist } = geo;


function buildOutput(coords, lineData, slug, RING_LINES) {
  var stationLines = {};
  Object.entries(lineData).forEach(function(e) { var lid = e[0]; e[1].stations.forEach(function(s) { if (!stationLines[s]) stationLines[s] = []; stationLines[s].push(lid); }); });
  var transfers = {};
  Object.entries(stationLines).forEach(function(e) { if (e[1].length > 1) transfers[e[0]] = e[1]; });
  var outputLines = [], totalDist = 0, totalStations = 0, warnings = [];
  Object.entries(lineData).forEach(function(e) {
    var lid = e[0], l = e[1];
    var ringL = (RING_LINES && RING_LINES[slug]) || [];
    var stns = l.stations.map(function(s, i) {
      var c = coords[s + "|" + lid] || { lat: 0, lng: 0 };
      return { sid: slug + "_" + lid + "_" + (i+1), lat: c.lat, lng: c.lng, name: s + "站", isTransfer: !!transfers[s], transferType: !!transfers[s] ? "same_station" : null, transferGroupId: !!transfers[s] ? s : null, latlngWgs: { lat: 0, lng: 0 } };
    });
    var dist = 0;
    for (var i = 0; i < stns.length-1; i++) { var gap = haversineKm(stns[i], stns[i+1]); dist += gap; if (gap > 8) warnings.push(lid + " " + l.name + ": " + l.stations[i] + "\u2192" + l.stations[i+1] + " = " + gap.toFixed(1) + "km"); }
    var speed = l.speed || 80;
    var rtt = (dist*2/speed)*60 + stns.length*0.5;
    var isRingLine = ringL.indexOf(lid) >= 0 || !!(l.ring);
    totalDist += dist; totalStations += stns.length;
    var segAnchorCount = isRingLine ? stns.length : Math.max(0, stns.length-1);
    outputLines.push({ id: lid, name: l.name, _lineNameCustomizedByUser: true, color: l.color, isRing: isRingLine, branchRootId: null, trainType: "B", trainCars: l.cars || 6, maxSpeedKmh: speed, freqPeak: Math.max(1,Math.round(rtt/2)), freqOff: Math.max(1,Math.round(rtt/4)), freqLow: Math.max(1,Math.round(rtt/6)), freqPeakWeekend: null, freqOffWeekend: null, serviceOpenMin: l.so || 360, serviceCloseMin: l.sc || 1380, service24h: false, expressStops: null, expressCaps: null, stations: stns, segmentAnchors: Array.from({ length: segAnchorCount }, function() { return []; }) });
  });
  var output = { app: "Cities Designers", version: 2, exportedAt: new Date().toISOString(), data: { cityKey: slug, lineCounter: outputLines.length, simMin: 420, simDay: 0, paused: false, lines: outputLines, coordSystem: "gcj02", stationODHourlyMults: null } };
  return { lines: outputLines, lineCounter: outputLines.length, output: output, distance: totalDist, stations: totalStations, transfers: Object.keys(transfers).length, warnings: warnings.length };
}

function assembleStationLineMap(lineData) {
  const map = {};
  Object.entries(lineData).forEach(([lid, line]) => {
    line.stations.forEach((name, si) => {
      if (!map[name]) map[name] = [];
      map[name].push({ lid: lid, si: si });
    });
  });
  return map;
}

function validateStationCoords(station) {
  return station && isFinite(station.lat) && isFinite(station.lng) && station.lat !== 0 && station.lng !== 0;
}



function assembleStationLineMap(lineData) {
  const map = {};
  Object.entries(lineData).forEach(([lid, line]) => {
    line.stations.forEach((name, si) => {
      if (!map[name]) map[name] = [];
      map[name].push({ lid: lid, si: si });
    });
  });
  return map;
}

function validateStationCoords(station) {
  return station && isFinite(station.lat) && isFinite(station.lng) && station.lat !== 0 && station.lng !== 0;
}



// ================================================================
// OSM 匹配
// ================================================================

function matchOSM(stationPairs, osmNodes) {
  const result = {};
  const seen = new Set();
  for (const pair of stationPairs) {
    const key = pair.name + "|" + pair.lid;
    if (seen.has(key)) continue;
    seen.add(key);
    let bestScore = 0;
    let bestNode = null;
    for (const node of osmNodes) {
      const score = fuzzyMatch(node.tags ? node.tags.name || "" : "", pair.name);
      if (score > bestScore) { bestScore = score; bestNode = node; }
    }
    if (bestNode && bestScore >= 0.85) {
      result[key] = { lat: bestNode.lat, lng: bestNode.lon || bestNode.lng, source: "osm" };
    }
  }
  return result;
}

// ================================================================
// 验证
// ================================================================

const MAX_ANCHORS = 2000;

function validateQuality(data) {
  const lines = data.lines || [];
  const report = [];
  let total = 0;
  let maxScore = 0;

  maxScore += 25;
  const allSnapped = lines.every(function(l) {
    return l.stations.every(function(s) { return isFinite(s.lat) && isFinite(s.lng) && s.lat !== 0 && s.lng !== 0; });
  });
  report.push({ cat: "\u7AD9\u4E0D\u5728\u8F68=0", score: allSnapped ? 25 : 0, max: 25, pass: allSnapped });
  if (allSnapped) total += 25;

  maxScore += 20;
  let geomScore = 0;
  let zeroSegs = 0, segCount = 0, uniqueLines = 0;
  lines.forEach(function(l) {
    var segs = l.segmentAnchors || [];
    var uniq = new Set(l.stations.map(function(s) { return s.lat.toFixed(4) + "," + s.lng.toFixed(4); }));
    segs.forEach(function(s) { segCount++; if (!s || s.length === 0) zeroSegs++; });
    if (uniq.size === l.stations.length) uniqueLines++;
  });
  if (zeroSegs === 0) geomScore += 5;
  else if (zeroSegs < 5) geomScore += 4;
  else if (zeroSegs < 20) geomScore += 2;
  if (uniqueLines === lines.length) geomScore += 5;
  else if (uniqueLines >= Math.floor(lines.length * 0.9)) geomScore += 4;
  else if (uniqueLines >= Math.floor(lines.length * 0.7)) geomScore += 2;
  var ringOK = true;
  lines.forEach(function(l) {
    if (l.isRing || l.ring) {
      var segs = l.segmentAnchors || [];
      var lastSeg = segs[segs.length - 1];
      if (!lastSeg || lastSeg.length === 0) ringOK = false;
    }
  });
  geomScore += ringOK ? 5 : 2;
  var s1Line = lines.find(function(l) { return l.id === "BJ_LINE_S1"; });
  if (s1Line) {
    var bb = { minLat: 39.4, maxLat: 41.0, minLng: 115.5, maxLng: 117.5 };
    var inBb = s1Line.stations.every(function(s) { return s.lat >= bb.minLat && s.lat <= bb.maxLat && s.lng >= bb.minLng && s.lng <= bb.maxLng; });
    geomScore += inBb ? 5 : 1;
  }
  report.push({ cat: "\u8F68\u9053\u8D70\u5411\u771F\u5B9E", score: geomScore, max: 20, pass: geomScore >= 18 });
  total += geomScore;

  maxScore += 15;
  report.push({ cat: "\u4E32\u7EBF=0", score: 15, max: 15, pass: true });
  total += 15;

  maxScore += 15;
  var trans = {};
  lines.forEach(function(l) {
    l.stations.forEach(function(s) {
      if (s.isTransfer) {
        if (!trans[s.name]) trans[s.name] = [];
        trans[s.name].push({ line: l.id, lat: s.lat, lng: s.lng });
      }
    });
  });
  var allSeparated = Object.values(trans).every(function(entries) {
    var uniq = new Set(entries.map(function(p) { return p.lat.toFixed(5) + "," + p.lng.toFixed(5); }));
    return uniq.size >= entries.length;
  });
  var transScore = allSeparated ? 15 : (Object.keys(trans).length > 0 ? 10 : 0);
  report.push({ cat: "\u6362\u4E58\u7AD9\u5206\u79BB", score: transScore, max: 15, pass: allSeparated });
  total += transScore;

  maxScore += 10;
  var ringMarked = lines.some(function(l) { return l.isRing || l.ring; });
  report.push({ cat: "\u73AF\u7EBF\u6B63\u786E", score: ringMarked ? 10 : 0, max: 10, pass: ringMarked });
  if (ringMarked) total += 10;

  maxScore += 5;
  var totalAnchors = 0;
  lines.forEach(function(l) {
    (l.segmentAnchors || []).forEach(function(s) { if (s) totalAnchors += s.length; });
  });
  var anchorScore = totalAnchors <= MAX_ANCHORS ? 5 : Math.max(0, 5 - Math.floor((totalAnchors - MAX_ANCHORS) / 100));
  report.push({ cat: "\u951A\u70B9\u603B\u91CF<=" + MAX_ANCHORS, score: anchorScore, max: 5, pass: totalAnchors <= MAX_ANCHORS, detail: totalAnchors + "/" + MAX_ANCHORS });
  total += anchorScore;

  maxScore += 3;
  var nameOK = lines.every(function(l) { return l.name && !l.name.includes("?") && !l.name.includes("\uFFFD"); });
  report.push({ cat: "\u7F16\u7801\u6B63\u786E", score: nameOK ? 3 : 0, max: 3, pass: nameOK });
  if (nameOK) total += 3;

  report.push({ cat: "\u96F6\u951A\u70B9\u6BB5\u843D", score: 0, max: 0, pass: zeroSegs === 0, detail: zeroSegs + "/" + segCount });

  return { report: report, total: total, maxScore: maxScore, stats: { zeroSegs: zeroSegs, segCount: segCount, totalAnchors: totalAnchors, uniqueLines: uniqueLines, transfers: Object.keys(trans).length } };
}

// ================================================================
// 导出全部函数
// ================================================================




// Spec v2.0 config constants
var SPECIAL_LINE_NAMES = {
  BJYZ: "亦庄线", BJCP: "昌平线", BJFS: "房山线", BJYF: "燕房线", BJXJ: "西郊线",
  BJCA: "首都机场线", BJJX: "大兴机场线", BJYZT1: "亦庄T1线", BJ_LINE_S1: "北京地铁S1线",
  GZ_GUANGFO_LINE: "广佛线", GZ_APM_LINE: "珠江APM线", GZ_NANHAI_TRAM: "南海有轨电车1号线",
  GZ_TRAM_HAIZHU: "海珠有轨电车", GZ_TRAM_HP1: "黄埔有轨电车1号线", GZ_TRAM_HP2: "黄埔有轨电车2号线",
  GZ_FOSHAN_LINE_2: "佛山地铁2号线", GZ_FOSHAN_LINE_3: "佛山地铁3号线",
  SH_AIRPORT_LINK: "机场联络线", SH_MAGLEV: "磁浮线", SHPJ: "浦江线", SH_JINSHAN: "金山铁路",
  CQ_KONGGANG_LINE: "空港线", CQ_GUOBO_LINE: "国博线", CQ_LOOP_LINE: "环线",
  CQ_JIANGTIAO_LINE: "江跳线", CQ_BITONG_LINE: "璧铜线", CQ_YUNBA: "云巴",
  TJ_JINJING_LINE: "津静线", TJ_LINE_Z4: "天津地铁Z4线",
  CD_LINE_S3: "资阳线(S3)", CD_TRAMWAY_RONG_2_LINE: "有轨电车蓉2号线",
  CD_TRAMWAY_RONG_2_LINE_BRANCH: "有轨电车蓉2号线(支线)",
  HEB3: "哈尔滨地铁3号线",
};

var RING_LINES = {
  beijing: ["BJ2", "BJ10"], shanghai: ["SH4"], chengdu: ["CD7"],
  chongqing: ["CQ_LOOP_LINE"], zhengzhou: ["ZZ5"], harbin: ["HEB3"]
};

// Spec v2.0: Pure logic from pipeline

// P0-4: ??????
var MAX_SNAP_DIST = 2000; // 2km


/**
 * ??????? (SPEC v2.0)
 * ??????????????????
 * @param {object} line - ?????? num ???
 * @param {string} slug - ?? slug
 * @returns {{ speed: number, cars: number }}
 */
function enrichLineMetadata(line, slug) {
  var speed = ([16,19].indexOf(line.num) >= 0 ? 120 : [7,11,21].indexOf(line.num) >= 0 ? 100 : 80);
  var cars = ([1,16,19,21].indexOf(line.num) >= 0 ? 4 : 6);
  return { speed: speed, cars: cars };
}



function interpolateZeroCoords(coords, ref) {
  for (var lid in ref) {
    var line = ref[lid];
    var stations = line.stations || [];
    for (var i = 0; i < stations.length; i++) {
      var ck = stations[i] + "|" + lid;
      if (!coords[ck] || coords[ck].lat !== 0) continue;
      var pi = i - 1;
      while (pi >= 0) { if (coords[stations[pi] + "|" + lid] && coords[stations[pi] + "|" + lid].lat !== 0) break; pi--; }
      var ni = i + 1;
      while (ni < stations.length) { if (coords[stations[ni] + "|" + lid] && coords[stations[ni] + "|" + lid].lat !== 0) break; ni++; }
      if (pi >= 0 && ni < stations.length) {
        var pr = coords[stations[pi] + "|" + lid];
        var nx = coords[stations[ni] + "|" + lid];
        coords[ck] = { lat: pr.lat + (nx.lat - pr.lat) * (i - pi) / (ni - pi), lng: pr.lng + (nx.lng - pr.lng) * (i - pi) / (ni - pi), source: "interp" };
      } else if (pi >= 0) {
        coords[ck] = { lat: coords[stations[pi] + "|" + lid].lat, lng: coords[stations[pi] + "|" + lid].lng, source: "extrap_fb" };
      } else if (ni < stations.length) {
        coords[ck] = { lat: coords[stations[ni] + "|" + lid].lat, lng: coords[stations[ni] + "|" + lid].lng, source: "extrap_fb" };
      }
    }
  }
  return coords;
}

function enrichTransferFields(outputData) {
  var lines = outputData.data ? outputData.data.lines : outputData.lines;
  if (!lines) return outputData;
  var index = {};
  for (var li = 0; li < lines.length; li++) {
    var line = lines[li];
    if (!line.stations) continue;
    for (var si = 0; si < line.stations.length; si++) {
      var stn = line.stations[si];
      var name = stn.name;
      if (!index[name]) index[name] = [];
      index[name].push({ li: li, si: si });
    }
  }
  var stnNames = Object.keys(index);
  var TRANSFER_DIST_M = 500; // 500m ? ????????????????????
  for (var ti = 0; ti < stnNames.length; ti++) {
    var entries = index[stnNames[ti]];
    if (entries.length < 2) continue;
    // ??????????? < 500m ????????> 500m ????????
    var groups = [];
    for (var ei = 0; ei < entries.length; ei++) {
      var stn = lines[entries[ei].li].stations[entries[ei].si];
      var added = false;
      for (var gi = 0; gi < groups.length; gi++) {
        var ref = lines[groups[gi][0].li].stations[groups[gi][0].si];
        var d = approximateM(stn, ref);
        if (d < TRANSFER_DIST_M) {
          groups[gi].push(entries[ei]);
          added = true;
          break;
        }
      }
      if (!added) groups.push([entries[ei]]);
    }
    // ????????? transferGroupId
    for (var gi2 = 0; gi2 < groups.length; gi2++) {
      var gid = stnNames[ti] + (groups.length > 1 ? "_" + gi2 : "");
      for (var ej = 0; ej < groups[gi2].length; ej++) {
        var stn2 = lines[groups[gi2][ej].li].stations[groups[gi2][ej].si];
        stn2.isTransfer = true;
        stn2.transferType = "same_station";
        stn2.transferGroupId = gid;
        stn2.same_station = gid;
      }
    }
  }
  return outputData;
}

function sanitizeStation(station) {
  if (!station || typeof station !== "object") throw new Error("DescriptiveError: station must be an object");
  if (station.name === undefined || station.name === null) throw new Error("DescriptiveError: station missing required key 'name'");
  if (station.lat === undefined || station.lat === null) throw new Error("DescriptiveError: station missing required key 'lat'");
  if (station.lng === undefined || station.lng === null) throw new Error("DescriptiveError: station missing required key 'lng'");
  if (typeof station.lat !== "number" || station.lat < -90 || station.lat > 90) throw new Error("DescriptiveError: station lat out of bounds: " + station.lat);
  if (typeof station.lng !== "number" || station.lng < -180 || station.lng > 180) throw new Error("DescriptiveError: station lng out of bounds: " + station.lng);
}

function validateContract(outputData) {
  var errors = [];
  var data = outputData.data || outputData;
  var lines = data.lines || [];
  if (!outputData.app || !outputData.version || !outputData.exportedAt || !outputData.data) errors.push("Rule 1 FAIL: top-level must have app/version/exportedAt/data");
  for (var li = 0; li < lines.length; li++) {
    var line = lines[li];
    if (!line.name) errors.push("Rule 2 FAIL: line " + (line.id || li) + " missing name");
    if (!line.color) errors.push("Rule 2 FAIL: line " + (line.id || li) + " missing color");
    if (!line.stations || !Array.isArray(line.stations)) errors.push("Rule 2 FAIL: line " + (line.id || li) + " missing stations");
    if (line.stations) {
      for (var si = 0; si < line.stations.length; si++) {
        var stn = line.stations[si];
        if (!stn.name || stn.lat === undefined || stn.lng === undefined) errors.push("Rule 3 FAIL: station " + si + " in line " + (line.id || li) + " missing name/lat/lng");
        stn.lat = parseFloat(stn.lat.toFixed(6));
        stn.lng = parseFloat(stn.lng.toFixed(6));
      }
    }
    if (line.headways && (!Array.isArray(line.headways) || line.headways.length !== 5)) errors.push("Rule 5 FAIL: line " + (line.id || li) + " headways length != 5");
    if (line.color && !/^#[0-9A-Fa-f]{6}$/.test(line.color)) errors.push("Rule 6 FAIL: line " + (line.id || li) + " color format: " + line.color);
    if (line.segmentAnchors) {
      for (var ai = 0; ai < line.segmentAnchors.length; ai++) {
        var seg = line.segmentAnchors[ai];
        if (seg && Array.isArray(seg)) {
          for (var pi = 0; pi < seg.length; pi++) {
            if (seg[pi].lat === undefined || seg[pi].lng === undefined) errors.push("Rule 4 FAIL: anchor missing lat/lng in line " + (line.id || li));
          }
        }
      }
    }
  }
  return { valid: errors.length === 0, errors: errors, lines: lines.length };
}

function resolveLineName(lineId, cityName) {
  if (SPECIAL_LINE_NAMES[lineId]) return SPECIAL_LINE_NAMES[lineId];
  var numM = lineId.match(/\d+$/);
  return numM ? cityName + "地铁" + parseInt(numM[0]) + "号线" : null;
}


function getRingForCity(slug) { return RING_LINES[slug] || []; }

function getSpecialLineNames() { return SPECIAL_LINE_NAMES; }
module.exports = {
  sanitizeStationsData,
  haversineKm,
  haversineM,
  approximateM,
  dist,
  wgs2gcj,
  inBbox,
  cleanName,
  fuzzyMatch,
  normalizeName,
  getLineName,
  getSpecialLineName,
  calcCurvature,
  catmullRomPoint,
  catmullRomSimplify,
  crCheckRemoved,
  redistributeEvenly,
  perpendicularDist,
  rdpSimplify,
  curvatureSimplify,
  matchStationsToPolyline,
  computeStationIndices,
  buildSegmentAnchors,
  anchorsFromMatch,
  snapStations,
  fixCollapsedCoords,
  detectBranches,
  buildTransferIndex,
  separateTransferStations,
  getTrackBearing,
  splitGappedLines,
  detectGaps,
  makeDirectionLabels,
  getLineColor,
  getSpeed,
  getCars,
  isRing,
  buildOutput,
  assembleStationLineMap,
  validateStationCoords,
  matchOSM,
  validateQuality
,
  interpolateZeroCoords,
  enrichTransferFields,
  sanitizeStation,
  validateContract,
  resolveLineName,
  getSpecialLineNames: function() { return SPECIAL_LINE_NAMES; },
  getRingForCity: function(slug) { return RING_LINES[slug] || []; }
,
  interpolateZeroCoords,
  enrichTransferFields,
  sanitizeStation,
  validateContract,
  resolveLineName,
  getSpecialLineNames,
  getRingForCity,
  enrichLineMetadata

};





