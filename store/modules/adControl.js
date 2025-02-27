import { defineStore } from 'pinia'
import {computed } from 'vue'

// 广告控制类型
export const AD_CONTROL_TYPES = {
  NONE: '0',        // 不显示任何广告
  BANNER: '1',     // 只显示 banner
  REWARDED: '11',   // banner + 激励
  INTERSTITIAL: '13' // banner + 插屏
}

 export const useAdControlStore = defineStore('adControl', () => {
  // 广告控制类型
  const adType = ref(AD_CONTROL_TYPES.INTERSTITIAL) // 默认显示 banner + 插屏
  // 获取广告类型描述
  const getAdTypeDescription = (type) => {
    switch (type) {
      case AD_CONTROL_TYPES.NONE:
        return '不显示任何广告'
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

  // 设置广告类型
  function setAdType(type) {
    adType.value = type
    // 保存到本地存储
    try {
      console.log('广告控制类型已更新:', {
        类型: type,
        说明: getAdTypeDescription(type)
      })
    } catch (error) {
      console.error('保存广告控制类型失败:', error)
    }
  }

  return {
    // 状态
    adType,
    adTypeDescription: currentAdTypeDescription,
    showBanner,
    showRewarded,
    showInterstitial,
    // 方法
    setAdType,
    // 常量
    AD_CONTROL_TYPES
  }
}) 