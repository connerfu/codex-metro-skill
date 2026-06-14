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

async function testStation(name, city) {
    var cleanName = name.replace(/\u7AD9$/, "");
    var kw = encodeURIComponent(cleanName + "\u5730\u94C1\u7AD9");
    var path = "/v3/place/text?key=" + AMAP_KEY + "&keywords=" + kw + "&city=" + encodeURIComponent(city) + "&offset=25&extensions=all";
    var result = await amapGet(path);
    if (!result || !result.pois) {
        console.log(name + ": NO RESULT");
        return;
    }
    var exits = result.pois.filter(p => p.typecode === '150501');
    console.log(name + ": " + result.pois.length + " total, " + exits.length + " exits");
    if (exits.length > 0) {
        exits.forEach(e => console.log("  " + e.name + " addr=" + e.address + " loc=" + e.location));
    }
}

async function main() {
    var city = "\u5317\u4EAC";
    var stations = [
        "\u82F9\u679C\u56ED\u7AD9",  // 苹果园
        "\u897F\u76F4\u95E8\u7AD9",  // 西直门
        "\u56FD\u5BB6\u56FE\u4E66\u9986\u7AD9", // 国家图书馆
        "\u5B8B\u5BB6\u5E84\u7AD9",  // 宋家庄
        "\u4E09\u5143\u6865\u7AD9",  // 三元桥
    ];
    for (var s of stations) {
        await testStation(s, city);
    }
}
main().catch(e => console.error(e));