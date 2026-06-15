// bin/run.js — 唯一 CLI 入口
// 参数解析 → 读 config/{slug}.json → 调 pipeline.js → 退出码

const fs = require("fs");
const path = require("path");
const amap = require("../src/amap");
const pipeline = require("../src/pipeline");

// ===== Config helpers (inline, no I/O) =====
const CITY_CHARS = {
  beijing: "北京", shanghai: "上海", guangzhou: "广州",
  shenzhen: "深圳", chengdu: "成都", chongqing: "重庆",
  hangzhou: "杭州", nanjing: "南京", tianjin: "天津",
  wuhan: "武汉", shenyang: "沈阳", changchun: "长春",
  xian: "西安", zhengzhou: "郑州", qingdao: "青岛",
  suzhou: "苏州", wuxi: "无锡", xiamen: "厦门",
  dalian: "大连", harbin: "哈尔滨", dongguan: "东莞",
  nanning: "南宁", foshan: "佛山", shaoxing: "绍兴",
  zhuhai: "珠海", xianyang: "咸阳", urumqi: "乌鲁木齐",
  zhongshan: "中山",
};

function getAllCitySlugs() {
  const configDir = amap.skillPath("config");
  if (!fs.existsSync(configDir)) return Object.keys(CITY_CHARS);
  return fs.readdirSync(configDir)
    .filter(function(f) { return f.endsWith(".json"); })
    .map(function(f) { return f.replace(/\.json$/, ""); });
}

// ===== Argument parsing =====
const args = process.argv.slice(2);
let city = null;
let force = false;
let all = false;
let help = false;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--city" || a === "-c") { city = args[++i]; }
  else if (a === "--force" || a === "-f") { force = true; }
  else if (a === "--all" || a === "-a") { all = true; }
  else if (a === "--help" || a === "-h") { help = true; }
}

// ===== Help =====
if (help || (!city && !all)) {
  console.log([
    "Metro Pipeline — 地铁存档生成器",
    "",
    "Usage:",
    "  node bin/run.js --city <slug>        生成指定城市",
    "  node bin/run.js --all                 生成所有城市",
    "  node bin/run.js --city <slug> --force 强制重新生成",
    "",
    "Options:",
    "  --city <slug>, -c <slug>  城市 slug（如 beijing）",
    "  --all, -a                  处理所有城市",
    "  --force, -f                忽略缓存",
    "  --help, -h                 显示帮助",
    "",
    "Examples:",
    "  node bin/run.js --city beijing",
    "  node bin/run.js -c shanghai --force",
    "  node bin/run.js --all",
    "",
    "Available slugs: " + getAllCitySlugs().join(", "),
  ].join("\n"));
  process.exit(0);
}

// ===== Main =====
async function main() {
  const t0 = Date.now();
  let slugs = [];

  if (all) {
    slugs = getAllCitySlugs();
  } else if (city) {
    slugs = [city];
  }

  if (slugs.length === 0) {
    console.error("错误: 未指定城市");
    process.exit(1);
  }

  console.log("=== Metro Pipeline ===");
  const results = {};

  for (const slug of slugs) {
    const cityName = CITY_CHARS[slug] || slug;
    console.log("\n" + "=".repeat(50));
    console.log("城市: " + slug + " (" + cityName + ")");

    try {
      const result = await pipeline.runPipeline(slug, cityName, { force: force });
      results[slug] = result.success ? "OK" : "FAIL";
      if (result.success) {
        console.log("结果: OK [" + result.tier + "] (" + (result.stats.elapsed || "?") + "s)");
      } else {
        console.error("结果: FAIL - " + (result.error || "unknown"));
      }
    } catch (err) {
      console.error("结果: FAIL - " + (err.message || err));
      results[slug] = "FAIL";
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const okCount = Object.values(results).filter(function(s) { return s === "OK"; }).length;
  const failCount = Object.values(results).filter(function(s) { return s === "FAIL"; }).length;

  console.log("\n" + "=".repeat(50));
  console.log("完成 in " + elapsed + "s | OK: " + okCount + "  FAIL: " + failCount);

  if (failCount > 0) process.exit(1);
  process.exit(0);
}

main().catch(function(err) {
  console.error("FATAL:", err.message || err);
  process.exit(2);
});
