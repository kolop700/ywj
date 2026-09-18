#!/usr/bin/env node
/**
 * 本地静态服务器：在普通浏览器中预览 H5 构建产物。
 *
 * 用于验证「无原生壳」时桥接层能否安全降级（页面正常渲染、不白屏）。
 * 原生能力（蓝牙/扫码/广告等）在普通浏览器中会按设计失败，属预期行为。
 *
 * 用法：node scripts/serve-h5.js [port]   默认端口 8080
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const DIR = path.join(ROOT, 'unpackage', 'dist', 'build', 'h5')
const PORT = Number(process.argv[2] || 8080)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8'
}

if (!fs.existsSync(path.join(DIR, 'index.html'))) {
  console.error('[preview:h5] 未找到 H5 产物：' + DIR)
  console.error('[preview:h5] 请先执行：npm run build:h5')
  process.exit(1)
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  if (urlPath === '/') urlPath = '/index.html'
  const file = path.join(DIR, urlPath)
  if (!file.startsWith(DIR)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  const target = (fs.existsSync(file) && fs.statSync(file).isFile()) ? file : path.join(DIR, 'index.html')
  fs.readFile(target, (err, data) => {
    if (err) {
      res.writeHead(404)
      res.end('Not Found')
      return
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream' })
    res.end(data)
  })
})

server.listen(PORT, () => console.log('[preview:h5] http://127.0.0.1:' + PORT))
