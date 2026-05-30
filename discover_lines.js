// === DISCOVER LINES v1.2 — with sanity checks & false-positive filtering ===
var fs = require("fs"), https = require("https");
var args = process.argv;
var CITY = args[2], CITY_CN = args[3];
if (!CITY) { console.log("Usage: discover_lines.js CITY \"城市名\""); process.exit(1); }

var AMAP_KEY = process.env.AMAP_KEY || "";
if (!AMAP_KEY) { console.error("Set $env:AMAP_KEY"); process.exit(1); }

var REF_DIR = "C:/Users/Conner/Documents/New project/codex-metro-skill/references";
var OUT_FILE = REF_DIR + "/" + CITY + "_lines.json";
var MAX_LINES = 30, BATCH_DISCOVER = 5, DELAY_DISCOVER = 400;
var DELAY_FETCH = 300, COOLDOWN = 800;
var RETRY_MAX = 2;
var MAX_STATIONS = 60;  // sanity: no metro line has >60 stations
var MIN_STATIONS = 3;   // sanity: <3 is too short to be real

var PALETTE = [
    "#E60012","#009944","#F39800","#0072BC","#8B2E9E","#00A0E9","#77BB00","#E95295","#FFD400",
    "#006B6B","#B6007E","#00B48D","#F47B20","#003399","#99CC00","#D6004C","#0088CC","#FF6600",
    "#6600CC","#0099CC","#CC0033","#336633","#FF9933","#006699","#993366","#339966","#CC6600",
    "#003366","#996600","#336699"
];

function amapSearch(keywords, city, page) {
    return new Promise(function(resolve) {
        function attempt(retry) {
            if (retry > RETRY_MAX) { resolve(null); return; }
            var q = encodeURIComponent(keywords);
            var path = "/v3/place/text?key=" + AMAP_KEY + "&keywords=" + q + "&types=150500&offset=50&page=" + (page||1);
            if (city) path += "&city=" + encodeURIComponent(city);
            var done = false;
            var timer = setTimeout(function() { if (!done) { done = true; req.destroy(); attempt(retry+1); } }, 10000);
            var req = https.get({
                hostname: "restapi.amap.com", path: path,
                headers: { "User-Agent": "CodexDiscover/1.2" }, agent: false
            }, function(res) {
                var d = "";
                res.on("data", function(c) { d += c; });
                res.on("end", function() {
                    if (done) return;
                    done = true; clearTimeout(timer);
                    try { var j = JSON.parse(d); if (j.status === "1") resolve(j); else resolve(null); }
                    catch(e) { attempt(retry+1); }
                });
            });
            req.on("error", function() { if (!done) { done = true; clearTimeout(timer); attempt(retry+1); } });
            req.end();
        }
        attempt(0);
    });
}

function haversine(lat1, lng1, lat2, lng2) {
    var R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
    var a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function normName(n) {
    return (n||"").replace(/站$/,"").replace(/（/g,"(").replace(/）/g,")").trim();
}

function sortStations(stations) {
    if (stations.length < 2) return stations;
    var lats = stations.map(function(s) { return s.lat; });
    var lngs = stations.map(function(s) { return s.lng; });
    var latRange = Math.max.apply(null, lats) - Math.min.apply(null, lats);
    var lngRange = Math.max.apply(null, lngs) - Math.min.apply(null, lngs);
    if (latRange > lngRange * 1.5) {
        stations.sort(function(a, b) { return a.lat - b.lat; });
    } else if (lngRange > latRange * 1.5) {
        stations.sort(function(a, b) { return a.lng - b.lng; });
    } else {
        var meanLat = lats.reduce(function(a,b){return a+b;},0)/lats.length;
        var meanLng = lngs.reduce(function(a,b){return a+b;},0)/lngs.length;
        var num=0, den=0;
        for (var i=0; i<stations.length; i++) { num += (stations[i].lng-meanLng)*(stations[i].lat-meanLat); den += (stations[i].lng-meanLng)**2; }
        var slope = den > 0.0001 ? num/den : 999;
        stations.sort(function(a, b) { return (a.lng + slope*a.lat) - (b.lng + slope*b.lat); });
    }
    return stations;
}

function isRing(stations) {
    if (stations.length < 8) return false;
    var first = stations[0], last = stations[stations.length-1];
    return haversine(first.lat, first.lng, last.lat, last.lng) < 4;
}

async function fetchLineStations(lineNum) {
    var kw = CITY_CN + "地铁" + lineNum + "号线";
    var allPois = [];
    for (var page = 1; page <= 3; page++) {
        var r = await amapSearch(kw, CITY_CN, page);
        if (!r || r.status !== "1") {
            if (page === 1) return [];
            break;
        }
        var pois = r.pois || [];
        allPois = allPois.concat(pois);
        var total = parseInt(r.count) || 0;
        if (allPois.length >= total || pois.length < 50) break;
    }
    // Filter: only keep POIs whose name/address contains the line number hint
    var lineStr = lineNum + "号线";
    allPois = allPois.filter(function(p) {
        var addr = (p.name||"") + (p.address||"");
        return addr.indexOf(lineStr) !== -1 || addr.indexOf(lineNum+"号") !== -1;
    });
    var seen = {};
    var stations = [];
    allPois.forEach(function(p) {
        var nm = normName(p.name);
        if (!nm || seen[nm]) return;
        seen[nm] = true;
        var loc = (p.location || "").split(",");
        if (loc.length === 2) {
            stations.push({ name: nm, lat: parseFloat(loc[1]), lng: parseFloat(loc[0]) });
        }
    });
    return stations;
}

async function main() {
    var t0 = Date.now();
    console.log("\n=== Discover Lines: " + CITY_CN + " ===\n");

    console.log("[1/3] Discovering lines (1-" + MAX_LINES + ")...");
    var candidates = [];
    for (var n = 1; n <= MAX_LINES; n += BATCH_DISCOVER) {
        var batchNums = [];
        for (var k = 0; k < BATCH_DISCOVER && n+k <= MAX_LINES; k++) batchNums.push(n+k);
        var results = await Promise.all(batchNums.map(function(num) {
            return amapSearch(CITY_CN + "地铁" + num + "号线", CITY_CN, 1).then(function(r) {
                return { num: num, r: r };
            });
        }));
        for (var i = 0; i < results.length; i++) {
            var num = results[i].num, r = results[i].r;
            if (r && r.status === "1" && parseInt(r.count) > 0) {
                candidates.push({ num: num, count: parseInt(r.count) });
            }
        }
        if (n + BATCH_DISCOVER <= MAX_LINES) await new Promise(function(r) { setTimeout(r, DELAY_DISCOVER); });
    }
    console.log("  Candidates: " + candidates.map(function(l){return l.num+"("+l.count+")";}).join(" "));

    // Filter out implausible candidates
    var existingLines = [];
    var skipped = [];
    candidates.forEach(function(l) {
        if (l.count > MAX_STATIONS) { skipped.push(l.num + "号线(" + l.count + "站>max)"); }
        else if (l.count < MIN_STATIONS) { skipped.push(l.num + "号线(" + l.count + "站<min)"); }
        else { existingLines.push(l.num); }
    });
    if (skipped.length > 0) console.log("  Skipped: " + skipped.join(", "));
    console.log("  Valid: " + existingLines.length + " lines");

    if (existingLines.length === 0) {
        console.error("No valid lines found!");
        process.exit(1);
    }

    console.log("  Cooling down " + COOLDOWN + "ms...");
    await new Promise(function(r) { setTimeout(r, COOLDOWN); });

    console.log("\n[2/3] Fetching stations...");
    var lineData = {};
    var allStations = {};

    for (var li = 0; li < existingLines.length; li++) {
        var num = existingLines[li];
        var stations = await fetchLineStations(num);

        if (stations.length < MIN_STATIONS) {
            console.log("  " + num + "号线: SKIP (" + stations.length + " stations after filter)");
            await new Promise(function(r) { setTimeout(r, DELAY_FETCH); });
            continue;
        }

        stations = sortStations(stations);
        var ring = isRing(stations);
        var stationNames = stations.map(function(s) { return s.name; });

        stationNames.forEach(function(s) {
            if (!allStations[s]) allStations[s] = [];
            if (allStations[s].indexOf(num) === -1) allStations[s].push(num);
        });

        if (ring) {
            var clat = stations.reduce(function(a,b){return a+b.lat;},0)/stations.length;
            var clng = stations.reduce(function(a,b){return a+b.lng;},0)/stations.length;
            stations.sort(function(a, b) {
                return Math.atan2(a.lng-clng, a.lat-clat) - Math.atan2(b.lng-clng, b.lat-clat);
            });
            stationNames = stations.map(function(s) { return s.name; });
        }

        var prefix = CITY.replace(/[^a-zA-Z]/g,"").substring(0,2).toUpperCase() || CITY.substring(0,2).toUpperCase();
        var lid = prefix + num;

        lineData[lid] = {
            name: num + "号线",
            color: PALETTE[(num-1) % PALETTE.length],
            speed: 80,
            cars: 6,
            ring: ring,
            so: 360,
            sc: 1380,
            stations: stationNames
        };

        console.log("  " + lid + " " + num + "号线: " + stationNames.length + "站" + (ring ? " (环线)" : ""));
        await new Promise(function(r) { setTimeout(r, DELAY_FETCH); });
    }

    console.log("\n[3/3] Analyzing transfers...");
    var transferCount = 0;
    Object.keys(allStations).forEach(function(s) {
        if (allStations[s].length > 1) transferCount++;
    });
    console.log("  Transfers: " + transferCount);

    var json = JSON.stringify(lineData, null, 2);
    fs.writeFileSync(OUT_FILE, json, "utf8");
    var elapsed = ((Date.now()-t0)/1000).toFixed(1);
    var totalStations = Object.values(lineData).reduce(function(a,l){return a+l.stations.length;},0);
    console.log("\n=== Done in " + elapsed + "s ===");
    console.log("Lines: " + Object.keys(lineData).length + ", stations: " + totalStations + ", transfers: " + transferCount);
    console.log("Output: " + OUT_FILE);
    console.log("Next: review & edit, then run metro_builder.js");
}
main().catch(function(e) { console.error("FATAL:", e.message || e); process.exit(1); });