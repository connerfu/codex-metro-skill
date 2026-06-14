const https = require("https");
const AMAP_KEY = "c037d67ccb46f69c5f1b7a9b84c61e0e";

var ok = 0, fail = 0;
var t0 = Date.now();

function call(i) {
    return new Promise(r => {
        var ts = Date.now();
        https.get("https://restapi.amap.com/v3/place/text?key=" + AMAP_KEY + "&keywords=" + encodeURIComponent("\u5317\u4EAC") + "&types=150500&city=" + encodeURIComponent("\u5317\u4EAC") + "&offset=1", {headers:{"User-Agent":"CM/5"}}, res => {
            var d = ""; res.on("data", c => d += c);
            res.on("end", () => {
                try {
                    var j = JSON.parse(d);
                    if (j.status === "1") ok++; else fail++;
                } catch(e) { fail++; }
                r();
            });
        }).on("error", () => { fail++; r(); });
    });
}

async function test(n, batchSize) {
    ok = 0; fail = 0; t0 = Date.now();
    console.log("Testing " + n + " calls in batches of " + batchSize + "...");
    for (var bi = 0; bi < Math.ceil(n/batchSize); bi++) {
        var promises = [];
        for (var i = 0; i < batchSize && bi*batchSize + i < n; i++) {
            promises.push(call(bi*batchSize + i));
        }
        await Promise.all(promises);
        process.stderr.write("\r  " + Math.min((bi+1)*batchSize, n) + "/" + n);
    }
    var elapsed = (Date.now() - t0) / 1000;
    console.log("\n  Result: " + ok + " OK, " + fail + " FAIL, " + elapsed.toFixed(1) + "s (" + (n/elapsed).toFixed(0) + " QPS)");
    return fail === 0;
}

async function main() {
    // Test increasing concurrency
    for (var batch of [5, 8, 10, 15, 20]) {
        var ok = await test(20, batch);
        if (!ok) console.log("  !! QPS LIMIT HIT at batch=" + batch + " !!");
        await new Promise(r => setTimeout(r, 1000));
    }
}
main().catch(e => console.error(e));