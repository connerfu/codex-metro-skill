const fs = require("fs");
const dl = process.env.USERPROFILE + "\\Downloads";
const ar = "C:/Users/Conner/Documents/New project/codex-metro-skill/archives";

var cities = ["beijing","shanghai","guangzhou","shenzhen","chengdu","chongqing","hangzhou","nanjing",
    "tianjin","wuhan","shenyang","changchun","xian","zhengzhou","qingdao","suzhou","wuxi","xiamen","dalian",
    "haerbin","dongguan","nanning","foshan","shaoxing","zhuhai","xianyang","wulumuqi","zhongshan"];

console.log("=== Copying to archives ===");
var ok = 0, empty = 0;
cities.forEach(function(c){
    try {
        var sf = dl + "\\" + c + "_metro.json";
        var df = ar + "/" + c + "_metro.json";
        var s = fs.statSync(sf);
        fs.copyFileSync(sf, df);
        var kb = (s.size/1024).toFixed(0);
        if (s.size > 100) { ok++; console.log("  " + c + ": " + kb + "KB"); }
        else { empty++; console.log("  " + c + ": " + kb + "KB [empty]"); }
    } catch(e) { console.log("  " + c + ": ERROR " + e.message); }
});
console.log("\nDone: " + ok + " metro files, " + empty + " empty");