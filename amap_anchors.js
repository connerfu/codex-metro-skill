const https = require('https');
const fs = require('fs');

// AMap Polyline Anchor Builder v4.1 — Ring overlapping windows + gap fill
const AMAP_KEY = 'c037d67ccb46f69c5f1b7a9b84c61e0e';
const CONCURRENCY = 5;
const TIMEOUT_MS = 12000;
const RATE_LIMIT_MS = 150;
const SEGMENT_EPSILON = 10;
const RING_CHUNK = 8;
const RING_OVERLAP = 3;
https.globalAgent.maxSockets = 10;

// Per-call rate limiter (not serial — concurrent workers get independent slots)
function rateLimit() {
    var now = Date.now();
    if (!rateLimit._last) rateLimit._last = 0;
    var next = rateLimit._last + RATE_LIMIT_MS;
    rateLimit._last = Math.max(now, next);
    var wait = Math.max(0, rateLimit._last - now);
    return new Promise(r => setTimeout(r, wait));
}

function amapGet(path) {
    return rateLimit().then(() => new Promise(r => {
        const timer = setTimeout(() => r(null), TIMEOUT_MS);
        https.get('https://restapi.amap.com' + path, {
            headers: { 'User-Agent': 'CodexMetro/4.1' }
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
    // Try multiple strategies for robustness
    for (const strat of [0, 2, 5]) {
        const path = '/v3/direction/transit/integrated?key=' + AMAP_KEY +
            '&origin=' + orig + '&destination=' + dest +
            '&city=' + encodeURIComponent(city) + '&cityd=' + encodeURIComponent(city) +
            '&strategy=' + strat + '&nightflag=0';
        const result = await amapGet(path);
        if (!result || result.status !== '1') continue;
        const transit = result.route && result.route.transits && result.route.transits[0];
        if (!transit) continue;
        let polyline = null;
        (transit.segments || []).forEach(function(seg) {
            (seg.bus && seg.bus.buslines || []).forEach(function(bl) {
                if (bl.type && bl.type.indexOf('\u5730\u94C1') !== -1 && bl.polyline) polyline = bl.polyline;
            });
        });
        if (polyline) return polyline.split(';').map(function(p) {
            const parts = p.split(','); return { lng: +parts[0], lat: +parts[1] };
        });
    }
    return null;
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
    // v4.1: Overlapping 8-station windows instead of fixed quarters
    // This ensures full coverage even when some windows fail
    const st = l.stations;
    const n = st.length;
    
    if (!l.segmentAnchors) l.segmentAnchors = [];
    for (let si = 0; si < n; si++) {
        if (!l.segmentAnchors[si]) l.segmentAnchors[si] = [];
    }
    
    const chunks = [];
    for (let start = 0; start < n; start += RING_CHUNK - RING_OVERLAP) {
        let end = Math.min(start + RING_CHUNK, n);
        if (end - start < 3) continue;
        chunks.push({ start, end, wrap: false });
    }
    // Wrap-around chunk for ring closing
    const lastChunkEnd = chunks.length > 0 ? chunks[chunks.length - 1].end : 0;
    if (n - lastChunkEnd >= 2) {
        chunks.push({ start: Math.max(0, n - RING_CHUNK), end: n, wrap: false });
    }
    // Ensure closing segment is covered: wrap-around
    chunks.push({ start: n - 3, end: 3, wrap: true });
    
    console.log("  Ring " + l.id + ": " + n + " st, " + chunks.length + " windows");
    
    let totalPts = 0, totalAnchors = 0, okChunks = 0;
    
    for (let ci = 0; ci < chunks.length; ci++) {
        const { start, end, wrap } = chunks[ci];
        let chunkSt;
        if (wrap) {
            chunkSt = st.slice(start).concat(st.slice(0, end));
        } else {
            chunkSt = st.slice(start, end);
        }
        if (chunkSt.length < 2) continue;
        
        const first = chunkSt[0], last = chunkSt[chunkSt.length - 1];
        const polyline = await getLinePolyline(cityName, first.lng, first.lat, last.lng, last.lat);
        
        if (!polyline || polyline.length < 3) {
            process.stderr.write("\r    window " + ci + " [" + start + "-" + end + (wrap?"W":"") + "] FAIL: no polyline");
            continue;
        }
        
        const firstD = dist(chunkSt[0], polyline[0]);
        const lastD = dist(chunkSt[chunkSt.length - 1], polyline[polyline.length - 1]);
        if (firstD > 2000 || lastD > 2000) {
            process.stderr.write("\r    window " + ci + " [" + start + "-" + end + (wrap?"W":"") + "] MISMATCH: " + firstD.toFixed(0) + "/" + lastD.toFixed(0));
            continue;
        }
        
        const chunkStationObjs = chunkSt.map(s => ({ lat: s.lat, lng: s.lng }));
        const anchors = buildAnchorsForStations(polyline, chunkStationObjs);
        
        for (let si = 0; si < chunkSt.length - 1; si++) {
            let globalSi = wrap ? ((start + si) % n) : (start + si);
            if (anchors[si] && anchors[si].length > 0) {
                if (!l.segmentAnchors[globalSi] || l.segmentAnchors[globalSi].length === 0) {
                    l.segmentAnchors[globalSi] = anchors[si];
                } else if (anchors[si].length > l.segmentAnchors[globalSi].length) {
                    // Prefer more detailed result
                    l.segmentAnchors[globalSi] = anchors[si];
                }
            }
        }
        
        const aCount = anchors.reduce((a, seg) => a + (seg || []).length, 0);
        totalPts += polyline.length;
        totalAnchors += aCount;
        okChunks++;
        process.stderr.write("\r    window " + ci + " [" + start + "-" + end + (wrap?"W":"") + "] OK: " + polyline.length + "pts->" + aCount + "a");
    }
    
    // Gap fill: for any segment still with 0 anchors, try individual pair or use midpoint
    for (let si = 0; si < n; si++) {
        const seg = l.segmentAnchors[si];
        if (seg && seg.length > 0) continue;
        
        const s = st[si % n];
        const ns = st[(si + 1) % n];
        if (!s || !ns) continue;
        
        // Try individual transit polyline
        const polyline = await getLinePolyline(cityName, s.lng, s.lat, ns.lng, ns.lat);
        if (polyline && polyline.length > 2) {
            const midPts = polyline.slice(1, -1);
            const step = Math.max(1, Math.floor(midPts.length / 5));
            l.segmentAnchors[si] = midPts.filter((p, i) => i % step === 0).map(p => ({ lat: p.lat, lng: p.lng }));
        } else {
            // Midpoint fallback
            l.segmentAnchors[si] = [{ lat: (s.lat + ns.lat) / 2, lng: (s.lng + ns.lng) / 2 }];
        }
    }
    
    console.log("\n  Ring done: " + okChunks + "/" + chunks.length + " windows, " + totalAnchors + " anchors (" + totalPts + " raw)");
    return { ok: okChunks > 0, pts: totalPts, aCount: totalAnchors };
}

async function processOneLine(l, cityName) {
    const first = l.stations[0], last = l.stations[l.stations.length - 1];
    const polyline = await getLinePolyline(cityName, first.lng, first.lat, last.lng, last.lat);
    if (!polyline || polyline.length === 0) return { id: l.id, ok: false, reason: 'no polyline' };
    const stationObjs = l.stations.map(function(s) { return { lat: s.lat, lng: s.lng }; });
    const rawCount = polyline.length;
    const anchors = buildAnchorsForStations(polyline, stationObjs);
    const firstD = dist(stationObjs[0], polyline[0]);
    const lastD = dist(stationObjs[stationObjs.length - 1], polyline[polyline.length - 1]);
    if (firstD > 2000 || lastD > 2000) {
        return { id: l.id, ok: false, reason: 'mismatch first=' + firstD.toFixed(0) + 'm last=' + lastD.toFixed(0) + 'm' };
    }
    const aCount = anchors.reduce(function(a, seg) { return a + seg.length; }, 0);
    return { id: l.id, ok: true, anchors: anchors, pts: rawCount, aCount: aCount };
}

async function processCity(slug, cityName, inputFile, outputFile) {
    const t0 = Date.now();
    console.log('\n=== ' + cityName + ' (' + slug + ') ===');
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    const lines = data.data.lines;
    const queue = [];
    for (let li = 0; li < lines.length; li++) {
        const l = lines[li];
        if (l.stations.length < 2) continue;
        if (l.isRing) { l._isRing = true; }
        const hasAnchors = l.segmentAnchors && l.segmentAnchors.some(function(a) { return a.length > 0; });
        if (hasAnchors) { console.log('  SKIP ' + l.id + ' (cached)'); continue; }
        queue.push(l);
    }
    console.log('Lines to process: ' + queue.length + ' (concurrency=' + CONCURRENCY + ', segRDP=' + SEGMENT_EPSILON + 'm)');
    let totalAnchors = 0, totalRaw = 0, ok = 0, fail = 0;
    let i = 0;
    async function worker() {
        while (i < queue.length) {
            const idx = i++;
            const l = queue[idx];
            process.stderr.write('\r  [' + (idx + 1) + '/' + queue.length + '] ' + l.id + ': ' + l.stations[0].name + ' ...');
            let result;
            if (l._isRing) {
                result = await processRing(cityName, l);
            } else {
                result = await processOneLine(l, cityName);
            }
            if (result.ok) {
                if (!l._isRing) l.segmentAnchors = result.anchors;
                totalAnchors += result.aCount;
                totalRaw += result.pts;
                ok++;
                const ratio = ((1 - result.aCount / result.pts) * 100).toFixed(0);
                console.log('  [' + (idx + 1) + '/' + queue.length + '] ' + l.id + ' OK: ' + result.pts + '->' + result.aCount + ' anchors (-' + ratio + '%)');
            } else {
                // Fallback: split long line into 5-station windows
                var n = l.stations.length;
                if (n >= 5 && !l._isRing) {
                    console.log('  [' + (idx + 1) + '/' + queue.length + '] ' + l.id + ' FAIL, retry with windows...');
                    var windowSize = 5, overlap = 2;
                    if (!l.segmentAnchors) l.segmentAnchors = [];
                    for (var si = 0; si < n; si++) {
                        if (!l.segmentAnchors[si]) l.segmentAnchors[si] = [];
                    }
                    var wOk = 0, wFail = 0, wPts = 0, wAnchors = 0;
                    var wi = 0;
                    for (var ws = 0; ws < n - 1; ws += windowSize - overlap) {
                        var we = Math.min(ws + windowSize, n);
                        if (we - ws < 2) continue;
                        wi++;
                        var chunk = JSON.parse(JSON.stringify(l));
                        chunk.stations = l.stations.slice(ws, we);
                        var cr = await processOneLine(chunk, cityName);
                        if (cr.ok) {
                            for (var hi = 0; hi < cr.anchors.length; hi++) {
                                if (cr.anchors[hi].length > 0 && l.segmentAnchors[ws + hi].length === 0) {
                                    l.segmentAnchors[ws + hi] = cr.anchors[hi];
                                }
                            }
                            wOk++; wPts += cr.pts; wAnchors += cr.aCount;
                        } else { wFail++; }
                        process.stderr.write('\r    win ' + wi + ': [' + ws + '-' + we + '] ' + (cr.ok?'OK':'FAIL'));
                    }
                    if (wOk > 0) {
                        totalAnchors += wAnchors; totalRaw += wPts; ok++;
                        console.log('  [' + (idx + 1) + '/' + queue.length + '] ' + l.id + ' WINDOWS: ' + wOk + '/' + wi + ' OK, ' + wAnchors + ' anchors');
                    } else {
                        fail++;
                        console.log('  [' + (idx + 1) + '/' + queue.length + '] ' + l.id + ' FAIL (windows also failed)');
                    }
                } else {
                    fail++;
                    console.log('  [' + (idx + 1) + '/' + queue.length + '] ' + l.id + ' FAIL: ' + result.reason);
                }
            }
        }
    }
    const workers = [];
    for (let w = 0; w < Math.min(CONCURRENCY, queue.length); w++) workers.push(worker());
    await Promise.all(workers);
    data.data.lineCounter = lines.length;
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), 'utf8');
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const overallRatio = totalRaw > 0 ? ((1 - totalAnchors / totalRaw) * 100).toFixed(0) : 0;
    console.log('\nDone: ' + ok + '/' + queue.length + ' OK, ' + totalAnchors + ' anchors (from ' + totalRaw + ' raw, -' + overallRatio + '%), ' + fail + ' failed, ' + elapsed + 's');
}

const args = process.argv;
const slug = args[2], cityName = args[3];
if (!slug) { console.log('Usage: amap_anchors.js {slug} {中文名}'); process.exit(1); }
const f = 'C:/Users/Conner/Downloads/' + slug + '_metro.json';
if (!fs.existsSync(f)) { console.log('File not found: ' + f); process.exit(1); }
processCity(slug, cityName, f, f).catch(function(e) { console.error(e); process.exit(1); });