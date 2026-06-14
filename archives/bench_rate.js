const https = require("https");
const AMAP_KEY = "c037d67ccb46f69c5f1b7a9b84c61e0e";

var ok = 0, fail = 0;

function call(i, delay) {
    return new Promise(r => {
        setTimeout(() => {
            https.get("https://restapi.amap.com/v3/place/text?key=" + AMAP_KEY + "&keywords=" + encodeURIComponent("\u5317\u4EAC") + "&types=150500&city=" + encodeURIComponent("\u5317\u4EAC") + "&offset=1", {headers:{"User-Agent":"CM/5"}}, res => {
                var d = ""; res.on("data", c => d += c);
                res.on("end", () => {
                    try { var j = JSON.parse(d); if (j.status === "1") ok++; else fail++; } catch(e) { fail++; }
                    r();
                });
            }).on("error", () => { fail++; r(); });
        }, i * delay);
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function test(concurrency, rateMs, total) {
    ok = 0; fail = 0;
    var t0 = Date.now();
    console.log("Test: conc=" + concurrency + " rate=" + rateMs + "ms ...");
    
    // Use worker pool pattern with rate limiter
    var lastReq = 0;
    function rateLimit() {
        var now = Date.now(), wait = Math.max(0, rateMs - (now - lastReq));
        lastReq = now + wait;
        return new Promise(r => setTimeout(r, wait));
    }
    
    var i = 0;
    async function worker() {
        while (i < total) {
            i++;
            await rateLimit();
            await new Promise(r => {
                https.get("https://restapi.amap.com/v3/place/text?key=" + AMAP_KEY + "&keywords=" + encodeURIComponent("\u5317\u4EAC") + "&types=150500&city=" + encodeURIComponent("\u5317\u4EAC") + "&offset=1", {headers:{"User-Agent":"CM/5"}}, res => {
                    var d = ""; res.on("data", c => d += c);
                    res.on("end", () => {
                        try { var j = JSON.parse(d); if (j.status === "1") ok++; else fail++; } catch(e) { fail++; }
                        r();
                    });
                }).on("error", () => { fail++; r(); });
            });
        }
    }
    
    var workers = [];
    for (var w = 0; w < concurrency; w++) workers.push(worker());
    await Promise.all(workers);
    
    var elapsed = (Date.now() - t0) / 1000;
    var qps = total / elapsed;
    console.log("  " + ok + "/" + total + " OK, " + elapsed.toFixed(1) + "s (" + qps.toFixed(0) + " QPS) " + (fail>0?"FAIL!":"OK"));
    return fail === 0;
}

async function main() {
    // Test various rate limits with concurrency=5
    for (var rate of [300, 250, 200, 150, 100]) {
        var ok = await test(5, rate, 20);
        if (!ok) { console.log("  -> Rate " + rate + "ms too fast, backing off"); break; }
        await sleep(2000);
    }
    
    // Test higher concurrency with safe rate
    console.log("\n--- Higher concurrency ---");
    for (var conc of [6, 8, 10]) {
        var ok = await test(conc, 250, 20);
        if (!ok) break;
        await sleep(2000);
    }
}
main().catch(e => console.error(e));