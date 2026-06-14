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
    // 广州体育馆 → 二沙岛
    var from = "113.27828,23.18088";
    var to = "113.30498,23.10963";
    var path = "/v3/direction/transit/integrated?key=" + AMAP_KEY +
        "&origin=" + from + "&destination=" + to +
        "&city=" + encodeURIComponent("\u5E7F\u5DDE") + "&cityd=" + encodeURIComponent("\u5E7F\u5DDE") +
        "&strategy=0&nightflag=0";
    var r = await amapGet(path);
    if (r && r.status === "1") {
        var transit = r.route && r.route.transits && r.route.transits[0];
        if (transit) {
            console.log("Cost: " + transit.cost + " duration: " + transit.duration + "s");
            (transit.segments || []).forEach(function(seg, i) {
                console.log("Seg " + i + ": " + (seg.bus ? "BUS " + (seg.bus.buslines||[]).map(function(l){return l.name + "("+l.type+")"}).join(",") : "WALK"));
            });
            
            // Check if any segment has subway
            var hasMetro = false;
            (transit.segments || []).forEach(function(seg) {
                (seg.bus && seg.bus.buslines || []).forEach(function(bl) {
                    if (bl.type && bl.type.indexOf("\u5730\u94C1") >= 0) {
                        console.log("  Metro: " + bl.name + " polyline length: " + (bl.polyline ? bl.polyline.split(";").length : 0));
                        hasMetro = true;
                    }
                });
            });
            if (!hasMetro) console.log("  NO METRO SEGMENT FOUND");
        } else {
            console.log("No transit route");
        }
    } else {
        console.log("API failed: " + (r ? r.status : "null"));
    }
}
main().catch(e => console.error(e));