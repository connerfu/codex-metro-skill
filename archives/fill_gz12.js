const https = require("https");
const AMAP_KEY = "c037d67ccb46f69c5f1b7a9b84c61e0e";

// Missing stations for GZ Line 12 middle section
var missingStations = [
    "\u4E91\u6EAA\u516C\u56ED\u7AD9",      // 云溪公园
    "\u5C0F\u91D1\u949F\u7AD9",            // 小金钟
    "\u666F\u4E91\u8DEF\u7AD9",            // 景云路
    "\u5E7F\u56ED\u65B0\u6751\u7AD9",      // 广园新村
    "\u6052\u798F\u8DEF\u7AD9",            // 恒福路
    "\u5EFA\u8BBE\u516D\u9A6C\u8DEF\u7AD9", // 建设六马路
    "\u70C8\u58EB\u9675\u56ED\u7AD9",      // 烈士陵园
    "\u4E1C\u6E56\u7AD9",                  // 东湖
];

// Also verify existing stations between 白云文化广场 and 二沙岛
var verifyStations = [
    "\u767D\u4E91\u6587\u5316\u5E7F\u573A\u7AD9", // 8: 白云文化广场
    "\u5E7F\u5DDE\u4F53\u80B2\u9986\u7AD9",       // what's after 白云文化广场?
];

async function geocodeOne(name) {
    return new Promise(r => {
        var kw = encodeURIComponent(name);
        var path = "/v3/place/text?key=" + AMAP_KEY + "&keywords=" + kw + "&types=150500&city=" + encodeURIComponent("\u5E7F\u5DDE") + "&offset=3";
        https.get("https://restapi.amap.com" + path, {headers:{"User-Agent":"CM/5"}}, res => {
            let d = ""; res.on("data", c => d += c);
            res.on("end", () => {
                try {
                    var j = JSON.parse(d);
                    if (j.status === "1" && j.pois && j.pois.length > 0) {
                        var loc = j.pois[0].location.split(",");
                        console.log(name + ": " + loc[1] + "," + loc[0] + " (" + j.pois[0].name + ")");
                    } else {
                        console.log(name + ": NOT FOUND");
                    }
                } catch(e) { console.log(name + ": ERROR"); }
                r();
            });
        }).on("error", () => { console.log(name + ": NET ERR"); r(); });
    });
}

async function main() {
    console.log("=== Missing Line 12 stations ===");
    for (var s of missingStations) {
        await geocodeOne(s);
        await new Promise(r => setTimeout(r, 200));
    }
}
main().catch(e => console.error(e));