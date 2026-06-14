const fs = require("fs");
var data = JSON.parse(fs.readFileSync("C:/Users/Conner/Downloads/beijing_metro.json", "utf8"));
var lines = data.data.lines;

var groups = {};
for (var li = 0; li < lines.length; li++) {
    var st = lines[li].stations || [];
    for (var si = 0; si < st.length; si++) {
        var s = st[si];
        if (s.transferGroupId) {
            if (!groups[s.transferGroupId]) groups[s.transferGroupId] = [];
            groups[s.transferGroupId].push({line: lines[li].name, lat: s.lat.toFixed(6), lng: s.lng.toFixed(6)});
        }
    }
}

console.log("=== 3+ line transfers ===");
for (var k in groups) {
    var uniqueLids = [...new Set(groups[k].map(function(e){return e.line}))];
    if (uniqueLids.length < 3) continue;
    
    console.log("\n" + k + " (" + uniqueLids.length + " lines):");
    groups[k].forEach(function(e){
        console.log("  " + e.line + " @ " + e.lat + "," + e.lng);
    });
    var coords = new Set(groups[k].map(function(e){return e.lat+","+e.lng}));
    console.log("  -> " + coords.size + " unique positions");
}

// Quick check: any 2-line transfer still with different positions?
console.log("\n=== 2-line transfers check ===");
var sameCount = 0, diffCount = 0;
for (var k in groups) {
    var uniqueLids = [...new Set(groups[k].map(function(e){return e.line}))];
    if (uniqueLids.length !== 2) continue;
    var coords = new Set(groups[k].map(function(e){return e.lat+","+e.lng}));
    if (coords.size === 1) sameCount++; else {
        diffCount++;
        if (diffCount <= 3) console.log("  DIFF: " + k + " (" + coords.size + " positions)");
    }
}
console.log("2-line: " + sameCount + " unified, " + diffCount + " still different");