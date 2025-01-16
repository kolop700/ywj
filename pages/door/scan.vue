<template>
  <view class="container">
    <!-- 设备号显示 -->
    <view class="device-number">{{deviceNumber}}</view>
    <text class="tip-text">点击下面按钮开门</text>
    <!-- 开门按钮区域 -->
    <view class="door-control">
      <view class="door-button" @click="openDoor">
        <text>开门</text>
      </view>
    </view>

    <!-- 访客密码区域 -->
    <view class="visitor-section">
      <text class="section-title">访客密钥</text>
      <input 
        type="number" 
        v-model="visitorPassword"
        placeholder="请输入访客密码"
        class="custom-input"
      />
      <view class="button-container">
            <button 
              class="cu-btn login-button bg-red"
              :class="{'secondary': !isFormValid}"
              @click="openDoorWithPassword"
              type="submit"
            >提交申请</button>
          </view>
    </view>
  </view>
</template>

<script setup>
import { ref, getCurrentInstance, computed } from 'vue'
import { storeToRefs } from 'pinia'
const { proxy } = getCurrentInstance()
import { onLoad } from '@dcloudio/uni-app'
import doorAccessUtils from '@/utils/doorAccessUtils'
const deviceStore = proxy.$store.device.useDeviceStore()
const { deviceList } = storeToRefs(deviceStore)
const deviceNumber = ref('')
const visitorPassword = ref('')

// 判断表单是否有效的计算属性
const isFormValid = computed(() => {
  return visitorPassword.value.length >= 6 && /^\d+$/.test(visitorPassword.value)
})

// 页面加载时获取设备号
onLoad((options) => {
  if (options.device_number) {
    deviceNumber.value = options.device_number
  }
  console.log('设备列表:', deviceList.value)
})

// 直接开门
const openDoor = async () => {
  if (!deviceNumber.value) {
    uni.showToast({
      title: '设备号不能为空',
      icon: 'none'
    })
    return
  }

  try {
    // 查找匹配的设备
    const matchedDevice = deviceList.value.find(device => device.door_qr_code === deviceNumber.value)
    if (!matchedDevice) {
      uni.showToast({
        title: '未找到匹配的设备',
        icon: 'none'
      })
      return
    }
    await doorAccessUtils.openDoor(matchedDevice)
    uni.showToast({
      title: '开门成功',
      icon: 'success'
    })
  } catch (error) {
    uni.showToast({
      title: '开门失败',
      icon: 'none'
    })
  }
}

// 使用访客密码开门
const openDoorWithPassword = async () => {
  if (!deviceNumber.value) {
    uni.showToast({
      title: '设备号不能为空',
      icon: 'none'
    })
    return
  }

  if (!visitorPassword.value) {
    uni.showToast({
      title: '请输入访客密码',
      icon: 'none'
    })
    return
  }

  try {
    await doorAccessUtils.openDoorWithPassword(deviceNumber.value, visitorPassword.value)
    uni.showToast({
      title: '开门成功',
      icon: 'success'
    })
  } catch (error) {
    uni.showToast({
      title: '密码错误或已过期',
      icon: 'none'
    })
  }
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background-color: #FFFFFF;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx;
}

.device-number {
  font-size: 32rpx;
  color: #333333;
  margin-bottom: 10rpx;
}

.door-control {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 30rpx;
}

.door-button {
  width: 250rpx !important;
  height: 250rpx !important;
    background-image: url('data:image/png;base64,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'); 
  background-size: cover; 
  background-position: center; 
  border: none; 
  border-radius: 50%; 
  color: white; 
  font-size: 36rpx; 
  line-height: 250rpx; 
  text-align: center; 
  cursor: pointer; 
  transition: all 0.2s ease;
  box-shadow: 0 6rpx 16rpx rgba(0, 122, 255, 0.3);
  transform: scale(1);
  
  &:active {
    transform: scale(0.85);
    box-shadow: 0 2rpx 8rpx rgba(0, 122, 255, 0.2);
  }
  
  text {
    color: #FFFFFF;
    font-size: 36rpx;
    font-weight: bold;
  }
}

.tip-text {
  font-size: 28rpx;
  color: #999999;
  margin-bottom: 20rpx;
}

.visitor-section {
  width: 100%;
  border-radius: 20rpx;
  box-sizing: border-box;
}

.section-title {
  font-size: 32rpx;
  color: #333333;
  margin-bottom: 30rpx;
  display: block;
}

.custom-input {
  border: 1px solid #ddd;
  border-radius: 8rpx;
  margin-bottom: 20rpx;
  background: #F9F9F9;
  height: 100rpx;
  display: flex;
  align-items: center;
  padding: 0 30rpx;
  font-size: 30rpx;
  line-height: 30rpx;
  box-sizing: border-box;
  width: 100%;
}

.button-container {
  display: flex;
  width: 100%;
  justify-content: center;
  margin-top: 10rpx;
}

.login-button {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 32rpx;
  text-align: center;
  font-weight: bold;
  border-radius: 8rpx;
}

.login-button.secondary {
  background-color: #FCA5A7;
}
</style> 