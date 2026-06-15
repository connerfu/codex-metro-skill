
const p=require("path"),fs=require("fs"),amap=require("./amap"),tr=require("./transform");
function sp(){var a=Array.prototype.slice.call(arguments);return p.join.apply(null,[__dirname,".."].concat(a));}
function cp(s,n){return sp("references",s+"_"+n+".json");}
function wc(s,n,d){var f=cp(s,n);amap.ensureDir(p.dirname(f));fs.writeFileSync(f,JSON.stringify(d,null,2),"utf8");}
function rc(s,n){return amap.readJSON(cp(s,n),0);}
function ap(s){return sp("archives",s+"_metro.json");}
function cf(s){try{return JSON.parse(fs.readFileSync(sp("config",s+".json"),"utf8"));}catch(e){return{};}}

async function fetchLines(slug,cn){
  var is=[],ls;try{ls=await amap.fetchMetroLines(slug);}catch(e){return {data:null,meta:{step:"fetchLines"},health:"FAIL",issues:[{severity:"FAIL",code:"E001",msg:e.message}]};}
  for(var i=0;i<ls.length;i++){try{ls[i].stations=await amap.fetchMetroStations(slug,ls[i].slug||ls[i].num);}catch(e){ls[i].stations=[];}}
  if(ls.length===0)is.push({severity:"FAIL",code:"E001",msg:"0 lines"});
  return {data:{lines:ls},meta:{step:"fetchLines",lineCount:ls.length},health:is.length?"FAIL":"OK",issues:is};
}

async function fetchCoords(slug,cn,ld){
  var is=[],al=ld.lines||{},cfg=cf(slug),bb=cfg.bbox||{};
  var slugs=[...new Set(Object.values(al).flatMap(function(l){return (l.stations||[]).map(function(s){return s.slug;});}))];
  var sc={},done=0;
  for(var i=0;i<slugs.length;i++){try{var c=await amap.fetchMetroCoord(slugs[i]);if(c){sc[slugs[i]]=c;done++;}}catch(e){}}
  var ol={},ts=0,mc=0,cl=[],obl=[],lidSeq=0;
  Object.entries(al).forEach(function(e){
    var lid=e[0],line=e[1];
    var sts=(line.stations||[]).map(function(st){var c=sc[st.slug]||{};return {name:st.name,slug:st.slug,lat:c.lat||0,lng:c.lng||0};});
    var useKey = (line.slug||line.num) ? (line.slug||"l"+line.num) : String(lidSeq);
    ol[useKey]={num:line.num,name:line.name,color:line.color,stations:sts,isRing:!!line.ring};
    lidSeq++;
    ts+=sts.length;var miss=sts.filter(function(s){return s.lat===0&&s.lng===0;});if(miss.length)mc+=miss.length;
    var f=sts[0];if(f&&sts.length>1&&sts.every(function(s){return s.lat===f.lat&&s.lng===f.lng;}))cl.push(lid);
    if(bb.minLat!==undefined){var o=sts.filter(function(s){return s.lat!==0&&(s.lat<bb.minLat||s.lat>bb.maxLat||s.lng<bb.minLng||s.lng>bb.maxLng);});if(o.length)obl.push({lid:lid,count:o.length});}
  });
  if(cl.length)is.push({severity:"FAIL",code:"E002",msg:"collapsed:"+cl.join(","),detail:{lines:cl}});
  if(mc)is.push({severity:"WARN",code:"E003",msg:mc+" missing",detail:{count:mc}});
  if(obl.length)is.push({severity:"WARN",code:"E004",msg:obl.length+" oob",detail:{lines:obl}});
  return {data:{lines:ol,slugCoords:sc},meta:{step:"fetchCoords",totalStations:ts,stationsMissingCoords:mc},health:is.some(function(i){return i.severity==="FAIL";})?"FAIL":is.length?"WARN":"OK",issues:is};
}

function detectBranches(slug,ld){
  var al=JSON.parse(JSON.stringify(ld.lines||ld)),sc={},ea=Object.entries(al);
  ea.forEach(function(e){var l=e[1];(l.stations||[]).forEach(function(s){if(s.slug&&s.lat)sc[s.slug]={lat:s.lat,lng:s.lng};});});
  var br=tr.detectBranches(ea.map(function(e){return e[1];}),sc);
  for(var b=0;b<br.length;b++){var r=br[b],ei=ea[parseInt(r.slug)];if(!ei)continue;var pKey=ei[0],p=ei[1];var rm=p.stations.splice(r.i+1,r.j-r.i);al[pKey+"-b"]={num:p.num,color:p.color,stations:[p.stations[r.i]].concat(rm),isBranch:true,isRing:false};}
  return {data:{lines:al},meta:{step:"detectBranches",branchCount:br.length},health:"OK",issues:[]};
}
function buildReference(slug,ld){
  var al=ld.lines||ld,ref={},brc={};
  Object.entries(al).forEach(function(e){
    var lid=e[0],line=e[1];
    var nm=tr.resolveLineName(lid,slug)||line.name||tr.resolveLineName(String(line.num),slug)||slug+"m";
    var md=tr.enrichLineMetadata(line,slug),rl=tr.getRingForCity(slug);
    var sn=[],sw=(line.stations||[]);
    sw.forEach(function(s){var n=s.name||s;sn.push(n);if(s.lat)brc[n+"|"+lid]={lat:s.lat,lng:s.lng,source:"m"};});
    ref[lid]={line:line.num,name:nm,color:line.color,speed:md.speed,cars:md.cars,ring:rl.indexOf(lid)>=0||!!line.isRing,stations:sn};
  });
  return {data:{ref:ref,brCoords:brc},meta:{step:"buildReference",lineCount:Object.keys(ref).length},health:"OK",issues:[]};
}
function buildGameJson(slug,rd){
  var is=[],ref=rd.ref||rd,bc=rd.brCoords||{},coords={};
  Object.entries(ref).forEach(function(e){var lid=e[0],line=e[1];(line.stations||[]).forEach(function(s){coords[s+"|"+lid]={lat:0,lng:0,s:"i"};});});
  Object.keys(bc).forEach(function(k){if(coords[k]&&bc[k].lat!==0)coords[k]=bc[k];});
  tr.interpolateZeroCoords(coords,ref);
  var rf=tr.getRingForCity(slug),rl={};rl[slug]=rf;
  var br2=tr.buildOutput(coords,ref,slug,rl);
  var el=br2.lines.filter(function(l){return !l.stations||!l.stations.length;});
  if(el.length)is.push({severity:"FAIL",code:"E005",msg:el.length+" lines 0 st: "+el.map(function(l){return l.id;}).join(",")});
  if((br2.stations||0)<10)is.push({severity:"WARN",code:"E006",msg:"st too few: "+br2.stations});
  var o=br2.output;tr.sanitizeStationsData(o.data);tr.enrichTransferFields(o);tr.separateTransferStations({lines:o.data.lines});
  var sp2=tr.splitGappedLines(o.data.lines,8,4);if(sp2.splitCount){o.data.lines=sp2.newLines;o.data.lineCounter=sp2.newLines.length;}
  return {data:o,meta:{step:"buildGameJson",lines:br2.lines.length,stations:br2.stations},health:is.some(function(i){return i.severity==="FAIL";})?"FAIL":is.length?"WARN":"OK",issues:is};
}

async function generateAnchors(slug,cn,gj){
  var is=[],od=JSON.parse(JSON.stringify(gj));
  if(!od.data)od={data:{lines:od.lines||od}};
  var ls=(od.data&&od.data.lines)||od.lines||[],ta=0,zs=0,sc=0,c2=cf(slug);
  console.log("  Anchors: " + ls.length + " lines...");
  for(var li=0;li<ls.length;li++){
    var l=ls[li];if(!l.stations||l.stations.length<2)continue;
    process.stdout.write("    ["+(li+1)+"/"+ls.length+"] "+(l.id||l.name||li)+"... ");
    try{await amap.rateLimit();var bls=await amap.busLineSearch(l.name||cn+"m",cn);var er=amap.electBusLine(bls,c2,l.stations,tr.haversineKm);if(er.line&&er.line.polyline){var pl=er.line.polyline.split(";").map(function(p){var ps=p.split(",");return {lng:+ps[0],lat:+ps[1]};});if(pl.length>4){if(l.stations&&l.stations.length>=2&&l.stations[0].lat){var f2p=0,l2p=0;for(var di=0;di<Math.min(pl.length,10);di++){f2p+=tr.approximateM(l.stations[0],pl[di]);l2p+=tr.approximateM(l.stations[l.stations.length-1],pl[pl.length-1-di]);}if(f2p>l2p)pl.reverse();}var mt=tr.matchStationsToPolyline(l.stations,pl);if(mt&&mt.length>=2){tr.fixCollapsedCoords(l.stations,pl,mt);l.segmentAnchors=tr.anchorsFromMatch(l.stations,pl,mt,!!(l.isRing||l.ring));tr.snapStations(l.stations,mt,pl);console.log((er.score||"ok")+(l.segmentAnchors?l.segmentAnchors.length+"s":"0s"));}else console.log("nomatch");}else console.log("shortpl");}else console.log("nopoly");}catch(e){console.log("FAIL");is.push({severity:"WARN",code:"E010",msg:cn+" "+(l.id||"")+" fail: "+e.message,detail:{}});}
    if(l.segmentAnchors){for(var a=0;a<l.segmentAnchors.length;a++){if(l.segmentAnchors[a]&&l.segmentAnchors[a].length>0)ta+=l.segmentAnchors[a].length;else zs++;sc++;}}
    if(l.segmentAnchors&&l.segmentAnchors.length>0&&l.stations.length>=2){for(var s2=0;s2<l.segmentAnchors.length;s2++){if(!l.segmentAnchors[s2]||!l.segmentAnchors[s2].length){var f=l.stations[s2],t=l.stations[s2+1]||l.stations[s2];if(f&&t){var pts=[];for(var k=1;k<=5;k++)pts.push({lat:f.lat+(t.lat-f.lat)*k/6,lng:f.lng+(t.lng-f.lng)*k/6});l.segmentAnchors[s2]=pts;}}}}
  }
  console.log("  Anchors done: " + ta + " total, " + zs + " zero/" + sc + " segs (" + (sc?(zs/sc*100).toFixed(1):0) + "%)");
  var zr=sc?zs/sc:0;if(zr>0.3)is.push({severity:"WARN",code:"E007",msg:"zr "+(zr*100).toFixed(1)+"%"});if(ta>5000)is.push({severity:"WARN",code:"E008",msg:"ta "+ta+" >5k"});
  return {data:od,meta:{step:"generateAnchors",totalAnchors:ta},health:is.some(function(i){return i.severity==="FAIL";})?"FAIL":is.length?"WARN":"OK",issues:is};
}
function validate(slug,gj){
  var is=[],d=gj.data||gj,ls=d.lines||[],c2=cf(slug),bb=c2.bbox||{};
  var ts=0,ta=0,zs=0,sc=0,cl=[],oos=0,tsi=0;
  if(!ls.length)is.push({severity:"FAIL",code:"E001",msg:"0 lines"});
  for(var i=0;i<ls.length;i++){var l=ls[i],st=l.stations||[];ts+=st.length;if(!st.length)is.push({severity:"FAIL",code:"E005",msg:"empty:"+(l.id||l.name),detail:{}});if(st.length>1){var f=st[0];if(st.every(function(s){return s.lat===f.lat&&s.lng===f.lng;}))cl.push(l.id||l.name);}if(bb.minLat!==undefined)st.forEach(function(s){if(s.lat&&(s.lat<bb.minLat||s.lat>bb.maxLat||s.lng<bb.minLng||s.lng>bb.maxLng))oos++;});for(var t=0;t<st.length-1;t++){if(st[t].isTransfer&&st[t+1].isTransfer){var d2=tr.approximateM(st[t],st[t+1]);if(d2<30&&d2>0)tsi++;}}if(l.segmentAnchors)l.segmentAnchors.forEach(function(seg){if(seg&&seg.length>0)ta+=seg.length;else zs++;sc++;});}
  if(cl.length)is.push({severity:"FAIL",code:"E002",msg:"collapsed:"+cl.join(",")});if(oos)is.push({severity:"WARN",code:"E004",msg:oos+" oob"});var zr=sc?zs/sc:0;if(zr>0.3)is.push({severity:"WARN",code:"E007",msg:"zr "+(zr*100).toFixed(1)+"%"});if(ta>5000)is.push({severity:"WARN",code:"E008",msg:"ta "+ta});if(tsi)is.push({severity:"WARN",code:"E009",msg:tsi+" xfer <30m"});
  return {health:is.some(function(i){return i.severity==="FAIL";})?"FAIL":is.length?"WARN":"OK",stats:{lines:ls.length,stations:ts,totalAnchors:ta,zeroAnchorSegments:zs,zeroAnchorRatio:zr,collapsedLines:cl,outOfBboxStations:oos,transferSeparationIssues:tsi},issues:is};
}

async function runPipeline(slug,cn,op){
  op=op||{};var t0=Date.now(),f=!!op.force,sn=op.step||null,rs=op.resume||null,vo=op.validate||false,af=ap(slug);
  if(!f&&!sn&&!rs&&!vo&&fs.existsSync(af)){amap.ensureDir(p.dirname(amap.downloadPath("")));fs.copyFileSync(af,amap.downloadPath(slug+"_m.json"));return {success:true,health:"OK",tier:"P0",steps:[],stats:{elapsed:((Date.now()-t0)/1000).toFixed(1)}};}
  if(vo){if(fs.existsSync(af)){var gjd=amap.readJSON(af,0);var vr=validate(slug,gjd);return {success:vr.health!=="FAIL",health:vr.health,tier:"VAL",validate:vr,steps:[],stats:{elapsed:((Date.now()-t0)/1000).toFixed(1)}};}return {success:false,health:"FAIL",tier:"VAL",validate:{health:"FAIL",issues:[{severity:"FAIL",code:"E001",msg:"no archive"}]},steps:[],stats:{elapsed:"0"}};}
  var steps=[{n:"fetchLines",fn:function(){return fetchLines(slug,cn);}},{n:"fetchCoords",fn:function(pr){return fetchCoords(slug,cn,pr.data);}},{n:"detectBranches",fn:function(pr){return detectBranches(slug,pr.data);}},{n:"buildReference",fn:function(pr){return buildReference(slug,pr.data);}},{n:"buildGameJson",fn:function(pr){return buildGameJson(slug,pr.data);}},{n:"generateAnchors",fn:function(pr){return generateAnchors(slug,cn,pr.data);}}];
  var sr=[],pr=null,si=0;
  if(sn){var fd=false;for(var i=0;i<steps.length;i++){if(steps[i].n===sn){si=i;fd=true;break;}}if(!fd)return {success:false,health:"FAIL",tier:"ERR",steps:[],stats:{elapsed:"0"},error:"unknown step:"+sn};}else if(rs){var fdr=false;for(var i=0;i<steps.length;i++){if(steps[i].n===rs){si=i;fdr=true;break;}var c=rc(slug,steps[i].n);if(c){sr.push({data:c,meta:{step:steps[i].n,cached:true},health:"OK",issues:[]});pr={data:c};}else return {success:false,health:"FAIL",tier:"ERR",steps:sr,stats:{elapsed:"0"},error:"no cache:"+steps[i].n};}if(!fdr)return {success:false,health:"FAIL",tier:"ERR",steps:sr,stats:{elapsed:"0"},error:"unknown step:"+rs};}if(sn&&si>0){var psc=rc(slug,steps[si-1].n);if(psc){sr.push({data:psc,meta:{step:steps[si-1].n,cached:true},health:"OK",issues:[]});pr={data:psc};}}
  if(si===0&&!f&&!sn&&!rs){var lr=sp("references",slug+"_lines.json");var p1=rc(slug,"fetchLines");if(!p1&&fs.existsSync(lr)){var ld=amap.readJSON(lr,0);if(ld){var cl2={lines:[]};Object.entries(ld).forEach(function(e){cl2.lines.push({num:e[1].line,name:e[1].name,color:e[1].color,stations:(e[1].stations||[]).map(function(s){return {name:s,slug:""};}),isRing:!!e[1].ring});});p1={lines:cl2.lines};wc(slug,"fetchLines",p1);}}if(p1){var rc2=rc(slug,"fetchCoords");if(rc2){sr.push({data:p1,meta:{step:"fetchLines",cached:true},health:"OK",issues:[]});sr.push({data:rc2,meta:{step:"fetchCoords",cached:true},health:"OK",issues:[]});pr={data:rc2};si=2;}else{sr.push({data:p1,meta:{step:"fetchLines",cached:true},health:"OK",issues:[]});pr={data:p1};si=1;}}}
  for(var si2=si;si2<steps.length;si2++){if(sn&&si2>si)break;var res;try{res=await steps[si2].fn(pr);}catch(e){res={data:null,meta:{step:steps[si2].n},health:"FAIL",issues:[{severity:"FAIL",code:"E000",msg:e.message}]};}sr.push(res);pr=res;if(res.data!==null&&res.data!==undefined)wc(slug,steps[si2].n,res.data);if(res.health==="FAIL"){console.log("Step "+steps[si2].n+" FAIL:");res.issues.forEach(function(ix){console.log("  ["+ix.severity+"] "+ix.msg);});return {success:false,health:"FAIL",tier:sn?"STEP":"ERR",steps:sr,stats:{elapsed:((Date.now()-t0)/1000).toFixed(1)}};}if(res.health==="WARN")res.issues.forEach(function(ix){console.warn("  [WARN] "+ix.msg);});}
  var fd2=pr?pr.data:null;
  if(fd2&&!sn){amap.ensureDir(p.dirname(af));var cv=tr.validateContract(fd2);if(!cv.valid)return {success:false,health:"FAIL",tier:"ERR",steps:sr,stats:{elapsed:((Date.now()-t0)/1000).toFixed(1)},error:"CV fail:"+cv.errors.join(";")};console.log("WRITING archive: "+af+" size="+JSON.stringify(fd2).length);fs.writeFileSync(af,JSON.stringify(fd2,null,2),"utf8");console.log("WRITING download");fs.writeFileSync(amap.downloadPath(slug+"_m.json"),JSON.stringify(fd2,null,2),"utf8");console.log("WRITE DONE");}
  var fv=(fd2&&!sn)?validate(slug,fd2):null;
  var rh=sr.some(function(r){return r.health==="FAIL";})?"FAIL":sr.some(function(r){return r.health==="WARN";})?"WARN":"OK";
  return {success:rh!=="FAIL",health:rh,tier:sn?"STEP":rs?"RESUME":"P2",steps:sr,validate:fv,stats:{elapsed:((Date.now()-t0)/1000).toFixed(1),lines:fd2&&fd2.data&&fd2.data.lineCounter,stations:fv?fv.stats.stations:null}};
}

module.exports={fetchLines,fetchCoords,detectBranches,buildReference,buildGameJson,generateAnchors,validate,runPipeline};
