const fs = require("fs");
var data = JSON.parse(fs.readFileSync("C:/Users/Conner/Downloads/beijing_metro.json", "utf8"));
var lines = data.data.lines;

for (var li = 0; li < lines.length; li++) {
    var l = lines[li];
    if (l.name && l.name.indexOf("10\u53F7\u7EBF") >= 0) {
        var st = l.stations;
        var zeroCount = 0, sparseCount = 0, goodCount = 0;
        for (var si = 0; si < st.length - 1; si++) {
            var anchors = l.segmentAnchors ? l.segmentAnchors[si] : [];
            var s = st[si], ns = st[si+1];
            var dlat = (s.lat - ns.lat) * 111000;
            var dlng = (s.lng - ns.lng) * 111000 * Math.cos(s.lat * Math.PI / 180);
            var segDist = Math.sqrt(dlat*dlat + dlng*dlng);
            if (!anchors || anchors.length === 0) {
                zeroCount++;
                console.log("  STILL ZERO: " + s.name + " -> " + ns.name + " dist=" + segDist.toFixed(0) + "m");
            } else if (anchors.length <= 2 && segDist > 800) {
                sparseCount++;
            } else {
                goodCount++;
            }
        }
        console.log("\n10\u53F7\u7EBF: " + goodCount + " good, " + sparseCount + " sparse, " + zeroCount + " zero-anchor");
        break;
    }
}