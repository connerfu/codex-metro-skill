const https = require('https');
const fs = require('fs');

// fix_transfers.js v9.2 — Concurrent 3+ line exit search
const AMAP_KEY = 'c037d67ccb46f69c5f1b7a9b84c61e0e';
const POI_INTERVAL = 50;
const CONCURRENCY = 3;

function dist(a, b) {
    var dlat = (a.lat - b.lat) * 111000;
    var dlng = (a.lng - b.lng) * 111000 * Math.cos(a.lat * Math.PI / 180);
    return Math.sqrt(dlat * dlat + dlng * dlng);
}

var lastReq = 0;
function rateLimit() {
    var now = Date.now(), wait = Math.max(0, POI_INTERVAL - (now - lastReq));
    lastReq = now + wait;
    return new Promise(function(r) { setTimeout(r, wait); });
}

function amapSearch(url) {
    return rateLimit().then(function() {
        return new Promise(function(r) {
            var timer = setTimeout(function() { r([]); }, 10000);
            https.get('https://restapi.amap.com' + url, {headers:{'User-Agent':'CM/5'}}, function(res) {
                var d = ''; res.on('data', function(c) { d += c; });
                res.on('end', function() { clearTimeout(timer);
                    try {
                        var j = JSON.parse(d);
                        if (j.status === '1' && j.pois) r(j.pois);
                        else r([]);
                    } catch(e) { r([]); }
                });
            }).on('error', function() { clearTimeout(timer); r([]); });
        });
    });
}

async function searchExits(stationName, cityName) {
    var cleanName = stationName.replace(/\u7AD9$/, '');
    var cityEnc = encodeURIComponent(cityName);
    
    var variants = [
        encodeURIComponent(cleanName + '\u5730\u94C1\u7AD9\u51FA\u5165\u53E3'),
        encodeURIComponent(cleanName + '\u5730\u94C1\u7AD9'),
        encodeURIComponent(cleanName + '\u7AD9'),
    ];
    
    for (var vi = 0; vi < variants.length; vi++) {
        var path = '/v3/place/text?key=' + AMAP_KEY + '&keywords=' + variants[vi] +
            '&city=' + cityEnc + '&offset=25&page=1&extensions=all';
        var pois = await amapSearch(path);
        var exits = [];
        for (var pi = 0; pi < pois.length; pi++) {
            if (pois[pi].typecode === '150501' && pois[pi].location && pois[pi].address) {
                var loc = pois[pi].location.split(',');
                exits.push({
                    lat: parseFloat(loc[1]),
                    lng: parseFloat(loc[0]),
                    address: pois[pi].address,
                    name: pois[pi].name
                });
            }
        }
        if (exits.length >= 2) return exits;
    }
    return [];
}

function getLineNumFromName(lineName) {
    var m = lineName ? lineName.match(/(\d+)/) : null;
    return m ? m[1] : '';
}

function parseAddressLines(address) {
    if (!address) return [];
    var lines = [];
    var parts = address.split(';');
    for (var i = 0; i < parts.length; i++) {
        var m = parts[i].match(/(\d+)/);
        if (m) lines.push(m[1]);
    }
    if (address.indexOf('\u5927\u5174') >= 0 && lines.indexOf('daxing') === -1) lines.push('daxing');
    if (address.indexOf('\u4EA6\u5E84') >= 0) lines.push('yizhuang');
    if (address.indexOf('\u660C\u5E73') >= 0) lines.push('changping');
    if (address.indexOf('\u623F\u5C71') >= 0) lines.push('fangshan');
    if (address.indexOf('\u71D5\u623F') >= 0) lines.push('yanfang');
    if (address.indexOf('\u9996\u90FD\u673A\u573A') >= 0) lines.push('airport');
    if (address.indexOf('\u5927\u5174\u673A\u573A') >= 0) lines.push('daxingairport');
    if (address.indexOf('S1') >= 0) lines.push('S1');
    return lines;
}

function entryMatchesLine(entry, addrLines) {
    var ln = entry.lineNum;
    if (ln && addrLines.indexOf(ln) >= 0) return true;
    if (entry.lineSuffix && addrLines.indexOf(entry.lineSuffix) >= 0) return true;
    return false;
}

function getLineSuffix(lineName) {
    if (!lineName) return null;
    if (lineName.indexOf('\u4EA6\u5E84') >= 0) return 'yizhuang';
    if (lineName.indexOf('\u660C\u5E73') >= 0) return 'changping';
    if (lineName.indexOf('\u623F\u5C71') >= 0) return 'fangshan';
    if (lineName.indexOf('\u71D5\u623F') >= 0) return 'yanfang';
    if (lineName.indexOf('\u9996\u90FD\u673A\u573A') >= 0) return 'airport';
    if (lineName.indexOf('\u5927\u5174\u673A\u573A') >= 0) return 'daxingairport';
    if (lineName.indexOf('S1') >= 0) return 'S1';
    return null;
}

// Spatial k-means fallback when address-based grouping fails
function spatialCluster(entries, exits, numClusters) {
    if (exits.length < numClusters) return [];
    var clusters = [];
    for (var ci = 0; ci < numClusters; ci++) clusters.push([]);
    var centers = entries.map(function(e) { return { lat: e.stationLat, lng: e.stationLng }; });
    
    for (var iteration = 0; iteration < 10; iteration++) {
        for (var ci = 0; ci < numClusters; ci++) clusters[ci] = [];
        for (var exi = 0; exi < exits.length; exi++) {
            var bestCi = 0, bestD = Infinity;
            for (var ci = 0; ci < numClusters; ci++) {
                var d = dist(exits[exi], centers[ci]);
                if (d < bestD) { bestD = d; bestCi = ci; }
            }
            clusters[bestCi].push(exits[exi]);
        }
        var changed = false;
        for (var ci = 0; ci < numClusters; ci++) {
            if (clusters[ci].length === 0) continue;
            var sl = 0, sg = 0;
            for (var ei = 0; ei < clusters[ci].length; ei++) { sl += clusters[ci][ei].lat; sg += clusters[ci][ei].lng; }
            var nc = { lat: sl/clusters[ci].length, lng: sg/clusters[ci].length };
            if (dist(nc, centers[ci]) > 5) changed = true;
            centers[ci] = nc;
        }
        if (!changed) break;
    }
    
    // Map clusters to entries by proximity to original positions
    var result = [];
    var used = new Set();
    for (var ei = 0; ei < entries.length; ei++) {
        var bestCi = -1, bestD = Infinity;
        for (var ci = 0; ci < numClusters; ci++) {
            if (used.has(ci) || clusters[ci].length === 0) continue;
            var d = dist({lat:entries[ei].stationLat, lng:entries[ei].stationLng}, centers[ci]);
            if (d < bestD) { bestD = d; bestCi = ci; }
        }
        if (bestCi >= 0) { used.add(bestCi); result.push({ei:ei, centroid:centers[bestCi], count:clusters[bestCi].length}); }
    }
    return result;
}
async function processTransfer(t, lines, cityName, ti, total) {
    var entries = t.entries;
    
    for (var ei = 0; ei < entries.length; ei++) {
        var s = lines[entries[ei].li].stations[entries[ei].si];
        s.isTransfer = true;
        s.transferType = 'same_station';
        s.transferGroupId = t.name;
    }
    
    if (t.uniqueCount === 2) {
        var ref = lines[entries[0].li].stations[entries[0].si];
        for (var ei = 1; ei < entries.length; ei++) {
            var s = lines[entries[ei].li].stations[entries[ei].si];
            s.lat = ref.lat;
            s.lng = ref.lng;
        }
        return { type: '2line', name: t.name };
    }
    
    // 3+ line: search exits
    var exits = await searchExits(t.name, cityName); var refPos = entries[0].refPos; if (refPos) { exits = exits.filter(function(ex) { return dist(ex, refPos) < 2000; }); }
    
    if (ti < 20) {
        console.log('[' + t.name + '] ' + exits.length + ' exits, ' + t.uniqueCount + ' lines');
    }
    
    if (exits.length < 2) {
        return { type: 'fail', name: t.name, reason: 'no exits' };
    }
    
    for (var exi = 0; exi < exits.length; exi++) {
        exits[exi].addrLines = parseAddressLines(exits[exi].address);
    }
    
    var allMoved = true;
    for (var ei = 0; ei < entries.length; ei++) {
        var e = entries[ei];
        var matchingExits = [];
        for (var exi = 0; exi < exits.length; exi++) {
            if (entryMatchesLine(e, exits[exi].addrLines)) {
                matchingExits.push(exits[exi]);
            }
        }
        
        if (matchingExits.length >= 1) {
            var sumLat = 0, sumLng = 0;
            for (var mi = 0; mi < matchingExits.length; mi++) {
                sumLat += matchingExits[mi].lat;
                sumLng += matchingExits[mi].lng;
            }
            var s = lines[e.li].stations[e.si];
            s.lat = sumLat / matchingExits.length;
            s.lng = sumLng / matchingExits.length;
        } else {
            allMoved = false;
        }
    }
    
    // Spatial clustering fallback for unseparated entries
    if (!allMoved && exits.length >= entries.length) {
        var entryObjs = entries.map(function(e) {
            var s = lines[e.li].stations[e.si];
            return { ei: e, stationLat: s.lat, stationLng: s.lng };
        });
        var spatialResult = spatialCluster(entryObjs, exits, entries.length);
        if (spatialResult.length >= 2) {
            for (var ri = 0; ri < spatialResult.length; ri++) {
                var e = entries[spatialResult[ri].ei];
                var s = lines[e.li].stations[e.si];
                s.lat = spatialResult[ri].centroid.lat;
                s.lng = spatialResult[ri].centroid.lng;
            }
            allMoved = true;
            if (ti < 20) console.log('  -> spatial fallback: ' + spatialResult.length + ' clusters');
        }
    }
    
    return { type: allMoved ? 'moved' : 'partial', name: t.name };
}

async function main() {
    var t0 = Date.now();
    var slug = process.argv[2] || 'beijing';
    var cityName = process.argv[3] || '\u5317\u4EAC';
    var file = 'C:/Users/Conner/Downloads/' + slug + '_metro.json';
    
    console.log('\n=== Transfer Separation v9.2 (concurrent): ' + cityName + ' ===');
    var data = JSON.parse(fs.readFileSync(file, 'utf8'));
    var lines = data.data.lines;
    
    var bakFile = file.replace('.json', '_pre_transfer.json');
    fs.writeFileSync(bakFile, JSON.stringify(data, null, 2), 'utf8');
    
    var transferMap = {};
    for (var li = 0; li < lines.length; li++) {
        var l = lines[li], st = l.stations;
        if (!st) continue;
        for (var si = 0; si < st.length; si++) {
            var s = st[si], key = s.name;
            if (!transferMap[key]) transferMap[key] = [];
            transferMap[key].push({ li: li, si: si, lid: l.id, lineName: l.name, refPos: {lat: s.lat, lng: s.lng}, 
                lineNum: getLineNumFromName(l.name), lineSuffix: getLineSuffix(l.name) });
        }
    }
    
    var transfers = [];
    for (var key in transferMap) {
        var entries = transferMap[key];
        var uniqueLids = [];
        for (var ei = 0; ei < entries.length; ei++) {
            if (uniqueLids.indexOf(entries[ei].lid) === -1) uniqueLids.push(entries[ei].lid);
        }
        if (uniqueLids.length >= 2) transfers.push({ name: key, entries: entries, uniqueCount: uniqueLids.length });
    }
    
    var threePlus = transfers.filter(function(t){return t.uniqueCount >= 3;});
    var twoLine = transfers.filter(function(t){return t.uniqueCount === 2;});
    console.log('Transfer stations: ' + transfers.length + ' (2-line: ' + twoLine.length + ', 3+: ' + threePlus.length + ')');
    
    // Process 2-line first (no API calls, instant)
    var kept2line = 0;
    for (var ti = 0; ti < twoLine.length; ti++) {
        var t = twoLine[ti];
        var ref = lines[t.entries[0].li].stations[t.entries[0].si];
        for (var ei = 0; ei < t.entries.length; ei++) {
            var s = lines[t.entries[ei].li].stations[t.entries[ei].si];
            s.isTransfer = true;
            s.transferType = 'same_station';
            s.transferGroupId = t.name;
            s.lat = ref.lat;
            s.lng = ref.lng;
        }
        kept2line++;
    }
    
    // Process 3+ line concurrently
    var moved3plus = 0, failed3plus = 0;
    var i = 0;
    var results = [];
    
    async function worker() {
        while (i < threePlus.length) {
            var idx = i++;
            var t = threePlus[idx];
            process.stderr.write('\r  [' + (idx+1) + '/' + threePlus.length + '] ' + t.name + ' ...');
            var result = await processTransfer(t, lines, cityName, idx, threePlus.length);
            results.push(result);
        }
    }
    
    var workers = [];
    for (var w = 0; w < Math.min(CONCURRENCY, threePlus.length); w++) workers.push(worker());
    await Promise.all(workers);
    
    for (var ri = 0; ri < results.length; ri++) {
        if (results[ri].type === 'moved' || results[ri].type === 'partial') moved3plus++;
        else failed3plus++;
    }
    
    var elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log('\nDone: 3+line=' + moved3plus + ', 2line=' + kept2line + ', failed=' + failed3plus + ' | ' + elapsed + 's');
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    console.log('Saved: ' + file);
}
main().catch(function(e) { console.error(e); process.exit(1); });
