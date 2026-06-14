const https = require('https');
const fs = require('fs');

const AMAP_KEY = 'c037d67ccb46f69c5f1b7a9b84c61e0e';
const TIMEOUT_MS = 10000;

function amapGet(path) {
    return new Promise(r => {
        const timer = setTimeout(() => r(null), TIMEOUT_MS);
        https.get('https://restapi.amap.com' + path, {
            headers: { 'User-Agent': 'CodexMetro/3.7' }
        }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { clearTimeout(timer); try { r(JSON.parse(d)); } catch(e) { r(null); } });
        }).on('error', () => { clearTimeout(timer); r(null); });
    });
}

function dist(a, b) {
    const dlat = (a.lat - b.lat) * 111000;
    const dlng = (a.lng - b.lng) * 111000 * Math.cos(a.lat * Math.PI / 180);
    return Math.sqrt(dlat * dlat + dlng * dlng);
}

var lastReq = 0;
function rateLimit() {
    var now = Date.now(), wait = Math.max(0, 350 - (now - lastReq));
    lastReq = now + wait;
    return new Promise(function(r) { setTimeout(r, wait); });
}

async function amapPOI(keyword, lineNum, city) {
    await rateLimit();
    return new Promise(function(r) {
        var cleanName = keyword.replace(/\u7AD9$/, "");
        var kw = encodeURIComponent(cleanName + "\u5730\u94C1\u7AD9" + (lineNum ? lineNum + "\u53F7\u7EBF" : ""));
        var path = "/v3/place/text?key=" + AMAP_KEY + "&keywords=" + kw + "&types=150500&city=" + encodeURIComponent(city) + "&offset=10&page=1";
        var timer = setTimeout(function() { r([]); }, 10000);
        https.get("https://restapi.amap.com" + path, {headers:{"User-Agent":"CM/5"}}, function(res) {
            var d = ""; res.on("data", function(c) { d += c; });
            res.on("end", function() { clearTimeout(timer);
                try { var j = JSON.parse(d); if (j.status === "1" && j.pois) r(j.pois); else r([]); }
                catch(e) { r([]); }
            });
        }).on("error", function() { clearTimeout(timer); r([]); });
    });
}

var ENTRANCE_RE = /[A-Za-z]\d*[\u4E1C\u897F\u5357\u5317]*\u51FA?\u53E3/;

async function getLineCentroid(stationName, lineNum, refStation, cityName) {
    var pois = await amapPOI(stationName, lineNum, cityName);
    var entrances = [];
    for (var pi = 0; pi < pois.length; pi++) {
        var p = pois[pi], ploc = p.location ? p.location.split(",") : null;
        if (!ploc) continue;
        var plat = parseFloat(ploc[1]), plng = parseFloat(ploc[0]);
        if (ENTRANCE_RE.test(p.name)) {
            var d = dist(refStation, {lat: plat, lng: plng});
            if (d < 1500) entrances.push({lat: plat, lng: plng});
        }
    }
    if (entrances.length >= 1) {
        var sumLat = 0, sumLng = 0;
        for (var eni = 0; eni < entrances.length; eni++) {
            sumLat += entrances[eni].lat;
            sumLng += entrances[eni].lng;
        }
        return { lat: sumLat / entrances.length, lng: sumLng / entrances.length, count: entrances.length };
    }
    return null;
}

async function main() {
    const file = "C:/Users/Conner/Downloads/beijing_metro.json";
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const lines = data.data.lines;
    const cityName = "\u5317\u4EAC";
    
    // 1. Fix ring closing segment for 10号线
    for (let li = 0; li < lines.length; li++) {
        const l = lines[li];
        if (l.isRing && l.name && l.name.indexOf("10\u53F7\u7EBF") >= 0) {
            const st = l.stations;
            const lastSi = st.length - 1; // 44
            const last = st[lastSi], first = st[0];
            console.log("Ring closing: " + last.name + " -> " + first.name);
            
            // Try transit between last and first
            const orig = last.lng + ',' + last.lat;
            const dest = first.lng + ',' + first.lat;
            const path = '/v3/direction/transit/integrated?key=' + AMAP_KEY +
                '&origin=' + orig + '&destination=' + dest +
                '&city=' + encodeURIComponent(cityName) + '&cityd=' + encodeURIComponent(cityName) +
                '&strategy=0&nightflag=0';
            const result = await amapGet(path);
            if (result && result.status === '1') {
                const transit = result.route && result.route.transits && result.route.transits[0];
                if (transit) {
                    let polyline = null;
                    (transit.segments || []).forEach(function(seg) {
                        (seg.bus && seg.bus.buslines || []).forEach(function(bl) {
                            if (bl.type && bl.type.indexOf('\u5730\u94C1') !== -1 && bl.polyline) polyline = bl.polyline;
                        });
                    });
                    if (polyline) {
                        const pts = polyline.split(';').map(p => { const parts = p.split(','); return { lng: +parts[0], lat: +parts[1] }; });
                        // Take middle points, sample every few points
                        const midPts = pts.slice(1, -1);
                        const step = Math.max(1, Math.floor(midPts.length / 6));
                        l.segmentAnchors.push(midPts.filter((p, i) => i % step === 0).map(p => ({ lat: p.lat, lng: p.lng })));
                        console.log("  OK: " + l.segmentAnchors[l.segmentAnchors.length-1].length + " anchors from " + pts.length + " pts");
                    } else {
                        // Fallback: midpoint
                        l.segmentAnchors.push([{lat: (last.lat + first.lat)/2, lng: (last.lng + first.lng)/2}]);
                        console.log("  Fallback: midpoint");
                    }
                } else {
                    l.segmentAnchors.push([{lat: (last.lat + first.lat)/2, lng: (last.lng + first.lng)/2}]);
                    console.log("  Fallback: midpoint (no transit)");
                }
            } else {
                l.segmentAnchors.push([{lat: (last.lat + first.lat)/2, lng: (last.lng + first.lng)/2}]);
                console.log("  Fallback: midpoint (API fail)");
            }
        }
    }
    
    // 2. Fix remaining unseparated transfers
    const unseparated = ["\u6728\u6A1E\u5730\u7AD9", "\u4E1C\u5355\u7AD9", "\u56FD\u8D38\u7AD9", "\u4E8C\u91CC\u6C9F\u7AD9", "\u6731\u8F9B\u5E84\u7AD9", "\u960E\u6751\u4E1C\u7AD9"];
    
    for (let name of unseparated) {
        // Find all occurrences
        let entries = [];
        for (let li = 0; li < lines.length; li++) {
            let st = lines[li].stations || [];
            for (let si = 0; si < st.length; si++) {
                if (st[si].name === name && st[si].isTransfer) {
                    entries.push({li, si, s: st[si], line: lines[li]});
                }
            }
        }
        
        let uniqueLids = [...new Set(entries.map(e => e.line.id))];
        if (uniqueLids.length < 2) continue;
        
        console.log("\nFixing: " + name + " (" + entries.length + " entries, " + uniqueLids.length + " unique lines)");
        
        let moved = false;
        for (let ei = 0; ei < entries.length; ei++) {
            let e = entries[ei];
            let m = e.line.name ? e.line.name.match(/(\d+)/) : null;
            let ln = m ? m[1] : "";
            let centroid = await getLineCentroid(name, ln, e.s, cityName);
            if (centroid) {
                let oldLat = e.s.lat.toFixed(6), oldLng = e.s.lng.toFixed(6);
                e.s.lat = centroid.lat;
                e.s.lng = centroid.lng;
                console.log("  " + e.line.name + ": " + oldLat + "," + oldLng + " -> " + centroid.lat.toFixed(6) + "," + centroid.lng.toFixed(6) + " (" + centroid.count + " entrances)");
                moved = true;
            } else {
                console.log("  " + e.line.name + ": no entrances found");
            }
        }
    }
    
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
    console.log("\nSaved: " + file);
}
main().catch(function(e) { console.error(e); process.exit(1); });