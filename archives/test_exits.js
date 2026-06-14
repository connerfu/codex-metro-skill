const https = require("https");
const AMAP_KEY = "c037d67ccb46f69c5f1b7a9b84c61e0e";

function amapGet(path) {
    return new Promise(r => {
        https.get("https://restapi.amap.com" + path, {headers:{"User-Agent":"CM/5"}}, res => {
            let d = ""; res.on("data", c => d += c);
            res.on("end", () => { try { r(JSON.parse(d)); } catch(e) { r(null); } });
        }).on("error", () => r(null));
    });
}

async function main() {
    var stationLoc = "116.372883,39.933949"; // 平安里站
    var city = encodeURIComponent("\u5317\u4EAC");
    
    // Try 1: around search 200m radius, no type filter
    var path1 = "/v3/place/around?key=" + AMAP_KEY + "&location=" + stationLoc + "&radius=300&keywords=" + encodeURIComponent("\u5730\u94C1\u7AD9") + "&city=" + city + "&offset=25&extensions=all";
    console.log("=== Around search (300m, no type) ===");
    var r1 = await amapGet(path1);
    if (r1 && r1.pois) {
        for (var i = 0; i < r1.pois.length; i++) {
            var p = r1.pois[i];
            console.log("[" + i + "] " + p.name + " | " + p.location + " | type=" + p.typecode);
            if (p.address) console.log("    addr: " + p.address);
        }
    } else {
        console.log("No results");
    }
    
    // Try 2: text search without types filter
    console.log("\n=== Text search (no types) ===");
    var kw = encodeURIComponent("\u5E73\u5B89\u91CC\u5730\u94C1\u7AD9\u51FA\u5165\u53E3");
    var path2 = "/v3/place/text?key=" + AMAP_KEY + "&keywords=" + kw + "&city=" + city + "&offset=25&extensions=all";
    var r2 = await amapGet(path2);
    if (r2 && r2.pois) {
        for (var i = 0; i < r2.pois.length; i++) {
            var p = r2.pois[i];
            console.log("[" + i + "] " + p.name + " | " + p.location + " | type=" + p.typecode);
            if (p.address) console.log("    addr: " + p.address);
        }
    } else {
        console.log("No results");
    }
}
main().catch(e => console.error(e));