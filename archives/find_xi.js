const fs = require("fs");
var data = JSON.parse(fs.readFileSync("C:/Users/Conner/Downloads/guangzhou_metro.json", "utf8"));
var lines = data.data.lines;

// Search for stations containing 西
for (var li = 0; li < lines.length; li++) {
    var st = lines[li].stations || [];
    for (var si = 0; si < st.length; si++) {
        if (st[si].name.indexOf("\u897F") >= 0) {
            console.log(lines[li].name + " [" + si + "]: " + st[si].name + " @ " + st[si].lat.toFixed(5) + "," + st[si].lng.toFixed(5));
        }
    }
}