/**
 * _cdp.js —— 通过 WebView 远程调试端在壳内 H5 页面执行 JS（调试用）
 *
 * 前置步骤（真机已通过 USB 连接、App 已打开）：
 *   1. adb -s <序列号> shell cat /proc/net/unix | findstr webview_devtools   # 找到 socket 名
 *   2. adb -s <序列号> forward tcp:9222 localabstract:webview_devtools_remote_<pid>
 *
 * 用法：
 *   node scripts/_cdp.js "<js 表达式>"          # 执行表达式并打印结果
 *   node scripts/_cdp.js --file <path>          # 执行文件中的 JS（探针注入用）
 *   node scripts/_cdp.js --list                 # 列出可调试页面
 *
 * 示例：
 *   node scripts/_cdp.js "location.href"
 *   node scripts/_cdp.js "JSON.stringify({n: document.querySelectorAll('taku-banner').length})"
 *   node scripts/_cdp.js "uni.navigateTo({url:'/workbench_package/pages/door-list/index'})"
 */
const http = require('http')

const PORT = process.env.CDP_PORT || 9222

const getJson = (url) => new Promise((resolve, reject) => {
  http.get(url, (res) => {
    let d = ''
    res.on('data', (c) => (d += c))
    res.on('end', () => {
      try { resolve(JSON.parse(d)) } catch (e) { reject(e) }
    })
  }).on('error', reject)
})

const main = async () => {
  let arg = process.argv.slice(2).join(' ').trim()
  if (!arg) {
    console.error('usage: node scripts/_cdp.js "<expression>" | --file <path> | --list')
    process.exit(1)
  }
  if (arg.startsWith('--file')) {
    const file = process.argv[3]
    if (!file) {
      console.error('usage: node scripts/_cdp.js --file <path>')
      process.exit(1)
    }
    arg = require('fs').readFileSync(file, 'utf8')
  }
  const list = await getJson(`http://localhost:${PORT}/json`)
  if (arg === '--list') {
    console.log(JSON.stringify(list.map((t) => ({ id: t.id, type: t.type, title: t.title, url: (t.url || '').slice(0, 120) })), null, 2))
    return
  }
  const page = list.find((t) => t.type === 'page') || list[0]
  if (!page || !page.webSocketDebuggerUrl) {
    console.error('no debuggable page target found')
    process.exit(2)
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  const timer = setTimeout(() => { console.error('CDP timeout'); process.exit(4) }, 20000)
  ws.onopen = () => {
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression: arg, returnByValue: true, awaitPromise: true, userGesture: true }
    }))
  }
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id !== 1) return
    clearTimeout(timer)
    if (msg.error) {
      console.error('CDP error:', JSON.stringify(msg.error, null, 2))
      process.exit(3)
    }
    const result = msg.result || {}
    if (result.exceptionDetails) {
      console.error('EXCEPTION:', JSON.stringify(result.exceptionDetails, null, 2))
      process.exit(5)
    }
    const r = result.result
    console.log('RESULT:', JSON.stringify(r && Object.prototype.hasOwnProperty.call(r, 'value') ? r.value : r, null, 2))
    try { ws.close() } catch (e) {}
    process.exit(0)
  }
  ws.onerror = (e) => {
    clearTimeout(timer)
    console.error('ws error:', (e && (e.message || e.error)) || e)
    process.exit(6)
  }
}

main().catch((e) => { console.error('fatal:', e && e.message ? e.message : e); process.exit(9) })
