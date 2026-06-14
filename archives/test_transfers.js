const https = require("https");
const fs = require("fs");

const AMAP_KEY = "c037d67ccb46f69c5f1b7a9b84c61e0e";
const slug = "beijing";
const cityName = "\u5317\u4EAC";
const file = "C:/Users/Conner/Downloads/beijing_metro.json";
const POI_INTERVAL = 80;

function dist(a, b) {
    var dlat = (a.lat - b.lat) * 111000;
    var dlng = (a.lng - b.lng) * 111000 * Math.cos(a.lat * Math.PI / 180);
    return Math.sqrt(dlat * dlat + dlng * dlng);
}

var lastReq = 0;
function rateLimit() {
    var now = Date.now(), wait = Math.max(0, POI_INTERVAL - (now - lastReq));
    lastReq = now + wait;
    return new Promise(function(r) { setTimeout(r, wait); });
}

function amapPOI(keyword, lineNum) {
    return rateLimit().then(function() {
        return new Promise(function(r) {
            var cleanName = keyword.replace(/\u7AD9$/, "");
            var kw = encodeURIComponent(cleanName + "\u5730\u94C1\u7AD9" + (lineNum ? lineNum + "\u53F7\u7EBF" : ""));
            var path = "/v3/place/text?key=" + AMAP_KEY + "&keywords=" + kw + "&types=150500&city=" + encodeURIComponent(cityName) + "&offset=10&page=1";
            var timer = setTimeout(function() { r([]); }, 10000);
            https.get("https://restapi.amap.com" + path, {headers:{"User-Agent":"CM/5"}}, function(res) {
                var d = ""; res.on("data", function(c) { d += c; });
                res.on("end", function() { clearTimeout(timer);
                    try { var j = JSON.parse(d); if (j.status === "1" && j.pois) r(j.pois); else { console.log("FAIL:", decodeURIComponent(kw), "status:", j.status, "count:", j.count); r([]); } }
                    catch(e) { console.log("PARSE_ERR:", e.message.substring(0,40)); r([]); }
                });
            }).on("error", function(e) { console.log("REQ_ERR:", decodeURIComponent(kw), e.message); clearTimeout(timer); r([]); });
        });
    });
}

async function testFew() {
    var data = JSON.parse(fs.readFileSync(file, "utf8"));
    var lines = data.data.lines;
    
    // Find first few transfer stations
    var transferMap = {};
    for (var li = 0; li < lines.length; li++) {
        var l = lines[li], st = l.stations;
        if (!st) continue;
        for (var si = 0; si < st.length; si++) {
            var s = st[si], key = s.name;
            if (!transferMap[key]) transferMap[key] = [];
            transferMap[key].push({ li: li, si: si, lid: l.id, lineName: l.name });
        }
    }
    
    var transfers = [];
    for (var key in transferMap) {
        if (transferMap[key].length >= 2) transfers.push({ name: key, entries: transferMap[key] });
    }
    console.log("Total transfer stations:", transfers.length);
    
    // Test first 5
    for (var ti = 0; ti < Math.min(5, transfers.length); ti++) {
        var t = transfers[ti];
        var e = t.entries[0];
        var l = lines[e.li];
        var m = l.name ? l.name.match(/(\d+)/) : null;
        var ln = m ? m[1] : "";
        console.log("\n--- [" + t.name + "] Line:", l.name, "LineNum:", ln);
        
        var pois = await amapPOI(t.name, ln);
        console.log("POIs found:", pois.length);
        
        var entrances = [];
        for (var pi = 0; pi < pois.length; pi++) {
            var p = pois[pi], ploc = p.location ? p.location.split(",") : null;
            if (!ploc) continue;
            var plat = parseFloat(ploc[1]), plng = parseFloat(ploc[0]);
            var isEntrance = p.name && /[A-Za-z]\d*\u53E3/.test(p.name);
            console.log("  POI[" + pi + "]:", p.name, "loc:", ploc[0], ploc[1], "isEntrance:", isEntrance);
            if (isEntrance) {
                var s = l.stations[e.si];
                var d = dist(s, {lat: plat, lng: plng});
                if (d < 1500) entrances.push({lat: plat, lng: plng, name: p.name});
            }
        }
        console.log("Entrances within 1500m:", entrances.length);
    }
}

testFew().catch(function(e) { console.error("FATAL:", e); process.exit(1); });