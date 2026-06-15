// bin/run.js ? ??? CLI ?? (ATOMIZATION_SPEC.md)
// ?? --city, --all, --force, --step, --validate, --resume

const fs = require("fs");
const path = require("path");
const amap = require("../src/amap");
const pipeline = require("../src/pipeline");

function getAllCitySlugs() {
  var configDir = amap.skillPath("config");
  if (!fs.existsSync(configDir)) return [];
  return fs.readdirSync(configDir).filter(function(f){return f.endsWith(".json");}).map(function(f){return f.replace(/\.json$/,"");});
}

var args = process.argv.slice(2);
var city = null, force = false, all = false, help = false, step = null, validateOnly = false, resume = null;

for (var i = 0; i < args.length; i++) {
  var a = args[i];
  if (a === "--city" || a === "-c") city = args[++i];
  else if (a === "--force" || a === "-f") force = true;
  else if (a === "--all" || a === "-a") all = true;
  else if (a === "--step" || a === "-s") step = args[++i];
  else if (a === "--validate" || a === "-v") validateOnly = true;
  else if (a === "--resume" || a === "-r") resume = args[++i];
  else if (a === "--help" || a === "-h") help = true;
}

if (help || (!city && !all)) {
  console.log([
    "Metro Pipeline ? ?????",
    "",
    "Usage:",
    "  node bin/run.js --city <slug>         ??????",
    "  node bin/run.js --all                  ??????",
    "  node bin/run.js --city <slug> --force  ??????",
    "  node bin/run.js --city <slug> --step <name>  ???????",
    "  node bin/run.js --city <slug> --validate     ??????",
    "  node bin/run.js --city <slug> --resume <name> ?????????",
    "",
    "Steps: fetchLines, fetchCoords, detectBranches, buildReference, buildGameJson, generateAnchors",
    "",
    "Options:",
    "  --city <slug>, -c <slug>  ?? slug",
    "  --all, -a                  ??????",
    "  --force, -f                ????",
    "  --step <name>, -s <name>   ???????",
    "  --validate, -v             ??????",
    "  --resume <name>, -r <name> ???????",
    "  --help, -h                 ????",
    "",
    "Available slugs: " + getAllCitySlugs().join(", ")
  ].join("\n"));
  process.exit(0);
}

async function main() {
  var t0 = Date.now();
  var slugs = [];
  if (all) slugs = getAllCitySlugs();
  else if (city) slugs = [city];
  if (slugs.length === 0) { console.error("??: ?????"); process.exit(1); }
  console.log("=== Metro Pipeline (Atomized) ===");
  var results = {};
  for (var si = 0; si < slugs.length; si++) {
    var slug = slugs[si];
    var config = (function(){try{return JSON.parse(fs.readFileSync(amap.skillPath("config",slug+".json"),"utf8"));}catch(e){return{};}})();
    var cityName = config.name || slug;
    console.log("\n" + "=".repeat(50));
    console.log("??: " + slug + " (" + cityName + ")");
    if (step) console.log("??: " + step);
    if (resume) console.log("??: ? " + resume + " ??");
    if (validateOnly) console.log("??: ??");
    try {
      var opts = { force: force };
      if (step) opts.step = step;
      if (resume) opts.resume = resume;
      if (validateOnly) opts.validate = true;
      var result = await pipeline.runPipeline(slug, cityName, opts);
      results[slug] = result.health || "FAIL";
      if (result.success) {
        var extra = "";
        if (result.tier) extra += " [" + result.tier + "]";
        if (result.health) extra += " health:" + result.health;
        if (result.steps) extra += " steps:" + result.steps.length;
        if (result.stats && result.stats.elapsed) extra += " (" + result.stats.elapsed + "s)";
        console.log("??: OK" + extra);
        if (result.validate) {
          var v = result.validate;
          console.log("??: " + v.health + " (" + (v.stats?v.stats.lines+"?, "+v.stats.stations+"?":"") + ")");
          if (v.issues && v.issues.length > 0) v.issues.forEach(function(iss){console.log("  ["+iss.severity+"] "+iss.msg);});
        }
      } else {
        console.error("??: FAIL [" + (result.tier||"ERR") + "] - " + (result.error||result.health||"unknown"));
        if (result.steps) result.steps.forEach(function(s,i){if(s.health==="FAIL"||s.health==="WARN")console.log("  ??"+(i+1)+" "+s.meta.step+": "+s.health);if(s.issues)s.issues.forEach(function(iss){console.log("    ["+iss.severity+"] "+iss.msg);});});
      }
    } catch (err) {
      console.error("??: FAIL - " + (err.message||err));
      results[slug] = "FAIL";
    }
  }
  var elapsed = ((Date.now()-t0)/1000).toFixed(1);
  var okCount = Object.values(results).filter(function(s){return s!=="FAIL";}).length;
  var failCount = Object.values(results).filter(function(s){return s==="FAIL";}).length;
  console.log("\n" + "=".repeat(50));
  console.log("?? in " + elapsed + "s | OK: " + okCount + "  FAIL: " + failCount);
  if (failCount > 0) process.exit(1);
  process.exit(0);
}

main().catch(function(err){console.error("FATAL:",err.message||err);process.exit(2);});
