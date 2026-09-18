/**
 * Taku（塔酷）广告统一封装层
 *
 * 【说明】本文件与 DCloud 插件市场 taku-001「TakuAdsNativePlugin」提供的
 * common/taku-sdk.js 保持相同 API 契约（init/loadXxxAd/showXxxAd/hideXxxAd + 事件回调），
 * 页面与业务代码只依赖本文件的 TakuAds 导出，不感知底层实现。
 *
 * 【两种使用方式】
 * 1. 推荐：拿到 taku-001 作者的插件目录（含其自带 common/taku-sdk.js）后，
 *    用作者文件原样覆盖本文件，并在下方 TAKU_CONFIG 填入 AppId/AppKey 即可，业务代码零改动。
 * 2. 本文件兜底实现：插件未安装/环境非 App 时，所有 API 安全返回失败，页面自动隐藏广告位；
 *    插件已安装时，调用原生插件 TakuAdBridge 模块（方法名按插件文档同名透传）。
 *
 * 【iOS 自研插件开发契约】（iOS 原生插件到位后按此实现，JS 层与页面层无需改动）
 * - 插件目录：nativeplugins/TakuAdsNativePlugin-iOS/
 * - module 名：TakuAdBridge（与 Android taku-001 同名，便于本文件双端零差异桥接）
 * - 原生组件：taku-banner（props: placement-id；事件 onAdLoaded/onAdFailed/onAdShow/onAdClicked/onAdClosed）
 * - module 方法（与 Android 插件文档同签名）：
 *   initTaku({appId, appKey}, cb)          cb({code, msg}) code=0 成功
 *   loadRewardedVideoAd({placementId}, cbs)
 *   showRewardedVideoAd({placementId})
 *   loadInterstitialAd({placementId, scenarioId, extraData}, cbs)
 *   showInterstitialAd({placementId})
 *   showBannerAd / hideBannerAd / showNativeAd / hideNativeAd / loadSplashAd / showSplashAd
 * - 事件回调对象 cbs：onAdLoaded/onAdFailed/onAdShow/onAdClicked/onAdClosed/onReward/onAdPlayStart/onAdPlayEnd
 */

// H5 原生壳：广告桥接适配器（使本文件在 H5 壳内与 APP 端行为一致）
// #ifdef H5
import { createAdBridgeAdapter } from '@/utils/h5-native-bridge'
// #endif

// ============ 配置（Taku 后台注册后填入） ============
// 2026-09 已填入 Android 应用凭据（后台-应用管理）。
// 双端 AppId/AppKey 不同，而 H5 壳产物双端共用：此处按平台分组存放，运行时自动取当前平台。
// iOS 凭据待 Taku 后台创建 iOS 应用后填入 ios 分组（并同步 store/modules/ad.js 的 AD_IDS.ios 广告位）。
export const TAKU_CONFIG = {
  android: {
    appId: 'a6aa0d3c3c058d', // Taku AppId（后台-应用管理 Android 应用）
    appKey: 'a3da697cd42cf7198faa304f28b82ca0f' // Taku AppKey
  },
  ios: {
    appId: '', // 待填：Taku 后台 iOS 应用 AppId
    appKey: '' // 待填：Taku 后台 iOS 应用 AppKey
  }
}

/** 取当前运行平台（'ios' | 'android'；识别失败按 android 处理，与原行为一致） */
const currentPlatform = () => {
  try {
    const p = (uni.getSystemInfoSync() || {}).platform
    return p === 'ios' ? 'ios' : 'android'
  } catch (e) {
    return 'android'
  }
}

/**
 * 解析生效的 Taku 凭据。入参支持两种形态：
 *   1) { appId, appKey } 直接指定 → 原样使用（优先级最高）；
 *   2) 平台分组 { android: {appId, appKey}, ios: {...} }（即 TAKU_CONFIG）→ 按当前平台取。
 * @returns {{ appId: String, appKey: String }}
 */
export const resolveTakuConfig = (config = {}) => {
  if (config.appId || config.appKey) {
    return { appId: config.appId || '', appKey: config.appKey || '' }
  }
  const group = config[currentPlatform()] || TAKU_CONFIG[currentPlatform()] || {}
  return { appId: group.appId || '', appKey: group.appKey || '' }
}

// 隐私同意状态统一存储于 agreement store（hasAgreedToPolicy），初始化时序见 App.vue onLaunch

// 原生插件 module 名（Android taku-001 与 iOS 自研插件统一使用）
const TAKU_BRIDGE_MODULE = 'TakuAdBridge'

// 【VIP 免广告】用户类型存储键（'vip' | 'normal'）：
// 冷启动时由 init() 读取并随参数下发，原生在 ATSDK.init 之前设置为 Taku 流量分组标记
// （后台按 user_type=vip 建「无广告源」分组拦截）；后端 VIP 接口就绪前可作本地模拟开关。
export const USER_TYPE_STORAGE_KEY = 'taku_user_type'

// 【用户对账】userId 本地缓存键：登录/开通/退登时由 setUserType(type, userId) 维护，
// 冷启动 init() 读取并随参数下发；原生哈希后以 user_id 上报 Taku（不传原始 ID），
// 供后台按用户对账（不参与分组匹配，空值不传）。
export const USER_ID_STORAGE_KEY = 'taku_user_id'

/**
 * 横幅位置标识（全局共享 key）
 * 约定：同一广告位在所有页面共用同一 key —— 原生侧按 key 复用同一个横幅实例，
 * 配合 preloadBannerAd 预加载，实现「进入页面前竞价已完成、进页直接复用秒显」。
 * （旧方案为「页面路由 + 广告位」，页面间实例互相隔离、无法复用预加载结果。）
 */
export const bannerPositionKey = (placementId) => 'banner:shared:' + (placementId || 'default')

// ============ 内部状态 ============
let inited = false        // 是否已成功初始化
let initFailed = false    // 初始化是否已失败（避免无谓重试）
let bridge = null         // 原生模块引用（仅 App 端）

// 尝试获取原生模块（APP-Plus 走 uni.requireNativePlugin；H5 壳走桥接适配器）
const getBridge = () => {
  // #ifdef APP-PLUS
  if (bridge) return bridge
  try {
    bridge = uni.requireNativePlugin(TAKU_BRIDGE_MODULE)
  } catch (error) {
    bridge = null
  }
  return bridge
  // #endif

  // #ifdef H5
  if (bridge) return bridge
  bridge = createAdBridgeAdapter()
  return bridge
  // #endif

  // #ifndef APP-PLUS
  // #ifndef H5
  return null
  // #endif
  // #endif
}

// 通用失败回调（插件缺失/环境不支持时使用）
const failCallback = (cb, code = -1, msg = '') => {
  if (typeof cb === 'function') {
    cb({ code, msg })
  }
}

// 事件回调对象 -> 原生可调用分发函数（自研插件事件回传协议）
// 原生侧每次事件回调 invoke 一次：{ event: 'onAdLoaded'|'onAdFailed'|..., code, msg }
// JS 侧按 event 分发给对应处理函数；兼容直接传函数的旧形态
const wrapEventCbs = (cbs) => {
  if (typeof cbs === 'function') return cbs
  const map = cbs || {}
  return (res = {}) => {
    const handler = map[res.event]
    if (typeof handler === 'function') {
      handler(res)
    }
  }
}

// ============ 对外 API ============

/**
 * 初始化 Taku SDK
 * 必须在用户同意隐私政策之后调用（Android 系统隐私弹窗同意后才进入 App；
 * iOS 需应用内同意《隐私政策》，未同意前不要调用本方法）。
 * @param {Object} config { appId, appKey } 直接指定，或 TAKU_CONFIG 平台分组形态（缺省使用 TAKU_CONFIG）
 * @param {Function} cb 回调 (res)，res.code === 0 表示成功
 */
export const TakuAds = {
  // 初始化
  init(config = {}, cb) {
    if (inited) {
      failCallback(cb, 0, 'already inited')
      return
    }
    const cfg = resolveTakuConfig(config)
    // 【VIP 免广告】读取本地缓存的用户类型（默认 normal），初始化时一并下发：
    // 原生在 ATSDK.init 之前调用 initCustomMap，保证冷启动首个广告请求（含开屏）即命中对应流量分组。
    let userType = 'normal'
    try {
      const cached = uni.getStorageSync(USER_TYPE_STORAGE_KEY)
      if (cached) userType = cached
    } catch (e) {
      // 读取失败按默认值处理
    }
    // 【用户对账】读取本地缓存的 userId（登录时写入，退登时清除）
    let userId = ''
    try {
      userId = String(uni.getStorageSync(USER_ID_STORAGE_KEY) || '')
    } catch (e) {
      // 读取失败按空处理
    }
    if (!cfg.appId || !cfg.appKey) {
      console.warn('[TakuAds] 未配置 appId/appKey，跳过初始化（在 common/taku-sdk.js 的 TAKU_CONFIG 对应平台分组中填入）')
      initFailed = true
      failCallback(cb, -1, 'appId/appKey not configured')
      return
    }
    const module = getBridge()
    if (!module) {
      console.warn('[TakuAds] 未找到原生插件模块 TakuAdBridge，请确认已集成 nativeplugins/TakuAdsNativePlugin（Android 需自定义基座）')
      initFailed = true
      failCallback(cb, -1, 'native plugin not found')
      return
    }
    try {
      module.initTaku({
        appId: cfg.appId,
        appKey: cfg.appKey,
        userType,
        userId
      }, (res) => {
        if (res && res.code === 0) {
          inited = true
          console.log('[TakuAds] Taku SDK 初始化成功')
        } else {
          initFailed = true
          console.error('[TakuAds] Taku SDK 初始化失败', res)
        }
        if (typeof cb === 'function') cb(res)
      })
    } catch (error) {
      console.error('[TakuAds] 调用 initTaku 异常', error)
      initFailed = true
      failCallback(cb, -1, 'init exception')
    }
  },

  // 是否已初始化成功
  isReady() {
    return inited
  },

  /**
   * 设置用户类型（Taku 自定义流量分组）——用于「VIP 免广告」：
   *   'vip'    → 立即写本地缓存（下次冷启动在 ATSDK.init 前生效）+ 通知原生更新分组规则（后续请求生效）；
   *   'normal' → 恢复普通用户分组。
   * 后端 VIP 接口就绪前，业务层可用本方法做本地模拟开关；就绪后由登录/开通/退登流程调用。
   * @param {String} type 'vip' | 'normal'
   * @param {String|Number} [userId] 用户 ID（可选）：随参数透传原生（哈希后上报 Taku 对账）；
   *   传入时写本地缓存（供冷启动 init 使用）；type=normal 且未传时视为退登，清除缓存。
   */
  setUserType(type, userId) {
    const t = type === 'vip' ? 'vip' : 'normal'
    try {
      uni.setStorageSync(USER_TYPE_STORAGE_KEY, t)
    } catch (e) {
      console.error('[TakuAds] setUserType 缓存失败', e)
    }
    // 【用户对账】维护 userId 缓存：显式传入 → 写入；normal 且未传（退登）→ 清除；其余沿用缓存
    let uid = ''
    try {
      if (userId) {
        uid = String(userId)
        uni.setStorageSync(USER_ID_STORAGE_KEY, uid)
      } else if (t === 'normal') {
        uni.removeStorageSync(USER_ID_STORAGE_KEY)
      } else {
        uid = String(uni.getStorageSync(USER_ID_STORAGE_KEY) || '')
      }
    } catch (e) {
      console.error('[TakuAds] setUserType userId 缓存失败', e)
    }
    const module = getBridge()
    if (!module) return
    try {
      module.setUserType({
        userType: t,
        userId: uid
      })
    } catch (error) {
      console.error('[TakuAds] setUserType 异常', error)
    }
  },

  /**
   * 加载激励视频广告
   * @param {Object} params { placementId }
   * @param {Object} cbs { onAdLoaded, onAdFailed, onAdShow, onAdClicked, onAdClosed, onReward, onAdPlayStart, onAdPlayEnd }
   */
  loadRewardedVideoAd(params = {}, cbs = {}) {
    const module = getBridge()
    if (!module) return
    try {
      module.loadRewardedVideoAd(params, wrapEventCbs(cbs))
    } catch (error) {
      console.error('[TakuAds] loadRewardedVideoAd 异常', error)
    }
  },

  // 展示激励视频广告（需先 load 成功）
  showRewardedVideoAd(params = {}) {
    const module = getBridge()
    if (!module) return
    try {
      module.showRewardedVideoAd(params)
    } catch (error) {
      console.error('[TakuAds] showRewardedVideoAd 异常', error)
    }
  },

  /**
   * 加载插屏广告
   * @param {Object} params { placementId, scenarioId?, extraData? }
   * @param {Object} cbs { onAdLoaded, onAdFailed, onAdShow, onAdClicked, onAdClosed }
   */
  loadInterstitialAd(params = {}, cbs = {}) {
    const module = getBridge()
    if (!module) return
    try {
      module.loadInterstitialAd(params, wrapEventCbs(cbs))
    } catch (error) {
      console.error('[TakuAds] loadInterstitialAd 异常', error)
    }
  },

  // 展示插屏广告（需先 load 成功）
  showInterstitialAd(params = {}) {
    const module = getBridge()
    if (!module) return
    try {
      module.showInterstitialAd(params)
    } catch (error) {
      console.error('[TakuAds] showInterstitialAd 异常', error)
    }
  },

  /**
   * 预加载横幅广告（H5 原生壳）：提前发起竞价但不挂载视图，
   * 用户进入页面时由 <taku-banner> 组件直接复用已加载实例（消除页面内等待竞价）。
   * 说明：不传 rect，原生侧按「仅加载不挂载」处理（AdBridge.showBanner）；加载结果经 cbs 回调。
   * APP 端（uni-app 插件）无此语义，经条件编译在非 H5 平台自动跳过。
   * @param {String} placementId 广告位 ID
   * @param {Object} cbs { onAdLoaded, onAdFailed }
   */
  preloadBannerAd(placementId, cbs = {}) {
    // #ifdef H5
    if (!placementId) return
    const module = getBridge()
    if (!module) return
    try {
      module.showBannerAd({
        placementId,
        positionKey: bannerPositionKey(placementId),
        preload: true // 标记用途：原生以 rect 缺失识别「仅加载」，此处仅便于日志排查
      }, wrapEventCbs(cbs))
    } catch (error) {
      console.error('[TakuAds] preloadBannerAd 异常', error)
    }
    // #endif
  },

  // 展示 Banner（JS 方式，按坐标悬浮；页面内横幅请使用原生组件 <taku-banner>）
  showBannerAd(params = {}, cbs = {}) {
    const module = getBridge()
    if (!module) return
    try {
      module.showBannerAd(params, wrapEventCbs(cbs))
    } catch (error) {
      console.error('[TakuAds] showBannerAd 异常', error)
    }
  },

  // 隐藏 JS 方式 Banner（positionKey 对应 showBannerAd 传入的位置标识）
  hideBannerAd(positionKey) {
    const module = getBridge()
    if (!module) return
    try {
      module.hideBannerAd(positionKey)
    } catch (error) {
      console.error('[TakuAds] hideBannerAd 异常', error)
    }
  },

  // 展示原生信息流广告（JS 方式，按坐标悬浮）
  showNativeAd(params = {}, cbs = {}) {
    const module = getBridge()
    if (!module) return
    try {
      module.showNativeAd(params, wrapEventCbs(cbs))
    } catch (error) {
      console.error('[TakuAds] showNativeAd 异常', error)
    }
  },

  // 隐藏 JS 方式原生广告（positionKey 对应 showNativeAd 传入的位置标识）
  hideNativeAd(positionKey) {
    const module = getBridge()
    if (!module) return
    try {
      module.hideNativeAd(positionKey)
    } catch (error) {
      console.error('[TakuAds] hideNativeAd 异常', error)
    }
  },

  /**
   * 加载开屏广告（App 冷启动时调用，加载结果经 onAdLoaded / onAdFailed 事件下发；
   * 展示窗口由调用方控制，见 App.vue 的启动窗口约束）
   * @param {Object} params { placementId }
   * @param {Object} cbs { onAdLoaded, onAdFailed, onAdShow, onAdClicked, onAdClosed }
   */
  loadSplashAd(params = {}, cbs = {}) {
    const module = getBridge()
    if (!module) return
    try {
      module.loadSplashAd(params, wrapEventCbs(cbs))
    } catch (error) {
      console.error('[TakuAds] loadSplashAd 异常', error)
    }
  },

  // 展示开屏广告（需先 load 成功且处于启动窗口内）
  showSplashAd(params = {}) {
    const module = getBridge()
    if (!module) return
    try {
      module.showSplashAd(params)
    } catch (error) {
      console.error('[TakuAds] showSplashAd 异常', error)
    }
  }
}

export default TakuAds
