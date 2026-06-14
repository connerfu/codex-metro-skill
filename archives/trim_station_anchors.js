const fs = require("fs");

var file = "C:/Users/Conner/Downloads/beijing_metro.json";
var data = JSON.parse(fs.readFileSync(file, "utf8"));
var lines = data.data.lines;
const TRIM_RADIUS = 80; // meters around transfer station

function dist(a, b) {
    var dlat = (a.lat - b.lat) * 111000;
    var dlng = (a.lng - b.lng) * 111000 * Math.cos(a.lat * Math.PI / 180);
    return Math.sqrt(dlat*dlat + dlng*dlng);
}

// Collect all transfer stations
var transferStations = new Set();
for (var li = 0; li < lines.length; li++) {
    var st = lines[li].stations || [];
    for (var si = 0; si < st.length; si++) {
        if (st[si].isTransfer) transferStations.add(st[si].name);
    }
}
console.log("Transfer stations: " + transferStations.size);

var trimmed = 0, totalBefore = 0, totalAfter = 0;

for (var li = 0; li < lines.length; li++) {
    var l = lines[li];
    var st = l.stations;
    if (!l.segmentAnchors) continue;
    
    for (var si = 0; si < st.length - 1; si++) {
        var s = st[si], ns = st[si+1];
        var anchors = l.segmentAnchors[si];
        if (!anchors || anchors.length === 0) continue;
        
        totalBefore += anchors.length;
        
        // Trim anchors near transfer station at start
        if (transferStations.has(s.name)) {
            var keep = [];
            for (var ai = 0; ai < anchors.length; ai++) {
                if (dist(s, anchors[ai]) >= TRIM_RADIUS) keep.push(anchors[ai]);
                else trimmed++;
            }
            anchors = keep;
        }
        
        // Trim anchors near transfer station at end
        if (transferStations.has(ns.name)) {
            var keep = [];
            for (var ai = 0; ai < anchors.length; ai++) {
                if (dist(ns, anchors[ai]) >= TRIM_RADIUS) keep.push(anchors[ai]);
                else trimmed++;
            }
            anchors = keep;
        }
        
        l.segmentAnchors[si] = anchors;
        totalAfter += anchors.length;
    }
}

console.log("Anchors: " + totalBefore + " -> " + totalAfter + " (trimmed " + trimmed + ")");
fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
console.log("Saved: " + file);