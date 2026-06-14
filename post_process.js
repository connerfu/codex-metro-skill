// post_process.js �?Run anchors + transfers + names in one pass
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const slug = process.argv[2];
const cityName = process.argv[3];
if (!slug || !cityName) { console.log('Usage: post_process.js {slug} {中文名}'); process.exit(1); }

const skillDir = __dirname;
const nodeExe = process.env.USERPROFILE + '\\codex-node\\node.exe';
const file = 'C:/Users/Conner/Downloads/' + slug + '_metro.json';

if (!fs.existsSync(file)) { console.log('File not found: ' + file); process.exit(1); }

const t0 = Date.now();

function run(label, script, args) {
    var ts = Date.now();
    process.stderr.write(label + '...');
    try {
        var out = execSync('"' + nodeExe + '" "' + path.join(skillDir, script) + '" ' + args, {
            cwd: skillDir, timeout: 300000, encoding: 'utf8', maxBuffer: 2*1024*1024
        });
        var elapsed = ((Date.now() - ts) / 1000).toFixed(1);
        console.log(' ' + elapsed + 's');
        process.stderr.write(out.split('\n').slice(-3).join('\n') + '\n');
    } catch(e) {
        console.log(' FAILED');
        console.error(e.stderr || e.message);
    }
}

console.log('\n=== Post-process: ' + cityName + ' ===');
run('Anchors', 'amap_anchors.js', slug + ' "' + cityName + '"');
run('Names', 'fix_names.js', slug);

run('Split', 'split_gapped_lines.js', slug);
var total = ((Date.now() - t0) / 1000).toFixed(1);
var sizeKb = (fs.statSync(file).size / 1024).toFixed(0);
console.log('Done in ' + total + 's | ' + file + ' (' + sizeKb + 'KB)');
