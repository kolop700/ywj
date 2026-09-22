import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAdControlStore, AD_CONTROL_TYPES } from './adControl' // 引入广告控制模块
import TakuAds from '@/common/taku-sdk' // 预加载横幅（提前竞价）

// Taku（塔酷）广告位配置
// 【接入必读】Taku 后台 → 流量管理-广告位，按平台分别创建后，把 placementId 填入下方对应位置：
//   android.*   → Android 端广告位
//   ios.*       → iOS 端广告位（需完成 iOS 原生插件接入后生效）
//   test.*      → 联调阶段使用，配合 setTestMode(true) 生效（Taku 后台可建测试广告位）
// 值为空字符串时，对应广告形式不会加载与展示（页面自动隐藏），属正常状态。
// 说明：Taku 广告位与旧 uni-ad 的 adpid 完全独立，不可沿用旧值。
// 2026-09 已填入 Android 5 个广告位（后台应用 a6aa0d3c3c058d）与 iOS 5 个广告位（后台应用 a6aa8bfd99036e）
const AD_IDS = {
  android: {
    banner: 'b6aa0d4e967667', // Android 横幅（Banner）
    interstitial: 'b6aa0d4eb27c91', // Android 插屏
    rewardedVideo: 'b6aa0d4e9d081a', // Android 激励视频
    informationflow: 'b6aa0d4eabcca8', // Android 原生信息流
    splash: 'b6aa0d4ea33cec' // Android 开屏
  },
  ios: {
    banner: 'b1hlb1u6665oe8', // iOS 横幅（Banner）
    interstitial: 'b1hlb1u6665l9h', // iOS 插屏
    rewardedVideo: 'b1hlb1u6665rse', // iOS 激励视频
    informationflow: 'b1hlb1u6666055', // iOS 原生信息流
    splash: 'b1hlb1u6665et6' // iOS 开屏
  },
  test: {
    banner: '', // 测试横幅
    interstitial: '', // 测试插屏
    rewardedVideo: '', // 测试激励视频
    splash: '' // 测试开屏
  }
}

// 创建广告状态管理
export const useAdStore = defineStore('ad', () => {
  const isTestMode = ref(false) // 默认关闭测试模式

  // 获取当前平台
  const getPlatform = () => {
    const platform = uni.getSystemInfoSync().platform
    return platform === 'android' || platform === 'ios' ? platform : 'android'
  }

  // 获取广告位ID（按当前平台与广告控制类型返回，未配置/全关返回空串）
  const getAdId = (type) => {
    const adControlStore = useAdControlStore() // 使用广告控制 store
    // 广告类型为 NONE（全关）时不返回任何广告位
    if (adControlStore.adType === AD_CONTROL_TYPES.NONE) {
      return ''
    }
    const platform = isTestMode.value ? 'test' : getPlatform()
    return AD_IDS[platform]?.[type] || ''
  }

  // 获取横幅广告位ID
  const getBannerAdId = () => getAdId('banner')

  // 获取插屏广告位ID
  const getInterstitialAdId = () => getAdId('interstitial')

  // 获取激励视频广告位ID
  const getRewardedVideoAdId = () => getAdId('rewardedVideo')

  // 获取信息流广告位ID
  const getInformationFlowAdId = () => getAdId('informationflow')

  // 获取开屏广告位ID
  // 说明：开屏展示于冷启动瞬间，此时房间级广告控制（adType）尚未赋值（恒为默认 NONE），
  // 故开屏不受 adType 约束——只要平台广告位已配置即返回（未配置返回空串，自动跳过展示）。
  const getSplashAdId = () => {
    const platform = isTestMode.value ? 'test' : getPlatform()
    return AD_IDS[platform]?.splash || ''
  }

  // 预加载横幅（广告类型确定后由登录流程调用：提前发起竞价，进入页面时若已加载完成则直接复用展示）
  // 说明：竞价失败不作处理——页面内 <taku-banner> 挂载时仍会正常发起加载兜底；
  //      实际加载动作由 taku-sdk.preloadBannerAd 完成（仅 H5 原生壳具备「加载不挂载」语义，非 H5 平台安全空操作）。
  const preloadBanner = () => {
    let attempts = 0
    const tryOnce = () => {
      const placementId = getBannerAdId()
      if (!placementId) return
      // 广告 SDK 初始化是异步的：未就绪时延时重试（最多 10 次 × 1s）
      if (!TakuAds.isReady()) {
        if (++attempts <= 10) setTimeout(tryOnce, 1000)
        return
      }
      console.log('[广告] 预加载横幅:', placementId)
      TakuAds.preloadBannerAd(placementId, {
        onAdLoaded() {
          console.log('[广告] 横幅预加载成功（进入页面可直接展示）')
        },
        onAdFailed(res) {
          console.log('[广告] 横幅预加载未成功（进入页面后仍会正常加载）', res && res.msg)
        }
      })
    }
    tryOnce()
  }

  // 设置测试模式
  const setTestMode = (status) => {
    isTestMode.value = status
    console.log(`广告模式: ${status ? '测试模式' : '正式模式'}`)
  }

  // 获取测试模式状态
  const getTestMode = () => isTestMode.value

  return {
    getBannerAdId,
    getInterstitialAdId,
    getRewardedVideoAdId,
    getInformationFlowAdId,
    getSplashAdId,
    preloadBanner,
    setTestMode,
    getTestMode
  }
})
