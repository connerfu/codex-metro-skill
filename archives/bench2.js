const https = require("https");
const AMAP_KEY = "c037d67ccb46f69c5f1b7a9b84c61e0e";

async function testTransit(delayMs, count) {
    var ok = 0, fail = 0;
    var t0 = Date.now();
    var rateGate = Promise.resolve();
    function rateLimit() {
        var prev = rateGate; var rg;
        rateGate = new Promise(r => { rg = r; });
        prev.then(() => setTimeout(rg, delayMs));
        return prev;
    }
    for (var i = 0; i < count; i++) {
        await rateLimit();
        await new Promise(r => {
            var timer = setTimeout(() => { fail++; r(); }, 5000);
            https.get("https://restapi.amap.com/v3/direction/transit/integrated?key=" + AMAP_KEY + 
                "&origin=113.23723,23.07596&destination=113.32342,23.10639&city=%E5%B9%BF%E5%B7%9E&cityd=%E5%B9%BF%E5%B7%9E&strategy=0&nightflag=0",
            {headers:{"User-Agent":"CM/5"}}, res => {
                var d = ""; res.on("data", c => d += c);
                res.on("end", () => { clearTimeout(timer);
                    try { var j = JSON.parse(d); if (j.status==="1") ok++; else fail++; } catch(e) { fail++; }
                    r();
                });
            }).on("error", () => { clearTimeout(timer); fail++; r(); });
        });
    }
    var elapsed = (Date.now()-t0)/1000;
    console.log("Rate=" + delayMs + "ms: " + ok + "/" + count + " OK " + elapsed.toFixed(1) + "s " + (fail?"FAIL":""));
    return fail===0;
}

async function main() {
    for (var rate of [150, 120, 100]) {
        var ok = await testTransit(rate, 8);
        if (!ok) { console.log("  LIMIT at " + rate); break; }
        await new Promise(r=>setTimeout(r,1500));
    }
}
main();