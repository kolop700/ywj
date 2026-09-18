const fs = require('fs');
const path = require('path');

const root = 'c:/Users/Administrator/Desktop/ywjxcx';
const skip = new Set(['node_modules', 'miniprogram_npm', '.git', 'unpackage']);

function dirSize(dir) {
  let total = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (skip.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) total += dirSize(p);
    else total += fs.statSync(p).size;
  }
  return total;
}

const kb = (n) => (n / 1024).toFixed(0) + 'KB';
// main package estimate: everything except subpackages & dev-only dirs
const dirs = fs.readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
let mainPkg = 0;
for (const d of dirs) {
  if (skip.has(d) || d === 'manageModule' || d === 'miniapp') continue;
  mainPkg += dirSize(path.join(root, d));
}
// root-level files (non-dir) belong to main package
for (const f of fs.readdirSync(root, { withFileTypes: true })) {
  if (f.isDirectory() || skip.has(f.name)) continue;
  mainPkg += fs.statSync(path.join(root, f.name)).size;
}
const sub = dirSize(path.join(root, 'manageModule'));
console.log('main package (est):', kb(mainPkg));
console.log('subpackage manageModule:', kb(sub));
console.log('total:', kb(mainPkg + sub));
// biggest files in main package
const big = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else big.push([p.replace(root + '/', ''), fs.statSync(p).size]);
  }
}
walk(root);
big.sort((a, b) => b[1] - a[1]);
console.log('\nTop 12 largest files:');
for (const [f, s] of big.slice(0, 12)) console.log(' ', kb(s).padStart(8), f);
