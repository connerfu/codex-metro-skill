// fix_transfers.js v4.1 - Unicode-safe transfer station separation
var https = require("https"), fs = require("fs");
var AMAP_KEY = "c037d67ccb46f69c5f1b7a9b84c61e0e";
var slug = process.argv[2] || "beijing", cityName = process.argv[3] || "\u5317\u4EAC";
var file = "C:/Users/Conner/Downloads/" + slug + "_metro.json";
var POI_MAX_DIST = 500, GEO_OFFSET = 60, POI_INTERVAL = 80;

function dist(a,b){var dlat=(a.lat-b.lat)*111000,dlng=(a.lng-b.lng)*111000*Math.cos(a.lat*Math.PI/180);return Math.sqrt(dlat*dlat+dlng*dlng)}

var lastReq = 0;
function rateLimit() {
    var now = Date.now(), wait = Math.max(0, POI_INTERVAL - (now - lastReq));
    lastReq = now + wait;
    return new Promise(function(r) { setTimeout(r, wait); });
}

function amapPOI(keyword, lineNum) {
    return rateLimit().then(function() {
        return new Promise(function(r) {
            var kw = encodeURIComponent(keyword + "\u5730\u94C1\u7AD9" + (lineNum ? lineNum + "\u53F7\u7EBF" : ""));
            var path = "/v3/place/text?key=" + AMAP_KEY + "&keywords=" + kw + "&types=150500&city=" + encodeURIComponent(cityName) + "&offset=3&page=1";
            var timer = setTimeout(function() { r(null); }, 10000);
            https.get("https://restapi.amap.com" + path, {headers:{"User-Agent":"CM/4"}}, function(res) {
                var d = ""; res.on("data", function(c) { d += c; });
                res.on("end", function() { clearTimeout(timer);
                    try { var j = JSON.parse(d); if (j.status === "1" && j.pois) r(j.pois); else r([]); }
                    catch(e) { r([]); }
                });
            }).on("error", function() { clearTimeout(timer); r([]); });
        });
    });
}

async function main() {
    var t0 = Date.now();
    console.log("\n=== Transfer Separation: " + cityName + " ===");
    var data = JSON.parse(fs.readFileSync(file, "utf8"));
    var lines = data.data?.lines || data.lines || [];
    
    // Find transfer stations
    var transferMap = {};
    for (var li = 0; li < lines.length; li++) {
        var l = lines[li], st = l.stations;
        if (!st) continue;
        for (var si = 0; si < st.length; si++) {
            var s = st[si], key = s.name;
            if (!transferMap[key]) transferMap[key] = [];
            transferMap[key].push({ li: li, si: si, lid: l.id });
        }
    }
    
    // Filter to actual transfers (station appears in 2+ lines)
    var transfers = [];
    for (var key in transferMap) {
        if (transferMap[key].length >= 2) transfers.push({ name: key, entries: transferMap[key] });
    }
    console.log("Transfer stations: " + transfers.length);
    
    var poiDone = 0, geoDone = 0;
    for (var ti = 0; ti < transfers.length; ti++) {
        var t = transfers[ti];
        var entries = t.entries;
        var uniqueLines = [];
        for (var ei = 0; ei < entries.length; ei++) {
            if (uniqueLines.indexOf(entries[ei].lid) === -1) uniqueLines.push(entries[ei].lid);
        }
        if (uniqueLines.length < 2) continue;
        
        // Try POI search for each line
        var poiResults = [];
        for (var ei = 0; ei < entries.length; ei++) {
            var e = entries[ei], l = lines[e.li];
            var lineNum = l.name ? l.name.match(/(\d+)/) : null;
            var pois = await amapPOI(t.name, lineNum ? lineNum[1] : "");
            
            var bestPoi = null, bestDist = Infinity;
            var s = l.stations[e.si];
            for (var pi = 0; pi < pois.length; pi++) {
                var p = pois[pi], ploc = p.location ? p.location.split(",") : null;
                if (!ploc) continue;
                var plat = parseFloat(ploc[1]), plng = parseFloat(ploc[0]);
                var d = dist(s, {lat: plat, lng: plng});
                if (d < bestDist && d < POI_MAX_DIST) { bestDist = d; bestPoi = {lat: plat, lng: plng}; }
            }
            poiResults.push({ ei: ei, poi: bestPoi, dist: bestDist });
        }
        
        // Apply POI results if we have at least 2 different locations
        var uniqueLocs = [];
        for (var ri = 0; ri < poiResults.length; ri++) {
            if (poiResults[ri].poi) {
                var dup = false;
                for (var ui = 0; ui < uniqueLocs.length; ui++) {
                    if (dist(poiResults[ri].poi, uniqueLocs[ui]) < 30) dup = true;
                }
                if (!dup) uniqueLocs.push(poiResults[ri].poi);
            }
        }
        
        if (uniqueLocs.length >= 2) {
            // Apply different positions for different lines
            for (var ri = 0; ri < poiResults.length; ri++) {
                if (poiResults[ri].poi) {
                    var e = entries[poiResults[ri].ei];
                    var l = lines[e.li], s = l.stations[e.si];
                    s.lat = poiResults[ri].poi.lat;
                    s.lng = poiResults[ri].poi.lng;
                    s.isTransfer = true;
                    s.transferType = "same_station";
                    s.transferGroupId = t.name;
                    poiDone++;
                }
            }
        } else if (poiResults.length >= 2 && poiResults.some(function(r) { return r.poi; })) {
            // Geometric offset fallback
            var baseEntry = null;
            for (var ri = 0; ri < poiResults.length; ri++) {
                if (poiResults[ri].poi) { baseEntry = poiResults[ri]; break; }
            }
            if (baseEntry) {
                var baseE = entries[baseEntry.ei], baseS = lines[baseE.li].stations[baseE.si];
                for (var ri = 0; ri < poiResults.length; ri++) {
                    if (poiResults[ri].poi || ri === baseEntry.ei) continue;
                    var e = entries[poiResults[ri].ei], l = lines[e.li], s = l.stations[e.si];
                    // Offset perpendicular to the line direction
                    var dx = 0, dy = 0;
                    if (e.si > 0) { dx += s.lng - l.stations[e.si-1].lng; dy += s.lat - l.stations[e.si-1].lat; }
                    if (e.si < l.stations.length - 1) { dx += l.stations[e.si+1].lng - s.lng; dy += l.stations[e.si+1].lat - s.lat; }
                    var len = Math.sqrt(dx*dx + dy*dy) || 1;
                    var perpLng = -dy / len * GEO_OFFSET / 111000;
                    var perpLat = dx / len * GEO_OFFSET / 111000;
                    s.lat += perpLat;
                    s.lng += perpLng;
                    s.isTransfer = true;
                    s.transferType = "same_station";
                    s.transferGroupId = t.name;
                    geoDone++;
                }
            }
        } else {
            // Mark as transfer even without separation
            for (var ei = 0; ei < entries.length; ei++) {
                var e = entries[ei], l = lines[e.li], s = l.stations[e.si];
                s.isTransfer = true;
                s.transferType = "same_station";
                s.transferGroupId = t.name;
            }
        }
        
        if ((ti+1) % 50 === 0) process.stderr.write("\r  " + (ti+1) + "/" + transfers.length);
    }
    
    var elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log("\nDone: POI=" + poiDone + " Geo=" + geoDone + " " + elapsed + "s");
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}
main().catch(function(e) { console.error(e); process.exit(1); });