// 最终核验：构建目录 / Android www / iOS WebApp 三处产物一致性 + 关键桥代码
const fs = require('fs')
const path = require('path')

const roots = [
  'unpackage/dist/build/h5',
  'shell-android/app/src/main/assets/www',
  'shell-ios/CloudGuard/WebApp'
]
const keys = ['miniprogram.launch', 'launchMiniProgram', 'wx4c80533df6184dda', 'gh_67863dc191ba', 'manageModule/pages/adminLogin', 'taku_user_id']

const lists = []
for (const r of roots) {
  const hit = {}
  const assetNames = []
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(js|html|css)$/.test(e.name)) {
        assetNames.push(path.relative(r, p).replace(/\\/g, '/'))
        const c = fs.readFileSync(p, 'utf8')
        for (const k of keys) if (c.includes(k)) hit[k] = (hit[k] || 0) + 1
      }
    }
  }
  walk(r)
  assetNames.sort()
  lists.push(assetNames.join('|'))
  console.log(r)
  console.log('  文件数:', assetNames.length, '| 关键命中:', JSON.stringify(hit))
}

console.log('三目录文件清单一致:', lists[0] === lists[1] && lists[0] === lists[2])

// 额外：my chunk 应含完整跳转逻辑（appId 已填，不再被构建优化移除）
const dir = 'unpackage/dist/build/h5/assets'
const f = fs.readdirSync(dir).find((n) => n.includes('workbench_package-pages-my-index'))
const c = fs.readFileSync(path.join(dir, f), 'utf8')
console.log('my chunk:', f)
console.log('  含 appId:', c.includes('wx4c80533df6184dda'), '| 含 gh_:', c.includes('gh_67863dc191ba'), '| 含 manageModule:', c.includes('manageModule/pages/adminLogin'), '| 含 bridge 调用 launchMiniProgram:', c.includes('launchMiniProgram'))
