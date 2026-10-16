import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// ==================== 广告独立开关（2026-10 起运营端按类型单独控制） ====================
// 数据源：t_community 四列 ad_splash / ad_banner / ad_rewarded / ad_interstitial（1开 0关 NULL沿用旧枚举）
// 旧版兼容：运营端改动时会同步回写 ad_prod_app 枚举，老 App 包按枚举照常工作

// 旧广告类型枚举（对应改造前 t_community.ad_prod_app，保留用于映射与日志）
export const AD_CONTROL_TYPES = {
  NONE: '0',        // 不显示任何广告（含开屏）
  SPLASH_ONLY: '04', // 只显示开屏广告
  BANNER: '1',     // 开屏 + banner
  REWARDED: '11',   // 开屏 + banner + 激励
  INTERSTITIAL: '13' // 开屏 + banner + 插屏
}

// 旧枚举 → 四项独立开关映射（旧语义中除 '0'/'04' 外开屏恒开）
// 注意：ad_prod_app 列实际为数值型，'04' 存库后会退化成 4（接口返回 '4'），两个键都要认
export const AD_ENUM_TO_SWITCHES = {
  '0': { splash: 0, banner: 0, rewarded: 0, interstitial: 0 },
  '04': { splash: 1, banner: 0, rewarded: 0, interstitial: 0 },
  '4': { splash: 1, banner: 0, rewarded: 0, interstitial: 0 },
  '1': { splash: 1, banner: 1, rewarded: 0, interstitial: 0 },
  '11': { splash: 1, banner: 1, rewarded: 1, interstitial: 0 },
  '13': { splash: 1, banner: 1, rewarded: 0, interstitial: 1 }
}

// 开关组合 → 旧枚举回写映射（供运营端同步 ad_prod_app 兼容老 App 版本）
export function switchesToLegacyEnum(s) {
  const on = (v) => Number(v) === 1
  if (!on(s.banner) && !on(s.rewarded) && !on(s.interstitial)) return on(s.splash) ? '04' : '0'
  if (on(s.banner) && on(s.rewarded)) return '11'
  if (on(s.banner) && on(s.interstitial)) return '13'
  return '1'
}

// 广告控制本地缓存键：登录后按房间计算并写入（见 store/modules/user.js）。
// 新格式为对象 {splash,banner,rewarded,interstitial}；旧格式为枚举字符串（App.vue 读取时双兼容）
export const AD_CONTROL_STORAGE_KEY = 'taku_ad_control'

const norm = (v) => (Number(v) === 1 ? 1 : 0)

export const useAdControlStore = defineStore('adControl', () => {
  // 四项独立开关（内存态；开屏实际展示由 App.vue 冷启动读缓存决定，此处 splash 仅供日志/调试）
  const adSwitches = ref({ splash: 0, banner: 0, rewarded: 0, interstitial: 0 })

  // 兼容旧引用：由开关反推旧枚举值（仅用于日志描述）
  const adType = computed(() => switchesToLegacyEnum(adSwitches.value))
  const currentAdSwitches = computed(() => ({ ...adSwitches.value }))

  const getAdTypeDescription = (sws) => {
    const names = []
    if (norm(sws.splash)) names.push('开屏')
    if (norm(sws.banner)) names.push('横幅')
    if (norm(sws.rewarded)) names.push('激励')
    if (norm(sws.interstitial)) names.push('插屏')
    return names.length ? '显示：' + names.join(' + ') : '不显示任何广告'
  }
  const currentAdTypeDescription = computed(() => getAdTypeDescription(adSwitches.value))

  // 各类型展示判定（消费点：ad.js getAdId / adUtils.js / 页面 computed）
  const showBanner = computed(() => norm(adSwitches.value.banner) === 1)
  const showRewarded = computed(() => norm(adSwitches.value.rewarded) === 1)
  const showInterstitial = computed(() => norm(adSwitches.value.interstitial) === 1)
  const showSplash = computed(() => norm(adSwitches.value.splash) === 1)

  // App 内广告是否全关：横幅/激励/插屏三者皆关（开屏不受 VIP 影响，单列不参与）
  const isAdsDisabled = computed(
    () => !showBanner.value && !showRewarded.value && !showInterstitial.value
  )

  // 设置独立开关（传入部分键即可，未传的保持原值）
  function setAdSwitches(partial) {
    adSwitches.value = {
      ...adSwitches.value,
      splash: norm(partial.splash ?? adSwitches.value.splash),
      banner: norm(partial.banner ?? adSwitches.value.banner),
      rewarded: norm(partial.rewarded ?? adSwitches.value.rewarded),
      interstitial: norm(partial.interstitial ?? adSwitches.value.interstitial)
    }
    console.log('广告独立开关已更新:', { ...adSwitches.value })
  }

  // 兼容旧接口：按旧枚举设置四项开关（旧调用方 setAdType('13') 等无需改动）
  function setAdType(type) {
    setAdSwitches(AD_ENUM_TO_SWITCHES[String(type)] || AD_ENUM_TO_SWITCHES['0'])
  }

  // 【VIP 免广告专用】只关界面三类广告，开屏不动（VIP 不免开屏；开屏本就不受 store 控制）
  function setVipAdsOff() {
    setAdSwitches({ banner: 0, rewarded: 0, interstitial: 0 })
  }

  return {
    // 状态
    adSwitches: currentAdSwitches,
    adType,
    adTypeDescription: currentAdTypeDescription,
    showBanner,
    showRewarded,
    showInterstitial,
    showSplash,
    isAdsDisabled,
    // 方法
    setAdSwitches,
    setAdType,
    setVipAdsOff,
    // 常量
    AD_CONTROL_TYPES
  }
})
