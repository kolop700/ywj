// 深入核验：my 页面 H5 分支与 WX_MINI_PROGRAM 配置在产物中的留存情况
const fs = require('fs')
const path = require('path')

const roots = [
  'unpackage/dist/build/h5',
  'shell-android/app/src/main/assets/www'
]
const keys = [
  'gh_67863dc191ba',
  'fromApp=1',
  '未配置微信开放平台',
  'manageModule/pages/adminLogin',
  '管理员登录',
  'miniprogram.launch'
]

for (const r of roots) {
  console.log('==== ' + r + ' ====')
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(js|html)$/.test(e.name)) {
        const c = fs.readFileSync(p, 'utf8')
        const hits = keys.filter((k) => c.includes(k))
        if (hits.length) console.log(' ', p.replace(/\\/g, '/'), '=>', hits.join(' , '))
      }
    }
  }
  walk(r)
}
