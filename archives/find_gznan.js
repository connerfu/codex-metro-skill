const fs = require("fs");
var data = JSON.parse(fs.readFileSync("C:/Users/Conner/Downloads/guangzhou_metro.json", "utf8"));
var lines = data.data.lines;

for (var li = 0; li < lines.length; li++) {
    var st = lines[li].stations || [];
    for (var si = 0; si < st.length; si++) {
        if (st[si].name.indexOf("\u5357\u7AD9") >= 0 && st[si].name.indexOf("\u5E7F\u5DDE") >= 0) {
            console.log(lines[li].name + ": " + st[si].name + " @ " + st[si].lat.toFixed(5) + "," + st[si].lng.toFixed(5));
        }
    }
}