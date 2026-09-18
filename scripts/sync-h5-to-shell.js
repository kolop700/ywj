#!/usr/bin/env node
/**
 * 将 uni-app H5 构建产物同步到 Android / iOS 原生壳的本地资源目录。
 *
 * 使用方式：
 *   1) 用 HBuilderX 发行 → 网站-H5手机版（或 CLI: npm run build:h5）
 *      产物默认输出到：unpackage/dist/build/h5
 *   2) 执行：npm run sync:h5
 *
 * 说明：脚本会先清空壳内 www / WebApp 目录再复制，确保不残留旧版本资源。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'unpackage', 'dist', 'build', 'h5')

// 各壳的本地资源目录（root 用于判断壳工程是否存在，dir 为产物落地目录）
const TARGETS = [
  {
    name: 'Android',
    root: path.join(ROOT, 'shell-android'),
    dir: path.join(ROOT, 'shell-android', 'app', 'src', 'main', 'assets', 'www')
  },
  {
    name: 'iOS',
    root: path.join(ROOT, 'shell-ios'),
    dir: path.join(ROOT, 'shell-ios', 'CloudGuard', 'WebApp')
  }
]

function rmDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  let count = 0
  for (const entry of entries) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      count += copyDir(s, d)
    } else {
      fs.copyFileSync(s, d)
      count++
    }
  }
  return count
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('[sync:h5] 未找到 H5 构建产物：' + SRC)
    console.error('[sync:h5] 请先用 HBuilderX「发行 → 网站-H5手机版」构建，或执行 npm run build:h5')
    process.exit(1)
  }

  const indexPath = path.join(SRC, 'index.html')
  if (!fs.existsSync(indexPath)) {
    console.error('[sync:h5] 产物目录缺少 index.html，构建可能未完成：' + SRC)
    process.exit(1)
  }

  console.log('[sync:h5] 源目录：' + SRC)

  for (const target of TARGETS) {
    if (!fs.existsSync(target.root)) {
      console.warn('[sync:h5] 跳过 ' + target.name + '：壳工程目录不存在（' + target.root + '）')
      continue
    }
    rmDir(target.dir)
    const count = copyDir(SRC, target.dir)
    console.log('[sync:h5] -> ' + target.name + ' 完成，共同步 ' + count + ' 个文件到 ' + target.dir)
  }

  console.log('[sync:h5] 全部完成。请重新构建壳工程（Android: Gradle；iOS: Xcode）。')
}

main()
