<template>
  <view>
    <button type="primary" @click="showAd">显示广告</button>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// 广告实例
const rewardedVideoAd = ref(null)

// 服务器回调参数
const urlCallback = {
  userId: 'testuser',
  extra: 'testdata'
}

// 广告回调处理
const handleAdClose = (res) => {
  if (res && res.isEnded) {
    // 正常播放结束，可以获得奖励
    console.log("广告播放完成，发放奖励")
    // TODO: 在这里处理奖励逻辑
  } else {
    // 播放中途退出，不能获得奖励
    console.log("广告播放中途退出，不能获得奖励")
  }
}

// 显示广告方法
const showAd = async () => {
  if (!rewardedVideoAd.value) return
  
  try {
    await rewardedVideoAd.value.show()
  } catch (err) {
    console.log('激励广告显示失败', err)
    // 可以尝试重新加载广告
    rewardedVideoAd.value.load()
      .then(() => rewardedVideoAd.value.show())
      .catch(err => {
        console.log('激励广告重新加载失败', err)
        uni.showToast({
          title: '广告加载失败',
          icon: 'none'
        })
      })
  }
}

onMounted(() => {
  // 初始化激励视频广告
  rewardedVideoAd.value = uni.createRewardedVideoAd({
    adpid: '1507000689',
    urlCallback // 服务器回调透传参数
  })

  // 监听广告加载事件
  rewardedVideoAd.value.onLoad(() => {
    console.log('激励广告加载成功')
  })

  // 监听广告错误事件
  rewardedVideoAd.value.onError((err) => {
    console.log('激励广告加载失败', err)
    uni.showToast({
      title: '广告加载失败',
      icon: 'none'
    })
  })

  // 监听广告关闭事件
  rewardedVideoAd.value.onClose((res) => {
    handleAdClose(res)
  })

  // 预加载广告
  rewardedVideoAd.value.load()
})

// 在组件卸载时清理广告实例
onUnmounted(() => {
  if (rewardedVideoAd.value) {
    rewardedVideoAd.value.destroy()
    rewardedVideoAd.value = null
  }
})
</script>

<style>

</style>
