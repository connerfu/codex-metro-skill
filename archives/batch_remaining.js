const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const nodeExe = process.env.USERPROFILE + '\\codex-node\\node.exe';
const skillDir = 'C:/Users/Conner/Documents/New project/codex-metro-skill';
const dlDir = process.env.USERPROFILE + '\\Downloads';
const arDir = skillDir + '\\archives';

const remaining = [
    {slug:'hangzhou',name:'\u676D\u5DDE'},{slug:'nanjing',name:'\u5357\u4EAC'},{slug:'wuhan',name:'\u6B66\u6C49'},
    {slug:'shenyang',name:'\u6C88\u9633'},{slug:'changchun',name:'\u957F\u6625'},{slug:'xian',name:'\u897F\u5B89'},
    {slug:'zhengzhou',name:'\u90D1\u5DDE'},{slug:'qingdao',name:'\u9752\u5C9B'},{slug:'suzhou',name:'\u82CF\u5DDE'},
    {slug:'wuxi',name:'\u65E0\u9521'},{slug:'xiamen',name:'\u53A6\u95E8'},{slug:'dalian',name:'\u5927\u8FDE'},
    {slug:'dongguan',name:'\u4E1C\u839E'},{slug:'nanning',name:'\u5357\u5B81'},
];

function run(cmd, timeout) {
    try { return execSync(cmd, {cwd:skillDir,timeout:timeout||120000,encoding:'utf8',maxBuffer:4*1024*1024}); }
    catch(e) { return 'ERR: ' + (e.stderr||e.message).substring(0,200); }
}

for (var ci = 0; ci < remaining.length; ci++) {
    var c = remaining[ci];
    var f = dlDir + '/' + c.slug + '_metro.json';
    
    // Check if already has anchors (>300KB)
    try {
        if (fs.statSync(f).size > 300000) {
            console.log('SKIP ' + c.name + ' (already ' + (fs.statSync(f).size/1024).toFixed(0) + 'KB)');
            continue;
        }
    } catch(e) {}
    
    console.log('\n=== [' + (ci+1) + '/' + remaining.length + '] ' + c.name + ' ===');
    var ts = Date.now();
    
    // Scrape
    var out = run('"' + nodeExe + '" "' + skillDir + '/metro_scraper.js" ' + c.slug + ' "' + c.name + '"', 180000);
    console.log('  Scraper: ' + ((Date.now()-ts)/1000).toFixed(1) + 's');
    
    // Post-process
    ts = Date.now();
    var res = run('"' + nodeExe + '" "' + skillDir + '/post_process.js" ' + c.slug + ' "' + c.name + '"', 180000);
    console.log('  Post: ' + ((Date.now()-ts)/1000).toFixed(1) + 's');
    
    // Check result
    try {
        var kb = (fs.statSync(f).size/1024).toFixed(0);
        fs.copyFileSync(f, arDir + '/' + c.slug + '_metro.json');
        console.log('  -> ' + kb + 'KB archived');
    } catch(e) { console.log('  -> FAIL: ' + e.message); }
}

console.log('\n=== REMAINING DONE ===');