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
    // Search for all exits of 平安里站
    var kw = encodeURIComponent("\u5E73\u5B89\u91CC\u5730\u94C1\u7AD9");
    var path = "/v3/place/text?key=" + AMAP_KEY + "&keywords=" + kw + "&types=150500&city=" + encodeURIComponent("\u5317\u4EAC") + "&offset=25&page=1&extensions=all";
    var result = await amapGet(path);
    
    if (result && result.pois) {
        console.log("Found " + result.pois.length + " POIs\n");
        for (var i = 0; i < result.pois.length; i++) {
            var p = result.pois[i];
            console.log("[" + i + "] " + p.name);
            console.log("    location: " + p.location);
            console.log("    type: " + p.type);
            console.log("    typecode: " + p.typecode);
            if (p.address) console.log("    address: " + p.address);
            if (p.biz_ext) console.log("    biz_ext: " + JSON.stringify(p.biz_ext));
            if (p.deep_info) console.log("    deep_info: " + JSON.stringify(p.deep_info));
            if (p.parent) console.log("    parent: " + JSON.stringify(p.parent));
            if (p.business_area) console.log("    business_area: " + p.business_area);
            console.log("");
        }
    }
}
main().catch(e => console.error(e));