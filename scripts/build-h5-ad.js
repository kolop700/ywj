#!/usr/bin/env node
/**
 * 云卫家(operations-ad) H5 构建包装脚本。
 * 复用主工程根目录的 node_modules（@dcloudio/vite-plugin-uni 等），
 * 但把 UNI_INPUT_DIR 指向 operations-ad/frontend，产物输出到该前端工程自己的 unpackage。
 *
 *   node scripts/build-h5-ad.js          # 生产构建 -> operations-ad/frontend/unpackage/dist/build/web
 */
const path = require('path')
const fs = require('fs')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')                     // ywj 主工程根(含 node_modules)
const FRONTEND = path.join(ROOT, 'operations-ad', 'frontend')  // uni 输入目录
const CLI = path.join(ROOT, 'node_modules', '@dcloudio', 'vite-plugin-uni', 'bin', 'uni.js')

if (!fs.existsSync(CLI)) {
  console.error('[build:h5:ad] 未找到 uni CLI：' + CLI + '\n请先在工程根执行 npm install')
  process.exit(1)
}

const env = Object.assign({}, process.env, {
  UNI_PLATFORM: 'h5',
  NODE_ENV: 'production',
  UNI_INPUT_DIR: FRONTEND,
  UNI_OUTPUT_DIR: path.join(FRONTEND, 'unpackage', 'dist', 'build', 'web')
})

console.log('[build:h5:ad] 输入=' + env.UNI_INPUT_DIR + '\n[build:h5:ad] 输出=' + env.UNI_OUTPUT_DIR)

const res = spawnSync(process.execPath, [CLI, 'build', '-p', 'h5'], { cwd: FRONTEND, env, stdio: 'inherit' })
if (res.error) {
  console.error('[build:h5:ad] 启动失败：' + res.error.message)
  process.exit(1)
}
process.exit(res.status === null ? 1 : res.status)
