const https = require("https");
const fs = require("fs");

// === AMap Polyline Anchor Builder v3.4 ===
const AMAP_KEY = "c037d67ccb46f69c5f1b7a9b84c61e0e";
const CONCURRENCY = 10;
const TIMEOUT_MS = 8000;
const RATE_LIMIT_MS = 30;
const RDP_EPSILON = 80;  // meters: points within 80m of simplified line are removed

https.globalAgent.maxSockets = 20;

function amapGet(path) {
    return new Promise(r => {
        const timer = setTimeout(() => r(null), TIMEOUT_MS);
        const req = https.get("https://restapi.amap.com" + path, {
            headers: { "User-Agent": "CodexMetro/3.4" }
        }, res => {
            let d = "";
            res.on("data", c => d += c);
            res.on("end", () => { clearTimeout(timer); try { r(JSON.parse(d)); } catch(e) { r(null); } });
        });
        req.on("error", () => { clearTimeout(timer); r(null); });
    });
}

function getLinePolyline(city, fromLng, fromLat, toLng, toLat) {
    return new Promise(async r => {
        const orig = fromLng + "," + fromLat;
        const dest = toLng + "," + toLat;
        const path = "/v3/direction/transit/integrated?key=" + AMAP_KEY +
            "&origin=" + orig + "&destination=" + dest +
            "&city=" + encodeURIComponent(city) + "&cityd=" + encodeURIComponent(city) +
            "&strategy=0&nightflag=0";
        const result = await amapGet(path);
        if (!result || result.status !== "1") { r(null); return; }
        const transit = result.route?.transits?.[0];
        if (!transit) { r(null); return; }
        let polyline = null;
        transit.segments?.forEach(seg => {
            seg.bus?.buslines?.forEach(bl => {
                if (bl.type && bl.type.includes("地铁") && bl.polyline) polyline = bl.polyline;
            });
        });
        if (!polyline) { r(null); return; }
        r(polyline.split(";").map(p => { const [lng, lat] = p.split(",").map(Number); return { lng, lat }; }));
    });
}

// Ramer-Douglas-Peucker: simplify polyline while preserving shape
function rdpSimplify(points, epsilon) {
    if (points.length <= 2) return points;
    // Convert epsilon (meters) to approximate degrees
    const epsDeg = epsilon / 111000;

    function perpDist(pt, a, b) {
        const dx = b.lng - a.lng, dy = b.lat - a.lat;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(pt.lng - a.lng, pt.lat - a.lat);
        const t = Math.max(0, Math.min(1, ((pt.lng - a.lng) * dx + (pt.lat - a.lat) * dy) / lenSq));
        const projLng = a.lng + t * dx, projLat = a.lat + t * dy;
        return Math.hypot(pt.lng - projLng, pt.lat - projLat);
    }

    function recurse(start, end) {
        let maxDist = 0, maxIdx = start;
        for (let i = start + 1; i < end; i++) {
            const d = perpDist(points[i], points[start], points[end]);
            if (d > maxDist) { maxDist = d; maxIdx = i; }
        }
        if (maxDist > epsDeg) {
            const left = recurse(start, maxIdx);
            const right = recurse(maxIdx, end);
            left.pop();
            return left.concat(right);
        }
        return [points[start], points[end]];
    }
    return recurse(0, points.length - 1);
}

function dist(a, b) {
    const dlat = (a.lat - b.lat) * 111000;
    const dlng = (a.lng - b.lng) * 111000 * Math.cos(a.lat * Math.PI / 180);
    return Math.sqrt(dlat * dlat + dlng * dlng);
}

function buildAnchors(polylinePts, stations) {
    // First simplify the polyline
    const simplified = rdpSimplify(polylinePts, RDP_EPSILON);

    // Match stations to simplified polyline
    let currentIdx = 0;
    const stationIndices = [];
    for (const s of stations) {
        let bestIdx = currentIdx, bestDist = Infinity;
        for (let j = currentIdx; j < simplified.length; j++) {
            const d = dist(s, simplified[j]);
            if (d < bestDist) { bestDist = d; bestIdx = j; }
        }
        stationIndices.push(bestIdx);
        currentIdx = bestIdx;
    }

    const anchors = [];
    for (let i = 0; i < stations.length - 1; i++) {
        const start = stationIndices[i], end = stationIndices[i + 1];
        anchors.push(simplified.slice(start + 1, end).map(p => ({ lat: p.lat, lng: p.lng })));
    }
    return anchors;
}

async function processOneLine(l, cityName) {
    const first = l.stations[0], last = l.stations[l.stations.length - 1];
    const polyline = await getLinePolyline(cityName, first.lng, first.lat, last.lng, last.lat);
    if (!polyline || polyline.length === 0) return { id: l.id, ok: false, reason: "no polyline" };

    const stationObjs = l.stations.map(s => ({ lat: s.lat, lng: s.lng }));
    const rawCount = polyline.length;
    const anchors = buildAnchors(polyline, stationObjs);
    const firstD = dist(stationObjs[0], polyline[0]);
    const lastD = dist(stationObjs[stationObjs.length - 1], polyline[polyline.length - 1]);

    if (firstD > 2000 || lastD > 2000) {
        return { id: l.id, ok: false, reason: "mismatch first=" + firstD.toFixed(0) + "m last=" + lastD.toFixed(0) + "m" };
    }
    const aCount = anchors.reduce((a, seg) => a + seg.length, 0);
    return { id: l.id, ok: true, anchors, pts: rawCount, aCount };
}

async function processCity(slug, cityName, inputFile, outputFile) {
    const t0 = Date.now();
    console.log("\n=== " + cityName + " (" + slug + ") ===");
    const data = JSON.parse(fs.readFileSync(inputFile, "utf8"));
    const lines = data.data.lines;

    const queue = [];
    for (const l of lines) {
        if (l.stations.length < 2) continue;
        if (l.isRing) { console.log("  SKIP " + l.id + " (ring)"); continue; }
        const hasAnchors = l.segmentAnchors && l.segmentAnchors.some(a => a.length > 0);
        if (hasAnchors) { console.log("  SKIP " + l.id + " (cached)"); continue; }
        queue.push(l);
    }
    console.log("Lines to process: " + queue.length + " (concurrency=" + CONCURRENCY + ", RDP=" + RDP_EPSILON + "m)");

    let totalAnchors = 0, totalRaw = 0, ok = 0, fail = 0;
    let i = 0;

    async function worker() {
        while (i < queue.length) {
            const idx = i++;
            const l = queue[idx];
            console.log("  [" + (idx + 1) + "/" + queue.length + "] " + l.id + ": " + l.stations[0].name + " ...");
            const result = await processOneLine(l, cityName);
            if (result.ok) {
                l.segmentAnchors = result.anchors;
                totalAnchors += result.aCount;
                totalRaw += result.pts;
                ok++;
                const ratio = ((1 - result.aCount / result.pts) * 100).toFixed(0);
                console.log("    OK: " + result.pts + "->" + result.aCount + " anchors (-" + ratio + "%)");
            } else {
                fail++;
                console.log("    FAIL: " + result.reason);
            }
            if (i < queue.length) await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
        }
    }

    const workers = [];
    for (let w = 0; w < Math.min(CONCURRENCY, queue.length); w++) workers.push(worker());
    await Promise.all(workers);

    data.data.lineCounter = lines.length;
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), "utf8");
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const overallRatio = totalRaw > 0 ? ((1 - totalAnchors / totalRaw) * 100).toFixed(0) : 0;
    console.log("\nDone: " + ok + "/" + queue.length + " OK, " + totalAnchors + " anchors (from " + totalRaw + " raw, -" + overallRatio + "%), " + fail + " failed, " + elapsed + "s");
}

async function main() {
    const [,, slug, cityName] = process.argv;
    if (!slug) { console.log("Usage: amap_anchors.js {slug} {中文名}"); process.exit(1); }
    const f = "C:/Users/Conner/Downloads/" + slug + "_metro.json";
    if (!fs.existsSync(f)) { console.log("File not found: " + f); process.exit(1); }
    await processCity(slug, cityName, f, f);
}
main();
