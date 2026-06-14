const fs = require("fs");
var data = JSON.parse(fs.readFileSync("C:/Users/Conner/Downloads/beijing_metro.json", "utf8"));
var lines = data.data.lines;

console.log("=== Beijing Metro Final Stats ===");
console.log("Lines:", lines.length);
console.log("File:", (fs.statSync("C:/Users/Conner/Downloads/beijing_metro.json").size/1024).toFixed(0) + "KB");

// Ring stats
var ring10, ring2;
for (var li = 0; li < lines.length; li++) {
    var l = lines[li];
    if (l.isRing) {
        var totalA = 0, zeroA = 0;
        (l.segmentAnchors||[]).forEach(function(a){ totalA += (a||[]).length; if(!a||a.length===0)zeroA++; });
        console.log(l.name + ": " + l.stations.length + " st, " + totalA + " anchors, " + zeroA + " zero-seg");
    }
}

// Transfer stats
var groups = {}, totalT = 0;
for (var li = 0; li < lines.length; li++) {
    (lines[li].stations||[]).forEach(function(s){
        if (s.isTransfer) {
            totalT++;
            if(!groups[s.transferGroupId]) groups[s.transferGroupId]=[];
            groups[s.transferGroupId].push({line:lines[li].name,lat:s.lat.toFixed(6),lng:s.lng.toFixed(6)});
        }
    });
}
var sepCount = 0, sameList = [];
for (var k in groups) {
    var coords = new Set(groups[k].map(function(s){return s.lat+","+s.lng}));
    if (coords.size >= 2) sepCount++; else sameList.push(k);
}
console.log("Transfers: " + Object.keys(groups).length + " groups, " + sepCount + " separated, " + sameList.length + " same-struct");
if (sameList.length > 0) console.log("  Same structure: " + sameList.join(", "));

// Station count
var totalSt = 0;
lines.forEach(function(l){ totalSt += (l.stations||[]).length; });
console.log("Total stations: " + totalSt);