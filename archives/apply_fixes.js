const fs = require("fs");
const file = "C:/Users/Conner/Downloads/guangzhou_metro.json";
const data = JSON.parse(fs.readFileSync(file, "utf8"));
var lines = data.data.lines;

// 1. Split GZ12
var gz12 = lines.find(function(l){return l.id==="GZ12"});
if (gz12) {
    var st = gz12.stations;
    // Gap at index 8: 广州体育馆 -> 二沙岛
    var gz12w = JSON.parse(JSON.stringify(gz12));
    gz12w.id = "GZ12_1";
    gz12w.name = "\u5E7F\u5DDE\u5730\u94C112\u53F7\u7EBF\u897F\u6BB5";
    gz12w.stations = st.slice(0, 9);
    if (gz12w.segmentAnchors) gz12w.segmentAnchors = gz12w.segmentAnchors.slice(0, 8);
    gz12w.sc = Math.round(gz12.sc * 9/18);
    
    var gz12e = JSON.parse(JSON.stringify(gz12));
    gz12e.id = "GZ12_2";
    gz12e.name = "\u5E7F\u5DDE\u5730\u94C112\u53F7\u7EBF\u4E1C\u6BB5";
    gz12e.stations = st.slice(9);
    if (gz12e.segmentAnchors) gz12e.segmentAnchors = gz12e.segmentAnchors.slice(9);
    gz12e.sc = Math.round(gz12.sc * 9/18);
    
    // Replace GZ12 with two segments
    var idx = lines.indexOf(gz12);
    lines.splice(idx, 1, gz12w, gz12e);
    console.log("Split GZ12: " + gz12w.stations.length + " + " + gz12e.stations.length + " stations");
}

// 2. Fix 广州南站: GZ2 and Foshan L2
for (var li = 0; li < lines.length; li++) {
    var st = lines[li].stations || [];
    for (var si = 0; si < st.length; si++) {
        if (st[si].name.indexOf("\u5E7F\u5DDE\u5357\u7AD9") >= 0 && Math.abs(st[si].lat - 22.989) > 0.005) {
            console.log("Fix 广州南站: " + lines[li].name + " " + st[si].lat.toFixed(5) + " -> 22.98900");
            st[si].lat = 22.989;
            st[si].lng = 113.269;
        }
    }
}

// 3. Fix 西塱站: GZ1
for (var li = 0; li < lines.length; li++) {
    var st = lines[li].stations || [];
    for (var si = 0; si < st.length; si++) {
        if (st[si].name.indexOf("\u897F\u5871") >= 0 && Math.abs(st[si].lat - 23.066) > 0.005) {
            console.log("Fix 西塱站: " + lines[li].name + " " + st[si].lat.toFixed(5) + " -> 23.06600");
            st[si].lat = 23.066;
            st[si].lng = 113.233;
        }
    }
}

data.data.lineCounter = lines.length;
fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
console.log("\nDone: " + lines.length + " lines");