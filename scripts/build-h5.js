#!/usr/bin/env node
/**
 * uni-app H5 构建包装脚本。
 *
 * 为什么需要它：
 *   uni 的 easycom 在生成自定义组件路径时使用 path.join(UNI_INPUT_DIR, 组件相对路径)，
 *   若 UNI_INPUT_DIR 是相对路径（如 "."），产物会是 "uni_modules/xxx" 这类没有 "./" 前缀的
 *   裸路径，Rollup 无法解析。因此这里始终以「绝对路径」注入 UNI_INPUT_DIR / UNI_OUTPUT_DIR。
 *
 * 使用方式：
 *   node scripts/build-h5.js build   # 生产构建，产物 -> unpackage/dist/build/h5
 *   node scripts/build-h5.js dev     # 本地开发服务
 */
const path = require('path')
const fs = require('fs')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const MODE = process.argv[2] === 'dev' ? 'dev' : 'build'
const CLI = path.join(ROOT, 'node_modules', '@dcloudio', 'vite-plugin-uni', 'bin', 'uni.js')

if (!fs.existsSync(CLI)) {
  console.error('[build:h5] 未找到 uni CLI：' + CLI)
  console.error('[build:h5] 请先在本目录执行：npm install')
  process.exit(1)
}

const env = Object.assign({}, process.env, {
  UNI_INPUT_DIR: ROOT,
  UNI_OUTPUT_DIR: path.join(ROOT, 'unpackage', 'dist', 'build', 'h5')
})

const args = MODE === 'dev' ? [CLI] : [CLI, 'build']
args.push('-p', 'h5')

console.log('[build:h5] 模式=' + MODE + ' 输入=' + env.UNI_INPUT_DIR + ' 输出=' + env.UNI_OUTPUT_DIR)

const res = spawnSync(process.execPath, args, { cwd: ROOT, env, stdio: 'inherit' })
if (res.error) {
  console.error('[build:h5] 启动失败：' + res.error.message)
  process.exit(1)
}
process.exit(res.status === null ? 1 : res.status)
