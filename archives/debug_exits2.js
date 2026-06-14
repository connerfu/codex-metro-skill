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

async function testVariants(name, city) {
    var cleanName = name.replace(/\u7AD9$/, "");
    city = encodeURIComponent(city);
    
    // Variant 1: "站名地铁站出入口"
    var kw1 = encodeURIComponent(cleanName + "\u5730\u94C1\u7AD9\u51FA\u5165\u53E3");
    var r1 = await amapGet("/v3/place/text?key=" + AMAP_KEY + "&keywords=" + kw1 + "&city=" + city + "&offset=25&extensions=all");
    var exits1 = r1 && r1.pois ? r1.pois.filter(p => p.typecode === '150501') : [];
    
    // Variant 2: "站名地铁站口"  
    var kw2 = encodeURIComponent(cleanName + "\u5730\u94C1\u7AD9\u53E3");
    var r2 = await amapGet("/v3/place/text?key=" + AMAP_KEY + "&keywords=" + kw2 + "&city=" + city + "&offset=25&extensions=all");
    var exits2 = r2 && r2.pois ? r2.pois.filter(p => p.typecode === '150501') : [];
    
    // Variant 3: just "站名站"  
    var kw3 = encodeURIComponent(cleanName + "\u7AD9");
    var r3 = await amapGet("/v3/place/text?key=" + AMAP_KEY + "&keywords=" + kw3 + "&city=" + city + "&offset=25&extensions=all");
    var exits3 = r3 && r3.pois ? r3.pois.filter(p => p.typecode === '150501') : [];
    
    console.log(name + ": kw1=" + exits1.length + " kw2=" + exits2.length + " kw3=" + exits3.length);
}

async function main() {
    var city = "\u5317\u4EAC";
    await testVariants("\u82F9\u679C\u56ED\u7AD9", city);
    await testVariants("\u56FD\u5BB6\u56FE\u4E66\u9986\u7AD9", city);
    await testVariants("\u4E09\u5143\u6865\u7AD9", city);
    await testVariants("\u4E1C\u76F4\u95E8\u7AD9", city);
}
main().catch(e => console.error(e));