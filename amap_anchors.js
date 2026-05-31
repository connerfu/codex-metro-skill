const https = require("https");
const fs = require("fs");

// === AMap Polyline Anchor Builder ===
// Post-processing step: add segmentAnchors to metro JSON using AMap direction API

const AMAP_KEY = "c037d67ccb46f69c5f1b7a9b84c61e0e";
const BATCH_DELAY = 300; // ms between API calls

function amapGet(path) {
    return new Promise(r => {
        const timer = setTimeout(() => r(null), 15000);
        const req = https.get("https://restapi.amap.com" + path, {
            headers: { "User-Agent": "CodexMetro/3.2" }
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
                if (bl.type && bl.type.includes("地铁") && bl.polyline) {
                    polyline = bl.polyline;
                }
            });
        });

        if (!polyline) { r(null); return; }

        const pts = polyline.split(";").map(p => {
            const [lng, lat] = p.split(",").map(Number);
            return { lng, lat };
        });
        r(pts);
    });
}

function dist(a, b) {
    const dlat = (a.lat - b.lat) * 111000;
    const dlng = (a.lng - b.lng) * 111000 * Math.cos(a.lat * Math.PI / 180);
    return Math.sqrt(dlat * dlat + dlng * dlng);
}

function buildAnchors(polylinePts, stations) {
    // Match stations to polyline points
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

    // Build segment anchors
    const anchors = [];
    for (let i = 0; i < stations.length - 1; i++) {
        const start = stationIndices[i];
        const end = stationIndices[i + 1];
        const segmentPoints = polylinePts.slice(start + 1, end).map(p => ({ lat: p.lat, lng: p.lng }));
        anchors.push(segmentPoints);
    }
    return anchors;
}

async function processCity(slug, cityName, inputFile, outputFile) {
    console.log("\n=== " + cityName + " (" + slug + ") ===");
    const data = JSON.parse(fs.readFileSync(inputFile, "utf8"));
    const lines = data.data.lines;
    console.log("Lines: " + lines.length);

    let totalAnchors = 0, apiCalls = 0, failedCalls = 0;

    for (let li = 0; li < lines.length; li++) {
        const l = lines[li];
        if (l.stations.length < 2) continue;

        const first = l.stations[0], last = l.stations[l.stations.length - 1];
        const isRing = l.isRing;

        // For ring lines, we need two calls (first→mid→last...→first)
        // For simplicity, skip ring lines for now
        if (isRing) {
            console.log("  SKIP " + l.id + " (ring line)");
            continue;
        }

        // Skip if already has anchors
        const hasAnchors = l.segmentAnchors && l.segmentAnchors.some(a => a.length > 0);
        if (hasAnchors) {
            console.log("  SKIP " + l.id + " (already has anchors)");
            continue;
        }

        console.log("  " + l.id + ": " + first.name + " → " + last.name + " ...");
        apiCalls++;

        const polyline = await getLinePolyline(cityName, first.lng, first.lat, last.lng, last.lat);

        if (polyline && polyline.length > 0) {
            const stationObjs = l.stations.map(s => ({ lat: s.lat, lng: s.lng }));
            const anchors = buildAnchors(polyline, stationObjs);

            // Verify first and last match
            const firstD = dist(stationObjs[0], polyline[0]);
            const lastD = dist(stationObjs[stationObjs.length - 1], polyline[polyline.length - 1]);

            if (firstD > 2000 || lastD > 2000) {
                console.log("    MISMATCH: first=" + firstD.toFixed(0) + "m last=" + lastD.toFixed(0) + "m — SKIP");
                failedCalls++;
            } else {
                l.segmentAnchors = anchors;
                const aCount = anchors.reduce((a, seg) => a + seg.length, 0);
                totalAnchors += aCount;
                console.log("    OK: " + polyline.length + " pts, " + aCount + " anchors");
            }
        } else {
            console.log("    FAILED (no polyline)");
            failedCalls++;
        }

        // Rate limit
        if (li < lines.length - 1 && !isRing) {
            await new Promise(r => setTimeout(r, BATCH_DELAY));
        }
    }

    // Write output
    data.data.lineCounter = lines.length;
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), "utf8");
    console.log("\nDone: " + apiCalls + " API calls, " + totalAnchors + " anchors, " + failedCalls + " failed");
    console.log("Output: " + outputFile);
}

async function main() {
    const [,, slug, cityName] = process.argv;
    if (!slug) { console.log("Usage: amap_anchors.js {slug} {中文名}"); process.exit(1); }

    const inputFile = "C:/Users/Conner/Downloads/" + slug + "_metro.json";
    const outputFile = "C:/Users/Conner/Downloads/" + slug + "_metro.json";

    if (!fs.existsSync(inputFile)) { console.log("File not found: " + inputFile); process.exit(1); }

    await processCity(slug, cityName, inputFile, outputFile);
}
main();
