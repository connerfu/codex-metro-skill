const fs = require("fs");
var data = JSON.parse(fs.readFileSync("C:/Users/Conner/Downloads/guangzhou_metro.json", "utf8"));
var lines = data.data.lines;

// Use indexOf for partial match
for (var li = 0; li < lines.length; li++) {
    var st = lines[li].stations || [];
    for (var si = 0; si < st.length; si++) {
        var nm = st[si].name;
        // Check for 西塱 or 西朗
        if ((nm.indexOf("\u897F\u5831") >= 0 || nm.indexOf("\u897F\u6717") >= 0) && Math.abs(st[si].lat - 23.066) > 0.005) {
            console.log("Fixed: " + lines[li].name + " [" + nm + "] " + st[si].lat.toFixed(5) + " -> 23.06600");
            st[si].lat = 23.066;
            st[si].lng = 113.233;
        }
    }
}

fs.writeFileSync("C:/Users/Conner/Downloads/guangzhou_metro.json", JSON.stringify(data, null, 2), "utf8");
console.log("Done");