const fs = require("fs");

// split_gapped_lines.js v2.1 — Smart gap detection
// Splits lines where gap > 8km AND gap > 4x median station spacing
const GAP_KM = 8;
const GAP_RATIO = 4;

const slug = process.argv[2];
if (!slug) { console.log("Usage: split_gapped_lines.js {slug}"); process.exit(1); }
const file = "C:/Users/Conner/Downloads/" + slug + "_metro.json";
if (!fs.existsSync(file)) { console.log("Not found: " + file); process.exit(0); }

const data = JSON.parse(fs.readFileSync(file, "utf8"));
const lines = data.data.lines;

function dist(a, b) {
    var dlat = (a.lat - b.lat) * 111000;
    var dlng = (a.lng - b.lng) * 111000 * Math.cos(a.lat * Math.PI / 180);
    return Math.sqrt(dlat*dlat + dlng*dlng);
}

var newLines = [];
var splitCount = 0;

for (var li = 0; li < lines.length; li++) {
    var l = lines[li];
    var st = l.stations;
    if (st.length < 4) { newLines.push(l); continue; }
    
    // Calculate median spacing
    var spacings = [];
    for (var si = 0; si < st.length - 1; si++) {
        spacings.push(dist(st[si], st[si+1]));
    }
    spacings.sort(function(a,b){return a-b;});
    var median = spacings[Math.floor(spacings.length/2)];
    
    // Find significant gaps
    var gaps = [];
    for (var si = 0; si < st.length - 1; si++) {
        var d = dist(st[si], st[si+1]);
        if (d > GAP_KM * 1000 && d > median * GAP_RATIO) {
            gaps.push({ index: si, dist: d, from: st[si].name, to: st[si+1].name });
        }
    }
    
    if (gaps.length === 0) { newLines.push(l); continue; }
    
    console.log("Splitting " + l.name + " (" + l.id + "): median=" + (median/1000).toFixed(1) + "km");
    gaps.forEach(function(g) {
        console.log("  Gap: " + g.from + " -> " + g.to + " = " + (g.dist/1000).toFixed(1) + "km (" + (g.dist/median).toFixed(1) + "x)");
    });
    
    // Build segments
    var segments = [];
    var segStart = 0;
    for (var gi = 0; gi < gaps.length; gi++) {
        if (gaps[gi].index - segStart >= 2) segments.push({start:segStart, end:gaps[gi].index+1});
        segStart = gaps[gi].index + 1;
    }
    if (st.length - segStart >= 2) segments.push({start:segStart, end:st.length});
    if (segments.length < 2 || segments.some(function(s){return s.end-s.start < 3;})) { newLines.push(l); continue; }
    
    // Direction labels
    var labels = [];
    if (segments.length === 2) {
        var avg0_lat = 0, avg1_lat = 0, avg0_lng = 0, avg1_lng = 0;
        for (var si = segments[0].start; si < segments[0].end; si++) { avg0_lat += st[si].lat; avg0_lng += st[si].lng; }
        for (var si = segments[1].start; si < segments[1].end; si++) { avg1_lat += st[si].lat; avg1_lng += st[si].lng; }
        var n0 = segments[0].end - segments[0].start;
        var n1 = segments[1].end - segments[1].start;
        avg0_lat /= n0; avg0_lng /= n0; avg1_lat /= n1; avg1_lng /= n1;
        if (Math.abs(avg0_lat-avg1_lat) > Math.abs(avg0_lng-avg1_lng)) {
            labels = avg0_lat > avg1_lat ? ["\u5317\u6BB5","\u5357\u6BB5"] : ["\u5357\u6BB5","\u5317\u6BB5"];
        } else {
            labels = avg0_lng > avg1_lng ? ["\u4E1C\u6BB5","\u897F\u6BB5"] : ["\u897F\u6BB5","\u4E1C\u6BB5"];
        }
    }
    
    for (var si = 0; si < segments.length; si++) {
        var seg = segments[si];
        var nl = JSON.parse(JSON.stringify(l));
        nl.id = l.id + "_" + (si+1);
        nl.name = l.name + (labels[si] || "");
        nl.stations = st.slice(seg.start, seg.end);
        if (nl.segmentAnchors) nl.segmentAnchors = nl.segmentAnchors.slice(seg.start, seg.end-1);
        nl.sc = Math.max(3, Math.round(l.sc * nl.stations.length / st.length));
        newLines.push(nl);
        console.log("  -> " + nl.id + ": " + nl.name + " (" + nl.stations.length + " st)");
        splitCount++;
    }
}

if (splitCount > 0) {
    data.data.lines = newLines;
    data.data.lineCounter = newLines.length;
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
    console.log("Split " + splitCount + " segments (" + newLines.length + " lines total)");
} else {
    console.log("No splits needed");
}