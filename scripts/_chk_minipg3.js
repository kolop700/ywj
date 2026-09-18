// 提取 my chunk 中管理员登录 H5 分支的生成代码片段
const fs = require('fs')
const path = require('path')

const dir = 'unpackage/dist/build/h5/assets'
const f = fs.readdirSync(dir).find((n) => n.includes('workbench_package-pages-my-index'))
const c = fs.readFileSync(path.join(dir, f), 'utf8')
const idx = c.indexOf('wxtmpverify00000001')
console.log('file:', f, '| size:', c.length, '| found at:', idx)
if (idx >= 0) {
  console.log('---- 片段开始 ----')
  console.log(c.slice(Math.max(0, idx - 900), idx + 900))
  console.log('---- 片段结束 ----')
}
