/**
 * iOS 商店更新检查（零维护方案）
 * 直接请求苹果官方 iTunes Lookup 接口获取 App Store 当前上架版本，
 * 与本机 CFBundleShortVersionString 做 semver 比较，有新版本则弹窗引导跳商店。
 * 以后 iOS 只要正常发商店版（ASC 版本字段 = 包 MARKETING_VERSION，1.4 风格），
 * 老用户自动能收到更新提示，无需维护后端 t_ver 记录。
 */
// #ifdef H5
import { isNativeShell, NativeApp } from '@/utils/h5-native-bridge'
// #endif

const APP_STORE_ID = '6808532133' // 云卫家在 App Store 的 trackId
const STORE_URL = 'https://apps.apple.com/cn/app/id6808532133'

// "1.4" / "1.0.27" → 可比较整数：major*10000 + minor*100 + patch（patch 需 <100）
const versionToNum = (v) => {
  const parts = String(v || '').split('.').map(n => parseInt(n, 10))
  if (!parts.length || parts.some(n => isNaN(n))) return 0
  const [major = 0, minor = 0, patch = 0] = parts
  return major * 10000 + minor * 100 + patch
}

// 本机版本号（marketing version，非构建号）
const getLocalVersion = async () => {
  // #ifdef H5
  if (isNativeShell) {
    try {
      const info = await NativeApp.getInfo()
      return (info && info.version) || '' // CFBundleShortVersionString
    } catch (e) {
      return ''
    }
  }
  // #endif
  const sys = uni.getSystemInfoSync()
  return sys.appVersion || sys.version || ''
}

// 查询 App Store 最新版本号（H5 走 JSONP 绕开 CORS；App 端直接 uni.request）
const lookupStoreVersion = () => {
  const baseUrl = `https://itunes.apple.com/lookup?id=${APP_STORE_ID}&country=CN`
  // #ifdef H5
  return new Promise((resolve, reject) => {
    const cbName = '__iTunesLookupCb_' + Date.now()
    const script = document.createElement('script')
    const timer = setTimeout(() => { cleanup(); reject(new Error('lookup timeout')) }, 8000)
    const cleanup = () => {
      clearTimeout(timer)
      try { delete window[cbName] } catch (e) { window[cbName] = undefined }
      if (script.parentNode) script.parentNode.removeChild(script)
    }
    window[cbName] = (res) => {
      cleanup()
      const version = res && res.results && res.results[0] && res.results[0].version
      version ? resolve(version) : reject(new Error('no version in response'))
    }
    script.src = `${baseUrl}&callback=${cbName}`
    script.onerror = () => { cleanup(); reject(new Error('lookup error')) }
    document.head.appendChild(script)
  })
  // #endif
  // #ifndef H5
  return new Promise((resolve, reject) => {
    uni.request({
      url: baseUrl,
      timeout: 8000,
      success: (r) => {
        const version = r.data && r.data.results && r.data.results[0] && r.data.results[0].version
        version ? resolve(version) : reject(new Error('no version in response'))
      },
      fail: reject
    })
  })
  // #endif
}

// 跳 App Store
const openStore = () => {
  // #ifdef H5
  if (isNativeShell) {
    NativeApp.openStore(STORE_URL).catch(() => { window.location.href = STORE_URL })
    return
  }
  window.location.href = STORE_URL
  // #endif
  // #ifndef H5
  plus.runtime.openURL(STORE_URL)
  // #endif
}

/**
 * 检查 iOS 商店是否有新版本，有则弹窗引导升级
 * @param {boolean} silent 静默模式：无新版本/请求失败都不提示（默认 true）
 */
export const checkIosStoreUpdate = async (silent = true) => {
  try {
    const [localVer, storeVer] = [await getLocalVersion(), await lookupStoreVersion()]
    const localNum = versionToNum(localVer)
    const storeNum = versionToNum(storeVer)
    console.log('[iosStoreUpdate] 本机版本:', localVer, localNum, '商店版本:', storeVer, storeNum)
    if (!localNum || !storeNum) return // 任一取不到则跳过，防误报
    if (storeNum > localNum) {
      uni.showModal({
        title: '发现新版本 ' + storeVer,
        content: '请到 App Store 进行升级',
        showCancel: !silent,
        confirmText: '去升级',
        success: (r) => { if (r.confirm) openStore() }
      })
    }
  } catch (e) {
    console.warn('[iosStoreUpdate] 检查失败（忽略，不影响使用）:', e)
  }
}

export default checkIosStoreUpdate
