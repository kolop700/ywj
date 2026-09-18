#!/usr/bin/env node
/**
 * Android 壳一键构建脚本。
 *
 * 背景：本机未安装系统级 JDK / Android SDK，采用「工作区内便携式工具链」，
 *       全程不写系统目录、无需管理员权限：
 *   - JDK   ：复用 HBuilderX 自带 Amazon Corretto 17
 *   - SDK   ：.toolchain/android-sdk（platform-tools / platforms;android-34 / build-tools;34.0.0）
 *   - Gradle：.toolchain/gradle-home（缓存全部落在仓库内）
 *
 * 前置：先执行 npm run sync:h5，确保 assets/www 是最新 H5 产物。
 *
 * 用法：
 *   node scripts/build-android.js            # 调试包 assembleDebug
 *   node scripts/build-android.js release    # 正式包 assembleRelease（需先配置签名）
 */
const path = require('path')
const fs = require('fs')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const SHELL = path.join(ROOT, 'shell-android')
const GRADLEW = path.join(SHELL, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')
const TASK = process.argv[2] === 'release' ? 'assembleRelease' : 'assembleDebug'

// 1) 定位 JDK 17：优先环境变量，其次复用 HBuilderX 自带 Corretto
const CANDIDATE_JDKS = [
  process.env.JAVA_HOME,
  'C:\\Program Files (x86)\\HBuilder X\\plugins\\amazon-corretto',
  'C:\\Program Files\\Java\\jdk-17'
].filter(Boolean)

const javaHome = CANDIDATE_JDKS.find((p) => fs.existsSync(path.join(p, 'bin', 'java.exe')))
if (!javaHome) {
  console.error('[build:android] 未找到 JDK 17。请设置 JAVA_HOME，或安装 HBuilderX。')
  process.exit(1)
}

// 2) SDK 与 Gradle 缓存均落在工作区内，避免写用户目录
const sdkDir = path.join(ROOT, '.toolchain', 'android-sdk')
const env = Object.assign({}, process.env, {
  JAVA_HOME: javaHome,
  ANDROID_HOME: sdkDir,
  ANDROID_SDK_ROOT: sdkDir,
  GRADLE_USER_HOME: path.join(ROOT, '.toolchain', 'gradle-home')
})

console.log('[build:android] JDK=' + javaHome)
console.log('[build:android] SDK=' + sdkDir)
console.log('[build:android] 任务=' + TASK)

const res = spawnSync(GRADLEW, ['-p', SHELL, TASK, '--no-daemon'], {
  cwd: ROOT,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32'
})
if (res.error) {
  console.error('[build:android] 启动失败：' + res.error.message)
  process.exit(1)
}
process.exit(res.status === null ? 1 : res.status)
