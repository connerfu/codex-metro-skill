const fs = require("fs");
const file = "C:/Users/Conner/Downloads/guangzhou_metro.json";
const data = JSON.parse(fs.readFileSync(file, "utf8"));
var lines = data.data.lines;

// Re-merge everything except GZ12
var merged = [];
var seen = {};

for (var li = 0; li < lines.length; li++) {
    var l = lines[li];
    var base = l.id.replace(/_\d+$/, "");
    
    if (base === "GZ12") {
        // Keep as-is (already split into 2)
        merged.push(l);
        continue;
    }
    
    if (l.id.indexOf("_") >= 0) {
        // This is a split segment that should be re-merged
        if (seen[base]) continue;
        seen[base] = true;
        
        var variants = lines.filter(function(x){ return x.id === base || x.id.indexOf(base+"_")===0; });
        variants.sort(function(a,b){ return a.id.localeCompare(b.id); });
        
        var m = JSON.parse(JSON.stringify(variants[0]));
        m.id = base;
        m.name = variants[0].name.replace(/(\u5317\u6BB5|\u5357\u6BB5|\u4E1C\u6BB5|\u897F\u6BB5|\u6BB5\d+)$/, "");
        m.stations = [];
        m.segmentAnchors = [];
        for (var vi = 0; vi < variants.length; vi++) {
            for (var si = 0; si < variants[vi].stations.length; si++) m.stations.push(variants[vi].stations[si]);
            if (variants[vi].segmentAnchors) {
                for (var ai = 0; ai < variants[vi].segmentAnchors.length; ai++) m.segmentAnchors.push(variants[vi].segmentAnchors[ai]);
            }
            if (vi < variants.length-1) m.segmentAnchors.push([]);
        }
        m.sc = Math.max(4, variants[0].sc);
        merged.push(m);
        console.log("Re-merged: " + m.name + " (" + m.stations.length + " st)");
    } else {
        merged.push(l);
    }
}

// Rename GZ12 segments to 北段/南段
for (var li = 0; li < merged.length; li++) {
    if (merged[li].id === "GZ12_1") merged[li].name = "\u5E7F\u5DDE\u5730\u94C112\u53F7\u7EBF\u897F\u6BB5";
    if (merged[li].id === "GZ12_2") merged[li].name = "\u5E7F\u5DDE\u5730\u94C112\u53F7\u7EBF\u4E1C\u6BB5";
}

data.data.lines = merged;
data.data.lineCounter = merged.length;
fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");

console.log("\nFinal: " + merged.length + " lines");
for (var li = 0; li < merged.length; li++) {
    var l = merged[li];
    if (l.id.indexOf("GZ12") >= 0) {
        console.log("  " + l.id + ": " + l.name + " (" + l.stations.length + " st)");
    }
}