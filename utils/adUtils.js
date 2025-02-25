import { useAdStore } from '../store/modules/ad'

class AdManager {
  constructor() {
    this.rewardedVideoAd = null
    this.interstitialAd = null
    this.adStore = null
    this.urlCallback = null
    
    // 广告配置
    this.config = {
      maxDailyCount: 15,    // 每天最大展示次数
      minInterval: 10000,   // 最小间隔时间（毫秒）
      resetHour: 0,         // 每天重置时间（0-23）
      resetMinute: 0        // 重置分钟（0-59）
    }
  }

  // 设置URL回调参数
  setUrlCallback(callback) {
    this.urlCallback = callback
  }

  // 初始化store
  initStore(store) {
    this.adStore = store
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
    if (this.state.lastResetTime < currentResetTimestamp) {
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

  // 初始化广告实例
  init() {
    if (!this.adStore) {
      console.error('请先调用initStore初始化store')
      return
    }

    // 初始化激励广告
    this.rewardedVideoAd = uni.createRewardedVideoAd({
      adpid: this.adStore.getRewardedVideoAdId(),
      urlCallback: this.urlCallback
    })

    this.setupAdListeners()
  }

  // 设置广告事件监听
  setupAdListeners() {
    if (!this.rewardedVideoAd) return

    // 激励广告事件
    this.rewardedVideoAd.onLoad(() => {
      console.log('激励广告加载成功')
    })

    this.rewardedVideoAd.onError((err) => {
      console.log('激励广告加载失败', err)
      uni.showToast({
        title: '广告加载失败',
        icon: 'none'
      })
    })

    this.rewardedVideoAd.onClose((res) => {
      if (res && res.isEnded) {
        // 正常播放结束，可以获得奖励
        console.log("广告播放完成，发放奖励")
        // TODO: 在这里处理奖励逻辑
      } else {
        // 播放中途退出，不能获得奖励
        console.log("广告播放中途退出，不能获得奖励")
      }
    })
  }

  // 检查是否可以展示广告
  canShowAd(lastTime) {
    const now = Date.now()
    return (now - lastTime) >= this.config.minInterval
  }

  // 检查是否达到每日限制
  checkDailyLimit(count) {
    this.checkAndResetState() // 检查是否需要重置
    return count < this.config.maxDailyCount
  }

  // 获取当前广告统计信息
  getAdStats() {
    this.checkAndResetState() // 检查是否需要重置
    return {
      rewardedCount: this.state.rewardedCount,
      interstitialCount: this.state.interstitialCount,
      maxDailyCount: this.config.maxDailyCount,
      nextResetTime: new Date(this.getTodayResetTimestamp() + 24 * 60 * 60 * 1000)
    }
  }

  // 显示广告
  async showAd() {
    if (!this.rewardedVideoAd) {
      console.error('广告未初始化')
      return
    }

    try {
      await this.rewardedVideoAd.show()
    } catch (err) {
      console.log('激励广告显示失败', err)
      // 尝试重新加载广告
      try {
        await this.rewardedVideoAd.load()
        await this.rewardedVideoAd.show()
      } catch (err) {
        console.log('激励广告重新加载失败', err)
        uni.showToast({
          title: '广告加载失败',
          icon: 'none'
        })
      }
    }
  }

  // 销毁广告实例
  destroy() {
    if (this.rewardedVideoAd) {
      this.rewardedVideoAd.destroy()
      this.rewardedVideoAd = null
    }
  }
}

// 导出单例
export const adManager = new AdManager()