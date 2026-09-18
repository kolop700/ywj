import TakuAds from '@/common/taku-sdk'
import { useAdStore } from '../store/modules/ad'
import { useAdControlStore } from '../store/modules/adControl'

/**
 * 广告管理器（Taku 版）
 * 保留 uni-ad 时代的展示策略：后端房间 ad_prod_app → adType → 激励/插屏选择、
 * 激励失败降级插屏、每日 15 次上限与最小间隔限制；
 * 底层广告实例由 uni.createRewardedVideoAd/createInterstitialAd 替换为 TakuAds（Taku 聚合 SDK）。
 */
class AdManager {
  constructor() {
    this.adStore = null
    this.adControlStore = null
    this.urlCallback = null

    // 广告加载状态（Taku 加载/展示/关闭事件集中在 load 时注册的回调对象中）
    this.rewardedLoaded = false
    this.interstitialLoaded = false
    this.rewardedLoading = false
    this.interstitialLoading = false

    // 等待加载完成的一次性回调（ensureAdReady 使用）
    this.rewardedWaiters = []
    this.interstitialWaiters = []

    // 广告配置
    this.config = {
      maxDailyCount: 15,    // 每天最大展示次数
      minInterval: 10000,   // 最小间隔时间（毫秒）
      resetHour: 0,         // 每天重置时间（0-23）
      resetMinute: 0        // 重置分钟（0-59）
    }
    this.state = null
  }

  // 设置URL回调参数（Taku 时代暂无使用，保留字段避免改动调用方）
  setUrlCallback(callback) {
    this.urlCallback = callback
  }

  // 初始化store
  initStore(adStore, adControlStore) {
    console.log('初始化广告 Store:', {
      adStore: !!adStore,
      adControlStore: !!adControlStore
    })

    this.adStore = adStore
    this.adControlStore = adControlStore

    if (!this.adStore || !this.adControlStore) {
      console.error('Store 初始化失败')
      return
    }

    console.log('Store 初始化成功，当前广告控制状态:', {
      广告类型: this.adControlStore.adTypeDescription,
      是否显示激励广告: this.adControlStore.showRewarded,
      是否显示插屏广告: this.adControlStore.showInterstitial
    })

    // 初始化状态
    this.initState()
  }

  // 获取今天的重置时间戳
  getTodayResetTimestamp() {
    const now = new Date()
    const resetTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      this.config.resetHour,
      this.config.resetMinute,
      0,
      0
    )

    // 如果当前时间小于重置时间，返回前一天的重置时间
    if (now < resetTime) {
      resetTime.setDate(resetTime.getDate() - 1)
    }

    return resetTime.getTime()
  }

  // 初始化状态
  initState() {
    const savedState = uni.getStorageSync('adState') || {}
    const currentResetTimestamp = this.getTodayResetTimestamp()

    // 检查是否需要重置（如果没有上次重置时间或上次重置时间小于当前重置时间）
    if (!savedState.lastResetTime || savedState.lastResetTime < currentResetTimestamp) {
      this.state = {
        lastResetTime: currentResetTimestamp,
        rewardedCount: 0,
        interstitialCount: 0,
        lastRewardedTime: 0,
        lastInterstitialTime: 0
      }
      console.log('广告计数已重置')
    } else {
      this.state = savedState
    }

    this.saveState()
  }

  // 检查是否需要重置状态
  checkAndResetState() {
    const currentResetTimestamp = this.getTodayResetTimestamp()
    if (!this.state || this.state.lastResetTime < currentResetTimestamp) {
      this.state = {
        lastResetTime: currentResetTimestamp,
        rewardedCount: 0,
        interstitialCount: 0,
        lastRewardedTime: 0,
        lastInterstitialTime: 0
      }
      this.saveState()
      console.log('广告计数已重置')
      return true
    }
    return false
  }

  // 保存状态到本地存储
  saveState() {
    uni.setStorageSync('adState', this.state)
  }

  // 当前是否需要预加载某类广告（有广告位配置且开关允许）
  shouldLoad(type) {
    if (!this.adControlStore) return false
    if (!TakuAds.isReady()) return false
    if (this.adControlStore.adType === this.adControlStore.AD_CONTROL_TYPES.NONE) return false
    const id = type === 'rewarded'
      ? this.adStore.getRewardedVideoAdId()
      : this.adStore.getInterstitialAdId()
    return !!id
  }

  // 加载激励广告并注册全生命周期事件
  loadRewarded() {
    if (this.rewardedLoaded || this.rewardedLoading) return
    const id = this.adStore.getRewardedVideoAdId()
    if (!id) return

    this.rewardedLoading = true
    console.log('加载激励广告, placementId:', id)
    TakuAds.loadRewardedVideoAd({
      placementId: id
    }, {
      onAdLoaded: (placementId) => {
        this.rewardedLoading = false
        this.rewardedLoaded = true
        console.log('激励广告加载成功', placementId)
        this.resolveWaiters('rewarded', true)
      },
      onAdFailed: ({ placementId, error }) => {
        this.rewardedLoading = false
        this.rewardedLoaded = false
        console.log('激励广告加载失败', placementId, error)
        this.resolveWaiters('rewarded', false)
        // 激励广告无填充时，若允许插屏则尝试插屏展示
        if (this.canShowAd('interstitial')) {
          this.showInterstitialAd()
        }
      },
      onAdShow: (placementId) => {
        console.log('激励广告展示', placementId)
        this.updateAdCount('rewarded')
      },
      onAdClicked: (placementId) => {
        console.log('激励广告点击', placementId)
      },
      onAdClosed: (placementId) => {
        console.log('激励广告关闭', placementId)
      },
      onAdPlayStart: (placementId) => {
        console.log('激励广告开始播放', placementId)
      },
      onAdPlayEnd: (placementId) => {
        console.log('激励广告播放结束', placementId)
      },
      onReward: ({ placementId, rewardAmount }) => {
        console.log('激励广告发放奖励', placementId, rewardAmount)
      }
    })
  }

  // 加载插屏广告并注册全生命周期事件
  loadInterstitial() {
    if (this.interstitialLoaded || this.interstitialLoading) return
    const id = this.adStore.getInterstitialAdId()
    if (!id) return

    this.interstitialLoading = true
    console.log('加载插屏广告, placementId:', id)
    TakuAds.loadInterstitialAd({
      placementId: id
    }, {
      onAdLoaded: (placementId) => {
        this.interstitialLoading = false
        this.interstitialLoaded = true
        console.log('插屏广告加载成功', placementId)
        this.resolveWaiters('interstitial', true)
      },
      onAdFailed: ({ placementId, error }) => {
        this.interstitialLoading = false
        this.interstitialLoaded = false
        console.log('插屏广告加载失败', placementId, error)
        this.resolveWaiters('interstitial', false)
      },
      onAdShow: (placementId) => {
        console.log('插屏广告展示', placementId)
        this.updateAdCount('interstitial')
      },
      onAdClicked: (placementId) => {
        console.log('插屏广告点击', placementId)
      },
      onAdClosed: (placementId) => {
        console.log('插屏广告关闭', placementId)
      }
    })
  }

  // 等待某类广告加载完成（超时 5s 返回 false）
  ensureAdReady(type, timeout = 5000) {
    return new Promise((resolve) => {
      const loaded = type === 'rewarded' ? this.rewardedLoaded : this.interstitialLoaded
      if (loaded) {
        resolve(true)
        return
      }
      const waiters = type === 'rewarded' ? this.rewardedWaiters : this.interstitialWaiters
      waiters.push(resolve)
      setTimeout(() => {
        this.resolveWaiters(type, false)
      }, timeout)
    })
  }

  resolveWaiters(type, result) {
    const waiters = type === 'rewarded' ? this.rewardedWaiters : this.interstitialWaiters
    while (waiters.length > 0) {
      const fn = waiters.shift()
      if (typeof fn === 'function') fn(result)
    }
  }

  // 初始化广告（预加载激励与插屏；页面 onLoad 时调用，展示策略同 uni-ad 时代）
  init() {
    if (!this.adStore) {
      console.error('请先调用 initStore 初始化 store')
      return
    }
    if (this.shouldLoad('rewarded')) {
      this.loadRewarded()
    }
    if (this.shouldLoad('interstitial')) {
      this.loadInterstitial()
    }
  }

  // 更新广告计数（onAdShow 触发，即"真实展示"后计数）
  updateAdCount(type) {
    if (type === 'rewarded') {
      this.state.rewardedCount++
      this.state.lastRewardedTime = Date.now()
      console.log(`激励广告展示次数：${this.state.rewardedCount}/${this.config.maxDailyCount}`)
    } else if (type === 'interstitial') {
      this.state.interstitialCount++
      this.state.lastInterstitialTime = Date.now()
      console.log(`插屏广告展示次数：${this.state.interstitialCount}/${this.config.maxDailyCount}`)
    }
    this.saveState()
  }

  // 显示广告（自动选择类型：激励优先，失败降级插屏；与 uni-ad 时代行为一致）
  async showAd() {
    if (!this.adStore || !this.adControlStore) {
      console.error('广告 Store 未初始化')
      return false
    }

    if (this.adControlStore.adType === this.adControlStore.AD_CONTROL_TYPES.NONE) {
      console.log('广告功能已关闭，当前广告类型:', this.adControlStore.adType)
      return false
    }

    // SDK 未初始化成功（插件未集成/未配置）时不展示
    if (!TakuAds.isReady()) {
      console.log('Taku SDK 未就绪，跳过广告展示')
      return false
    }

    const preferredType = this.adControlStore.showRewarded ? 'rewarded' : 'interstitial'

    if (preferredType === 'rewarded' && !this.adControlStore.showRewarded) {
      return false
    }
    if (preferredType === 'interstitial' && !this.adControlStore.showInterstitial) {
      return false
    }

    // 先检查限制，避免不必要的广告加载
    if (!this.checkDailyLimit(preferredType) || !this.canShowAd(preferredType)) {
      return false
    }

    if (preferredType === 'rewarded' && this.adControlStore.showRewarded) {
      try {
        const result = await this.showRewardedAd()
        if (!result && this.adControlStore.showInterstitial) {
          console.log('激励广告失败，尝试显示插屏广告')
          // 在尝试插屏广告之前也要检查限制
          if (!this.checkDailyLimit('interstitial') || !this.canShowAd('interstitial')) {
            return false
          }
          return await this.showInterstitialAd()
        }
        return result
      } catch (error) {
        console.error('广告展示失败，详细错误:', error)
        return false
      }
    } else if (this.adControlStore.showInterstitial) {
      console.log('直接展示插屏广告')
      return await this.showInterstitialAd()
    }

    console.log('无可用广告类型')
    return false
  }

  // 显示激励广告
  async showRewardedAd() {
    const id = this.adStore.getRewardedVideoAdId()
    if (!id) {
      console.error('激励广告位未配置（ad.js 中填入 Taku placementId）')
      return false
    }

    // 未加载完成则等待（load 已在 init/首次展示时触发）
    if (!this.rewardedLoaded) {
      if (!this.rewardedLoading) {
        this.loadRewarded()
      }
      const ready = await this.ensureAdReady('rewarded')
      if (!ready) {
        console.error('激励广告加载未就绪')
        return false
      }
    }

    try {
      console.log('开始展示激励广告')
      TakuAds.showRewardedVideoAd({ placementId: id })
      console.log('激励广告展示指令已发送')
      return true
    } catch (error) {
      console.error('激励广告展示异常:', error)
      return false
    }
  }

  // 显示插屏广告
  async showInterstitialAd() {
    const id = this.adStore.getInterstitialAdId()
    if (!id) {
      console.error('插屏广告位未配置（ad.js 中填入 Taku placementId）')
      return false
    }

    if (!this.interstitialLoaded) {
      if (!this.interstitialLoading) {
        this.loadInterstitial()
      }
      const ready = await this.ensureAdReady('interstitial')
      if (!ready) {
        console.error('插屏广告加载未就绪')
        return false
      }
    }

    try {
      console.log('开始展示插屏广告')
      TakuAds.showInterstitialAd({ placementId: id })
      console.log('插屏广告展示指令已发送')
      return true
    } catch (error) {
      console.error('插屏广告展示异常:', error)
      return false
    }
  }

  // 检查是否可以展示广告
  canShowAd(type) {
    if (!this.state) return false
    const now = Date.now()
    const lastTime = type === 'rewarded' ? this.state.lastRewardedTime : this.state.lastInterstitialTime
    const timeDiff = now - lastTime
    if (timeDiff < this.config.minInterval) {
      console.log(`广告展示间隔不足${this.config.minInterval / 1000}秒`)
      return false
    }
    return true
  }

  // 检查是否达到每日限制
  checkDailyLimit(type) {
    this.checkAndResetState() // 检查是否需要重置
    const count = type === 'rewarded' ? this.state.rewardedCount : this.state.interstitialCount

    if (count >= this.config.maxDailyCount) {
      console.log(`广告展示受限：${type}类型已达到每日${this.config.maxDailyCount}次限制`)
      return false
    }
    return true
  }

  // 获取当前广告统计信息
  getAdStats() {
    this.checkAndResetState()
    return {
      rewardedCount: this.state.rewardedCount,
      interstitialCount: this.state.interstitialCount,
      maxDailyCount: this.config.maxDailyCount,
      nextResetTime: new Date(this.getTodayResetTimestamp() + 24 * 60 * 60 * 1000)
    }
  }

  // 销毁广告状态（Taku 无独立 destroy API，重置状态即可；页面退出时可选调用）
  destroy() {
    this.rewardedLoaded = false
    this.interstitialLoaded = false
    this.rewardedLoading = false
    this.interstitialLoading = false
    this.rewardedWaiters = []
    this.interstitialWaiters = []
  }
}

// 导出单例
export const adManager = new AdManager()
