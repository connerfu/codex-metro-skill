// src/utils/geo.js ? ???? (SPEC P2-1)
// ? transform.js ??????????
// ??????? I/O

var EARTH_RADIUS_KM = 6371;

function toRadians(degrees) {
  return degrees * Math.PI / 180;
}

function haversineKm(a, b) {
  var deltaLat = toRadians(b.lat - a.lat);
  var deltaLng = toRadians(b.lng - a.lng);
  var sinDeltaLat = Math.sin(deltaLat / 2);
  var sinDeltaLng = Math.sin(deltaLng / 2);
  var hv = sinDeltaLat * sinDeltaLat
    + Math.cos(toRadians(a.lat))
    * Math.cos(toRadians(b.lat))
    * sinDeltaLng * sinDeltaLng;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(hv), Math.sqrt(1 - hv));
}

function haversineM(a, b) {
  return haversineKm(a, b) * 1000;
}

function approximateM(a, b) {
  var dlat = (a.lat - b.lat) * 111000;
  var dlng = (a.lng - b.lng) * 111000 * Math.cos(toRadians(a.lat));
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

function dist(a, b) {
  return approximateM(a, b);
}

function perpendicularDist(point, lineStart, lineEnd) {
  var dx = lineEnd.lng - lineStart.lng;
  var dy = lineEnd.lat - lineStart.lat;
  var lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return Math.hypot(point.lng - lineStart.lng, point.lat - lineStart.lat);
  }
  var t = Math.max(0, Math.min(1,
    ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) / lengthSq
  ));
  return Math.hypot(
    point.lng - lineStart.lng - t * dx,
    point.lat - lineStart.lat - t * dy
  );
}

module.exports = {
  haversineKm: haversineKm,
  haversineM: haversineM,
  approximateM: approximateM,
  dist: dist,
  perpendicularDist: perpendicularDist,
  toRadians: toRadians
};
