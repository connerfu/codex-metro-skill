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
            groups[s.transferGroupId].push({line: lines[li].name, lid: lines[li].id, lat: s.lat, lng: s.lng});
        }
    }
}

console.log("=== 3+ line transfers ===");
var count3plus = 0;
for (var k in groups) {
    var uniqueLines = [...new Set(groups[k].map(function(e){return e.lid}))];
    if (uniqueLines.length >= 3) {
        count3plus++;
        console.log("\n" + k + " (" + uniqueLines.length + " lines):");
        groups[k].forEach(function(e){
            console.log("  " + e.line + " @ " + e.lat.toFixed(6) + "," + e.lng.toFixed(6));
        });
        var coords = new Set(groups[k].map(function(e){return e.lat.toFixed(6)+","+e.lng.toFixed(6)}));
        console.log("  -> " + coords.size + " unique positions");
    }
}
console.log("\nTotal 3+ line transfers: " + count3plus);

console.log("\n=== 2-line transfers (sample) ===");
var count2 = 0;
for (var k in groups) {
    var uniqueLines = [...new Set(groups[k].map(function(e){return e.lid}))];
    if (uniqueLines.length === 2) count2++;
}
console.log("Total 2-line transfers: " + count2);