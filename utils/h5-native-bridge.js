/**
 * H5 原生壳桥接层（JS Shim）
 * =====================================================================
 * 作用：uni-app 编译为 H5 后，WebView 中缺失的原生能力（蓝牙/扫码/相机/
 *       保存相册/微信分享/App 更新/广告）由本层补齐，统一转发到自研原生壳。
 *
 * 桥接协议（WebView <-> 原生壳）：
 *   调用： window.NativeBridge.call(method, paramsJson, callbackId)
 *   回传： window.__nativeCallback(callbackId, { code, data, msg })
 *   事件： window.__nativeEmit(eventName, data)
 *     - code === 0 表示成功，其余为失败
 *
 * 仅在 H5 构建中引入（见 main.js 的 #ifdef H5）；APP/小程序端不加载本文件。
 * 浏览器中直接运行时（无原生壳），所有方法安全失败，不影响页面渲染。
 *
 * 方法清单与 uni.* 映射见 utils 顶部注释及《H5原生壳双端方案》文档。
 * =====================================================================
 */

// 原生壳注入的桥对象（Android: @JavascriptInterface / iOS: WKScriptMessageHandler）
const bridge = (typeof window !== 'undefined') ? window.NativeBridge : null

/** 是否运行在原生壳内（false 表示普通浏览器环境） */
export const isNativeShell = !!bridge

if (typeof window !== 'undefined') {
  window.__IS_NATIVE_SHELL__ = isNativeShell
}

// ==================== 回调与事件基础设施 ====================

let cbSeq = 0
const pendingCallbacks = {}

/**
 * 发起一次原生调用（Promise 风格）
 * @param {string} method 桥接方法名
 * @param {Object} params 参数对象
 * @returns {Promise<Object>} resolve 原生返回的 data；reject 失败对象
 */
function invoke(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (!bridge) {
      reject({ code: -1, msg: 'native bridge unavailable (not running in native shell)' })
      return
    }
    const id = 'cb_' + (++cbSeq) + '_' + Date.now()
    pendingCallbacks[id] = { resolve, reject }
    try {
      bridge.call(method, JSON.stringify(params || {}), id)
    } catch (e) {
      delete pendingCallbacks[id]
      reject({ code: -1, msg: 'bridge call exception: ' + (e && e.message) })
    }
  })
}

// 原生回传入口（由原生壳 evaluateJavascript 调用）
if (typeof window !== 'undefined') {
  window.__nativeCallback = function (id, resJson) {
    const pending = pendingCallbacks[id]
    if (!pending) return
    delete pendingCallbacks[id]
    let res = resJson
    if (typeof resJson === 'string') {
      try { res = JSON.parse(resJson) } catch (e) { res = {} }
    }
    res = res || {}
    if (Number(res.code) === 0) {
      pending.resolve(res.data !== undefined ? res.data : res)
    } else {
      pending.reject(res)
    }
  }
}

// 事件监听注册表
const eventListeners = {}

/**
 * 注册原生事件监听
 * @param {string} name 事件名（如 ble.onDeviceFound）
 * @param {Function} fn 回调
 */
function onNativeEvent(name, fn) {
  if (typeof fn !== 'function') return
  if (!eventListeners[name]) eventListeners[name] = []
  eventListeners[name].push(fn)
}

/**
 * 取消原生事件监听
 * @param {string} name 事件名
 * @param {Function} fn 之前注册的函数
 */
function offNativeEvent(name, fn) {
  const list = eventListeners[name]
  if (!list) return
  const idx = list.indexOf(fn)
  if (idx >= 0) list.splice(idx, 1)
}

// 原生事件分发入口（由原生壳调用）
if (typeof window !== 'undefined') {
  window.__nativeEmit = function (name, dataJson) {
    let data = dataJson
    if (typeof dataJson === 'string') {
      try { data = JSON.parse(dataJson) } catch (e) { data = {} }
    }
    const list = eventListeners[name]
    if (!list) return
    list.slice().forEach((fn) => {
      try { fn(data) } catch (e) { console.error('[NativeBridge] listener error:', name, e) }
    })
  }
}

// ==================== 数据转换工具 ====================

/** ArrayBuffer / TypedArray -> base64（蓝牙写入用） */
function arrayBufferToBase64(buffer) {
  if (!buffer) return ''
  let bytes
  if (buffer instanceof ArrayBuffer) bytes = new Uint8Array(buffer)
  else if (ArrayBuffer.isView(buffer)) bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  else if (typeof buffer === 'string') {
    // 已是字符串：按 latin1 处理
    let binary0 = ''
    for (let i = 0; i < buffer.length; i++) binary0 += String.fromCharCode(buffer.charCodeAt(i) & 0xff)
    return (typeof btoa !== 'undefined') ? btoa(binary0) : ''
  } else {
    return ''
  }
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i])
  return (typeof btoa !== 'undefined') ? btoa(binary) : ''
}

/** Blob -> base64（保存相册用，H5 中 canvas 产物常为 blob: URL） */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader()
      reader.onload = () => {
        const result = String(reader.result || '')
        const idx = result.indexOf(',')
        resolve(idx >= 0 ? result.slice(idx + 1) : '')
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    } catch (e) {
      reject(e)
    }
  })
}

/** base64 -> Blob（原生壳返回图片 base64，转为可上传/预览的 Blob） */
function base64ToBlob(base64, mimeType) {
  const mime = mimeType || 'image/jpeg'
  const binary = (typeof atob !== 'undefined') ? atob(base64 || '') : ''
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** data URL -> { base64, mimeType } */
function dataUrlToBase64(dataUrl) {
  const str = String(dataUrl || '')
  const comma = str.indexOf(',')
  const head = comma >= 0 ? str.slice(0, comma) : ''
  const mimeMatch = /data:([^;]+)/.exec(head)
  return {
    base64: comma >= 0 ? str.slice(comma + 1) : '',
    mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg'
  }
}

/** 将任意图片来源（blob:/data:/http(s)）规范为 { base64, mimeType }，失败返回 null */
function normalizeImageToBase64(url) {
  return new Promise((resolve) => {
    const str = String(url || '')
    if (str.indexOf('data:') === 0) {
      resolve(dataUrlToBase64(str))
      return
    }
    if (typeof fetch !== 'function') { resolve(null); return }
    fetch(str).then((r) => r.blob()).then((blob) => {
      blobToBase64(blob).then((base64) => resolve({ base64, mimeType: blob.type || 'image/jpeg' }))
    }).catch(() => resolve(null))
  })
}

/** 按原生产图数据构建 File/tempFile（模拟 H5 uni.chooseImage 返回结构，保证 u-upload/uni.uploadFile 可用） */
function buildTempFileFromImage(img) {
  const mime = (img && img.mimeType) || 'image/jpeg'
  const blob = base64ToBlob(img && img.base64, mime)
  const name = (img && img.name) || ('image_' + Date.now() + (mime.indexOf('png') >= 0 ? '.png' : '.jpg'))
  let file
  try {
    file = new File([blob], name, { type: mime })
  } catch (e) {
    file = blob
  }
  const url = (typeof URL !== 'undefined' && URL.createObjectURL) ? URL.createObjectURL(blob) : ''
  if (file.path === undefined) file.path = url
  if (file.size === undefined) file.size = (img && img.size) || blob.size
  if (file.name === undefined) file.name = name
  return file
}

// ==================== uni.* 补齐 ====================

/**
 * 通用「调用 + success/fail/complete」包装
 */
function callWithOptions(method, params, options = {}) {
  invoke(method, params).then(
    (data) => { if (typeof options.success === 'function') options.success(data) },
    (err) => { if (typeof options.fail === 'function') options.fail(err) }
  ).finally(() => {
    if (typeof options.complete === 'function') options.complete()
  })
}

function installUniShims(uni) {
  if (!uni) return

  // ---------- 扫码 ----------
  uni.scanCode = (options = {}) => {
    invoke('scan.qrcode', {
      onlyFromCamera: options.onlyFromCamera !== false,
      scanType: options.scanType || ['qrCode']
    }).then(
      (data) => {
        if (typeof options.success === 'function') {
          options.success({ result: data.result, scanType: data.scanType || 'qrCode' })
        }
      },
      (err) => { if (typeof options.fail === 'function') options.fail(err) }
    ).finally(() => { if (typeof options.complete === 'function') options.complete() })
  }

  // ---------- 蓝牙（BLE） ----------
  uni.openBluetoothAdapter = (o = {}) => callWithOptions('ble.open', {}, o)

  uni.startBluetoothDevicesDiscovery = (o = {}) => callWithOptions('ble.startDiscovery', {
    allowDuplicatesKey: o.allowDuplicatesKey,
    interval: o.interval
  }, o)

  uni.stopBluetoothDevicesDiscovery = (o = {}) => callWithOptions('ble.stopDiscovery', {}, o)

  uni.onBluetoothDeviceFound = (cb) => onNativeEvent('ble.onDeviceFound', cb)

  uni.onBluetoothAdapterStateChange = (cb) => onNativeEvent('ble.onAdapterStateChange', cb)

  uni.createBLEConnection = (o = {}) => callWithOptions('ble.connect', {
    deviceId: o.deviceId,
    timeout: o.timeout
  }, o)

  uni.getBLEDeviceServices = (o = {}) => {
    invoke('ble.getServices', { deviceId: o.deviceId }).then(
      (data) => { if (typeof o.success === 'function') o.success({ services: (data && data.services) || [] }) },
      (err) => { if (typeof o.fail === 'function') o.fail(err) }
    ).finally(() => { if (typeof o.complete === 'function') o.complete() })
  }

  uni.getBLEDeviceCharacteristics = (o = {}) => {
    invoke('ble.getCharacteristics', { deviceId: o.deviceId, serviceId: o.serviceId }).then(
      (data) => { if (typeof o.success === 'function') o.success({ characteristics: (data && data.characteristics) || [] }) },
      (err) => { if (typeof o.fail === 'function') o.fail(err) }
    ).finally(() => { if (typeof o.complete === 'function') o.complete() })
  }

  uni.writeBLECharacteristicValue = (o = {}) => callWithOptions('ble.write', {
    deviceId: o.deviceId,
    serviceId: o.serviceId,
    characteristicId: o.characteristicId,
    value: arrayBufferToBase64(o.value)
  }, o)

  uni.closeBLEConnection = (o = {}) => callWithOptions('ble.closeConnection', { deviceId: o.deviceId }, o)

  uni.closeBluetoothAdapter = (o = {}) => callWithOptions('ble.closeAdapter', {}, o)

  // ---------- 相机 / 相册 ----------
  // 原生返回 { images: [{ base64, mimeType, name, size }] }，此处转为可上传/预览的 File + blob URL
  uni.chooseImage = (o = {}) => {
    invoke('image.choose', {
      count: o.count || 1,
      sourceType: o.sourceType || ['camera', 'album'],
      sizeType: o.sizeType
    }).then(
      (data) => {
        const images = (data && data.images) || []
        const tempFiles = images.map(buildTempFileFromImage)
        if (typeof o.success === 'function') {
          o.success({ tempFilePaths: tempFiles.map((f) => f.path || ''), tempFiles })
        }
      },
      (err) => { if (typeof o.fail === 'function') o.fail(err) }
    ).finally(() => { if (typeof o.complete === 'function') o.complete() })
  }

  uni.chooseMedia = (o = {}) => {
    invoke('image.chooseMedia', {
      count: o.count || 1,
      mediaType: o.mediaType || ['image'],
      sourceType: o.sourceType || ['camera', 'album']
    }).then(
      (data) => {
        const images = (data && data.images) || []
        const tempFiles = images.map((img) => {
          const f = buildTempFileFromImage(img)
          return { tempFilePath: f.path || '', size: f.size, fileType: 'image', name: f.name, file: f }
        })
        if (typeof o.success === 'function') o.success({ tempFiles })
      },
      (err) => { if (typeof o.fail === 'function') o.fail(err) }
    ).finally(() => { if (typeof o.complete === 'function') o.complete() })
  }

  uni.saveImageToPhotosAlbum = (o = {}) => {
    const filePath = o.filePath
    const send = (payload) => {
      invoke('image.saveToAlbum', payload).then(
        (data) => { if (typeof o.success === 'function') o.success(data) },
        (err) => { if (typeof o.fail === 'function') o.fail(err) }
      ).finally(() => { if (typeof o.complete === 'function') o.complete() })
    }
    const strPath = String(filePath || '')
    // data:/blob: URL 无法被原生直接读取，先转 base64 再下发
    if (strPath.indexOf('data:') === 0) {
      const d = dataUrlToBase64(strPath)
      send({ filePath, base64: d.base64, mimeType: d.mimeType })
    } else if (strPath.indexOf('blob:') === 0 && typeof fetch === 'function') {
      fetch(filePath).then((r) => r.blob()).then(blobToBase64)
        .then((base64) => send({ filePath, base64 }))
        .catch(() => send({ filePath }))
    } else {
      send({ filePath })
    }
  }

  // ---------- 微信分享 ----------
  // imageUrl 若为 data:/blob: 先转 base64 下发，原生侧再按微信缩略图规则压缩
  uni.share = (o = {}) => {
    const run = (imageBase64, imageMimeType) => invoke('share.wechat', {
      provider: o.provider || 'weixin',
      scene: o.scene,
      type: o.type,
      imageUrl: o.imageUrl,
      imageBase64,
      imageMimeType,
      title: o.title,
      summary: o.summary,
      href: o.href
    }).then(
      (data) => { if (typeof o.success === 'function') o.success(data) },
      (err) => { if (typeof o.fail === 'function') o.fail(err) }
    ).finally(() => { if (typeof o.complete === 'function') o.complete() })

    const strImg = String(o.imageUrl || '')
    if (strImg.indexOf('blob:') === 0 || strImg.indexOf('data:') === 0) {
      normalizeImageToBase64(o.imageUrl).then((r) => run(r ? r.base64 : '', r ? r.mimeType : ''))
    } else {
      run('', '')
    }
  }

  console.log('[NativeBridge] uni.* shims installed, inShell =', isNativeShell)
}

// 安装到全局 uni（uni-app H5 运行时提供 window.uni）
const uniRef = (typeof uni !== 'undefined' && uni)
  ? uni
  : ((typeof window !== 'undefined') ? window.uni : null)

if (uniRef) {
  installUniShims(uniRef)
}

// ==================== App / 设备 能力（供 upgrade.js 等业务直接调用） ====================

export const NativeApp = {
  /** 设备信息 { version, platform, model, ... } */
  getInfo() { return invoke('device.getInfo', {}) },

  /**
   * 原生扫码（H5 壳内由 ZXing / AVFoundation 完成）。
   * resolve({ result, scanType })；用户取消时 reject({ msg: 'scan cancelled' })。
   *
   * 注意：uni-app 编译 H5 时会把源码里的 uni.scanCode(...) 静态改写成内置的
   * 「H5 占位实现」（method 'uni.scanCode' not supported），对 window.uni 上的
   * shim 覆盖无效。因此壳内业务必须直接经本方法调用原生扫码。
   */
  scanQRCode(options = {}) {
    return invoke('scan.qrcode', {
      onlyFromCamera: options.onlyFromCamera !== false,
      scanType: options.scanType || ['qrCode']
    })
  },

  /**
   * 原生 HTTP 请求：壳内由 OkHttp/URLSession 发起，绕过 WebView 同源策略。
   * 背景：业务后端未返回 CORS 允许头，H5 的 XHR 会被浏览器拦截（net::ERR_FAILED）。
   * 出参对齐 uni.request：resolve({ statusCode, data })，data 已尝试 JSON 解析。
   */
  request(options = {}) {
    return invoke('http.request', {
      url: options.url,
      method: options.method || 'GET',
      header: options.header || options.headers || {},
      data: options.data,
      timeout: options.timeout
    })
  },

  /**
   * 原生文件上传（multipart/form-data）。
   * 入参 fileBase64 为文件字节的 base64；resolve({ statusCode, data })，data 为响应原文。
   */
  upload(options = {}) {
    return invoke('http.upload', {
      url: options.url,
      name: options.name || 'file',
      fileName: options.fileName,
      mimeType: options.mimeType,
      fileBase64: options.fileBase64,
      formData: options.formData || {}
    })
  },

  /** 请求权限：requestPermissions(['android.permission.CAMERA', ...]) */
  requestPermissions(permissions = []) { return invoke('permission.request', { permissions }) },

  /** 打开本应用系统设置页 */
  openSettings() { return invoke('app.openSettings', {}) },

  /**
   * 下载文件（App 内更新）
   * @param {string} url 下载地址
   * @param {Function} progressCallback (percent, downloadedSize, totalSize) => void
   * @returns {Promise<string>} 本地文件路径
   */
  download(url, progressCallback) {
    return new Promise((resolve, reject) => {
      const taskId = 'dl_' + Date.now()
      const listener = (data) => {
        if (data && data.taskId === taskId && typeof progressCallback === 'function') {
          progressCallback(data.percent || 0, data.downloadedSize || 0, data.totalSize || 0)
        }
      }
      onNativeEvent('app.onDownloadProgress', listener)
      invoke('app.download', { url, taskId }).then(
        (data) => { offNativeEvent('app.onDownloadProgress', listener); resolve(data.filePath) },
        (err) => { offNativeEvent('app.onDownloadProgress', listener); reject(err) }
      )
    })
  },

  /** 安装本地 APK（Android）；iOS 会调用 openStore */
  installPackage(filePath) { return invoke('app.installPackage', { filePath }) },

  /** 打开应用商店（iOS 更新走这里） */
  openStore(url) { return invoke('app.openStore', { url }) },

  /**
   * 拉起微信小程序（原生壳经微信 OpenSDK 完成；Android WXLaunchMiniProgram.Req / iOS WXApi）。
   * 前置：微信开放平台「移动应用」（appId）与目标小程序绑定同一开放平台账号，
   *       且壳已集成微信 OpenSDK（Android app/libs、iOS Vendor/WechatOpenSDK，见 iOS编译接入说明.md）。
   * @param {Object} options { appId, userName, path, type }
   *   appId    微信开放平台移动应用 AppId（wx 开头；与小程序须同一开放平台账号）
   *   userName 目标小程序原始 ID（gh_ 开头）
   *   path     小程序页面路径（可携 query）
   *   type     0 正式版 / 1 开发版 / 2 体验版（默认 0）
   * resolve() 生效于「拉起指令已发出」；用户在小程序操作完成后自行返回本 App。
   */
  launchMiniProgram(options = {}) {
    return invoke('miniprogram.launch', {
      appId: options.appId,
      userName: options.userName,
      path: options.path,
      type: options.type
    })
  },

  /** 退出应用 */
  quit() { return invoke('app.quit', {}) }
}

// ==================== 支付桥接（VIP 购买） ====================
// 由 shell-android PayBridge / shell-ios PayBridge 实现（pay.* 路由）。
// 事件仅作触发信号，VIP 订单最终状态以后端 queryVipOrder 为准（见 utils/payUtils.js）。

export const NativePay = {
  /**
   * 订阅支付结果事件。
   * 载荷：{ channel: 'wechat'|'alipay'|'iap', event: 'pay.success'|'pay.cancel'|'pay.fail', code, msg, receipt?, transactionId? }
   * @param {Function} fn 事件回调
   * @returns {Function} 取消订阅函数
   */
  subscribe(fn) {
    onNativeEvent('pay.onEvent', fn)
    return () => offNativeEvent('pay.onEvent', fn)
  },

  /** 取消订阅 */
  unsubscribe(fn) { offNativeEvent('pay.onEvent', fn) },

  /** 调起微信支付（params 为后端 createVipOrder 下发的 pay_params） */
  wechatPay(params) { return invoke('pay.wechat', params || {}) },

  /** 调起支付宝支付（orderStr 为后端 createVipOrder 下发的 order_str） */
  alipayPay(orderStr) { return invoke('pay.alipay', { orderStr }) },

  /** 调起苹果内购（iOS StoreKit；productId 为 App Store 商品 ID，orderNo 用于对账） */
  iapPay(params) { return invoke('pay.iap', params || {}) }
}

// ==================== 广告桥接适配器 ====================
// 供 common/taku-sdk.js 在 H5 下替换 uni.requireNativePlugin 的返回值，
// 使业务层 TakuAds API 在 H5 壳内与 APP 端行为完全一致。

let adAdapter = null

export function createAdBridgeAdapter() {
  if (adAdapter) return adAdapter

  // 按 placementId 保存事件回调；'*' 为无 placementId 的兜底
  const cbsByPlacement = {}

  onNativeEvent('ad.onEvent', (res) => {
    res = res || {}
    const cb = cbsByPlacement[res.placementId] || cbsByPlacement['*']
    if (typeof cb === 'function') cb(res)
  })

  const registerCbs = (placementId, cbs) => {
    const handler = (typeof cbs === 'function')
      ? cbs
      : (res) => {
        const h = cbs && cbs[res.event]
        if (typeof h === 'function') h(res)
      }
    cbsByPlacement[placementId || '*'] = handler
  }

  adAdapter = {
    initTaku(params, cb) {
      invoke('ad.init', params || {}).then(
        (data) => { if (typeof cb === 'function') cb({ code: 0, msg: (data && data.msg) || 'ok' }) },
        (err) => { if (typeof cb === 'function') cb({ code: (err && err.code) || -1, msg: (err && (err.msg || err.errMsg)) || 'init failed' }) }
      )
    },
    // 【VIP 免广告】运行中更新 Taku 自定义流量分组（user_type=vip/normal）：
    // 对应 shell-android AdBridge 路由 "ad.setUserType"（原生持久化 + initCustomMap 更新，后续广告请求生效）
    setUserType(params) { invoke('ad.setUserType', params || {}).catch(() => {}) },
    loadRewardedVideoAd(params, cbs) {
      registerCbs(params && params.placementId, cbs)
      invoke('ad.loadRewarded', params || {}).catch(() => {})
    },
    showRewardedVideoAd(params) { invoke('ad.showRewarded', params || {}).catch(() => {}) },
    loadInterstitialAd(params, cbs) {
      registerCbs(params && params.placementId, cbs)
      invoke('ad.loadInterstitial', params || {}).catch(() => {})
    },
    showInterstitialAd(params) { invoke('ad.showInterstitial', params || {}).catch(() => {}) },
    showBannerAd(params, cbs) {
      registerCbs(params && params.placementId, cbs)
      invoke('ad.banner.show', params || {}).catch(() => {})
    },
    hideBannerAd(positionKey) { invoke('ad.banner.hide', { positionKey }).catch(() => {}) },
    showNativeAd(params, cbs) {
      registerCbs(params && params.placementId, cbs)
      invoke('ad.native.show', params || {}).catch(() => {})
    },
    hideNativeAd(positionKey) { invoke('ad.native.hide', { positionKey }).catch(() => {}) },
    loadSplashAd(params, cbs) {
      registerCbs(params && params.placementId, cbs)
      invoke('ad.splash.load', params || {}).catch(() => {})
    },
    showSplashAd(params) { invoke('ad.splash.show', params || {}).catch(() => {}) }
  }

  return adAdapter
}

export default { isNativeShell, NativeApp, NativePay, createAdBridgeAdapter }
