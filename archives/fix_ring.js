const https = require('https');
const fs = require('fs');

const AMAP_KEY = 'c037d67ccb46f69c5f1b7a9b84c61e0e';
const CONCURRENCY = 3;
const TIMEOUT_MS = 12000;
const RATE_LIMIT_MS = 350;
const SEGMENT_EPSILON = 10;
https.globalAgent.maxSockets = 10;

let rateGate = Promise.resolve();
function rateLimit() {
    const prev = rateGate;
    let rg; rateGate = new Promise(r => { rg = r; });
    prev.then(() => setTimeout(rg, RATE_LIMIT_MS));
    return prev;
}

function amapGet(path) {
    return rateLimit().then(() => new Promise(r => {
        const timer = setTimeout(() => r(null), TIMEOUT_MS);
        https.get('https://restapi.amap.com' + path, {
            headers: { 'User-Agent': 'CodexMetro/3.7' }
        }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { clearTimeout(timer); try { r(JSON.parse(d)); } catch(e) { r(null); } });
        }).on('error', () => { clearTimeout(timer); r(null); });
    }));
}

function dist(a, b) {
    const dlat = (a.lat - b.lat) * 111000;
    const dlng = (a.lng - b.lng) * 111000 * Math.cos(a.lat * Math.PI / 180);
    return Math.sqrt(dlat * dlat + dlng * dlng);
}

function rdpSegment(pts, epsilonM) {
    if (pts.length <= 2) return pts;
    const epsDeg = epsilonM / 111000;
    function perpDist(pt, a, b) {
        const dx = b.lng - a.lng, dy = b.lat - a.lat;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(pt.lng - a.lng, pt.lat - a.lat);
        const t = Math.max(0, Math.min(1, ((pt.lng - a.lng) * dx + (pt.lat - a.lat) * dy) / lenSq));
        return Math.hypot(pt.lng - a.lng - t * dx, pt.lat - a.lat - t * dy);
    }
    function recurse(start, end) {
        let maxDist = 0, maxIdx = start;
        for (let i = start + 1; i < end; i++) {
            const d = perpDist(pts[i], pts[start], pts[end]);
            if (d > maxDist) { maxDist = d; maxIdx = i; }
        }
        if (maxDist > epsDeg) {
            const left = recurse(start, maxIdx);
            const right = recurse(maxIdx, end);
            left.pop();
            return left.concat(right);
        }
        return [pts[start], pts[end]];
    }
    return recurse(0, pts.length - 1);
}

async function getLinePolyline(city, fromLng, fromLat, toLng, toLat) {
    const orig = fromLng + ',' + fromLat;
    const dest = toLng + ',' + toLat;
    const path = '/v3/direction/transit/integrated?key=' + AMAP_KEY +
        '&origin=' + orig + '&destination=' + dest +
        '&city=' + encodeURIComponent(city) + '&cityd=' + encodeURIComponent(city) +
        '&strategy=0&nightflag=0';
    const result = await amapGet(path);
    if (!result || result.status !== '1') return null;
    const transit = result.route && result.route.transits && result.route.transits[0];
    if (!transit) return null;
    let polyline = null;
    (transit.segments || []).forEach(function(seg) {
        (seg.bus && seg.bus.buslines || []).forEach(function(bl) {
            if (bl.type && bl.type.indexOf('\u5730\u94C1') !== -1 && bl.polyline) polyline = bl.polyline;
        });
    });
    if (!polyline) return null;
    return polyline.split(';').map(function(p) {
        const parts = p.split(','); return { lng: +parts[0], lat: +parts[1] };
    });
}

function buildAnchorsForStations(polylinePts, stations) {
    let currentIdx = 0;
    const stationIndices = [];
    for (let si = 0; si < stations.length; si++) {
        const s = stations[si];
        let bestIdx = currentIdx, bestDist = Infinity;
        for (let j = currentIdx; j < polylinePts.length; j++) {
            const d = dist(s, polylinePts[j]);
            if (d < bestDist) { bestDist = d; bestIdx = j; }
        }
        stationIndices.push(bestIdx);
        currentIdx = bestIdx;
    }
    const anchors = [];
    for (let i = 0; i < stations.length - 1; i++) {
        const start = stationIndices[i], end = stationIndices[i + 1];
        if (end - start <= 1) { anchors.push([]); continue; }
        const segPts = polylinePts.slice(start + 1, end);
        const simplified = rdpSegment(segPts, SEGMENT_EPSILON);
        anchors.push(simplified.map(function(p) { return { lat: p.lat, lng: p.lng }; }));
    }
    return anchors;
}

async function processRing(cityName, l) {
    const st = l.stations;
    const n = st.length;
    
    // Initialize segmentAnchors as empty arrays
    if (!l.segmentAnchors) l.segmentAnchors = [];
    for (let si = 0; si < n - 1; si++) {
        if (!l.segmentAnchors[si]) l.segmentAnchors[si] = [];
    }
    
    // Strategy: process as overlapping 8-station chunks with 3-station overlap
    const CHUNK = 8, OVERLAP = 3;
    let totalPts = 0, totalAnchors = 0, okChunks = 0, failChunks = 0;
    
    const chunks = [];
    for (let start = 0; start < n - 1; start += CHUNK - OVERLAP) {
        let end = Math.min(start + CHUNK, n);
        if (end - start < 3) continue;
        chunks.push({ start, end });
    }
    // Wrap-around chunk
    if (n - (chunks[chunks.length-1]?.end || 0) > 2) {
        chunks.push({ start: n - CHUNK, end: n });
    }
    
    console.log("  Ring " + l.id + ": " + n + " stations, " + chunks.length + " chunks");
    
    for (let ci = 0; ci < chunks.length; ci++) {
        const { start, end } = chunks[ci];
        const chunkSt = st.slice(start, end);
        const first = chunkSt[0], last = chunkSt[chunkSt.length - 1];
        
        const polyline = await getLinePolyline(cityName, first.lng, first.lat, last.lng, last.lat);
        if (!polyline || polyline.length < 3) {
            failChunks++;
            process.stderr.write("\r    chunk " + ci + " [" + start + "-" + end + "] FAIL: no polyline");
            continue;
        }
        
        // Verify endpoints match
        const firstD = dist(chunkSt[0], polyline[0]);
        const lastD = dist(chunkSt[chunkSt.length - 1], polyline[polyline.length - 1]);
        if (firstD > 2000 || lastD > 2000) {
            failChunks++;
            process.stderr.write("\r    chunk " + ci + " [" + start + "-" + end + "] MISMATCH: " + firstD.toFixed(0) + "m / " + lastD.toFixed(0) + "m");
            continue;
        }
        
        const chunkStationObjs = chunkSt.map(s => ({ lat: s.lat, lng: s.lng }));
        const anchors = buildAnchorsForStations(polyline, chunkStationObjs);
        
        // Apply anchors: fill in segments from start to end-1
        for (let si = 0; si < end - start - 1; si++) {
            const globalSi = start + si;
            if (anchors[si] && anchors[si].length > 0) {
                // Only overwrite if current is empty or new has more detail
                if (!l.segmentAnchors[globalSi] || l.segmentAnchors[globalSi].length === 0 || anchors[si].length > l.segmentAnchors[globalSi].length) {
                    l.segmentAnchors[globalSi] = anchors[si];
                }
            }
        }
        
        const aCount = anchors.reduce((a, seg) => a + (seg || []).length, 0);
        totalPts += polyline.length;
        totalAnchors += aCount;
        okChunks++;
        process.stderr.write("\r    chunk " + ci + " [" + start + "-" + end + "] OK: " + polyline.length + "pts -> " + aCount + " anchors");
    }
    
    console.log("\n  Ring done: " + okChunks + "/" + chunks.length + " chunks OK, " + totalAnchors + " anchors");
    return { ok: okChunks > 0, pts: totalPts, aCount: totalAnchors };
}

async function main() {
    const slug = process.argv[2] || "beijing";
    const cityName = process.argv[3] || "\u5317\u4EAC";
    const file = "C:/Users/Conner/Downloads/" + slug + "_metro.json";
    
    console.log("=== Ring Fix for " + cityName + " ===");
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const lines = data.data.lines;
    
    for (let li = 0; li < lines.length; li++) {
        const l = lines[li];
        if (l.isRing && l.stations.length >= 3) {
            console.log("Processing ring: " + l.name + " (" + l.stations.length + " stations)");
            await processRing(cityName, l);
        }
    }
    
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
    console.log("Saved: " + file);
}
main().catch(function(e) { console.error(e); process.exit(1); });