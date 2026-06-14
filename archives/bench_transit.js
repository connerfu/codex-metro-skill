const https = require("https");
const AMAP_KEY = "c037d67ccb46f69c5f1b7a9b84c61e0e";

// Test transit API specifically (used by amap_anchors.js)
var ok = 0, fail = 0;

async function testTransit(delayMs, count) {
    ok = 0; fail = 0;
    var t0 = Date.now();
    
    // Serial rate limiter (same as amap_anchors.js)
    var rateGate = Promise.resolve();
    function rateLimit() {
        var prev = rateGate;
        var rg;
        rateGate = new Promise(r => { rg = r; });
        prev.then(() => setTimeout(rg, delayMs));
        return prev;
    }
    
    for (var i = 0; i < count; i++) {
        await rateLimit();
        await new Promise(r => {
            var timer = setTimeout(() => { fail++; r(); }, 5000);
            // Use real stations to test direction API
            var orig = "113.23723,23.07596"; // 西塱
            var dest = "113.32342,23.10639"; // 广州塔
            https.get("https://restapi.amap.com/v3/direction/transit/integrated?key=" + AMAP_KEY + 
                "&origin=" + orig + "&destination=" + dest + 
                "&city=" + encodeURIComponent("\u5E7F\u5DDE") + "&cityd=" + encodeURIComponent("\u5E7F\u5DDE") +
                "&strategy=0&nightflag=0",
            {headers:{"User-Agent":"CM/5"}}, res => {
                var d = ""; res.on("data", c => d += c);
                res.on("end", () => { clearTimeout(timer);
                    try { var j = JSON.parse(d); if (j.status === "1") ok++; else fail++; } catch(e) { fail++; }
                    r();
                });
            }).on("error", () => { clearTimeout(timer); fail++; r(); });
        });
    }
    
    var elapsed = (Date.now() - t0) / 1000;
    var qps = count / elapsed;
    console.log("  Rate=" + delayMs + "ms: " + ok + "/" + count + " OK, " + elapsed.toFixed(1) + "s (" + qps.toFixed(1) + " QPS) " + (fail>0?"FAIL":"OK"));
    return fail === 0;
}

async function main() {
    console.log("Testing transit API rate limits...");
    for (var rate of [250, 200, 150, 100]) {
        var ok = await testTransit(rate, 10);
        if (!ok) { console.log("  -> Limit reached at " + rate + "ms"); break; }
        await new Promise(r => setTimeout(r, 1000));
    }
}
main().catch(e => console.error(e));