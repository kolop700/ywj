/**
 * 调试工具：在构建产物/文本文件中查找关键字并输出上下文
 * 用法: node scripts/_scan.js <fileOrDir> <needle> [contextLen=200] [maxHits=15]
 *   - fileOrDir 为目录时，自动扫描目录下所有 *.js 文件
 */
const fs = require('fs')
const path = require('path')

const target = process.argv[2]
const needle = process.argv[3]
const ctxLen = parseInt(process.argv[4] || '200', 10)
const maxHits = parseInt(process.argv[5] || '15', 10)

function scanFile(file) {
  const s = fs.readFileSync(file, 'utf8')
  let idx = 0
  let n = 0
  while ((idx = s.indexOf(needle, idx)) >= 0 && n < maxHits) {
    console.log('\n===== ' + file + ' @ ' + idx + ' =====')
    console.log(s.slice(Math.max(0, idx - ctxLen), idx + ctxLen).replace(/\r?\n/g, '\\n'))
    idx += needle.length
    n++
  }
  return n
}

let total = 0
const st = fs.statSync(target)
if (st.isDirectory()) {
  for (const f of fs.readdirSync(target)) {
    if (!f.endsWith('.js')) continue
    total += scanFile(path.join(target, f))
  }
} else {
  total = scanFile(target)
}
console.log('\n[scan] hits shown: ' + total)
