const https = require("https"), fs = require("fs"), { execSync } = require("child_process");

// === metro_scraper.js v2.1 �?Auto-detect branches, cache, one-shot ===
const [,, SLUG, CITY_NAME, ...flags] = process.argv;
const NOCACHE = flags.includes("--nocache");
const AMAP_KEY = process.env.AMAP_KEY || "";
if (!AMAP_KEY) { console.error("Set AMAP_KEY env var"); process.exit(1); }
const CACHE_DIR = __dirname + "/cache";
const REF_DIR = __dirname + "/references";
const COORDS_DIR = process.env.USERPROFILE + "/Documents/New project";

if (!SLUG || !CITY_NAME) { console.log("Usage: metro_scraper.js {slug} \"{中文名}\""); process.exit(1); }
[ CACHE_DIR, REF_DIR ].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ---- Cache ----
const LINE_CACHE = CACHE_DIR + "/" + SLUG + "_lines.json";
const COORD_CACHE = CACHE_DIR + "/" + SLUG + "_coords.json";
const TTL = 86400000;
function loadJson(f, ttl) { try { const d = JSON.parse(fs.readFileSync(f,"utf8")); if (!ttl || Date.now()-d._ts < ttl) return d; } catch(e) {} return null; }
function saveJson(f, d) { d._ts = Date.now(); fs.writeFileSync(f, JSON.stringify(d),"utf8"); }

// ---- HTTP ----
function fetch(url) {
    return new Promise(r => { let done = false; const t = setTimeout(()=>{if(!done){done=true;r("")}},15000);
        https.get(url,{headers:{"User-Agent":"Mozilla/5.0"}},res=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>{if(done)return;done=true;clearTimeout(t);r(d)});}).on("error",()=>{if(!done){done=true;clearTimeout(t);r("")}}); });
}
function geocode(name, lineNum) {
    return new Promise(r => {
        const q = encodeURIComponent(name + "����վ" + (lineNum ? lineNum + "����" : ""));
        const p = "/v3/geocode/geo?key=" + AMAP_KEY + "&address=" + q + "&city=" + encodeURIComponent(CITY_NAME);
        let d2 = false; const t2 = setTimeout(()=>{if(!d2){d2=true;r(null)}},10000);
        https.get({hostname:"restapi.amap.com",path:p,headers:{"User-Agent":"CodexMetro/2.1"},agent:false},res2=>{
            let dd="";res2.on("data",c=>dd+=c);res2.on("end",()=>{if(d2)return;d2=true;clearTimeout(t2);
                try{const j=JSON.parse(dd);if(j.status==="1"&&j.geocodes&&j.geocodes.length>0){const loc=j.geocodes[0].location.split(",");r({lat:parseFloat(loc[1]),lng:parseFloat(loc[0])})}else r(null)}catch(e){r(null)}});
        }).on("error",()=>{if(!d2){d2=true;clearTimeout(t2);r(null)}});
    });
}
function haversine(lat1,lng1,lat2,lng2){var R=6371,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180;var a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}

// ---- Config ----
const BBOX = {
    beijing:[39.4,41.0,115.5,117.5],shanghai:[30.5,31.8,120.8,122.2],guangzhou:[22.3,23.8,112.8,114.2],
    shenzhen:[22.3,22.9,113.7,114.6],chengdu:[30.1,31.0,103.5,104.8],chongqing:[28.0,31.5,105.0,109.5],
    hangzhou:[29.8,30.7,119.5,121.5],nanjing:[31.0,32.6,118.2,119.3],tianjin:[38.5,40.2,116.5,118.5],
    wuhan:[29.8,31.0,113.7,115.5],shenyang:[41.5,42.5,122.8,124.5],changchun:[43.5,44.2,125.0,125.6],
    xian:[34.0,34.6,108.5,109.3],zhengzhou:[34.3,35.1,113.0,114.3],qingdao:[35.8,36.6,119.8,121.2],
    suzhou:[30.9,31.7,120.3,121.3],wuxi:[31.1,31.9,119.9,120.8],xiamen:[24.2,24.8,117.8,118.5],
    dalian:[38.6,39.3,121.1,122.2],harbin:[45.3,46.2,126.1,127.2],dongguan:[22.6,23.3,113.4,114.3],
    nanning:[22.3,23.1,107.8,109.0],foshan:[22.6,23.4,112.6,113.4],shaoxing:[29.7,30.5,120.1,121.1],
    zhuhai:[22.0,22.5,113.1,113.6],xianyang:[34.1,34.6,108.3,109.1],urumqi:[43.4,44.2,87.1,88.2],
    zhongshan:[22.3,22.8,113.1,113.7],kunming:[24.8,25.5,102.5,103.0],changsha:[27.9,28.5,112.8,113.3],ningbo:[29.7,30.1,121.3,121.8],nanchang:[28.4,28.9,115.7,116.1],fuzhou:[25.8,26.3,119.1,119.5],hefei:[31.6,32.0,117.1,117.5],guiyang:[26.3,26.7,106.5,106.8],shijiazhuang:[37.8,38.2,114.3,114.7],wenzhou:[27.8,28.1,120.5,120.8],jinan:[36.5,36.8,116.8,117.2],lanzhou:[36.0,36.2,103.6,103.9],changzhou:[31.6,31.9,119.9,120.1],xuzhou:[34.1,34.4,117.0,117.3],taiyuan:[37.7,38.0,112.4,112.7],luoyang:[34.5,34.8,112.3,112.6],
};
const PREFIX = { beijing:"BJ",shanghai:"SH",guangzhou:"GZ",shenzhen:"SZ",chengdu:"CD",chongqing:"CQ",hangzhou:"HZ",nanjing:"NJ",tianjin:"TJ",wuhan:"WH",shenyang:"SY",changchun:"CC",xian:"XA",zhengzhou:"ZZ",qingdao:"QD",suzhou:"SZ2",wuxi:"WX",xiamen:"XM",dalian:"DL",harbin:"HEB",dongguan:"DG",nanning:"NN",foshan:"FS",shaoxing:"SX",zhuhai:"ZH",xianyang:"XY",urumqi:"WLMQ",zhongshan:"ZS",kunming:"KM",changsha:"CS",ningbo:"NB",nanchang:"NC",fuzhou:"FZ",hefei:"HF",guiyang:"GY",shijiazhuang:"SJZ",wenzhou:"WZ",jinan:"JN",lanzhou:"LZ",changzhou:"CZ",xuzhou:"XZ",taiyuan:"TY",luoyang:"LY" };
const SPECIAL_IDS = { "guangfo-line":"GZ_GUANGFO_LINE","apm-line":"GZ_APM_LINE","tram-haizhu":"GZ_TRAM_HAIZHU","pujiang-line":"SHPJ","airport-link-line":"SH_AIRPORT_LINK","jinshan-railway":"SH_JINSHAN","maglev-line":"SH_MAGLEV","pingshan-skyshuttle-line-1":"SZ_PINGSHAN","foshan-line-2":"GZ_FOSHAN_LINE_2","foshan-line-3":"GZ_FOSHAN_LINE_3","nanhai-tram-line-1":"GZ_NANHAI_TRAM","tram-huangpu-line-1":"GZ_TRAM_HP1","tram-huangpu-line-2":"GZ_TRAM_HP2","yizhuang-line":"BJYZ","changping-line":"BJCP","fangshan-line":"BJFS","yanfang-line":"BJYF","xijiao-line":"BJXJ","capital-airport-express":"BJCA","daxing-airport-express":"BJJX","yizhuang-t1-line":"BJYZT1" };
const LINE_NAMES = {
    "GZ_GUANGFO_LINE":"�����",
    "GZ_APM_LINE":"����APM��",
    "GZ_TRAM_HAIZHU":"�����й�糵",
    "SHPJ":"�ֽ���",
    "SH_AIRPORT_LINK":"����������",
    "SH_JINSHAN":"��ɽ��·",
    "SH_MAGLEV":"������",
    "SZ_PINGSHAN":"ƺɽ�ư�1����",
    "GZ_FOSHAN_LINE_2":"��ɽ����2����",
    "GZ_FOSHAN_LINE_3":"��ɽ����3����",
    "GZ_NANHAI_TRAM":"�Ϻ��й�糵1����",
    "GZ_TRAM_HP1":"�����й�糵1����",
    "GZ_TRAM_HP2":"�����й�糵2����",
    "BJYZ":"��ׯ��",
    "BJCP":"��ƽ��",
    "BJFS":"��ɽ��",
    "BJYF":"�෿��",
    "BJXJ":"������",
    "BJS1":"��������S1��",
    "BJCA":"�׶�������",
    "BJJX":"���˻�����",
    "BJYZT1":"��ׯT1��",
    "TJ_JINJING_LINE":"����",
    "TJ_LINE_Z4":"������Z4��",
    "TJ6P2":"������6���߶���",
    "CQ_KONGGANG_LINE":"�ո���",
    "CQ_INTERNATIONAL_EXPO_LINE":"������",
    "CQ_LOOP_LINE":"���컷��",
    "CQ_JIANGTIAO_LINE":"������",
    "CQ_BITONG_LINE":"�ͭ��",
    "CQ_CHONGQING_SKYSHUTTLE":"�����ư�",
    "CD_LINE_S3":"������(S3)",
    "CD_TRAMWAY_RONG_2_LINE":"��2����",
    "CD_TRAMWAY_RONG_2_LINE_BRANCH":"��2����(֧��)",
    "HZ_HANGZHOU_HAINING_INTERCITY_RAIL":"�����Ǽ�",
    "HZ_SHAOXING_LINE_1":"���˵���1����",
    "HZ_SHAOXING_LINE_2":"���˵���2����",
    "HZ_SHAOXING_LINE_1_BRANCH":"���˵���1����(֧��)",
    "NJ_LINE_S1":"�Ͼ�����S1����(������)",
    "NJ_LINE_S2":"�Ͼ�����S2����(������)",
    "NJ_LINE_S3":"�Ͼ�����S3����(������)",
    "NJ_LINE_S6":"�Ͼ�����S6����(������)",
    "NJ_LINE_S7":"�Ͼ�����S7����(������)",
    "NJ_LINE_S8":"�Ͼ�����S8����(������)",
    "NJ_LINE_S9":"�Ͼ�����S9����(������)",
    "NJ_NANJING_CHUZHOU_LINE":"������",
};
const RINGS = { beijing:[2], guangzhou:[11], shanghai:[4], wuhan:[], chengdu:[7], chongqing:[0], xian:[8] };

function getLid(slug, prefix) {
    if (SPECIAL_IDS[slug]) return SPECIAL_IDS[slug];
    const phaseMatch = slug.match(/^(?:line-)?(\d+)-phase-(i+)$/i);
    if (phaseMatch) {
        const romans = {"i":1,"ii":2,"iii":3,"iv":4,"v":5};
        const pn = romans[phaseMatch[2].toLowerCase()] || 2;
        return prefix + phaseMatch[1] + "P" + pn + (slug.endsWith("-branch")?"Z":"");
    }
    const nm = slug.match(/^(?:line-)?(\d+)/);
    if (nm) return prefix + nm[1] + (slug.endsWith("-branch")?"Z":"");
    return prefix + "_" + slug.replace(/-/g,"_").toUpperCase();
}
function getSpeed(num, lid) {
    if (lid==="SH_MAGLEV") return 430;
    if (["SH_AIRPORT_LINK","SH_JINSHAN","BJJX","BJCA"].includes(lid)) return 160;
    const fast = {16:120,17:100,18:160,19:120,20:120,21:120,14:120,11:100,7:100,13:100,22:100,6:100};
    const tram = ["SZ_PINGSHAN","GZ_TRAM_HAIZHU","GZ_TRAM_HP1","GZ_TRAM_HP2","GZ_NANHAI_TRAM","BJXJ","BJYZT1"];
    if (tram.includes(lid)) return 40;
    return fast[num] || 80;
}
function getCars(num, lid) {
    if (lid==="SH_MAGLEV") return 5;
    const tram = ["SZ_PINGSHAN","GZ_TRAM_HAIZHU","GZ_TRAM_HP1","GZ_TRAM_HP2","GZ_NANHAI_TRAM","BJXJ","BJYZT1"];
    if (tram.includes(lid)) return 2;
    if ([1,16,19,21].includes(num)) return 4;
    if ([17,19,22].includes(num)) return 8;
    return 6;
}
function isRing(num, lidOrSlug) { const rings = RINGS[SLUG]||[]; if (rings.includes(num)) { if (SLUG==="chongqing") return lidOrSlug==="CQ_LOOP_LINE" || lidOrSlug==="loop-line"; return true; } return false; }

// ---- Auto-detect branches ----
function detectBranches(allLines, slugCoords) {
    const branches = [];
    for (const [slug, line] of Object.entries(allLines)) { if (slug === "_ts") continue;
        if (line.stations.length < 5 || slug.endsWith("-branch")) continue;
        if (isRing(line.num, slug)) continue; // skip ring lines
        const stns = line.stations;
        const coords = stns.map(s => slugCoords[s.slug] || null);
        let best = null, bestRatio = 0;
        
        for (let i = 0; i < stns.length - 3; i++) {
            const a = coords[i]; if (!a) continue;
            for (let j = i + 2; j < stns.length - 1 && j - i >= 2 && j - i <= 15; j++) {
                const d = coords[j+1]; if (!d) continue;
                const direct = haversine(a.lat, a.lng, d.lat, d.lng);
                if (direct > 6) continue; // junction stations should be close
                let detour = 0, ok = true;
                for (let k = i; k <= j; k++) {
                    const c1 = coords[k], c2 = coords[k+1];
                    if (!c1 || !c2) { ok = false; break; }
                    detour += haversine(c1.lat, c1.lng, c2.lat, c2.lng);
                }
                if (!ok) continue;
                const ratio = detour / Math.max(direct, 0.5);
                if (ratio > 3 && ratio > bestRatio && (j - i) >= 2) {
                    bestRatio = ratio;
                    best = { slug, i, j, ratio, stations: stns.slice(i, j+1).map(s=>s.name) };
                }
            }
        }
        if (best && best.stations.length >= 3) {
            branches.push(best);
            console.log("  [BRANCH] " + best.slug + ": " + best.stations[0] + " -> [" + best.stations.slice(1).join(",") + "] (ratio=" + best.ratio.toFixed(1) + ")");
        }
    }
    return branches;
}

// ---- Main ----
async function main() {
    console.log("=== " + CITY_NAME + " (" + SLUG + ") ===");
    const prefix = PREFIX[SLUG] || SLUG.substring(0,2).toUpperCase();
    
    // Step 1: Load or scrape lines
    let allLines = NOCACHE ? null : loadJson(LINE_CACHE, TTL);
    if (allLines) { console.log("  [CACHE HIT] " + Object.keys(allLines).length + " lines"); }
    else {
        const html = await fetch("https://www.metroman.cn/cities/" + SLUG + "/lines");
        const hrefs = [...html.matchAll(new RegExp('href="/cities/' + SLUG + '/lines/([^"]+)"','g'))];
        const colors = [...html.matchAll(/--line-color:\s*([#0-9A-Fa-f]+)/g)];
        allLines = {};
        for (let i = 0; i < hrefs.length; i++) {
            const slug = hrefs[i][1], color = colors[i] ? colors[i][1] : "#888";
            const nm = slug.match(/^(?:line-)?(\d+)/);
            allLines[slug] = { slug, num: nm ? parseInt(nm[1]) : 0, color, stations: [] };
        }
        console.log("  Lines: " + Object.keys(allLines).length);
        for (const [slug, line] of Object.entries(allLines)) { if (slug === "_ts") continue;
            const lh = await fetch("https://www.metroman.cn/cities/" + SLUG + "/lines/" + slug);
            const re = new RegExp('href="(/cities/' + SLUG + '/stations/([^"]+))"[^>]*>([^<]+)<\\/a>','g');
            const links = [...lh.matchAll(re)];
            const seen = new Set();
            for (const m of links) {
                const name = m[3].trim().replace(/&#183;/g,"·").replace(/&amp;/g,"&").replace(/\(\d+号线\)/g,"");
                if (name === CITY_NAME || name.length < 2 || seen.has(name)) continue;
                seen.add(name); line.stations.push({ name, slug: m[1] });
            }
            console.log("    " + slug + ": " + line.stations.length + " stns, " + line.stations[0]?.name + " -> " + line.stations[line.stations.length-1]?.name);
            await new Promise(r => setTimeout(r, 100));
        }
        saveJson(LINE_CACHE, allLines);
        console.log("  [CACHED lines]");
    }
    
    // Step 2: Load or scrape coords
    let slugCoords = NOCACHE ? {} : (loadJson(COORD_CACHE, TTL) || {});
    const allStns = []; for (const [k,l] of Object.entries(allLines)) { if (k === "_ts") continue; l.stations.forEach(s => allStns.push({...s,lineKey:k})); }
    const uniqueSlugs = [...new Set(allStns.map(s=>s.slug))];
    const missing = uniqueSlugs.filter(s => !slugCoords[s]);
    if (missing.length > 0) {
        console.log("\n  Coords: fetching " + missing.length + " (cached: " + (uniqueSlugs.length-missing.length) + ")");
        let done = Object.keys(slugCoords).length;
        // Parallel fetch with concurrency pool
        const POOL = 8, queue = [...missing];
        async function worker() {
            while (queue.length > 0) {
                const s = queue.shift(); if (!s) break;
                const h = await fetch("https://www.metroman.cn" + s);
                const m = h.match(/position=([\d.]+),([\d.]+)/);
                if (m) { slugCoords[s] = { lng: parseFloat(m[1]), lat: parseFloat(m[2]) }; done++; }
                if (done % 50 === 0 && done <= uniqueSlugs.length) console.log("    " + done + "/" + uniqueSlugs.length);
            }
        }
        await Promise.all(Array.from({length: Math.min(POOL, missing.length)}, () => worker()));
        saveJson(COORD_CACHE, slugCoords);
        console.log("    Done: " + done + "/" + uniqueSlugs.length + " [CACHED coords]");
    } else { console.log("\n  Coords: " + uniqueSlugs.length + " [ALL CACHED]"); }
    
    // Step 3: Auto-detect branches
    console.log("\n  Detecting branches...");
    const branches = detectBranches(allLines, slugCoords);
    for (const b of branches) {
        const line = allLines[b.slug];
        const brSlug = b.slug + "-branch";
        // Remove branch stations from main (keep junction)
        const removed = line.stations.splice(b.i + 1, b.j - b.i);
        allLines[brSlug] = { slug: brSlug, num: line.num, color: line.color, stations: [line.stations[b.i], ...removed], isBranch: true };
        console.log("    -> " + brSlug + ": " + allLines[brSlug].stations.length + " stns");
    }
    
    // Step 4: Build reference + coords
    const ref = {}, coordsOut = {};
    for (const [slug, line] of Object.entries(allLines)) { if (slug === "_ts") continue;
        const lid = getLid(slug, prefix);
        ref[lid] = {
            line: line.num||0, name: LINE_NAMES[lid]||(function(){const ps=lid.match(/P(\d+)/);const pm={"1":"һ��","2":"����","3":"����","4":"����"};return CITY_NAME+"����"+(line.num||"")+"����"+(ps?pm[ps[1]]||"":"")+(line.isBranch?"(֧��)":"");})(),
            color: line.color, speed: getSpeed(line.num, lid), cars: getCars(line.num, lid),
            ring: isRing(line.num, lid), so: 360, sc: 1380, stations: line.stations.map(s=>s.name)
        };
        line.stations.forEach(s => { const c = slugCoords[s.slug]; if(c) coordsOut[s.name+"|"+lid] = { lat:c.lat, lng:c.lng, source:"metroman" }; });
    }
    // Fix zero coords
    const needsFix = Object.entries(coordsOut).filter(([k,v])=>v.lat===0&&v.lng===0);
    if (needsFix.length > 0) {
        console.log("\n  AMap fix: " + needsFix.length + " stations...");
        for (const [k] of needsFix) {
            const name = k.split("|")[0], lid = k.split("|")[1];
            await new Promise(r=>setTimeout(r,300));
            const r = await geocode(name, ref[lid]?.line||"");
            if (r) coordsOut[k] = { lat:r.lat, lng:r.lng, source:"amap_fix" };
        }
    }
    fs.writeFileSync(REF_DIR+"/"+SLUG+"_lines.json", JSON.stringify(ref,null,2),"utf8");
    fs.writeFileSync(COORDS_DIR+"/"+SLUG+"_coords.json", JSON.stringify(coordsOut),"utf8");
    let total=0; for(const v of Object.values(ref)) total+=v.stations.length;
    console.log("\n  Saved: " + Object.keys(ref).length + " lines, " + total + " stations");
    for(const[k,v]of Object.entries(ref)) console.log("    "+k+": "+v.name+" "+v.stations.length+" stns");
    
    // Step 5: Auto-run builder
    const bbox = BBOX[SLUG] || [30,32,113,115];
    const nodeExe = process.env.USERPROFILE + "\\codex-node\\node.exe";
    const builderPath = __dirname + "\\metro_builder.js";
    console.log("\n=== Building " + CITY_NAME + " metro ===");
    try {
        const result = execSync('"' + nodeExe + '" "' + builderPath + '" ' + SLUG + ' "' + CITY_NAME + '" ' + bbox.join(" "), {
            cwd: __dirname, timeout: 120000, encoding: "utf8", maxBuffer: 2*1024*1024
        });
        console.log(result);
        console.log("DONE! File: C:/Users/Conner/Downloads/" + SLUG + "_metro.json");
    } catch(e) {
        console.error("Builder error:", e.stderr ? e.stderr.substring(0,500) : e.message);
        console.log("Run: & $node metro_builder.js " + SLUG + ' "' + CITY_NAME + '" ' + bbox.join(" "));
    }

    // Step 6: AMap polyline anchors (post-builder)
    try {
        const anchorsPath = __dirname + "\\amap_anchors.js";
        if (fs.existsSync(anchorsPath)) {
            console.log("\n=== Adding AMap polyline anchors ===");
            const result2 = execSync("\"" + nodeExe + "\" \"" + anchorsPath + "\" " + SLUG + " \"" + CITY_NAME + "\"", {
                cwd: __dirname, timeout: 180000, encoding: "utf8", maxBuffer: 2*1024*1024
            });
            console.log(result2);
        }
    } catch(e) {
        console.log("Anchors skipped:", e.message ? e.message.substring(0,100) : "");
    }
}
main().catch(e => console.error(e));










