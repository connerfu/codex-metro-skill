const fs = require("fs");
var data = JSON.parse(fs.readFileSync("C:/Users/Conner/Downloads/beijing_metro.json", "utf8"));
var lines = data.data.lines;

// Sample a few lines to check anchor density and segment straightness
var samples = ["\u5317\u4EAC\u5730\u94C11\u53F7\u7EBF", "\u5317\u4EAC\u5730\u94C12\u53F7\u7EBF", "\u5317\u4EAC\u5730\u94C14\u53F7\u7EBF"];

function dist(a, b) {
    var dlat = (a.lat - b.lat) * 111000;
    var dlng = (a.lng - b.lng) * 111000 * Math.cos(a.lat * Math.PI / 180);
    return Math.sqrt(dlat*dlat + dlng*dlng);
}

for (var li = 0; li < lines.length; li++) {
    var l = lines[li];
    var matched = false;
    for (var si = 0; si < samples.length; si++) {
        if (l.name && l.name.indexOf(samples[si]) >= 0) matched = true;
    }
    if (!matched) continue;
    
    console.log("\n=== " + l.name + " (" + l.stations.length + " stations) ===");
    
    var totalAnchors = 0, totalDist = 0;
    var maxAnchorsPerSeg = 0, maxAnchorSeg = "";
    
    for (var si = 0; si < l.stations.length - 1; si++) {
        var s = l.stations[si], ns = l.stations[si+1];
        var segDist = dist(s, ns);
        totalDist += segDist;
        
        var anchors = l.segmentAnchors ? l.segmentAnchors[si] : [];
        var aCount = anchors ? anchors.length : 0;
        totalAnchors += aCount;
        
        if (aCount > maxAnchorsPerSeg) {
            maxAnchorsPerSeg = aCount;
            maxAnchorSeg = s.name + "->" + ns.name + " (" + segDist.toFixed(0) + "m)";
        }
        
        // Show segments with many anchors
        if (aCount >= 6) {
            // Check if segment is mostly straight
            var maxDeviation = 0;
            if (anchors && anchors.length > 0) {
                for (var ai = 0; ai < anchors.length; ai++) {
                    // Simple check: perpendicular distance from anchor to station-station line
                    var dx = ns.lng - s.lng, dy = ns.lat - s.lat;
                    var lenSq = dx*dx + dy*dy;
                    if (lenSq > 0) {
                        var t = ((anchors[ai].lng - s.lng)*dx + (anchors[ai].lat - s.lat)*dy) / lenSq;
                        t = Math.max(0, Math.min(1, t));
                        var projLng = s.lng + t*dx, projLat = s.lat + t*dy;
                        var dev = dist(anchors[ai], {lat: projLat, lng: projLng});
                        if (dev > maxDeviation) maxDeviation = dev;
                    }
                }
            }
            var isMostlyStraight = maxDeviation < 30;
            console.log("  HEAVY: " + s.name + "->" + ns.name + ": " + aCount + " anchors, " + segDist.toFixed(0) + "m, maxDev=" + maxDeviation.toFixed(0) + "m" + (isMostlyStraight ? " [MOSTLY STRAIGHT!]" : ""));
        }
    }
    
    console.log("  Total: " + totalAnchors + " anchors, " + (totalDist/1000).toFixed(1) + "km, " + (totalAnchors/(totalDist/1000)).toFixed(1) + " anchors/km");
    console.log("  Max: " + maxAnchorSeg + " (" + maxAnchorsPerSeg + " anchors)");
}