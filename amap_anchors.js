const req = require;
const fs = req("fs");
const https = req("https");

var AMAP_KEY = process.env.AMAP_KEY || "";
const CONCURRENCY = 2;
const TIMEOUT_MS = 12000;
const RATE_LIMIT_MS = 1000;
const SEGMENT_EPSILON = 10;
https.globalAgent.maxSockets = 10;

var _lastRateLimit = 0;
function rateLimit() {
  var now = Date.now();
  var next = _lastRateLimit + RATE_LIMIT_MS;
  _lastRateLimit = Math.max(now, next);
  return new Promise(function(r) { setTimeout(r, Math.max(0, _lastRateLimit - now)); });
}

function amapGet(path) {
  return rateLimit().then(function() {
    return new Promise(function(resolve) {
      var timer = setTimeout(function() { resolve(null); }, TIMEOUT_MS);
      https.get("https://restapi.amap.com" + path, { headers: { "User-Agent": "CodexMetro/5.0" } }, function(res) {
        var d = "";
        res.on("data", function(c) { d += c; });
        res.on("end", function() { clearTimeout(timer); try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
      }).on("error", function() { clearTimeout(timer); resolve(null); });
    });
  });
}

function dist(a, b) {
  var dlat = (a.lat - b.lat) * 111000;
  var dlng = (a.lng - b.lng) * 111000 * Math.cos(a.lat * Math.PI / 180);
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

function getLineSearchName(l, cityName) {
  var id = l.id || "";
  if (id.indexOf("TRAMWAY") >= 0) return id.indexOf("BRANCH") >= 0 ? "有轨电车蓉2号线支线" : "有轨电车蓉2号线";
  if (id.indexOf("LINE_S") >= 0) return "资阳线";
  var m = id.match(/\d+/);
  return m ? "成都地铁" + parseInt(m[0]) + "号线" : id;
}

// City detection for cross-city transit queries
function getCityForCoord(lat, lng, defaultCity) {
  if (defaultCity === "上海" && lng < 121.2) return encodeURIComponent("苏州");
  return encodeURIComponent(defaultCity);
}

// Curvature Catmull-Rom functions
function calcCurvature(pts) {
  if (pts.length < 3) return pts.map(function(){return 0;});
  var c = [0];
  for (var i = 1; i < pts.length - 1; i++) {
    var a = Math.abs(Math.atan2(pts[i+1].lat - pts[i].lat, pts[i+1].lng - pts[i].lng) - Math.atan2(pts[i].lat - pts[i-1].lat, pts[i].lng - pts[i-1].lng));
    c.push(a > Math.PI ? 2 * Math.PI - a : a);
  }
  c.push(0);
  return c;
}

function catmullRomPoint(p0, p1, p2, p3, t) {
  var t2 = t * t, t3 = t2 * t;
  return { lat: 0.5 * ((2*p1.lat) + (-p0.lat+p2.lat)*t + (2*p0.lat-5*p1.lat+4*p2.lat-p3.lat)*t2 + (-p0.lat+3*p1.lat-3*p2.lat+p3.lat)*t3), lng: 0.5 * ((2*p1.lng) + (-p0.lng+p2.lng)*t + (2*p0.lng-5*p1.lng+4*p2.lng-p3.lng)*t2 + (-p0.lng+3*p1.lng-3*p2.lng+p3.lng)*t3) };
}

function crCheckRemoved(full, ri, pts, idx, eps) {
  if (ri < 1 || ri + 1 >= full.length) return false;
  var b = full[ri-1], a = full[ri+1], p = pts[idx];
  if (ri >= 2 && ri + 2 < full.length) {
    for (var ti = 0; ti <= 50; ti++) { if (dist(catmullRomPoint(full[ri-2], b, a, full[ri+2], ti/50), p) <= eps) return true; }
    return false;
  }
  return dist(p, b) <= eps;
}

function redistributeEvenly(pts) {
  var n = pts.length;
  if (n <= 2) return pts;
  var cd = [0];
  for (var i = 1; i < n; i++) cd.push(cd[i-1] + dist(pts[i], pts[i-1]));
  var tot = cd[n-1];
  if (tot < 0.001) return pts;
  var step = tot / (n-1), r = [pts[0]], j = 1;
  for (var i = 1; i < n - 1; i++) {
    var tgt = i * step;
    while (j < n - 1 && cd[j+1] < tgt) j++;
    if (j >= n - 1) break;
    var t = (tgt - cd[j]) / (cd[j+1] - cd[j] || 1);
    r.push({ lat: pts[j].lat + (pts[j+1].lat - pts[j].lat) * t, lng: pts[j].lng + (pts[j+1].lng - pts[j].lng) * t });
  }
  r.push(pts[n-1]);
  return r;
}

function catmullRomSimplify(pts, eps) {
  if (pts.length < 3) return pts;
  var curv = calcCurvature(pts), th = 0.02;
  var ret = [0];
  for (var i = 1; i < pts.length - 1; i++) { if (curv[i] > th) ret.push(i); }
  ret.push(pts.length - 1);
  var changed = true;
  while (changed) {
    changed = false;
    for (var ri = 1; ri < ret.length-1; ri++) {
      if (curv[ret[ri]] > th*2) continue;
      if (crCheckRemoved(ret, ri, pts, ret[ri], eps)) { ret.splice(ri,1); ri--; changed = true; }
    }
  }
  var r = ret.map(function(i){return{lat:pts[i].lat,lng:pts[i].lng};});
  var i = 1;
  while (i < r.length) { if (dist(r[i], r[i-1]) < 50) r.splice(i,1); else i++; }
  i = 1;
  while (i < r.length - 1) {
    var cs = i-1;
    while (i < r.length && dist(r[i], r[i-1]) < 200) i++;
    if (i - cs >= 3) { var cl = r.slice(cs,i), rd = redistributeEvenly(cl); r.splice(cs,i-cs,...rd); i = cs + rd.length; }
    i++;
  }
  return r;
}

// Busline search with AMap POI fallback
async function findPolyline(l, cityName, allLines) {
  var name = getLineSearchName(l, cityName);
  // Strategy 1: busline name API
  for (var attempt = 0; attempt < 3; attempt++) {
    var result = await amapGet("/v3/bus/linename?key=" + AMAP_KEY + "&keywords=" + encodeURIComponent(name) + "&city=" + encodeURIComponent(cityName) + "&offset=10&page=1");
    if (result && result.status === "1" && result.buslines && result.buslines.length > 0) {
      var best = null;
      for (var bi = 0; bi < result.buslines.length; bi++) {
        var bl = result.buslines[bi], bt = bl.type || "", bn = bl.name || bl.bus_name || "";
        if (!bl.polyline) continue;
        if (bn.indexOf("摆渡车") >= 0 || bn.indexOf("假日接驳专线") >= 0 || bn.indexOf("接驳") >= 0) continue;
        var pts = bl.polyline.split(";");
        var sc = 0;
        if (bt.indexOf("地铁") >= 0) sc += 100;
        if (bt.indexOf("有轨电车") >= 0) sc += 50;
        if (bn.match(/^地铁\d+号线/)) sc += 200;
        sc += Math.min(pts.length, 500);
        if (!best || sc > best.score) best = { polyline: pts, score: sc };
      }
      if (best) { var tmp = best.polyline.map(function(p) { var ps = p.split(","); return { lng: +ps[0], lat: +ps[1] }; }); if (tmp.length >= 3 && l.stations && l.stations.length > 0) { var d = Math.sqrt(Math.pow((l.stations[0].lat-tmp[0].lat)*111000,2)+Math.pow((l.stations[0].lng-tmp[0].lng)*111000*Math.cos(l.stations[0].lat*Math.PI/180),2)); if (d <= 5000) return tmp; } }
    }
    if (result && result.status === "0") { await new Promise(function(r) { setTimeout(r, 2000); }); continue; }
    break;
  }
    // Strategy 2: transit direction between first/last station
  var st = l.stations, n = st.length;
  if (n < 2) return null;
  var dest = st[n-1].lng + "," + st[n-1].lat;
  var cityFrom = encodeURIComponent(cityName);
  var origins = [st[0].lng + "," + st[0].lat];
  if (n >= 2 && allLines) {
    var juncName = (st[0].name || "").replace(/站$/, "");
    for (var li = 0; li < allLines.length; li++) {
      var ol = allLines[li];
      if (ol === l || !ol.stations || ol.stations.length < 2) continue;
      for (var si2 = 1; si2 < ol.stations.length; si2++) {
        var sn = (ol.stations[si2].name || "").replace(/站$/, "");
        if (sn === juncName && ol.stations[si2 - 1]) {
          origins.push(ol.stations[si2 - 1].lng + "," + ol.stations[si2 - 1].lat);
          break;
        }
      }
    }
  }
  for (var oi = 0; oi < origins.length; oi++) {
    var orig = origins[oi];
    for (var si = 0; si < 3; si++) {
      var strat = [2, 0, 4][si];
      for (var ci = 0; ci < 2; ci++) {
        var cityD = ci === 0 ? cityFrom : getCityForCoord(st[n-1].lat, st[n-1].lng, cityName);
        var tr = await amapGet("/v3/direction/transit/integrated?key=" + AMAP_KEY + "&origin=" + orig + "&destination=" + dest + "&city=" + cityFrom + "&cityd=" + cityD + "&strategy=" + strat + "&nightflag=0");
        if (!tr || tr.status !== "1") continue;
        var transit = tr.route && tr.route.transits && tr.route.transits[0];
        if (!transit) continue;
        var polyline = null;
        (transit.segments || []).forEach(function(seg) {
          (seg.bus && seg.bus.buslines || []).forEach(function(bl) {
            if (bl.type && bl.type.indexOf("地铁") !== -1 && bl.polyline) polyline = bl.polyline;
          });
        });
        if (polyline && polyline.length > 20) return polyline.split(";").map(function(p) { var ps = p.split(","); return { lng: +ps[0], lat: +ps[1] }; });
      }
    }
  }
  return null;
}
function computeStationIndices(poly, st) {
  var idx = [], cur = 0;
  for (var i = 0; i < st.length; i++) {
    var s = st[i], bi = cur, bd = Infinity;
    for (var j = cur; j < poly.length; j++) { var d = dist(s, poly[j]); if (d < bd) { bd = d; bi = j; } }
    cur = bi; idx.push(bi);
  }
  return idx;
}

function buildSegmentAnchors(poly, stIdx) {
  var ans = [];
  for (var i = 0; i < stIdx.length - 1; i++) {
    var seg = poly.slice(stIdx[i], stIdx[i+1]+1);
    if (seg.length < 2) { ans.push([]); continue; }
    if (seg.length < 5) {
      ans.push(seg.slice(1, -1));
    } else {
      var s = catmullRomSimplify(seg, SEGMENT_EPSILON);
      ans.push(s.slice(1, -1));
    }
  }
  return ans;
}

async function processLine(l, city, allLines) {
  var poly = await findPolyline(l, city, allLines);
  if (!poly || poly.length < 3) return { ok: false, id: l.id, reason: "no polyline from busline API" };
  var st = l.stations, n = st.length;
  if (n < 2) return { ok: false, id: l.id, reason: "<2 stations" };
  var isRing = l.isRing || l._isRing || false;
  if (dist(st[0], poly[poly.length-1]) < dist(st[0], poly[0])) poly.reverse();
  if (dist(st[0], poly[0]) > 5000) return { ok: false, id: l.id, reason: "mismatch first=" + dist(st[0], poly[0]).toFixed(0) + "m" };
  // Station positions preserved from builder - no snapping to polyline
  var stIdx = computeStationIndices(poly, st);
  var ans = buildSegmentAnchors(poly, stIdx);
  if (isRing) {
    var wp = poly.slice(stIdx[n-1]).concat(poly.slice(0, stIdx[0]+1));
    var ws = catmullRomSimplify(wp, SEGMENT_EPSILON);
    ans.push(ws.slice(1, -1));
  }
  l.segmentAnchors = ans;
  var ac = ans.reduce(function(a, seg) { return a + seg.length; }, 0);
  return { ok: true, id: l.id, anchors: ans, pts: poly.length, aCount: ac };
}

async function processCity(slug, cityName, inFile, outFile) {
  var t0 = Date.now();
  console.log("\n=== " + cityName + " (" + slug + ") ===");
  var data = JSON.parse(fs.readFileSync(inFile, "utf8"));
  var lines = data.data && data.data.lines ? data.data.lines : data.lines || (Array.isArray(data) ? data : []);
  console.log("Total lines in data: " + lines.length);
  var queue = [];
  for (var li = 0; li < lines.length; li++) {
    var l = lines[li];
    if (l.stations.length < 2) continue;
    if (l.segmentAnchors && l.segmentAnchors.some(function(a) { return a && a.length > 0; })) { console.log("  SKIP " + l.id); continue; }
    queue.push(l);
  }
  console.log("Lines to process: " + queue.length + " (concurrency=" + CONCURRENCY + ")");
  var totalAnchors = 0, totalRaw = 0, ok = 0, fail = 0, i = 0;
  async function worker() {
    while (i < queue.length) {
      var idx = i++, l = queue[idx];
      process.stderr.write("\r  [" + (idx+1) + "/" + queue.length + "] " + l.id + ": " + (l.stations[0].name || "?") + " ...");
      var r = await processLine(l, cityName, data.data && data.data.lines ? data.data.lines : data.lines || (Array.isArray(data) ? data : []));
      if (r.ok) { totalAnchors += r.aCount; totalRaw += r.pts; ok++; console.log("  [" + (idx+1) + "/" + queue.length + "] " + l.id + " OK: " + r.pts + "->" + r.aCount + " (-" + ((1-r.aCount/r.pts)*100).toFixed(0) + "%)"); }
      else { fail++; console.log("  [" + (idx+1) + "/" + queue.length + "] " + l.id + " FAIL: " + (r.reason || "unknown")); }
    }
  }
  var workers = [];
  for (var w = 0; w < Math.min(CONCURRENCY, queue.length); w++) workers.push(worker());
  await Promise.all(workers);
  data.data.lineCounter = lines.length;
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2), "utf8");
  var e = ((Date.now() - t0) / 1000).toFixed(1);
  var ratio = totalRaw > 0 ? ((1 - totalAnchors / totalRaw) * 100).toFixed(0) : 0;
  console.log("\nDone: " + ok + "/" + queue.length + " OK, " + totalAnchors + " anchors (from " + totalRaw + " raw, -" + ratio + "%), " + fail + " failed, " + e + "s");
}

var args = process.argv;
var slug = args[2], cityName = args[3];
if (!slug) { console.log("Usage: amap_anchors.js {slug} {中文名}"); process.exit(1); }
var f = "C:/Users/Conner/Downloads/" + slug + "_metro.json";
if (!fs.existsSync(f)) { console.log("File not found: " + f); process.exit(1); }
processCity(slug, cityName, f, f).catch(function(e) { console.error(e); process.exit(1); });
