// lib/anchor-simplify.js — 轨道 polyline 简化算法
// 关键改动：从 amap_anchors.js 和 seg_anchors.js 提取清洁版本

const { approximateM } = require("./geo");

/**
 * 点到线段的垂直距离（用于 RDP 算法）
 */
function perpendicularDist(point, lineStart, lineEnd) {
  const dx = lineEnd.lng - lineStart.lng;
  const dy = lineEnd.lat - lineStart.lat;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return Math.hypot(point.lng - lineStart.lng, point.lat - lineStart.lat);
  }
  const t = Math.max(0, Math.min(1,
    ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) / lengthSq
  ));
  return Math.hypot(
    point.lng - lineStart.lng - t * dx,
    point.lat - lineStart.lat - t * dy
  );
}

/**
 * Ramer-Douglas-Peucker 折线简化
 * @param {Array<{lat:number,lng:number}>} points - 原始点列
 * @param {number} epsilon - 简化阈值（度）
 * @returns {Array<{lat:number,lng:number}>}
 */
function rdpSimplify(points, epsilon) {
  if (points.length <= 2) return points;

  const ep = epsilon / 111000; // 米 → 度近似

  function rec(start, end) {
    let maxDist = 0;
    let maxIndex = start;
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDist(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        maxIndex = i;
      }
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

/**
 * 计算三点间的曲率（弧度/米）
 */
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

/**
 * Catmull-Rom 插值点
 */
function catmullRomPoint(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    lat: 0.5 * (2 * p1.lat
      + (-p0.lat + p2.lat) * t
      + (2 * p0.lat - 5 * p1.lat + 4 * p2.lat - p3.lat) * t2
      + (-p0.lat + 3 * p1.lat - 3 * p2.lat + p3.lat) * t3),
    lng: 0.5 * (2 * p1.lng
      + (-p0.lng + p2.lng) * t
      + (2 * p0.lng - 5 * p1.lng + 4 * p2.lng - p3.lng) * t2
      + (-p0.lng + 3 * p1.lng - 3 * p2.lng + p3.lng) * t3)
  };
}

/**
 * 曲率感知的 polyline 简化
 * 保留弯曲度高的点，平滑低曲率区域
 */
function curvatureSimplify(points, maxError) {
  const n = points.length;
  if (n <= 3) return points.slice();

  // 计算每点曲率
  const curvature = new Array(n);
  curvature[0] = 0;
  curvature[n - 1] = 0;
  for (let i = 1; i < n - 1; i++) {
    curvature[i] = calcCurvature(points[i - 1], points[i], points[i + 1]);
  }

  // 取 P95 曲率作为阈值
  const sorted = [...curvature].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(n * 0.95)];
  const threshold = Math.max(0.0005, Math.min(p95 * 0.5, 0.01));

  // 保留高曲率点
  const retained = [0];
  for (let i = 1; i < n - 1; i++) {
    if (curvature[i] > threshold) retained.push(i);
  }
  retained.push(n - 1);

  return retained.map(i => points[i]);
}

module.exports = { rdpSimplify, curvatureSimplify, calcCurvature, catmullRomPoint };
