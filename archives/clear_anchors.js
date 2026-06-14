const fs = require("fs");
var d = JSON.parse(fs.readFileSync("C:/Users/Conner/Downloads/guangzhou_metro.json","utf8"));
d.data.lines.forEach(l => { delete l.segmentAnchors; });
fs.writeFileSync("C:/Users/Conner/Downloads/guangzhou_metro.json", JSON.stringify(d,null,2),"utf8");
console.log("Cleared anchors from " + d.data.lines.length + " lines");