/**
 * 统一 HTTP 入口（跨端）。
 * =====================================================================
 * 背景：业务后端（xy.yefiot.com）未返回 CORS 允许头。uni-app 原生端走 plus.net
 *       不受同源策略限制，但 H5 在 WebView 内走 XHR，会被浏览器 CORS 拦截
 *       （net::ERR_FAILED），导致登录/注册/验证码等全部接口失败。
 *
 * 策略：
 *   - H5 且运行在原生壳内（window.NativeBridge 存在）：改由原生 OkHttp / URLSession
 *     发起请求，彻底绕开同源策略；
 *   - 其余环境（普通浏览器 / APP-PLUS / 小程序）：回退到 uni.request / uni.uploadFile。
 *
 * 用法与 uni.request / uni.uploadFile 完全一致（success / fail / complete 回调）。
 */

// 注意：仅在 H5 引入桥接层，避免在 APP/小程序构建中误装 uni.* shim。
// #ifdef H5
import { isNativeShell, NativeApp } from '@/utils/h5-native-bridge'
// #endif

/** 兼容 uni.request 的 HTTP 请求封装 */
export function httpRequest(options = {}) {
  const { success, fail, complete } = options
  const done = () => { if (typeof complete === 'function') complete() }

  // #ifdef H5
  if (isNativeShell) {
    NativeApp.request(options).then(
      (res) => { if (typeof success === 'function') success(res) },
      (err) => { if (typeof fail === 'function') fail(err) }
    ).finally(done)
    return
  }
  // #endif

  uni.request(Object.assign({}, options, {
    success: (res) => { if (typeof success === 'function') success(res) },
    fail: (err) => { if (typeof fail === 'function') fail(err) },
    complete: done
  }))
}

/** 兼容 uni.uploadFile 的文件上传封装 */
export function httpUpload(options = {}) {
  const { success, fail, complete } = options
  const done = () => { if (typeof complete === 'function') complete() }

  // #ifdef H5
  if (isNativeShell) {
    nativeUpload(options).then(
      (res) => { if (typeof success === 'function') success(res) },
      (err) => { if (typeof fail === 'function') fail(err) }
    ).finally(done)
    return
  }
  // #endif

  uni.uploadFile(Object.assign({}, options, {
    success: (res) => { if (typeof success === 'function') success(res) },
    fail: (err) => { if (typeof fail === 'function') fail(err) },
    complete: done
  }))
}

// #ifdef H5
/** 把 filePath（blob:/data: 等）读成 base64，交给原生做 multipart 上传 */
async function nativeUpload(options) {
  const { url, filePath, name = 'file', formData = {} } = options
  const resp = await fetch(filePath)
  const blob = await resp.blob()
  const base64 = await blobToBase64(blob)
  return NativeApp.upload({
    url,
    name,
    fileName: (blob && blob.name) || options.fileName || ('upload_' + Date.now()),
    mimeType: blob.type || 'application/octet-stream',
    fileBase64: base64,
    formData
  })
}

/** Blob -> base64（去掉 dataURL 前缀） */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader()
      reader.onload = () => {
        const s = String(reader.result || '')
        const i = s.indexOf(',')
        resolve(i >= 0 ? s.slice(i + 1) : '')
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    } catch (e) {
      reject(e)
    }
  })
}
// #endif

export default { httpRequest, httpUpload }
