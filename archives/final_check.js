const fs = require("fs");
var data = JSON.parse(fs.readFileSync("C:/Users/Conner/Downloads/beijing_metro.json", "utf8"));
var lines = data.data.lines;
console.log("Lines:", lines.length);
console.log("Size:", (fs.statSync("C:/Users/Conner/Downloads/beijing_metro.json").size / 1024).toFixed(0) + "KB");

// Ring 10 stats
for (var li = 0; li < lines.length; li++) {
    var l = lines[li];
    if (l.name && l.name.indexOf("10\u53F7\u7EBF") >= 0) {
        var totalAnchors = 0, zeroCount = 0;
        l.segmentAnchors.forEach(function(a) { totalAnchors += (a||[]).length; if (!a || a.length === 0) zeroCount++; });
        console.log("10\u53F7\u7EBF: " + totalAnchors + " total anchors, " + zeroCount + " zero-anchor segments");
    }
}

// Check transfers
var transferCount = 0, sepCount = 0;
var groups = {};
for (var li = 0; li < lines.length; li++) {
    var st = lines[li].stations || [];
    for (var si = 0; si < st.length; si++) {
        var s = st[si];
        if (s.isTransfer) {
            transferCount++;
            if (!groups[s.transferGroupId]) groups[s.transferGroupId] = [];
            groups[s.transferGroupId].push(s);
        }
    }
}
var totalGroups = Object.keys(groups).length;
for (var k in groups) {
    var coords = new Set(groups[k].map(function(s){return s.lat.toFixed(6)+","+s.lng.toFixed(6)}));
    if (coords.size >= 2) sepCount++;
}
console.log("Transfer groups: " + totalGroups + ", separated: " + sepCount);

// Check 火器营->巴沟
for (var li = 0; li < lines.length; li++) {
    var l = lines[li];
    if (l.name && l.name.indexOf("10\u53F7\u7EBF") >= 0) {
        var st = l.stations;
        for (var si = 0; si < st.length - 1; si++) {
            if (st[si].name.indexOf("\u706B\u5668\u8425") >= 0) {
                var a = l.segmentAnchors[si];
                console.log(st[si].name + " -> " + st[si+1].name + ": " + (a?a.length:0) + " anchors");
            }
        }
    }
}