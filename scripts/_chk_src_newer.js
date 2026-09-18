// 检查 ywj H5 源码是否有比双壳产物(2026-09-17 16:30:41)更新的修改
const fs = require('fs');
const path = require('path');

const ROOT = 'c:/Users/Administrator/Desktop/ywj';
const REF = new Date('2026-09-17T16:30:41').getTime();
const EXCLUDE_DIRS = new Set(['node_modules', 'unpackage', 'shell-android', 'shell-ios', '.toolchain', '.hbuilderx', 'scripts', 'download', '证书', 'nativeplugins', '.git', '.npm-cache', '_tmp_www_test', '_brand_tools', '_tmp_apk_sig', '_tmp_extract', 'backend-vip-php']);
const EXTS = new Set(['.vue', '.js', '.json', '.scss', '.css', '.html']);
const SKIP_FILES = new Set(['package-lock.json', 'project.private.config.json']);

const newer = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name) || e.name.startsWith('_tmp') || e.name.startsWith('.')) continue;
      walk(path.join(dir, e.name));
    } else {
      const ext = path.extname(e.name).toLowerCase();
      if (!EXTS.has(ext) || SKIP_FILES.has(e.name) || e.name.includes('.min.')) continue;
      const p = path.join(dir, e.name);
      const t = fs.statSync(p).mtimeMs;
      if (t > REF) newer.push([new Date(t).toISOString(), p.replace(ROOT + '/', '')]);
    }
  }
}
walk(ROOT);
newer.sort((a, b) => b[0].localeCompare(a[0]));
console.log('基准(双壳产物同步时间):', new Date(REF).toISOString());
console.log('比产物新的源码文件数:', newer.length);
for (const [t, f] of newer.slice(0, 20)) console.log(' ', t, f);
