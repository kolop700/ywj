<template>
  <view class="content">
    <!-- 广告组件 -->
    <view class="ad-view" >
      <ad :adpid="bannerAdId" @load="onload" @close="onclose" @error="onerror"></ad>
    </view>
    <view class="ad-view" >
      <ad :adpid="bannerAdId" @load="onload" @close="onclose" @error="onerror"></ad>
    </view>
    <view class="ad-view" >
      <ad :adpid="bannerAdId" @load="onload" @close="onclose" @error="onerror"></ad>
    </view> 
  </view>
</template>

<script setup>
import { ref, getCurrentInstance } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
const { proxy } = getCurrentInstance()
const adStore = proxy.$store.ad.useAdStore()
const isAdLoaded = ref(false) // 控制广告加载状态
const bannerAdId = ref('')

onLoad(() => {
  // 获取横幅广告 ID
  bannerAdId.value = adStore.getBannerAdId()
  console.log("bannerAdId", bannerAdId.value)
})

const onload = () => {
  console.log("广告加载成功")
  isAdLoaded.value = true // 广告加载成功后，设置标志为 true
}

const onclose = (e) => {
  console.log("广告关闭: " + e.detail)
  isAdLoaded.value = false // 广告关闭后，恢复公告横幅
}

const onerror = (e) => {
  console.log("广告错误: " + e.detail.errCode + " message: " + e.detail.errMsg)
  isAdLoaded.value = false // 广告加载失败时，显示公告横幅
}
</script>

<style>
.content {
  background-color: #DBDBDB;
}
.ad-view {
  background-color: #FFFFFF;
}
</style>
