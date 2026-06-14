const fs = require("fs");
const file = "C:/Users/Conner/Downloads/guangzhou_metro.json";
const data = JSON.parse(fs.readFileSync(file, "utf8"));
var lines = data.data.lines;

// Better merge: only merge lines that were actually split (have _1/_2 suffix from the same original ID)
// Keep the split for GZ12, fix everything else

// First, identify which IDs have _1, _2 etc
var splitGroups = {};
for (var li = 0; li < lines.length; li++) {
    var m = lines[li].id.match(/^(.+)_(\d+)$/);
    if (m) {
        var base = m[1];
        if (!splitGroups[base]) splitGroups[base] = [];
        splitGroups[base].push(lines[li]);
    }
}

// For GZ12, keep the split
var keepSplit = {"GZ12": true};

var finalLines = [];
var skipIds = new Set();

for (var base in splitGroups) {
    if (keepSplit[base]) {
        // Keep the split
        splitGroups[base].forEach(function(l){ finalLines.push(l); skipIds.add(l.id); });
        console.log("KEEP SPLIT: " + base + " -> " + splitGroups[base].map(function(l){return l.name}).join(", "));
    } else {
        // Merge back — need to find the ORIGINAL unsplit line
        // The base ID might have a non-split version too
        var allVariants = lines.filter(function(l){ return l.id === base || l.id.indexOf(base+"_")===0; });
        
        // Sort: base first, then _1, _2...
        allVariants.sort(function(a,b){ 
            if (a.id === base) return -1;
            if (b.id === base) return 1;
            return a.id.localeCompare(b.id);
        });
        
        var merged = JSON.parse(JSON.stringify(allVariants[0]));
        merged.id = base;
        // Remove segment suffix from name
        merged.name = merged.name.replace(/(\u5317\u6BB5|\u5357\u6BB5|\u4E1C\u6BB5|\u897F\u6BB5|\u6BB5\d+)$/, "");
        merged.stations = [];
        merged.segmentAnchors = [];
        
        for (var vi = 0; vi < allVariants.length; vi++) {
            var v = allVariants[vi];
            for (var si = 0; si < v.stations.length; si++) merged.stations.push(v.stations[si]);
            if (v.segmentAnchors) {
                for (var ai = 0; ai < v.segmentAnchors.length; ai++) merged.segmentAnchors.push(v.segmentAnchors[ai]);
            }
            if (vi < allVariants.length-1) merged.segmentAnchors.push([]);
        }
        
        allVariants.forEach(function(v){ skipIds.add(v.id); });
        finalLines.push(merged);
        console.log("MERGED: " + base + " -> " + merged.name + " (" + merged.stations.length + " st)");
    }
}

// Add non-split lines
for (var li = 0; li < lines.length; li++) {
    if (!skipIds.has(lines[li].id)) {
        finalLines.push(lines[li]);
    }
}

// Sort by id
finalLines.sort(function(a,b){ return a.id.localeCompare(b.id); });

data.data.lines = finalLines;
data.data.lineCounter = finalLines.length;
fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");

console.log("\n=== Final ===");
for (var li = 0; li < finalLines.length; li++) {
    console.log(finalLines[li].id + ": " + finalLines[li].name + " (" + finalLines[li].stations.length + " st)");
}