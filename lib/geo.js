// lib/geo.js — 统一的地理计算工具模块
// 关键改动：消除 8 处重复的距离计算和 3 处坐标转换

const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_M = 6371000;

function toRadians(degrees) {
  return degrees * Math.PI / 180;
}

/**
 * Haversine 公式计算两点间距离，返回公里
 */
function haversineKm(pointA, pointB) {
  const deltaLat = toRadians(pointB.lat - pointA.lat);
  const deltaLng = toRadians(pointB.lng - pointA.lng);
  const sinDeltaLat = Math.sin(deltaLat / 2);
  const sinDeltaLng = Math.sin(deltaLng / 2);
  const a = sinDeltaLat ** 2
    + Math.cos(toRadians(pointA.lat))
    * Math.cos(toRadians(pointB.lat))
    * sinDeltaLng ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Haversine 公式计算两点间距离，返回米
 */
function haversineM(pointA, pointB) {
  return haversineKm(pointA, pointB) * 1000;
}

/**
 * 近似距离计算（无三角函数，适用于小范围快速估算）
 */
function approximateM(pointA, pointB) {
  const deltaLatM = (pointA.lat - pointB.lat) * 111000;
  const deltaLngM = (pointA.lng - pointB.lng) * 111000 * Math.cos(toRadians(pointA.lat));
  return Math.sqrt(deltaLatM * deltaLatM + deltaLngM * deltaLngM);
}

/**
 * WGS84 → GCJ02 坐标偏移（火星坐标系）
 */
function wgs84ToGcj02(lat, lng) {
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

module.exports = { haversineKm, haversineM, approximateM, wgs84ToGcj02 };
