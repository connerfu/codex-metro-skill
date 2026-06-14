const fs = require("fs");
var data = JSON.parse(fs.readFileSync("C:/Users/Conner/Downloads/guangzhou_metro.json", "utf8"));
var lines = data.data.lines;

// 西塱站 correct position (from GZ10/GZ22/Guangfo平均)
var correctLat = 23.066, correctLng = 113.233;

for (var li = 0; li < lines.length; li++) {
    var st = lines[li].stations || [];
    for (var si = 0; si < st.length; si++) {
        if (st[si].name === "\u897F\u5831\u7AD9" && Math.abs(st[si].lat - correctLat) > 0.005) {
            console.log("Fixed: " + lines[li].name + " " + st[si].lat.toFixed(5) + " -> " + correctLat.toFixed(5));
            st[si].lat = correctLat;
            st[si].lng = correctLng;
        }
    }
}

fs.writeFileSync("C:/Users/Conner/Downloads/guangzhou_metro.json", JSON.stringify(data, null, 2), "utf8");
console.log("Done");