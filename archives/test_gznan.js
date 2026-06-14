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
    var city = encodeURIComponent("\u5E7F\u5DDE");
    var kw = encodeURIComponent("\u5E7F\u5DDE\u5357\u7AD9\u5730\u94C1\u7AD9\u51FA\u5165\u53E3");
    var path = "/v3/place/text?key=" + AMAP_KEY + "&keywords=" + kw + "&city=" + city + "&offset=25&extensions=all";
    var r = await amapGet(path);
    if (r && r.pois) {
        console.log("Found " + r.pois.length + " POIs\n");
        for (var i = 0; i < r.pois.length; i++) {
            var p = r.pois[i];
            if (p.typecode === "150501") {
                console.log("[" + i + "] " + p.name + " | loc=" + p.location + " | addr=" + p.address);
            }
        }
    } else {
        console.log("No results");
    }
}
main().catch(e => console.error(e));