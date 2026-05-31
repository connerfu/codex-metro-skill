const https = require("https");
const fs = require("fs");

// === AMap Polyline Anchor Builder v3.3 ===
const AMAP_KEY = "c037d67ccb46f69c5f1b7a9b84c61e0e";
const CONCURRENCY = 10;      // parallel API calls (Node default maxSockets=5, we override to 20)
const TIMEOUT_MS = 8000;
const RATE_LIMIT_MS = 30;

// Override Node's per-host socket limit
https.globalAgent.maxSockets = 20;

function amapGet(path) {
    return new Promise(r => {
        const timer = setTimeout(() => r(null), TIMEOUT_MS);
        const req = https.get("https://restapi.amap.com" + path, {
            headers: { "User-Agent": "CodexMetro/3.3" }
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

function dist(a, b) {
    const dlat = (a.lat - b.lat) * 111000;
    const dlng = (a.lng - b.lng) * 111000 * Math.cos(a.lat * Math.PI / 180);
    return Math.sqrt(dlat * dlat + dlng * dlng);
}

function buildAnchors(polylinePts, stations) {
    let currentIdx = 0;
    const stationIndices = [];
    for (const s of stations) {
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
        anchors.push(polylinePts.slice(start + 1, end).map(p => ({ lat: p.lat, lng: p.lng })));
    }
    return anchors;
}

async function processOneLine(l, cityName) {
    const first = l.stations[0], last = l.stations[l.stations.length - 1];
    const polyline = await getLinePolyline(cityName, first.lng, first.lat, last.lng, last.lat);
    if (!polyline || polyline.length === 0) return { id: l.id, ok: false, reason: "no polyline" };

    const stationObjs = l.stations.map(s => ({ lat: s.lat, lng: s.lng }));
    const anchors = buildAnchors(polyline, stationObjs);
    const firstD = dist(stationObjs[0], polyline[0]);
    const lastD = dist(stationObjs[stationObjs.length - 1], polyline[polyline.length - 1]);

    if (firstD > 2000 || lastD > 2000) {
        return { id: l.id, ok: false, reason: "mismatch first=" + firstD.toFixed(0) + "m last=" + lastD.toFixed(0) + "m" };
    }
    const aCount = anchors.reduce((a, seg) => a + seg.length, 0);
    return { id: l.id, ok: true, anchors, pts: polyline.length, aCount };
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
    console.log("Lines to process: " + queue.length + " (concurrency=" + CONCURRENCY + ")");

    let totalAnchors = 0, ok = 0, fail = 0;
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
                ok++;
                console.log("    OK: " + result.pts + " pts, " + result.aCount + " anchors");
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
    console.log("\nDone: " + ok + "/" + queue.length + " OK, " + totalAnchors + " anchors, " + fail + " failed, " + elapsed + "s");
}

async function main() {
    const [,, slug, cityName] = process.argv;
    if (!slug) { console.log("Usage: amap_anchors.js {slug} {中文名}"); process.exit(1); }
    const f = "C:/Users/Conner/Downloads/" + slug + "_metro.json";
    if (!fs.existsSync(f)) { console.log("File not found: " + f); process.exit(1); }
    await processCity(slug, cityName, f, f);
}
main();
