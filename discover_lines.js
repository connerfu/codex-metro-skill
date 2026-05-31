// === DISCOVER LINES v1.3 — preserve AMap POI order ===
var fs = require("fs"), https = require("https");
var args = process.argv;
var CITY = args[2], CITY_CN = args[3];
if (!CITY) { console.log("Usage: discover_lines.js CITY \"city\""); process.exit(1); }
var AMAP_KEY = process.env.AMAP_KEY || "";
if (!AMAP_KEY) { console.error("Set AMAP_KEY"); process.exit(1); }
var REF_DIR = "C:/Users/Conner/Documents/New project/codex-metro-skill/references";
var OUT_FILE = REF_DIR + "/" + CITY + "_lines.json";
var MAX_STATIONS = 200, MIN_STATIONS = 3;
var PALETTE = ["#E60012","#009944","#F39800","#0072BC","#8B2E9E","#00A0E9","#77BB00","#E95295","#FFD400","#006B6B","#B6007E","#00B48D","#F47B20","#003399","#99CC00","#D6004C","#0088CC","#FF6600","#6600CC","#0099CC","#CC0033","#336633","#FF9933","#006699","#993366","#339966","#CC6600","#003366","#996600","#336699"];

function norm(n) { return (n||"").replace(/\u7AD9$/,"").replace(/\uFF08/g,"(").replace(/\uFF09/g,")").trim(); }

function amapPOI(kw, city, page) {
  return new Promise(function(ok) {
    var p = "/v3/place/text?key="+AMAP_KEY+"&keywords="+encodeURIComponent(kw)+"&types=150500&offset=50&page="+(page||1)+"&city="+encodeURIComponent(city);
    var t=setTimeout(function(){ok(null);},8000),d=false;
    https.get({hostname:"restapi.amap.com",path:p,headers:{"User-Agent":"CD/1.3"},agent:false},function(r){
      var b="";r.on("data",function(c){b+=c;});r.on("end",function(){if(d)return;d=true;clearTimeout(t);try{var j=JSON.parse(b);ok(j.status==="1"?j:null)}catch(e){ok(null)}});
    }).on("error",function(){if(!d){d=true;clearTimeout(t);ok(null)}}).end();
  });
}

async function getLine(num) {
  var kw = CITY_CN + "\u5730\u94C1" + num + "\u53F7\u7EBF", all=[];
  for(var pg=1;pg<=3;pg++){var r=await amapPOI(kw,CITY_CN,pg);if(!r)break;var pois=r.pois||[];all=all.concat(pois);if(all.length>=(parseInt(r.count)||0)||pois.length<50)break;}
  var seen={},stns=[];
  all.forEach(function(p){var nm=norm(p.name);if(!nm||seen[nm])return;seen[nm]=true;var l=(p.location||"").split(",");if(l.length===2)stns.push({name:nm,lat:parseFloat(l[1]),lng:parseFloat(l[0])});});
  return stns;
}

async function main() {
  var t0=Date.now();console.log("\n=== Discover: "+CITY_CN+" ===\n[1/3] Scanning lines 1-30...");
  var cand=[];
  for(var n=1;n<=30;n+=5){var nums=[];for(var k=0;k<5&&n+k<=30;k++)nums.push(n+k);
    var res=await Promise.all(nums.map(function(nu){return amapPOI(CITY_CN+"\u5730\u94C1"+nu+"\u53F7\u7EBF",CITY_CN,1).then(function(r){return{num:nu,r:r}});}));
    res.forEach(function(x){if(x.r&&x.r.status==="1"&&parseInt(x.r.count)>0)cand.push({num:x.num,cnt:parseInt(x.r.count)});});
    if(n+5<=30)await new Promise(function(r){setTimeout(r,400);});
  }
  var lines=[],skip=[];
  cand.forEach(function(l){if(l.cnt>MAX_STATIONS)skip.push(l.num+"("+l.cnt+")");else if(l.cnt<MIN_STATIONS)skip.push(l.num+"("+l.cnt+")");else lines.push(l.num);});
  console.log("  Found: "+lines.join(",")+" | Skip: "+skip.join(","));
  if(!lines.length){console.error("None!");process.exit(1);}
  await new Promise(function(r){setTimeout(r,800);});
  
  console.log("\n[2/3] Fetching stations...");
  var data={},allSt={};
  for(var i=0;i<lines.length;i++){var num=lines[i],stns=await getLine(num);
    if(stns.length<MIN_STATIONS){console.log("  "+num+": SKIP");await new Promise(function(r){setTimeout(r,300);});continue;}
    var names=stns.map(function(s){return s.name;});
    names.forEach(function(s){if(!allSt[s])allSt[s]=[];if(allSt[s].indexOf(num)===-1)allSt[s].push(num);});
    var pfx=CITY.replace(/[^a-zA-Z]/g,"").substring(0,2).toUpperCase();var lid=pfx+num;
    data[lid]={name:num+"\u53F7\u7EBF",color:PALETTE[(num-1)%PALETTE.length],speed:80,cars:6,ring:false,so:360,sc:1380,stations:names};
    console.log("  "+lid+" "+num+"\u53F7\u7EBF: "+names.length+"\u7AD9");
    await new Promise(function(r){setTimeout(r,300);});
  }
  
  var tr=0;Object.keys(allSt).forEach(function(s){if(allSt[s].length>1)tr++;});
  console.log("\n[3/3] Transfers: "+tr);
  fs.writeFileSync(OUT_FILE,JSON.stringify(data,null,2),"utf8");
  var total=Object.values(data).reduce(function(a,l){return a+l.stations.length;},0);
  console.log("Done "+(Date.now()-t0)/1000+"s | "+Object.keys(data).length+" lines "+total+" stations");
  console.log("Output: "+OUT_FILE);
}
main().catch(function(e){console.error("FATAL:",e.message);process.exit(1);});