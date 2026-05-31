// metroman_scraper.js v1.0 — Full metro data from metroman.cn
// Usage: node metroman_scraper.js {slug} "{中文名}"
const https = require("https"), fs = require("fs");
const [,, SLUG, CITY_NAME] = process.argv;

function fetch(url) {
    return new Promise((resolve) => {
        let done = false;
        const timer = setTimeout(() => { if(!done){done=true;resolve("")} }, 15000);
        https.get(url, {headers:{"User-Agent":"Mozilla/5.0"}}, (res) => {
            let d = "";
            res.on("data", c => d += c);
            res.on("end", () => { if(done)return; done=true; clearTimeout(timer); resolve(d); });
        }).on("error", () => { if(!done){done=true;clearTimeout(timer);resolve("")} });
    });
}

async function main() {
    console.log("=== " + CITY_NAME + " (" + SLUG + ") ===");
    
    // Step 1: Get lines + colors
    const linesHtml = await fetch("https://www.metroman.cn/cities/" + SLUG + "/lines");
    const lineCards = [...linesHtml.matchAll(/href="\/cities\/[^"]+\/lines\/line-(\d+)"[^>]*>[\s\S]*?--line-color:\s*([#0-9A-Fa-f]+)/g)];
    const lines = {};
    for (const m of lineCards) {
        const num = parseInt(m[1]);
        lines[num] = { num, color: m[2], stations: [] };
    }
    console.log("Lines: " + Object.keys(lines).join(","));
    
    // Step 2: Get station names per line (with slugs for coord lookup)
    for (const [num, line] of Object.entries(lines)) {
        const lineHtml = await fetch("https://www.metroman.cn/cities/" + SLUG + "/lines/line-" + num);
        const stationLinks = [...lineHtml.matchAll(/href="(\/cities\/[^/]+\/stations\/([^"]+))"[^>]*>([^<]+)<\/a>/g)];
        const seen = new Set();
        for (const m of stationLinks) {
            const name = m[3].trim();
            if (name === CITY_NAME || name.length < 2 || seen.has(name)) continue;
            seen.add(name);
            line.stations.push({ name, slug: m[1] });
        }
        console.log("Line " + num + ": " + line.stations.length + " stns, " + line.stations[0].name + " -> " + line.stations[line.stations.length-1].name);
        await new Promise(r => setTimeout(r, 200));
    }
    
    // Step 3: Get coordinates for unique stations
    const allStations = [];
    for (const [num, line] of Object.entries(lines)) {
        line.stations.forEach(s => allStations.push({ ...s, lineNum: parseInt(num) }));
    }
    const uniqueSlugs = [...new Set(allStations.map(s => s.slug))];
    console.log("\nFetching coords for " + uniqueSlugs.length + " stations...");
    const coords = {};
    let done = 0;
    for (const slug of uniqueSlugs) {
        const sHtml = await fetch("https://www.metroman.cn" + slug);
        const posMatch = sHtml.match(/position=([\d.]+),([\d.]+)/);
        if (posMatch) { coords[slug] = { lng: parseFloat(posMatch[1]), lat: parseFloat(posMatch[2]) }; done++; }
        if (done % 50 === 0) console.log("  " + done + "/" + uniqueSlugs.length);
        await new Promise(r => setTimeout(r, 120));
    }
    console.log("  Done: " + done + "/" + uniqueSlugs.length + " (" + (done/uniqueSlugs.length*100).toFixed(0) + "%)");
    
    // Step 4: Build reference + coords files
    const ref = {}, coordsOut = {};
    for (const [num, line] of Object.entries(lines)) {
        const lid = SLUG.toUpperCase() + num;
        ref[lid] = {
            line: parseInt(num), name: CITY_NAME + "地铁" + num + "号线",
            color: line.color,
            speed: [16,19].includes(parseInt(num)) ? 120 : ([7,11,21].includes(parseInt(num)) ? 100 : 80),
            cars: [1,16,19,21].includes(parseInt(num)) ? 4 : 6,
            ring: false, so: 360, sc: 1380,
            stations: line.stations.map(s => s.name)
        };
        line.stations.forEach(s => {
            const c = coords[s.slug];
            if (c) coordsOut[s.name + "|" + lid] = { lat: c.lat, lng: c.lng, source: "metroman" };
        });
    }
    
    const refDir = __dirname + "/references";
    if (!fs.existsSync(refDir)) fs.mkdirSync(refDir, { recursive: true });
    fs.writeFileSync(refDir + "/" + SLUG + "_lines.json", JSON.stringify(ref, null, 2), "utf8");
    fs.writeFileSync(SLUG + "_coords.json", JSON.stringify(coordsOut), "utf8");
    
    let totalStns = 0;
    for (const v of Object.values(ref)) totalStns += v.stations.length;
    console.log("\nSaved: " + Object.keys(ref).length + " lines, " + totalStns + " stations");
}
main().catch(e => console.error(e));