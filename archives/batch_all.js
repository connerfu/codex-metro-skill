const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const nodeExe = process.env.USERPROFILE + '\\codex-node\\node.exe';
const skillDir = 'C:/Users/Conner/Documents/New project/codex-metro-skill';
const dlDir = process.env.USERPROFILE + '\\Downloads';
const arDir = skillDir + '\\archives';

const cities = [
    {slug:'shenzhen',name:'\u6DF1\u5733'},{slug:'chengdu',name:'\u6210\u90FD'},{slug:'chongqing',name:'\u91CD\u5E86'},
    {slug:'hangzhou',name:'\u676D\u5DDE'},{slug:'nanjing',name:'\u5357\u4EAC'},{slug:'tianjin',name:'\u5929\u6D25'},
    {slug:'wuhan',name:'\u6B66\u6C49'},{slug:'shenyang',name:'\u6C88\u9633'},{slug:'changchun',name:'\u957F\u6625'},
    {slug:'xian',name:'\u897F\u5B89'},{slug:'zhengzhou',name:'\u90D1\u5DDE'},{slug:'qingdao',name:'\u9752\u5C9B'},
    {slug:'suzhou',name:'\u82CF\u5DDE'},{slug:'wuxi',name:'\u65E0\u9521'},{slug:'xiamen',name:'\u53A6\u95E8'},
    {slug:'dalian',name:'\u5927\u8FDE'},{slug:'dongguan',name:'\u4E1C\u839E'},{slug:'nanning',name:'\u5357\u5B81'},
];

function run(cmd) {
    try { return execSync(cmd, {cwd:skillDir,timeout:180000,encoding:'utf8',maxBuffer:4*1024*1024}); }
    catch(e) { return e.stderr || e.message; }
}

var t0 = Date.now();
for (var ci = 0; ci < cities.length; ci++) {
    var c = cities[ci];
    var f = dlDir + '/' + c.slug + '_metro.json';
    
    // Check if already has anchors (file > 300KB suggests anchors present)
    var skip = false;
    try { if (fs.statSync(f).size > 300000) { skip = true; } } catch(e) {}
    
    if (skip) {
        console.log('SKIP ' + c.name + ' (already ' + (fs.statSync(f).size/1024).toFixed(0) + 'KB)');
        continue;
    }
    
    console.log('\n=== [' + (ci+1) + '/' + cities.length + '] ' + c.name + ' ===');
    var ts = Date.now();
    
    // Scrape
    var out = run('"' + nodeExe + '" "' + skillDir + '/metro_scraper.js" ' + c.slug + ' "' + c.name + '"');
    console.log('Scraper: ' + ((Date.now()-ts)/1000).toFixed(1) + 's');
    
    // Post-process (anchors + transfers + names + split)
    ts = Date.now();
    out = run('"' + nodeExe + '" "' + skillDir + '/post_process.js" ' + c.slug + ' "' + c.name + '"');
    console.log('Post: ' + ((Date.now()-ts)/1000).toFixed(1) + 's');
    
    // Copy to archives
    try {
        fs.copyFileSync(f, arDir + '/' + c.slug + '_metro.json');
        var kb = (fs.statSync(f).size / 1024).toFixed(0);
        console.log('  -> archived (' + kb + 'KB)');
    } catch(e) { console.log('  -> archive FAILED: ' + e.message); }
}

console.log('\n=== ALL DONE in ' + ((Date.now()-t0)/1000/60).toFixed(1) + 'min ===');