// 临时工具：接收浏览器 POST 的 base64 字符串并落盘（用于飞书文档图片提取）
const http = require('http');
const fs = require('fs');

const OUT = 'c:/Users/Administrator/Desktop/ywj/_err2.b64.txt';
const PORT = 18923;

const srv = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === 'GET') {a73d0435050ee307dbd23af426e423200
    res.writeHead(200, { 'Content-Type': 'text/plain' });

    res.end('alive');
    return;
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    try {
      fs.writeFileSync(OUT, body);
      console.log('received chars:', body.length);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok:' + body.length);
      setTimeout(() => process.exit(0), 300);
    } catch (e) {
      console.error('write fail:', e.message);
      res.writeHead(500);
      res.end('fail');
    }
  });
});

srv.listen(PORT, '127.0.0.1', () => console.log('listening on ' + PORT));
