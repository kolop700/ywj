import { defineStore } from 'pinia'
import { ref } from 'vue'

// 定义广告 ID
// 【安卓】
// 星云小卫-Android-banner  :1775833252
// 星云小卫-Android-插屏：1438927711  
// 星云小卫-Android-激励视频：1339603001
// 星云小卫-Android-原生信息流：1477293195
// 【ios】
// ios-banner：1555981719
// ios-插屏：1762186846  
// ios-激励视频：1838654998
// 以上是正式id，直接使用即可。正式id刚出来，建议晚些再试，发版（上线）时必须使用正式id
const AD_IDS = {
  android: {
    banner: '1775833252',
    interstitial: '1438927711',
    rewardedVideo: '1339603001',
	informationflow: '1477293195',
  },
  ios: {
    banner: '1555981719',
    interstitial: '1762186846',
    rewardedVideo: '1838654998'
  },
  test: {
    banner: '1111111111',
    interstitial: '1111111113',
    rewardedVideo: '1507000689'
  }
}

// 创建广告状态管理
export const useAdStore = defineStore('ad', () => {
  const isTestMode = ref(true) // 默认关闭测试模式

  // 获取当前平台
  const getPlatform = () => {
    const platform = uni.getSystemInfoSync().platform
    return platform === 'android' || platform === 'ios' ? platform : 'android'
  }

  // 获取广告ID
  const getAdId = (type) => {
    const platform = isTestMode.value ? 'test' : getPlatform()
    return AD_IDS[platform]?.[type] || ''
  }

  // 获取横幅广告ID
  const getBannerAdId = () => getAdId('banner')

  // 获取插屏广告ID
  const getInterstitialAdId = () => getAdId('interstitial')

  // 获取激励视频广告ID
  const getRewardedVideoAdId = () => getAdId('rewardedVideo')

  // 获取信息流广告ID
  const getInformationFlowAdId = () => getAdId('informationflow')

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
    setTestMode,
    getTestMode
  }
})

// const adStore = useAdStore()
// // 启用测试模式
// adStore.setTestMode(true)
// // 获取广告 ID
// const bannerAdId = adStore.getBannerAdId()
// console.log('Banner Ad ID:', bannerAdId)

// const interstitialAdId = adStore.getInterstitialAdId()
// console.log('Interstitial Ad ID:', interstitialAdId)

// const rewardedVideoAdId = adStore.getRewardedVideoAdId()
// console.log('Rewarded Video Ad ID:', rewardedVideoAdId)

// // 禁用测试模式
// adStore.setTestMode(false)