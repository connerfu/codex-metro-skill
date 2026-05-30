// === METRO BUILDER v7.8 [line-batch POI fill, cache-first, smart rescue] ===
var fs = require("fs"), https = require("https");
var args = process.argv;
var CITY = args[2], CITY_CN = args[3];
var MIN_LAT = +args[4], MAX_LAT = +args[5], MIN_LNG = +args[6], MAX_LNG = +args[7];
if (!CITY) { console.log("Usage: metro_builder.js CITY CITY_CN MIN_LAT MAX_LAT MIN_LNG MAX_LNG"); process.exit(1); }

var BBOX = { minLat: MIN_LAT, maxLat: MAX_LAT, minLng: MIN_LNG, maxLng: MAX_LNG };
var BBOX_PAD = 0.3;
var AMAP_KEY = process.env.AMAP_KEY || "";
var REQ_TIMEOUT = 5000, BATCH_DELAY = 300;
console.log("BBOX:", BBOX);

var OUT_DIR = "C:/Users/Conner/Downloads";
var REF_DIR = "C:/Users/Conner/Documents/New project/codex-metro-skill/references";
var COORDS_FILE = "C:/Users/Conner/Documents/New project/" + CITY + "_coords.json";
var OSM_CACHE = "C:/Users/Conner/Documents/New project/" + CITY + "_osm_cache.json";
var OUT_FILE = OUT_DIR + "/" + CITY + "_metro.json";

var LINE_DATA = JSON.parse(fs.readFileSync(REF_DIR + "/" + CITY + "_lines.json", "utf8"));
console.log("Loaded " + Object.keys(LINE_DATA).length + " lines");

function inBbox(c) { return c && c.lat !== 0 && c.lng !== 0 && c.lat > BBOX.minLat-BBOX_PAD && c.lat < BBOX.maxLat+BBOX_PAD && c.lng > BBOX.minLng-BBOX_PAD && c.lng < BBOX.maxLng+BBOX_PAD; }
function haversine(lat1, lng1, lat2, lng2) {
    var R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
    var a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function wgs2gcj(lat, lng) {
    var A = 6378245.0, ee = 0.00669342162296594323;
    function tL(x, y) { var r = -100+2*x+3*y+0.2*y*y+0.1*x*y+0.2*Math.sqrt(Math.abs(x)); r += (20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3; r += (20*Math.sin(y*Math.PI)+40*Math.sin(y/3*Math.PI))*2/3; r += (160*Math.sin(y/12*Math.PI)+320*Math.sin(y*Math.PI/30))*2/3; return r; }
    function tG(x, y) { var r = 300+x+2*y+0.1*x*x+0.1*x*y+0.1*Math.sqrt(Math.abs(x)); r += (20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3; r += (20*Math.sin(x*Math.PI)+40*Math.sin(x/3*Math.PI))*2/3; r += (150*Math.sin(x/12*Math.PI)+300*Math.sin(x/30*Math.PI))*2/3; return r; }
    var dLt = tL(lng-105,lat-35), dLn = tG(lng-105,lat-35), rad = lat/180*Math.PI, m = Math.sin(rad);
    m = 1-ee*m*m; var sm = Math.sqrt(m);
    dLt = (dLt*180)/((A*(1-ee))/(m*sm)*Math.PI); dLn = (dLn*180)/(A/sm*Math.cos(rad)*Math.PI);
    return { lat: lat+dLt, lng: lng+dLn };
}

// ========== Overpass ==========
function queryOverpass() {
    return new Promise(function(resolve) {
        var body = '[out:json][timeout:8];(node["railway"="station"]["station"="subway"](' + BBOX.minLat + ',' + BBOX.minLng + ',' + BBOX.maxLat + ',' + BBOX.maxLng + '););out body;';
        var mirrors = [{ host: "overpass-api.de", name: "primary" },{ host: "overpass.kumi.systems", name: "kumi" },{ host: "overpass.openstreetmap.fr", name: "osmfr" }];
        var tries = 0;
        function tryMirror() {
            if (tries >= mirrors.length) { resolve([]); return; }
            var m = mirrors[tries++], done = false;
            var timer = setTimeout(function() { if (!done) { done = true; req.destroy(); tryMirror(); } }, REQ_TIMEOUT);
            var req = https.request({ hostname: m.host, path: "/api/interpreter", method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Codex/7.8" } }, function(res) {
                var data = "";
                res.on("data", function(c) { data += c; });
                res.on("end", function() { if (done) return; done = true; clearTimeout(timer);
                    try { var j = JSON.parse(data); var nodes = j.elements || []; if (nodes.length > 0) resolve(nodes); else tryMirror(); } catch(e) { tryMirror(); } });
            });
            req.on("error", function() { if (!done) { done = true; clearTimeout(timer); tryMirror(); } });
            req.write(body); req.end();
        }
        tryMirror();
    });
}

function clean(s) { return (s||"").replace(/[(\uFF08][^)\uFF09]*[)\uFF09]/g,"").replace(/\u7AD9/g,"").replace(/\s+/g,"").replace(/\u00B7/g,""); }
var CITY_PREFIXES = /^(\u91CD\u5E86|\u5317\u4EAC|\u4E0A\u6D77|\u5929\u6D25|\u5357\u4EAC|\u6B66\u6C49|\u6C88\u9633|\u6210\u90FD|\u5E7F\u5DDE|\u6DF1\u5733|\u676D\u5DDE|\u82CF\u5DDE|\u65E0\u9521|\u897F\u5B89|\u90D1\u5DDE|\u9752\u5C9B|\u5927\u8FDE|\u957F\u6625|\u4F5B\u5C71|\u4E1C\u839E)/;

function fuzzyMatch(osmName, target) {
    var ct = clean(target), co = clean(osmName);
    if (!ct || !co) return 0;
    if (ct === co) return 1;
    if (co.includes(ct) || ct.includes(co)) return 0.9;
    var ts = ct.replace(CITY_PREFIXES, ""), os = co.replace(CITY_PREFIXES, "");
    if (ts === os && ts.length >= 2) return 0.85;
    return 0;
}

// ========== AMap POI search by line (one query = all stations on the line) ==========
function amapLineSearch(lineNum) {
    return new Promise(function(resolve) {
        var kw = encodeURIComponent(CITY_CN + "\u5730\u94C1" + lineNum + "\u53F7\u7EBF");
        var path = "/v3/place/text?key=" + AMAP_KEY + "&keywords=" + kw + "&types=150500&city=" + encodeURIComponent(CITY_CN) + "&offset=50&page=1";
        var done = false;
        var timer = setTimeout(function() { if (!done) { done = true; req.destroy(); resolve([]); } }, REQ_TIMEOUT);
        var req = https.get({ hostname: "restapi.amap.com", path: path, headers: { "User-Agent": "CodexMetro/7.8" }, agent: false }, function(res) {
            var d = "";
            res.on("data", function(c) { d += c; });
            res.on("end", function() {
                if (done) return; done = true; clearTimeout(timer);
                try {
                    var j = JSON.parse(d);
                    if (j.status === "1" && j.pois) {
                        var results = j.pois.map(function(p) {
                            var loc = (p.location||"").split(",");
                            return { name: (p.name||"").replace(/\u7AD9$/,"").replace(/\uFF08/g,"(").replace(/\uFF09/g,")").trim(), lat: parseFloat(loc[1]), lng: parseFloat(loc[0]) };
                        }).filter(function(r) { return r.name && !isNaN(r.lat) && !isNaN(r.lng); });
                        resolve(results);
                    } else resolve([]);
                } catch(e) { resolve([]); }
            });
        });
        req.on("error", function() { if (!done) { done = true; clearTimeout(timer); resolve([]); } });
        req.end();
    });
}

// ========== AMap single-station geocode (for rescue) ==========
function amapGeocode(name, city) {
    return new Promise(function(resolve) {
        var q = encodeURIComponent(name);
        var path = "/v3/geocode/geo?key=" + AMAP_KEY + "&address=" + q + "&city=" + encodeURIComponent(city);
        var done = false;
        var timer = setTimeout(function() { if (!done) { done = true; req.destroy(); resolve(null); } }, REQ_TIMEOUT);
        var req = https.get({ hostname: "restapi.amap.com", path: path, headers: { "User-Agent": "CodexMetro/7.8" }, agent: false }, function(res) {
            var d = "";
            res.on("data", function(c) { d += c; });
            res.on("end", function() {
                if (done) return; done = true; clearTimeout(timer);
                try {
                    var j = JSON.parse(d);
                    if (j.status === "1" && j.geocodes && j.geocodes.length > 0) {
                        var loc = j.geocodes[0].location.split(",");
                        resolve({ lat: parseFloat(loc[1]), lng: parseFloat(loc[0]) });
                    } else resolve(null);
                } catch(e) { resolve(null); }
            });
        });
        req.on("error", function() { if (!done) { done = true; clearTimeout(timer); resolve(null); } });
        req.end();
    });
}

function buildOutput(coords) {
    var stationLines = {};
    Object.entries(LINE_DATA).forEach(function(e) { var lid = e[0]; e[1].stations.forEach(function(s) { if (!stationLines[s]) stationLines[s] = []; stationLines[s].push(lid); }); });
    var transfers = {};
    Object.entries(stationLines).forEach(function(e) { if (e[1].length > 1) transfers[e[0]] = e[1]; });
    var outputLines = [], totalDist = 0, totalStations = 0, warnings = [];
    Object.entries(LINE_DATA).forEach(function(e) {
        var lid = e[0], l = e[1];
        var stns = l.stations.map(function(s, i) {
            var c = coords[s + "|" + lid] || { lat: 0, lng: 0 };
            return { sid: CITY + "_" + lid + "_" + (i+1), lat: c.lat, lng: c.lng, name: s + "\u7AD9", isTransfer: !!transfers[s], transferType: !!transfers[s] ? "same_station" : null, transferGroupId: !!transfers[s] ? s : null, latlngWgs: { lat: 0, lng: 0 } };
        });
        var dist = 0;
        for (var i = 0; i < stns.length-1; i++) { var gap = haversine(stns[i].lat, stns[i].lng, stns[i+1].lat, stns[i+1].lng); dist += gap; if (gap > 3) warnings.push(lid + " " + l.name + ": " + l.stations[i] + "\u2192" + l.stations[i+1] + " = " + gap.toFixed(1) + "km"); }
        var rtt = (dist*2/l.speed)*60 + stns.length*0.5;
        console.log("  " + lid + " " + l.name + ": " + stns.length + "\u7AD9 " + dist.toFixed(1) + "km \u73ED\u6B21:" + Math.max(1,Math.round(rtt/2)) + "/" + Math.max(1,Math.round(rtt/4)) + "/" + Math.max(1,Math.round(rtt/6)));
        totalDist += dist; totalStations += stns.length;
        outputLines.push({ id: lid, name: l.name, _lineNameCustomizedByUser: true, color: l.color, isRing: l.ring, branchRootId: null, trainType: "B", trainCars: l.cars, maxSpeedKmh: l.speed, freqPeak: Math.max(1,Math.round(rtt/2)), freqOff: Math.max(1,Math.round(rtt/4)), freqLow: Math.max(1,Math.round(rtt/6)), freqPeakWeekend: null, freqOffWeekend: null, serviceOpenMin: l.so, serviceCloseMin: l.sc, service24h: false, expressStops: null, expressCaps: null, stations: stns, segmentAnchors: Array.from({ length: l.ring ? stns.length : Math.max(0, stns.length-1) }, function() { return []; }) });
    });
    if (warnings.length > 0) { console.log("\n" + warnings.length + " warnings:"); warnings.forEach(function(w) { console.log("  " + w); }); }
    var out = { app: "Cities Designers", version: 2, exportedAt: new Date().toISOString(), data: { cityKey: CITY, lineCounter: outputLines.length, simMin: 420, simDay: 0, paused: false, lines: outputLines, coordSystem: "gcj02", stationODHourlyMults: null } };
    fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), "utf8");
    return { lines: outputLines.length, stations: totalStations, transfers: Object.keys(transfers).length, distance: totalDist, warnings: warnings.length };
}

async function main() {
    var t0 = Date.now();
    console.log("\n=== " + CITY_CN + " Metro v7.8 [line-batch] ===\n");
    var stationPairs = [];
    Object.entries(LINE_DATA).forEach(function(e) { var lid = e[0]; e[1].stations.forEach(function(s) { stationPairs.push({ name: s, lid: lid }); }); });
    var uniqueNames = new Set(); stationPairs.forEach(function(p) { uniqueNames.add(p.name); });
    var nameList = Array.from(uniqueNames);
    console.log("Lines: " + Object.keys(LINE_DATA).length + ", stations: " + nameList.length + " unique, " + stationPairs.length + " occurrences");
    var coords = {}; stationPairs.forEach(function(p) { coords[p.name + "|" + p.lid] = { lat: 0, lng: 0 }; });

    // Phase 1: OSM cache
    console.log("\n[1/3] OSM cache...");
    var osmNodes = [];
    var hasCache = false;
    try { osmNodes = JSON.parse(fs.readFileSync(OSM_CACHE, "utf8")); hasCache = true; } catch(e) {}
    if (hasCache) { console.log("  Loaded " + osmNodes.length + " from cache"); }
    else {
        console.log("  Querying Overpass...");
        osmNodes = await queryOverpass();
        if (osmNodes.length > 0) { console.log("  " + osmNodes.length + " nodes"); try { fs.writeFileSync(OSM_CACHE, JSON.stringify(osmNodes), "utf8"); } catch(e) {} }
        else { console.log("  Overpass down"); }
    }
    var osmHits = 0;
    nameList.forEach(function(s) {
        var best = null, bestScore = 0;
        osmNodes.forEach(function(n) { var sc = fuzzyMatch(n.tags.name || "", s); if (sc > bestScore) { bestScore = sc; best = n; } });
        if (best && bestScore >= 0.8) {
            var gcj = wgs2gcj(best.lat, best.lon);
            if (inBbox(gcj)) { stationPairs.forEach(function(p) { if (p.name === s) coords[p.name + "|" + p.lid] = { lat: gcj.lat, lng: gcj.lng, source: "osm" }; }); osmHits++; }
        }
    });
    console.log("  Matched: " + osmHits + "/" + nameList.length + " (" + (osmHits/nameList.length*100).toFixed(0) + "%)");

    // Phase 2: LINE-BATCH POI fill — one query per line, match by name
    console.log("\n[2/3] Line-batch POI fill...");
    var lineEntries = Object.entries(LINE_DATA);
    var batchHits = 0;
    for (var li = 0; li < lineEntries.length; li++) {
        var lid = lineEntries[li][0], l = lineEntries[li][1];
        var lineNum = lid.replace(/^[A-Z]+/, "");
        // Handle special line IDs (S1, CA, JX, YZ, YF, FS, CP, etc.)
        var searchNum = lineNum;
        if (lid === "BJS1") searchNum = "S1";
        else if (lid === "BJCA") searchNum = "\u9996\u90FD\u673A\u573A\u7EBF"; // 首都机场线
        else if (lid === "BJJX") searchNum = "\u5927\u5174\u673A\u573A\u7EBF"; // 大兴机场线
        else if (lid === "BJYZ") searchNum = "\u4EA6\u5E84\u7EBF"; // 亦庄线
        else if (lid === "BJYF") searchNum = "\u71D5\u623F\u7EBF"; // 燕房线
        else if (lid === "BJFS") searchNum = "\u623F\u5C71\u7EBF"; // 房山线
        else if (lid === "BJCP") searchNum = "\u660C\u5E73\u7EBF"; // 昌平线
        else if (lid === "BJ1ZX") searchNum = "1\u53F7\u7EBF\u652F\u7EBF"; // 1号线支线

        var pois = await amapLineSearch(searchNum);
        
        // Match POIs to reference stations by name
        var matched = 0;
        l.stations.forEach(function(s) {
            if (coords[s + "|" + lid].lat !== 0) return; // already have OSM
            // Fuzzy match
            var best = null, bestDist = 999;
            pois.forEach(function(p) {
                var d = Math.abs(clean(s).length - clean(p.name).length);
                if (clean(s) === clean(p.name) || p.name.includes(s) || s.includes(p.name)) {
                    if (d < bestDist) { bestDist = d; best = p; }
                }
            });
            if (best && inBbox(best)) {
                coords[s + "|" + lid] = { lat: best.lat, lng: best.lng, source: "amap_line" };
                matched++;
            }
        });
        batchHits += matched;
        process.stdout.write("  " + lid + ":" + matched + "/" + l.stations.length + " ");
        await new Promise(function(r) { setTimeout(r, BATCH_DELAY); });
    }
    console.log("\n  Line-batch hits: " + batchHits);

    // Phase 2b: Individual geocode for remaining unmatched
    var unmatched = stationPairs.filter(function(p) { return coords[p.name + "|" + p.lid].lat === 0; });
    if (unmatched.length > 0 && AMAP_KEY) {
        console.log("\n[2b] Individual geocode (" + unmatched.length + " remaining)...");
        var filled = 0;
        for (var i = 0; i < unmatched.length; i += 3) {
            var batch = unmatched.slice(i, i + 3);
            var results = await Promise.all(batch.map(function(p) {
                var lineNum = p.lid.replace(/^[A-Z]+/, "");
                return amapGeocode(p.name + "\u5730\u94C1\u7AD9" + lineNum + "\u53F7\u7EBF", CITY_CN);
            }));
            for (var j = 0; j < batch.length; j++) {
                if (results[j] && inBbox(results[j])) {
                    coords[batch[j].name + "|" + batch[j].lid] = { lat: results[j].lat, lng: results[j].lng, source: "amap" };
                    filled++;
                }
            }
            if (i % 50 === 0 && i > 0) process.stdout.write(Math.round(i/unmatched.length*100) + "% ");
            if (i + 3 < unmatched.length) await new Promise(function(r) { setTimeout(r, 200); });
        }
        console.log("  Filled: " + filled);
    }

    // Phase 3: Anomaly + Interpolation
    console.log("\n[3/3] Anomaly + Interpolation...");
    // Anomaly clear
    var cleared = 0;
    Object.entries(LINE_DATA).forEach(function(e) { var lid = e[0], s = e[1].stations;
        for (var i = 0; i < s.length; i++) { var c = coords[s[i] + "|" + lid]; if (!c || c.lat === 0) continue;
            var pi = i-1, ni = i+1; while (pi >= 0 && coords[s[pi] + "|" + lid].lat === 0) pi--; while (ni < s.length && coords[s[ni] + "|" + lid].lat === 0) ni++;
            var thresh = (c.source === "interp" || c.source === "extrap") ? 2 : 4;
            if ((pi < 0 || haversine(c.lat,c.lng,coords[s[pi]+"|"+lid].lat,coords[s[pi]+"|"+lid].lng) > thresh) && (ni >= s.length || haversine(c.lat,c.lng,coords[s[ni]+"|"+lid].lat,coords[s[ni]+"|"+lid].lng) > thresh)) { coords[s[i]+"|"+lid] = { lat:0,lng:0 }; cleared++; }
        }
    });
    console.log("  Anomalies cleared: " + cleared);
    
    // Interpolation
    var needInterp = stationPairs.filter(function(p) { return coords[p.name + "|" + p.lid].lat === 0; });
    if (needInterp.length > 0) {
        console.log("  Interpolating " + needInterp.length + "...");
        Object.entries(LINE_DATA).forEach(function(e) { var lid = e[0], s = e[1].stations;
            for (var i = 0; i < s.length; i++) { if (coords[s[i]+"|"+lid].lat !== 0) continue;
                var pi = i-1, ni = i+1; while (pi >= 0 && coords[s[pi]+"|"+lid].lat === 0) pi--; while (ni < s.length && coords[s[ni]+"|"+lid].lat === 0) ni++;
                if (pi >= 0 && ni < s.length) { var pr = coords[s[pi]+"|"+lid], nx = coords[s[ni]+"|"+lid]; coords[s[i]+"|"+lid] = { lat: pr.lat+(nx.lat-pr.lat)*(i-pi)/(ni-pi), lng: pr.lng+(nx.lng-pr.lng)*(i-pi)/(ni-pi), source: "interp" }; }
                else if (pi >= 0) { coords[s[i]+"|"+lid] = { lat: coords[s[pi]+"|"+lid].lat, lng: coords[s[pi]+"|"+lid].lng, source: "extrap_fb" }; }
                else if (ni < s.length) { coords[s[i]+"|"+lid] = { lat: coords[s[ni]+"|"+lid].lat, lng: coords[s[ni]+"|"+lid].lng, source: "extrap_fb" }; }
            }
        });
    }

    try { fs.writeFileSync(COORDS_FILE, JSON.stringify(coords, null, 2), "utf8"); } catch(e) {}
    console.log("\n[Build] Assembling...");
    var stats = buildOutput(coords);
    var elapsed = ((Date.now()-t0)/1000).toFixed(1);
    console.log("\nDone in " + elapsed + "s! " + stats.lines + "\u7EBF " + stats.stations + "\u7AD9 " + stats.transfers + "\u6362\u4E58 " + stats.distance.toFixed(0) + "km \u8B66\u544A:" + stats.warnings);
    console.log("Output: " + OUT_FILE);
}
main().catch(function(e) { console.error("FATAL:", e.message || e); });