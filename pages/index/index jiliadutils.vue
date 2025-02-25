<template>
  <view>
    <button type="primary" @click="handleShowAd">显示广告</button>
  </view>
</template>

<script setup>
import { onUnmounted } from 'vue'
import { onReady } from '@dcloudio/uni-app'
import { adManager } from '@/utils/adUtils'
import { useAdStore } from '@/store/modules/ad'

// 显示广告
const handleShowAd = async () => {
  try {
    console.log('准备显示广告')
    if (!adManager) {
      throw new Error('广告管理器未初始化')
    }
    await adManager.showAd()
  } catch (err) {
    console.error('显示广告失败', err)
    uni.showToast({
      title: '广告加载失败',
      icon: 'none'
    })
  }
}

// 在页面准备就绪后初始化广告
onReady(() => {
  try {
    console.log('开始初始化广告')
    const adStore = useAdStore()
    // 初始化store
    adManager.initStore(adStore)
    // 设置广告回调参数
    adManager.setUrlCallback({
      userId: 'testuser',
      extra: 'testdata'
    })
    // 初始化广告
    adManager.init()
    console.log('广告初始化完成')
  } catch (err) {
    console.error('初始化广告失败', err)
    uni.showToast({
      title: '广告初始化失败',
      icon: 'none'
    })
  }
})

// 清理广告实例
onUnmounted(() => {
  try {
    adManager.destroy()
    console.log('广告实例已清理')
  } catch (err) {
    console.error('清理广告实例失败', err)
  }
})
</script>

<style>

</style>
