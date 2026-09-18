// Temp local static server for H5 mock test (diagnosis only)
const http = require('http')
const fs = require('fs')
const path = require('path')

const root = 'c:\\Users\\Administrator\\Desktop\\ywj\\_tmp_www_test'
const port = 8899

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
}

http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0])
  if (p === '/' || p === '/index.html') p = '/index-test.html'
  let file = path.join(root, p)
  if (!file.startsWith(root)) { res.writeHead(403); res.end('forbidden'); return }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      if (!path.extname(p)) {
        file = path.join(root, 'index-test.html')
      } else {
        res.writeHead(404); res.end('404 ' + p); return
      }
    }
    fs.readFile(file, (e2, data) => {
      if (e2) { res.writeHead(404); res.end('404'); return }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' })
      res.end(data)
    })
  })
}).listen(port, '127.0.0.1', () => console.log('listening on http://127.0.0.1:' + port))
