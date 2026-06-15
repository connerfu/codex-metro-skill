// src/pipeline.js — ETL 调度中枢
// 三级加速 (P0/P1/P2) + 脏数据拦截 + 锚点生成 + 换乘分离 + 支线检测
// 纯编排：I/O → src/amap.js, 计算 → src/transform.js

const path = require("path");
const fs = require("fs");
const amap = require("./amap");
const transform = require("./transform");

const SPECIAL_LINE_NAMES = {
  BJYZ: "亦庄线", BJCP: "昌平线", BJFS: "房山线",
  BJYF: "燕房线", BJXJ: "西郊线", BJCA: "首都机场线",
  BJJX: "大兴机场线", BJYZT1: "亦庄T1线", BJ_LINE_S1: "北京地铁S1线",
  GZ_GUANGFO_LINE: "广佛线", GZ_APM_LINE: "珠江APM线",
  GZ_TRAM_HAIZHU: "海珠有轨电车", GZ_FOSHAN_LINE_2: "佛山地铁2号线", GZ_FOSHAN_LINE_3: "佛山地铁3号线",
  SH_AIRPORT_LINK: "机场联络线", SH_MAGLEV: "磁浮线",
  SHPJ: "浦江线", SH_JINSHAN: "金山铁路",
  CQ_KONGGANG_LINE: "空港线", CQ_GUOBO_LINE: "国博线",
  CQ_LOOP_LINE: "环线", CQ_JIANGTIAO_LINE: "江跳线",
  CQ_BITONG_LINE: "璧铜线", CQ_YUNBA: "云巴",
  TJ_JINJING_LINE: "津静线", TJ_LINE_Z4: "天津地铁Z4线",
  CD_LINE_S3: "资阳线(S3)", CD_TRAMWAY_RONG_2_LINE: "有轨电车蓉2号线",
  CD_TRAMWAY_RONG_2_LINE_BRANCH: "有轨电车蓉2号线(支线)",
  HEB3: "哈尔滨地铁3号线",
};

const RING_LINES = {
  beijing: ["BJ2", "BJ10"],
  shanghai: ["SH4"],
  chengdu: ["CD7"],
  chongqing: ["CQ_LOOP_LINE"],
  zhengzhou: ["ZZ5"],
  harbin: ["HEB3"],
};

async function runPipeline(slug, cityName, options) {
  options = options || {};
  const t0 = Date.now();
  const force = !!options.force;
  const outputFile = amap.downloadPath(slug + "_metro.json");
  let tier = "P2";

  // ===== P0: Archive copy =====
  if (!force) {
    const archiveFile = path.join(amap.skillPath("archives"), slug + "_metro.json");
    if (fs.existsSync(archiveFile)) {
      amap.ensureDir(path.dirname(outputFile));
      fs.copyFileSync(archiveFile, outputFile);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log("[P0] " + slug + ": 存档命中 -> 直接复制 (" + elapsed + "s)");
      return { success: true, file: outputFile, tier: "P0", stats: { elapsed: elapsed } };
    }
  }

  // ===== Extract Phase =====
  const refFile = amap.refPath(slug);
  const hasRefCache = !force && fs.existsSync(refFile);

  let allLines, slugCoords, ref;

  if (hasRefCache) {
    tier = "P1";
    console.log("[P1] " + slug + ": 参考文件缓存命中，跳过线路发现");
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
    console.log("[P2] " + slug + ": 全流程开始");
    // Step 1: Fetch lines
    console.log("  [1/6] 抓取线路...");
    allLines = await amap.fetchMetroLines(slug);
    var lc = Object.keys(allLines).length;
    console.log("    " + lc + " 条线路");

    // Step 2: Fetch stations
    console.log("  [2/6] 抓取站点...");
    for (const ls of Object.values(allLines)) {
      const stations = await amap.fetchMetroStations(slug, ls.num);
      for (const s of stations) ls.stations.push(s);
      if (ls.stations.length > 0) {
        console.log("    line " + ls.num + ": " + ls.stations.length + " 站");
      }
    }

    // Step 3: Fetch coordinates from metroman
    console.log("  [3/6] 抓取坐标...");
    slugCoords = {};
    const allSlugs = [...new Set(Object.values(allLines).flatMap(function(l) { return l.stations.map(function(s) { return s.slug; }); }))];
    var done = 0;
    for (const slugPath of allSlugs) {
      const coord = await amap.fetchMetroCoord(slugPath);
      if (coord) { slugCoords[slugPath] = coord; done++; }
    }
    console.log("    " + done + "/" + allSlugs.length);

    // Step 4: Branch detection
    console.log("  [4/6] 支线检测...");
    const branches = transform.detectBranches(allLines, slugCoords);
    for (const b of branches) {
      const line = allLines[b.slug];
      const brSlug = b.slug + "-branch";
      const removed = line.stations.splice(b.i + 1, b.j - b.i);
      allLines[brSlug] = { num: line.num, color: line.color, stations: [line.stations[b.i]].concat(removed), isBranch: true };
    }
    console.log("    " + branches.length + " 支线");

    // Step 5: Build reference
    console.log("  [5/6] 生成参考...");
    ref = {};
    for (const [slugId, line] of Object.entries(allLines)) {
      var lid = slugId;
      var lineName = SPECIAL_LINE_NAMES[lid] || cityName + "地铁" + line.num + "号线";
      var ringL = RING_LINES[slug] || [];
      ref[lid] = {
        line: line.num, name: lineName, color: line.color,
        speed: ([16,19].indexOf(line.num) >= 0 ? 120 : [7,11,21].indexOf(line.num) >= 0 ? 100 : 80),
        cars: ([1,16,19,21].indexOf(line.num) >= 0 ? 4 : 6),
        ring: ringL.indexOf(lid) >= 0,
        so: 360, sc: 1380,
        stations: line.stations.map(function(s) { return s.name; })
      };
    }
    amap.writeJSON(refFile, ref);
    amap.writeJSON(amap.cachePath(slug + "_coords.json"), slugCoords);

    var totalSt = 0;
    for (const v of Object.values(ref)) totalSt += v.stations.length;
    console.log("    " + Object.keys(ref).length + " 线, " + totalSt + " 站");
  }

  // ===== Transform Phase =====
  console.log("  [6/6] 构建JSON...");

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
    console.log("    AMap 补充坐标: " + needsFix.length + " 站...");
    for (const [key] of needsFix) {
      var parts = key.split("|");
      var stName = parts[0].replace(/站$/, "");
      var lineNum = parts[1].replace(/^[A-Z_]+/, "").replace(/\D/g, "");
      await amap.rateLimit();
      var gc = await amap.geocode(stName + "地铁站" + lineNum + "号线", cityName);
      if (gc) coords[key] = { lat: gc.lat, lng: gc.lng, source: "amap_fix" };
    }
  }

  // Interpolate remaining zero coords
  for (const [lid, line] of Object.entries(ref)) {
    var stations = line.stations;
    for (var i = 0; i < stations.length; i++) {
      var ck = stations[i] + "|" + lid;
      if (coords[ck].lat !== 0) continue;
      var pi = i - 1;
      while (pi >= 0) { if (coords[stations[pi] + "|" + lid].lat !== 0) break; pi--; }
      var ni = i + 1;
      while (ni < stations.length) { if (coords[stations[ni] + "|" + lid].lat !== 0) break; ni++; }
      if (pi >= 0 && ni < stations.length) {
        var pr = coords[stations[pi] + "|" + lid];
        var nx = coords[stations[ni] + "|" + lid];
        coords[ck] = { lat: pr.lat + (nx.lat - pr.lat) * (i - pi) / (ni - pi), lng: pr.lng + (nx.lng - pr.lng) * (i - pi) / (ni - pi), source: "interp" };
      } else if (pi >= 0) {
        coords[ck] = { lat: coords[stations[pi] + "|" + lid].lat, lng: coords[stations[pi] + "|" + lid].lng, source: "extrap_fb" };
      } else if (ni < stations.length) {
        coords[ck] = { lat: coords[stations[ni] + "|" + lid].lat, lng: coords[stations[ni] + "|" + lid].lng, source: "extrap_fb" };
      }
    }
  }

  // Dirty data interception at transform entry
  var buildResult = transform.buildOutput(coords, ref, slug, RING_LINES);
  var rawOutput = { lines: buildResult.lines, output: buildResult.output };
  transform.sanitizeStationsData(rawOutput);

  // Build output JSON
  amap.writeJSON(outputFile, buildResult.output);

  // Add anchors via AMap bus/linename (skip if no AMAP_KEY)
  var outputData = amap.readJSON(outputFile);
  if (process.env.AMAP_KEY) {
    console.log("    AMap 轨道锚点...");
  if (outputData && outputData.data && outputData.data.lines) {
    for (var li = 0; li < outputData.data.lines.length; li++) {
      var line = outputData.data.lines[li];
      if (!line.stations || line.stations.length < 2) continue;
      var lineName = line.name || cityName + "地铁";
      await amap.rateLimit();
      var bls = await amap.busLineSearch(lineName, cityName);
      if (bls && bls.length > 0 && bls[0].polyline) {
        var pl = bls[0].polyline.split(";").map(function(p) { var ps = p.split(","); return { lng: +ps[0], lat: +ps[1] }; });
        if (pl.length > 4) {
          var match = transform.matchStationsToPolyline(line.stations, pl);
          if (match && match.length >= 2) {
            transform.fixCollapsedCoords(line.stations, pl, match);
            var segAnchors = transform.anchorsFromMatch(line.stations, pl, match, !!(line.isRing || line.ring));
            line.segmentAnchors = segAnchors;
            // Snap stations to polyline
            for (var mi = 0; mi < match.length; mi++) {
              if (match[mi].pi >= 0 && match[mi].pi < pl.length) {
                line.stations[mi].lat = pl[match[mi].pi].lat;
                line.stations[mi].lng = pl[match[mi].pi].lng;
              }
            }
          }
        }
      }
    }
  }
  } else {
    console.log("    AMap 轨道锚点: 跳过 (无 AMAP_KEY)");
  }

  // Fix names
    for (var li2 = 0; li2 < outputData.data.lines.length; li2++) {
    var l2 = outputData.data.lines[li2];
    var fixedName = SPECIAL_LINE_NAMES[l2.id] || (function() {
      var numM = l2.id.match(/\d+$/);
      var result = numM ? cityName + "地铁" + parseInt(numM[0]) + "号线" : l2.name;
      return result;
    })();
    if (fixedName) l2.name = fixedName;
  }

  // Fix transfers with same_station + transferGroupId linking
  var transferIndex = transform.buildTransferIndex({ lines: outputData.data.lines });
  var stnNames = Object.keys(transferIndex);
  for (var ti = 0; ti < stnNames.length; ti++) {
    var entries = transferIndex[stnNames[ti]];
    for (var ei = 0; ei < entries.length; ei++) {
      var stn = outputData.data.lines[entries[ei].li].stations[entries[ei].si];
      stn.isTransfer = true;
      stn.transferType = "same_station";
      stn.transferGroupId = stnNames[ti];
      stn.same_station = stnNames[ti];
    }
  }
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

    amap.writeJSON(outputFile, outputData);

  // Validate
  var quality = transform.validateQuality(outputData.data);

  var elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("=== " + cityName + " (" + slug + ") 完成 in " + elapsed + "s ===");
  console.log("输出: " + outputFile);
  console.log("质量: " + quality.total + "/" + quality.maxScore + " (" + Math.round(quality.total / quality.maxScore * 100) + "%)");

  return {
    success: true,
    file: outputFile,
    tier: tier,
    stats: { elapsed: elapsed, lines: buildResult.lines.length, stations: buildResult.stations, quality: quality }
  };
}

module.exports = { runPipeline };

