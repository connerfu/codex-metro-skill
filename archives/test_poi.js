const https = require("https");
const AMAP_KEY = "c037d67ccb46f69c5f1b7a9b84c61e0e";

// Test 1: exact same as fix_transfers.js
var kw1 = encodeURIComponent("\u516C\u4E3B\u575F\u5730\u94C1\u7AD91\u53F7\u7EBF");
console.log("kw1:", decodeURIComponent(kw1));
console.log("kw1 encoded:", kw1);

var path = "/v3/place/text?key=" + AMAP_KEY + "&keywords=" + kw1 + "&types=150500&city=" + encodeURIComponent("\u5317\u4EAC") + "&offset=10&page=1";
console.log("path:", path.substring(0, 200));

// Make request
console.log("Making request...");
https.get("https://restapi.amap.com" + path, {headers:{"User-Agent":"CM/5"}}, function(res) {
    var d = ""; 
    res.on("data", function(c) { d += c; });
    res.on("end", function() { 
        console.log("Status:", res.statusCode);
        console.log("Response (first 500):", d.substring(0, 500));
        try { 
            var j = JSON.parse(d); 
            console.log("status:", j.status, "count:", j.count);
            if (j.pois && j.pois.length > 0) {
                for (var i = 0; i < Math.min(j.pois.length, 3); i++) {
                    console.log("  POI:", j.pois[i].name, "location:", j.pois[i].location);
                }
            } else {
                console.log("  NO POIS");
            }
        } catch(e) { console.log("Parse error:", e.message); }
    });
}).on("error", function(e) { console.log("Error:", e.message); });