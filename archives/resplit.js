const fs = require("fs");

// Revert: re-scrape Guangzhou to get original file
// Since pre_transfer was already modified, let's rebuild from the working file
// Actually, let me fix the split logic instead

const file = "C:/Users/Conner/Downloads/guangzhou_metro.json";
const data = JSON.parse(fs.readFileSync(file, "utf8"));
var lines = data.data.lines;

function dist(a, b) {
    var dlat = (a.lat - b.lat) * 111000;
    var dlng = (a.lng - b.lng) * 111000 * Math.cos(a.lat * Math.PI / 180);
    return Math.sqrt(dlat*dlat + dlng*dlng);
}

// First, re-merge lines that were erroneously split
// Find lines with _1, _2, _3 suffixes
var mergedBack = [];
var processed = new Set();
for (var li = 0; li < lines.length; li++) {
    var l = lines[li];
    var baseId = l.id.replace(/_\d+$/, "");
    if (processed.has(baseId)) continue;
    
    var variants = lines.filter(function(x){ return x.id === baseId || x.id.indexOf(baseId + "_") === 0; });
    if (variants.length === 1) {
        mergedBack.push(l);
        processed.add(baseId);
    } else {
        // Re-merge
        console.log("Re-merging " + baseId + " from " + variants.length + " segments");
        // Sort by _1, _2, _3
        variants.sort(function(a,b){ return a.id.localeCompare(b.id); });
        
        var merged = JSON.parse(JSON.stringify(variants[0]));
        merged.id = baseId;
        merged.name = variants[0].name.replace(/(\u5317\u6BB5|\u5357\u6BB5|\u4E1C\u6BB5|\u897F\u6BB5|\u6BB5\d+)$/, "");
        
        // Merge stations
        merged.stations = [];
        merged.segmentAnchors = [];
        for (var vi = 0; vi < variants.length; vi++) {
            var v = variants[vi];
            // Add stations
            for (var si = 0; si < v.stations.length; si++) {
                merged.stations.push(v.stations[si]);
            }
            // Add anchors
            if (v.segmentAnchors) {
                for (var ai = 0; ai < v.segmentAnchors.length; ai++) {
                    merged.segmentAnchors.push(v.segmentAnchors[ai]);
                }
            }
            // Add one extra empty anchor segment between merged parts
            if (vi < variants.length - 1) {
                merged.segmentAnchors.push([]);
            }
        }
        
        // Recalculate cars
        var totalD = 0;
        for (var si = 0; si < merged.stations.length - 1; si++) {
            totalD += dist(merged.stations[si], merged.stations[si+1]);
        }
        merged.sc = Math.max(4, Math.round(totalD / 1000 * 0.6));
        
        mergedBack.push(merged);
        processed.add(baseId);
    }
}

// Now apply smarter splitting: only split when gap > 8km AND gap > 4x median
var finalLines = [];
for (var li = 0; li < mergedBack.length; li++) {
    var l = mergedBack[li];
    var st = l.stations;
    if (st.length < 4) { finalLines.push(l); continue; }
    
    // Calculate median spacing
    var spacings = [];
    for (var si = 0; si < st.length - 1; si++) {
        spacings.push(dist(st[si], st[si+1]));
    }
    spacings.sort(function(a,b){return a-b;});
    var median = spacings[Math.floor(spacings.length/2)];
    
    // Find gaps that are both > 8km AND > 4x median
    var gaps = [];
    for (var si = 0; si < st.length - 1; si++) {
        var d = dist(st[si], st[si+1]);
        if (d > 8000 && d > median * 4) {
            gaps.push({ index: si, dist: d, from: st[si].name, to: st[si+1].name });
        }
    }
    
    if (gaps.length === 0) { finalLines.push(l); continue; }
    
    console.log("Splitting " + l.name + ": " + gaps.length + " gaps (median=" + (median/1000).toFixed(1) + "km)");
    gaps.forEach(function(g) {
        console.log("  " + g.from + " -> " + g.to + " = " + (g.dist/1000).toFixed(1) + "km (" + (g.dist/median).toFixed(1) + "x median)");
    });
    
    var segments = [];
    var segStart = 0;
    for (var gi = 0; gi < gaps.length; gi++) {
        if (gaps[gi].index - segStart >= 2) segments.push({start:segStart, end:gaps[gi].index+1});
        segStart = gaps[gi].index + 1;
    }
    if (st.length - segStart >= 2) segments.push({start:segStart, end:st.length});
    if (segments.length < 2) { finalLines.push(l); continue; }
    
    // Labels
    var labels = [];
    if (segments.length === 2) {
        var avgLat0 = 0, avgLat1 = 0, avgLng0 = 0, avgLng1 = 0;
        for (var si = segments[0].start; si < segments[0].end; si++) { avgLat0 += st[si].lat; avgLng0 += st[si].lng; }
        for (var si = segments[1].start; si < segments[1].end; si++) { avgLat1 += st[si].lat; avgLng1 += st[si].lng; }
        avgLat0 /= (segments[0].end-segments[0].start); avgLat1 /= (segments[1].end-segments[1].start);
        avgLng0 /= (segments[0].end-segments[0].start); avgLng1 /= (segments[1].end-segments[1].start);
        if (Math.abs(avgLat0-avgLat1) > Math.abs(avgLng0-avgLng1)) {
            labels = avgLat0 > avgLat1 ? ["\u5317\u6BB5","\u5357\u6BB5"] : ["\u5357\u6BB5","\u5317\u6BB5"];
        } else {
            labels = avgLng0 > avgLng1 ? ["\u4E1C\u6BB5","\u897F\u6BB5"] : ["\u897F\u6BB5","\u4E1C\u6BB5"];
        }
    }
    
    for (var si = 0; si < segments.length; si++) {
        var seg = segments[si];
        var nl = JSON.parse(JSON.stringify(l));
        nl.id = l.id + "_" + (si+1);
        nl.name = l.name + (labels[si] || ("\u6BB5"+(si+1)));
        nl.stations = st.slice(seg.start, seg.end);
        if (nl.segmentAnchors) nl.segmentAnchors = nl.segmentAnchors.slice(seg.start, seg.end-1);
        var nd = 0;
        for (var ssi = 0; ssi < nl.stations.length-1; ssi++) nd += dist(nl.stations[ssi], nl.stations[ssi+1]);
        nl.sc = Math.max(3, Math.round(l.sc * nl.stations.length / st.length));
        finalLines.push(nl);
        console.log("  -> " + nl.name + " (" + nl.stations.length + " st)");
    }
}

data.data.lines = finalLines;
data.data.lineCounter = finalLines.length;
fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
console.log("\nResult: " + finalLines.length + " lines (was " + lines.length + " before merge)");