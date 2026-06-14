const fs = require("fs");
var data = JSON.parse(fs.readFileSync("C:/Users/Conner/Downloads/guangzhou_metro.json", "utf8"));
var lines = data.data.lines;

// Group stations by name, find ones where same-name stations differ by >500m
var groups = {};
for (var li = 0; li < lines.length; li++) {
    (lines[li].stations||[]).forEach(function(s){
        if(!groups[s.name]) groups[s.name]=[];
        groups[s.name].push({line:lines[li].name, lat:s.lat, lng:s.lng});
    });
}

function dist(a,b){return Math.sqrt(Math.pow((a.lat-b.lat)*111000,2)+Math.pow((a.lng-b.lng)*111000*Math.cos(a.lat*Math.PI/180),2));}

console.log("=== Stations with >500m spread ===");
var count = 0;
for (var k in groups) {
    var g = groups[k];
    if (g.length < 2) continue;
    var maxD = 0;
    for (var i = 0; i < g.length; i++)
        for (var j = i+1; j < g.length; j++)
            maxD = Math.max(maxD, dist(g[i],g[j]));
    if (maxD > 500) {
        count++;
        console.log(k + ": " + g.length + " entries, max spread " + (maxD/1000).toFixed(2) + "km");
        g.forEach(function(e){ console.log("  " + e.line + ": " + e.lat.toFixed(5)+","+e.lng.toFixed(5)); });
    }
}
console.log("\nTotal: " + count + " stations with >500m spread");