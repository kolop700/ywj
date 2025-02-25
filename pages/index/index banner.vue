<template>
  <view class="content">
    <!-- 测试色块区域 -->
    <view class="test-block" style="background-color: #FF6B6B;">
      <text>区块1</text>
    </view>
    
    <view class="test-block" style="background-color: #4ECDC4;">
      <text>区块2</text>
    </view>
    
    <view class="test-block" style="background-color: #45B7D1;">
      <text>区块3</text>
    </view>
    
    <view class="test-block" style="background-color: #96CEB4;">
      <text>区块4</text>
    </view>
    
    <view class="test-block" style="background-color: #D4A5A5;">
      <text>区块5</text>
    </view>

    <!-- 广告区域 -->
    <view class="ad-view">
      <ad adpid="1111111111" @load="onload" @close="onclose" @error="onerror"></ad>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      title: 'ad-test'
    }
  },
  methods: {
    onload(e) {
      console.log("onload")
    },
    onclose(e) {
      console.log("onclose: " + e.detail)
    },
    onerror(e) {
      console.log("onerror: " + e.detail.errCode + " message:: " + e.detail.errMsg)
    }
  }
}
</script>

<style>
.content {
  background-color: #DBDBDB;
  padding: 10px;
  min-height: 100vh;
  box-sizing: border-box;
}

.test-block {
  height: 150rpx;
  margin-bottom: 10px;
  border-radius: 8rpx;
  display: flex;
  justify-content: center;
  align-items: center;
}

.test-block text {
  color: #FFFFFF;
  font-size: 32rpx;
  font-weight: bold;
}

.ad-view {
  background-color: #FFFFFF;
  border-radius: 8rpx;
  margin-top: 10px;
}
</style> 