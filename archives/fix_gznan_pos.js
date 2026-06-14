const fs = require("fs");
var data = JSON.parse(fs.readFileSync("C:/Users/Conner/Downloads/guangzhou_metro.json", "utf8"));
var lines = data.data.lines;

// Correct 广州南站 for GZ2 and GZ_FOSHAN_LINE_2
// Real Guangzhou South Station: ~22.989, 113.269
var correctLat = 22.9890, correctLng = 113.2690;

for (var li = 0; li < lines.length; li++) {
    var st = lines[li].stations || [];
    for (var si = 0; si < st.length; si++) {
        if (st[si].name === "\u5E7F\u5DDE\u5357\u7AD9\u7AD9") {
            var oldLat = st[si].lat.toFixed(6);
            if (Math.abs(st[si].lat - correctLat) > 0.01) {
                st[si].lat = correctLat;
                st[si].lng = correctLng;
                console.log("Fixed: " + lines[li].name + " " + oldLat + " -> " + correctLat.toFixed(6));
            }
        }
    }
}

fs.writeFileSync("C:/Users/Conner/Downloads/guangzhou_metro.json", JSON.stringify(data, null, 2), "utf8");
console.log("Done");