// seg_anchors.js v16.1 - Per-line transit API + proper rate limiting
const https = require("https");
const fs = require("fs");

const AMAP_KEY = "c037d67ccb46f69c5f1b7a9b84c61e0e";
const TIMEOUT_MS = 15000;
const RATE_LIMIT_MS = 200;
const RDP_EPSILON = 15;
const STATION_PROXIMITY_M = 25;
https.globalAgent.maxSockets = 20;

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
        https.get("https://restapi.amap.com" + path, {
            headers: { "User-Agent": "CodexMetro/4.0" }
        }, res => {
            let d = "";
            res.on("data", c => d += c);
            res.on("end", () => { clearTimeout(timer); try { r(JSON.parse(d)); } catch(e) { r(null); } });
        }).on("error", () => { clearTimeout(timer); r(null); });
    }));
}

function dist(a, b) {
    const R = 6371000;
    const dlat = (a.lat - b.lat) * Math.PI / 180;
    const dlng = (a.lng - b.lng) * Math.PI / 180 * Math.cos(a.lat * Math.PI / 180);
    return R * Math.sqrt(dlat * dlat + dlng * dlng);
}

function rdp(pts, epsilon) {
    if (pts.length <= 2) return pts;
    const ep = epsilon / 111000;
    function perpDist(pt, a, b) {
        const dx = b.lng - a.lng, dy = b.lat - a.lat, ls = dx*dx + dy*dy;
        if (ls === 0) return Math.hypot(pt.lng-a.lng, pt.lat-a.lat);
        const t = Math.max(0, Math.min(1, ((pt.lng-a.lng)*dx + (pt.lat-a.lat)*dy) / ls));
        return Math.hypot(pt.lng-a.lng-t*dx, pt.lat-a.lat-t*dy);
    }
    function rec(s, e) {
        let mx = 0, mi = s;
        for (let i = s+1; i < e; i++) {
            const d = perpDist(pts[i], pts[s], pts[e]);
            if (d > mx) { mx = d; mi = i; }
        }
        if (mx > ep) {
            const l = rec(s, mi), r = rec(mi, e);
            l.pop();
            return l.concat(r);
        }
        return [pts[s], pts[e]];
    }
    return rec(0, pts.length-1);
}

function closestIdx(poly, pt, startFrom) {
    let bi = startFrom || 0, bd = Infinity;
    for (let i = startFrom || 0; i < poly.length; i++) {
        const d = dist(poly[i], pt);
        if (d < bd) { bd = d; bi = i; }
    }
    return bi;
}

async function getLinePolyline(city, stations) {
    const first = stations[0], last = stations[stations.length-1];
    const orig = first.lng + "," + first.lat;
    const dest = last.lng + "," + last.lat;
    const cityEnc = encodeURIComponent(city); console.log("CITY:", city, "ENC:", cityEnc);

    const result = await amapGet("/v3/direction/transit/integrated?key=" + AMAP_KEY +
        "&origin=" + orig + "&destination=" + dest +
        "&city=" + cityEnc + "&cityd=" + cityEnc +
        "&strategy=0&nightflag=0");

    if (!result || result.status !== "1") { console.log("API FAIL:", result?result.status:"null", result?result.info:""); return null; }

    const transit = result.route?.transits?.[0];
    if (!transit) return null;

    let polyline = null;
    for (const seg of (transit.segments || [])) {
        for (const bl of (seg.bus?.buslines || [])) {
            if (bl.polyline && bl.type && (bl.type.includes("??") || bl.type.includes("??") ||
                 bl.type.includes("??") || bl.type.includes("??") || bl.type.includes("??") ||
                 bl.type.includes("??") || bl.type.includes("??"))) {
                if (!polyline || bl.polyline.split(";").length > polyline.split(";").length) {
                    polyline = bl.polyline;
                }
            }
        }
    }
    if (!polyline) return null;

    return polyline.split(";").map(p => {
        const [lng, lat] = p.split(",").map(Number);
        return { lng, lat };
    });
}

function buildAnchors(polyline, stations) {
    const indices = [];
    let ci = 0;
    for (const s of stations) {
        ci = closestIdx(polyline, s, ci);
        indices.push(ci);
    }

    const anchors = [];
    for (let i = 0; i < stations.length - 1; i++) {
        const si = indices[i], ei = indices[i+1];
        let seg = polyline.slice(si + 1, ei);
        seg = seg.filter(pt =>
            dist(pt, stations[i]) > STATION_PROXIMITY_M &&
            dist(pt, stations[i+1]) > STATION_PROXIMITY_M
        );
        if (seg.length > 2) seg = rdp(seg, RDP_EPSILON);
        anchors.push(seg);
    }
    return anchors;
}

async function processLine(l, cityName, idx, total) {
    const st = l.stations;
    if (!st || st.length < 2) return { id: l.id, ok: false, reason: "too few stations" };
    const startTime = Date.now();

    if (l.isRing) {
        process.stderr.write("  [" + (idx+1) + "/" + total + "] " + l.id + " (ring) " + l.name + "...");
        const mid = Math.floor(st.length / 2);
        const half1 = st.slice(0, mid + 1);
        const half2 = st.slice(mid);
        const [poly1, poly2] = await Promise.all([
            getLinePolyline(cityName, half1),
            getLinePolyline(cityName, half2)
        ]);
        let ok = false;
        if (poly1 && poly1.length > 0) {
            const anchors1 = buildAnchors(poly1, half1);
            for (let i = 0; i < mid; i++) l.segmentAnchors[i] = anchors1[i];
            ok = true;
        }
        if (poly2 && poly2.length > 0) {
            const anchors2 = buildAnchors(poly2, half2);
            for (let i = 0; i < st.length - mid - 1; i++) l.segmentAnchors[mid + i] = anchors2[i];
            ok = true;
        }
        const elapsed = Date.now() - startTime;
        console.log("  [" + (idx+1) + "/" + total + "] " + l.id + " " + (ok ? "OK" : "FAIL") + " " + elapsed + "ms (ring)");
        return { id: l.id, ok, reason: ok ? null : "no polyline" };
    }

    process.stderr.write("  [" + (idx+1) + "/" + total + "] " + l.id + " " + l.name + " (" + st.length + " stations)...");
    const polyline = await getLinePolyline(cityName, st);

    if (!polyline || polyline.length < 2) {
        const isAirport = l.id.includes("CA") || l.id.includes("JX") || l.id.includes("JC") || l.name.includes("??");
        if (isAirport) {
            const walkRes = await amapGet("/v3/direction/walking?key=" + AMAP_KEY +
                "&origin=" + st[0].lng + "," + st[0].lat +
                "&destination=" + st[st.length-1].lng + "," + st[st.length-1].lat);
            if (walkRes && walkRes.status === "1" && walkRes.route?.paths?.[0]?.steps) {
                const walkPts = [];
                for (const step of walkRes.route.paths[0].steps) {
                    if (step.polyline) {
                        for (const p of step.polyline.split(";")) {
                            walkPts.push({ lng: +p.split(",")[0], lat: +p.split(",")[1] });
                        }
                    }
                }
                if (walkPts.length > 5) {
                    l.segmentAnchors = buildAnchors(walkPts, st);
                    const elapsed = Date.now() - startTime;
                    console.log("  [" + (idx+1) + "/" + total + "] " + l.id + " OK (walking) " + elapsed + "ms");
                    return { id: l.id, ok: true };
                }
            }
        }
        const elapsed = Date.now() - startTime;
        console.log("  [" + (idx+1) + "/" + total + "] " + l.id + " FAIL " + elapsed + "ms");
        return { id: l.id, ok: false, reason: "no polyline" };
    }

    const firstDist = dist(st[0], polyline[0]);
    const lastDist = dist(st[st.length-1], polyline[polyline.length-1]);
    if (firstDist > 3000 || lastDist > 3000) {
        const elapsed = Date.now() - startTime;
        console.log("  [" + (idx+1) + "/" + total + "] " + l.id + " FAIL mism " + elapsed + "ms");
        return { id: l.id, ok: false, reason: "mismatch" };
    }

    l.segmentAnchors = buildAnchors(polyline, st);
    const aCount = l.segmentAnchors.reduce((a, seg) => a + seg.length, 0);
    const elapsed = Date.now() - startTime;
    console.log("  [" + (idx+1) + "/" + total + "] " + l.id + " OK " + polyline.length + "pts " + aCount + "a " + elapsed + "ms");
    return { id: l.id, ok: true };
}

async function processCity(slug, cityName, inputFile, outputFile) {
    const t0 = Date.now();
    console.log("\n=== " + cityName + " (" + slug + ") ===");
    const data = JSON.parse(fs.readFileSync(inputFile, "utf8"));
    const lines = data.data?.lines || data.layers?.lines || data.lines || [];

    let toProcess = [];
    for (const l of lines) {
        if (!l.stations || l.stations.length < 2) continue;
        const hasAnchors = l.segmentAnchors && l.segmentAnchors.some(a => a && a.length > 0);
        if (hasAnchors) { console.log("  SKIP " + l.id + " (cached)"); continue; }
        if (!l.segmentAnchors) l.segmentAnchors = [];
        toProcess.push(l);
    }

    if (toProcess.length === 0) { console.log("All lines already have anchors"); return; }
    console.log("Processing " + toProcess.length + " lines (rate=" + RATE_LIMIT_MS + "ms)");

    let ok = 0, fail = 0;
    for (let i = 0; i < toProcess.length; i++) {
        const result = await processLine(toProcess[i], cityName, i, toProcess.length);
        if (result.ok) ok++; else fail++;
    }

    let filled = 0;
    for (const l of lines) {
        if (!l.stations || l.stations.length < 2) continue;
        if (!l.segmentAnchors) l.segmentAnchors = [];
        for (let i = 0; i < l.stations.length - 1; i++) {
            if (!l.segmentAnchors[i] || l.segmentAnchors[i].length === 0) {
                const a = l.stations[i], b = l.stations[i+1];
                const d = dist(a, b);
                const n = Math.max(3, Math.ceil(d / 300));
                const pts = [];
                for (let j = 1; j < n; j++) {
                    const r = j / n;
                    pts.push({ lat: a.lat + (b.lat - a.lat) * r, lng: a.lng + (b.lng - a.lng) * r });
                }
                l.segmentAnchors[i] = pts;
                filled++;
            }
        }
    }
    if (filled > 0) console.log("Filled " + filled + " straight segments");

    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), "utf8");

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    let totalAnchors = 0;
    for (const l of lines) for (const sa of (l.segmentAnchors || [])) if (sa && sa.length > 0) totalAnchors += sa.length;
    console.log("Done: " + ok + "/" + toProcess.length + " OK, " + totalAnchors + " anchors, " + fail + " failed, " + elapsed + "s");
}

const [,, slug, cityName] = process.argv;
if (!slug) { console.log("Usage: seg_anchors.js {slug} {???}"); process.exit(1); }
const f = "C:/Users/Conner/Downloads/" + slug + "_metro.json";
if (!fs.existsSync(f)) { console.log("File not found: " + f); process.exit(1); }
processCity(slug, cityName, f, f).catch(e => { console.error(e); process.exit(1); });