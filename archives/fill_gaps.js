const https = require('https');
const fs = require('fs');

const AMAP_KEY = 'c037d67ccb46f69c5f1b7a9b84c61e0e';
const TIMEOUT_MS = 8000;

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

async function tryTransitVariants(city, fromLng, fromLat, toLng, toLat) {
    const orig = fromLng + ',' + fromLat;
    const dest = toLng + ',' + toLat;
    
    // Try strategies: 0=default, 2=less walking, 5=subway priority
    const strategies = [0, 2, 5];
    for (const strat of strategies) {
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
        if (polyline) return polyline.split(';').map(p => { const parts = p.split(','); return { lng: +parts[0], lat: +parts[1] }; });
    }
    return null;
}

// Also try searching by station names + "地铁站" keyword
async function tryKeywordSearch(stationName, city, lineNum) {
    const kw = encodeURIComponent(stationName.replace(/\u7AD9$/, "") + "\u5730\u94C1\u7AD9" + lineNum + "\u53F7\u7EBF");
    const path = '/v3/place/text?key=' + AMAP_KEY + '&keywords=' + kw + '&types=150500&city=' + encodeURIComponent(city) + '&offset=5';
    const result = await amapGet(path);
    if (result && result.status === '1' && result.pois && result.pois.length > 0) {
        const loc = result.pois[0].location.split(',');
        return { lng: +loc[0], lat: +loc[1], name: result.pois[0].name };
    }
    return null;
}

async function main() {
    const file = "C:/Users/Conner/Downloads/beijing_metro.json";
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const lines = data.data.lines;
    
    const cityName = "\u5317\u4EAC";
    
    // Find 10号线 and fill 0-anchor segments
    for (let li = 0; li < lines.length; li++) {
        const l = lines[li];
        if (!l.name || l.name.indexOf("10\u53F7\u7EBF") === -1) continue;
        
        const st = l.stations;
        for (let si = 0; si < st.length - 1; si++) {
            const anchors = l.segmentAnchors ? l.segmentAnchors[si] : [];
            if (anchors && anchors.length > 0) continue;
            
            const s = st[si], ns = st[si+1];
            console.log("\nTrying to fill: " + s.name + " -> " + ns.name);
            
            // First try different transit strategies
            let polyline = await tryTransitVariants(cityName, s.lng, s.lat, ns.lng, ns.lat);
            
            if (polyline && polyline.length > 2) {
                console.log("  Transit OK: " + polyline.length + " pts");
                // Use middle points as anchors (excluding first/last which are stations)
                const midPts = polyline.slice(1, -1);
                // RDP simplify
                l.segmentAnchors[si] = midPts.filter((p, i) => {
                    if (i === 0 || i === midPts.length - 1) return true;
                    return i % Math.max(1, Math.floor(midPts.length / 4)) === 0;
                }).map(p => ({ lat: p.lat, lng: p.lng }));
                console.log("  -> " + l.segmentAnchors[si].length + " anchors");
            } else {
                // Fallback: simple midpoint interpolation
                console.log("  Transit failed, using midpoint");
                l.segmentAnchors[si] = [{
                    lat: (s.lat + ns.lat) / 2,
                    lng: (s.lng + ns.lng) / 2
                }];
            }
        }
        
        // Also fill very sparse segments (2 anchors for >800m)
        for (let si = 0; si < st.length - 1; si++) {
            const anchors = l.segmentAnchors ? l.segmentAnchors[si] : [];
            if (!anchors || anchors.length > 2) continue;
            
            const s = st[si], ns = st[si+1];
            const dlat = (s.lat - ns.lat) * 111000;
            const dlng = (s.lng - ns.lng) * 111000 * Math.cos(s.lat * Math.PI / 180);
            const segDist = Math.sqrt(dlat*dlat + dlng*dlng);
            
            if (segDist < 800) continue;
            
            // Try to get more anchors
            let polyline = await tryTransitVariants(cityName, s.lng, s.lat, ns.lng, ns.lat);
            if (polyline && polyline.length > anchors.length + 2) {
                const midPts = polyline.slice(1, -1);
                const step = Math.max(1, Math.floor(midPts.length / 6));
                l.segmentAnchors[si] = midPts.filter((p, i) => i % step === 0).map(p => ({ lat: p.lat, lng: p.lng }));
                console.log("  Enriched " + s.name + " -> " + ns.name + ": " + anchors.length + "->" + l.segmentAnchors[si].length + " anchors (" + segDist.toFixed(0) + "m)");
            }
        }
        break;
    }
    
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
    console.log("\nSaved.");
}
main().catch(function(e) { console.error(e); process.exit(1); });