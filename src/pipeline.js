// src/pipeline.js �� ETL ��������
// �������� (P0/P1/P2) + ���������� + ê������ + ���˷��� + ֧�߼��
// �����ţ�I/O �� src/amap.js, ���� �� src/transform.js

const path = require("path");
const fs = require("fs");
const amap = require("./amap");
const transform = require("./transform");





async function runPipeline(slug, cityName, options) {
  try {

  options = options || {};
  const t0 = Date.now();
  const force = !!options.force;
  const outputFile = amap.downloadPath(slug + "_metro.json");
  var tier = "P2";

  // ===== P0: Archive copy =====
  if (!force) {
    const archiveFile = amap.skillPath("archives", slug + "_metro.json");
    if (fs.existsSync(archiveFile)) {
      amap.ensureDir(path.dirname(outputFile));
      fs.copyFileSync(archiveFile, outputFile);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log("[P0] " + slug + ": �浵���� -> ֱ�Ӹ��� (" + elapsed + "s)");
      return { success: true, file: outputFile, tier: "P0", stats: { elapsed: elapsed } };
    }
  }

  // ===== Extract Phase =====
  const refFile = amap.refPath(slug);
  const hasRefCache = !force && fs.existsSync(refFile);

  let allLines, slugCoords, ref;

  if (hasRefCache) {
    tier = "P1";
    console.log("[P1] " + slug + ": �ο��ļ��������У�������·����");
    ref = amap.readJSON(refFile);
    // Build allLines from reference
    allLines = {};
    for (const [lid, line] of Object.entries(ref)) {
      allLines[lid] = { num: line.line, color: line.color, stations: line.stations.map(function(s) { return { name: s }; }) };
    }
    // Load coords from cache and build name|lid mapping
    slugCoords = amap.readJSON(amap.cachePath(slug + "_coords.json"), 0) || {};
    // Also load cache lines for slug-to-name mapping
    var cacheLines = amap.readJSON(amap.cachePath(slug + "_lines.json"), 0) || {};
    // Build slug-to-name map from cache lines
    var slugToName = {};
    Object.values(cacheLines).forEach(function(l) {
      if (l.stations) l.stations.forEach(function(s) { if (s.slug && s.name) slugToName[s.slug] = s.name; });
    });
    // If we have slug-to-name mapping, use it; otherwise try direct name lookup
    var hasSlugMapping = Object.keys(slugToName).length > 0;
    if (hasSlugMapping) {
      // Build reverse mapping: station name -> [lid] from ref
      var nameToLids = {};
      Object.entries(ref).forEach(function(e) {
        var lid = e[0];
        e[1].stations.forEach(function(s) {
          if (!nameToLids[s]) nameToLids[s] = [];
          nameToLids[s].push(lid);
        });
      });
      // Now match cache coords (keyed by slug path) to name|lid
      Object.entries(slugCoords).forEach(function(e) {
        var slugPath = e[0];
        var coord = e[1];
        var stnName = slugToName[slugPath] || slugPath.split("/").pop();
        var lids = nameToLids[stnName] || [];
        if (lids.length > 0) {
          lids.forEach(function(lid) {
            var key = stnName + "|" + lid;
            slugCoords[key] = coord;
          });
        }
        // Also keep the original slug path entry for fallback
      });
    }
  } else {
    console.log("[P2] " + slug + ": ȫ���̿�ʼ");
    // Step 1: Fetch lines
    console.log("  [1/6] ץȡ��·...");
    allLines = await amap.fetchMetroLines(slug);
    var lc = Object.keys(allLines).length;
    console.log("    " + lc + " ����·");

    // Step 2: Fetch stations
    console.log("  [2/6] ץȡվ��...");
    for (const ls of Object.values(allLines)) {
      const stations = await amap.fetchMetroStations(slug, ls.num);
      for (const s of stations) ls.stations.push(s);
      if (ls.stations.length > 0) {
        console.log("    line " + ls.num + ": " + ls.stations.length + " վ");
      }
    }

    // Step 3: Fetch coordinates from metroman
    console.log("  [3/6] ץȡ����...");
    slugCoords = {};
    const allSlugs = [...new Set(Object.values(allLines).flatMap(function(l) { return l.stations.map(function(s) { return s.slug; }); }))];
    var done = 0;
    for (const slugPath of allSlugs) {
      const coord = await amap.fetchMetroCoord(slugPath);
      if (coord) { slugCoords[slugPath] = coord; done++; }
    }
    console.log("    " + done + "/" + allSlugs.length);

    // Step 4: Branch detection
    console.log("  [4/6] ֧�߼��...");
    const branches = transform.detectBranches(allLines, slugCoords);
    for (const b of branches) {
      const line = allLines[b.slug];
      const brSlug = b.slug + "-branch";
      const removed = line.stations.splice(b.i + 1, b.j - b.i);
      allLines[brSlug] = { num: line.num, color: line.color, stations: [line.stations[b.i]].concat(removed), isBranch: true };
    }
    console.log("    " + branches.length + " ֧��");

    // Step 5: Build reference
    console.log("  [5/6] ���ɲο�...");
    ref = {};
    for (const [slugId, line] of Object.entries(allLines)) {
      var lid = slugId;
      var lineName = transform.resolveLineName(lid, cityName) || cityName + "����" + line.num + "����";
      var ringL = transform.getRingForCity(slug);
      var meta = transform.enrichLineMetadata(line, slug);
      ref[lid] = {
        line: line.num, name: lineName, color: line.color,
        speed: meta.speed,
        cars: meta.cars,
        ring: ringL.indexOf(lid) >= 0,
        so: 360, sc: 1380,
        stations: line.stations.map(function(s) { return s.name; })
      };
    }
    amap.writeJSON(refFile, ref);
    amap.writeJSON(amap.cachePath(slug + "_coords.json"), slugCoords);

    var totalSt = 0;
    for (const v of Object.values(ref)) totalSt += v.stations.length;
    console.log("    " + Object.keys(ref).length + " ��, " + totalSt + " վ");
  }

  // ===== Transform Phase =====
  console.log("  [6/6] ����JSON...");

  // Initialize coords from reference + cache (now handles name|lid keys from slug mapping)
  var coords = {};
  for (const [lid, line] of Object.entries(ref)) {
    for (const name of line.stations) {
      var key = name + "|" + lid;
      var cached = slugCoords[key] || slugCoords[name] || slugCoords["/cities/" + slug + "/stations/" + name];
      coords[key] = cached ? { lat: cached.lat, lng: cached.lng, source: "metroman" } : { lat: 0, lng: 0 };
    }
  }

  // Fill missing coords via AMap geocode
  var needsFix = Object.entries(coords).filter(function(e) { return e[1].lat === 0 && e[1].lng === 0; });
  if (needsFix.length > 0 && process.env.AMAP_KEY) {
    console.log("    AMap ��������: " + needsFix.length + " վ...");
    for (const [key] of needsFix) {
      var parts = key.split("|");
      var stName = parts[0].replace(/վ$/, "");
      var lineNum = parts[1].replace(/^[A-Z_]+/, "").replace(/\D/g, "");
      await amap.rateLimit();
      var gc = await amap.geocode(stName + "����վ" + lineNum + "����", cityName);
      if (gc) coords[key] = { lat: gc.lat, lng: gc.lng, source: "amap_fix" };
    }
  }

  // Interpolate remaining zero coords (via transform.js)
  transform.interpolateZeroCoords(coords, ref);

  // Build output JSON
  var ringForCity = transform.getRingForCity(slug);
  var ringLines = {}; ringLines[slug] = ringForCity;
  var buildResult = transform.buildOutput(coords, ref, slug, ringLines);
  var rawOutput = { lines: buildResult.lines, output: buildResult.output };
  // Empty line check: skip lines with stations.length < 2 (Spec v2.0 Task 3)
  var warnLines = [];
  rawOutput.lines = rawOutput.lines.filter(function(l) {
    if (l.stations && l.stations.length < 2) {
      warnLines.push(l.id || l.name);
      return false;
    }
    return true;
  });
  if (warnLines.length > 0) {
    console.log("    Warn: ?????: " + warnLines.join(", "));
  }
  transform.sanitizeStationsData(rawOutput);
    amap.writeJSON(outputFile, buildResult.output);

  // Add anchors via AMap bus/linename (skip if no AMAP_KEY)
  var outputData = amap.readJSON(outputFile);
  if (process.env.AMAP_KEY) {
    console.log("    AMap ���ê��...");
    if (outputData && outputData.data && outputData.data.lines) {
    for (var li = 0; li < outputData.data.lines.length; li++) {
      var line = outputData.data.lines[li];
      if (!line.stations || line.stations.length < 2) continue;
      var lineName = line.name || cityName + "����";
      // ?????? (SPEC P0-1): ???? bls[0]
      var config = (function() { try { var r = require("fs").readFileSync(require("path").join(amap.skillPath("config"), slug + ".json"), "utf8"); return JSON.parse(r); } catch(e) { return {}; } })();
      await amap.rateLimit();
      var bls = await amap.busLineSearch(lineName, cityName);
      var electResult = amap.electBusLine(bls, config, line.stations, transform.haversineKm);
      if (electResult.line && electResult.line.polyline) {
        console.log("    ?? [" + electResult.score.toFixed(0) + "]: " + electResult.reason);
        var pl = electResult.line.polyline.split(";").map(function(p) { var ps = p.split(","); return { lng: +ps[0], lat: +ps[1] }; });
        if (pl.length > 4) {
          var match = transform.matchStationsToPolyline(line.stations, pl);
          if (match && match.length >= 2) {
            transform.fixCollapsedCoords(line.stations, pl, match);
            var segAnchors = transform.anchorsFromMatch(line.stations, pl, match, !!(line.isRing || line.ring));
            line.segmentAnchors = segAnchors;
            // Snap stations to polyline (with MAX_SNAP_DIST boundary)
            transform.snapStations(line.stations, match, pl);
          }
        }
      }
    }
  }
  } else {
    console.log("    AMap ���ê��: ���� (�� AMAP_KEY)");
  }

  // Fix names (via transform.js)
  for (var li2 = 0; li2 < outputData.data.lines.length; li2++) {
    var l2 = outputData.data.lines[li2];
    var fixedName = transform.resolveLineName(l2.id, cityName);
    if (fixedName) l2.name = fixedName;
  }

  // Fix transfers with same_station + transferGroupId linking// Fix transfers with same_station + transferGroupId linking (via transform.js)
  transform.enrichTransferFields(outputData);
  transform.separateTransferStations({ lines: outputData.data.lines });

  // Dirty data re-check before split
  transform.sanitizeStationsData(outputData.data);
  
  // Split gapped lines
  var splitResult = transform.splitGappedLines(outputData.data.lines, 8, 4);
  if (splitResult.splitCount > 0) {
    outputData.data.lines = splitResult.newLines;
    outputData.data.lineCounter = splitResult.newLines.length;
  }

  // Dirty data interception
  for (var li3 = 0; li3 < outputData.data.lines.length; li3++) {
    var l3 = outputData.data.lines[li3];
    if (l3.segmentAnchors) {
      for (var si = 0; si < l3.segmentAnchors.length; si++) {
        if (!l3.segmentAnchors[si] || l3.segmentAnchors[si].length === 0) {
          var from = l3.stations[si];
          var to = l3.stations[si + 1];
          if (from && to) {
            var pts = [];
            for (var k = 1; k <= 5; k++) pts.push({ lat: from.lat + (to.lat - from.lat) * k / 6, lng: from.lng + (to.lng - from.lng) * k / 6 });
            l3.segmentAnchors[si] = pts;
          }
        }
      }
    }
  }

    // Validate contract before final write (Spec v2.0 Task 4)
    var contractResult = transform.validateContract(outputData);
    if (!contractResult.valid) {
      throw new Error("Contract validation FAILED: " + contractResult.errors.join("; "));
    }
    amap.writeJSON(outputFile, outputData);

  // Validate
  var quality = transform.validateQuality(outputData.data);

  var elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("=== " + cityName + " (" + slug + ") ��� in " + elapsed + "s ===");
  console.log("���: " + outputFile);
  console.log("����: " + quality.total + "/" + quality.maxScore + " (" + Math.round(quality.total / quality.maxScore * 100) + "%)");

  return {
    success: true,
    file: outputFile,
    tier: tier,
    stats: { elapsed: elapsed, lines: buildResult.lines.length, stations: buildResult.stations, quality: quality }
  };

  } catch (err) {
    var errMsg = err.message || String(err);
    console.error("Pipeline error: " + errMsg);
    // Write to LESSONS_LEARNED.md on DescriptiveError
    if (errMsg.indexOf("DescriptiveError") >= 0 || errMsg.indexOf("Contract validation") >= 0) {
      try {
        var lessonsPath = require("path").join(amap.skillPath(), "LESSONS_LEARNED.md");
        var fs2 = require('fs');
        var lessons = fs2.readFileSync(lessonsPath, 'utf8');
        var lCount = (lessons.match(/## L\d+/g) || []).length;
        var lNum = lCount + 1;
        var entry = "\n## L" + lNum + ": " + errMsg.substring(0, 60) + "\n";
        entry += "- ���󣺹������ص��쳣\n";
        entry += "- �Բߣ�" + errMsg + "\n";
        entry += "- ��Դ��pipeline.js try-catch\n";
        fs2.appendFileSync(lessonsPath, entry, 'utf8');
      } catch(e) {}
    }
    if (errMsg.indexOf("DescriptiveError") >= 0 || errMsg.indexOf("Contract validation") >= 0) {
      process.exit(1);
    }
    return { success: false, error: errMsg, tier: "ERR" };
  }
}


module.exports = { runPipeline };

