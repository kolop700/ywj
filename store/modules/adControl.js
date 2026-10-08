import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 广告控制类型（取值与后端 t_community.ad_prod_app 一致）
export const AD_CONTROL_TYPES = {
  NONE: '0',        // 不显示任何广告（含开屏）
  SPLASH_ONLY: '04', // 只显示开屏广告（App 内广告全关，保留开屏）
  BANNER: '1',     // 只显示 banner
  REWARDED: '11',   // banner + 激励
  INTERSTITIAL: '13' // banner + 插屏
}

// 广告类型本地缓存键：登录后按房间 ad_prod_app 计算并写入（见 store/modules/user.js），
// 供下次冷启动读取——App.vue 开屏展示前据此判断（'0' 都不显示时跳过开屏）
export const AD_CONTROL_STORAGE_KEY = 'taku_ad_control'

export const useAdControlStore = defineStore('adControl', () => {
  // 广告控制类型（默认全关，登录后按房间 ad_prod_app 计算赋值）
  const adType = ref(AD_CONTROL_TYPES.NONE)

  // 获取广告类型描述
  const getAdTypeDescription = (type) => {
    switch (type) {
      case AD_CONTROL_TYPES.NONE:
        return '不显示任何广告'
      case AD_CONTROL_TYPES.SPLASH_ONLY:
        return '只显示开屏广告'
      case AD_CONTROL_TYPES.BANNER:
        return '只显示 banner 广告'
      case AD_CONTROL_TYPES.REWARDED:
        return '显示 banner 和激励广告'
      case AD_CONTROL_TYPES.INTERSTITIAL:
        return '显示 banner 和插屏广告'
      default:
        return '未知类型'
    }
  }

  // 使用计算属性
  const currentAdType = computed(() => adType.value)
  const currentAdTypeDescription = computed(() => getAdTypeDescription(adType.value))
  const showBanner = computed(() => adType.value >= AD_CONTROL_TYPES.BANNER)
  const showRewarded = computed(() => adType.value === AD_CONTROL_TYPES.REWARDED)
  const showInterstitial = computed(() => adType.value === AD_CONTROL_TYPES.INTERSTITIAL)

  // App 内广告是否全关：'0'（都不显示）与 '04'（只保留开屏）均不展示
  // 横幅/激励/插屏/信息流（开屏由 App.vue 冷启动流程单独控制）
  const isAdsDisabled = computed(() =>
    adType.value === AD_CONTROL_TYPES.NONE || adType.value === AD_CONTROL_TYPES.SPLASH_ONLY
  )

  // 设置广告类型
  function setAdType(type) {
    adType.value = type
    console.log('广告控制类型已更新:', {
      类型: type,
      说明: getAdTypeDescription(type)
    })
  }

  return {
    // 状态
    adType,
    adTypeDescription: currentAdTypeDescription,
    showBanner,
    showRewarded,
    showInterstitial,
    isAdsDisabled,
    // 方法
    setAdType,
    // 常量
    AD_CONTROL_TYPES
  }
})
