<template>
  <view class="container">
    <!-- 设备号显示 -->
    <view class="device-number">{{deviceNumber}}</view>
    <text class="tip-text">{{searchStatus}}</text>
    <!-- 开门按钮区域 -->
    <view class="door-control">
      <view class="door-button" @click="openDoor">
        <text>一键开门</text>
      </view>
	  <view class="door-ble-button" @click="openBleDoor" v-if="isDeviceFound">
	    <text>蓝牙开门</text>
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
import { ref, getCurrentInstance, computed, inject, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
const { proxy } = getCurrentInstance()
import { onLoad } from '@dcloudio/uni-app'
import doorAccessUtils from '@/utils/doorAccessUtils'
import visitorPasswordUtils from '@/utils/visitorPasswordUtils'

// 注入蓝牙实例
const doorBleUtils = inject('doorBleUtils')

const deviceStore = proxy.$store.device.useDeviceStore()
const deviceApi = proxy.$api.device
const { deviceList } = storeToRefs(deviceStore)
const deviceNumber = ref('')
const visitorPassword = ref('')
const matchedDevice = ref(null)

// 添加 userStore
const userStore = proxy.$store.user.useUserStore()

// 添加设备搜索状态
const searchStatus = ref('正在搜索设备...')
const isDeviceFound = ref(false)

// 判断表单是否有效的计算属性
const isFormValid = computed(() => {
  return visitorPassword.value.length >= 6 && /^\d+$/.test(visitorPassword.value)
})

// 页面加载时获取设备号和查找设备
onLoad((options) => {
  if (options.device_number) {
    deviceNumber.value = options.device_number
    console.log('设备号:', deviceNumber.value)
    // 查找匹配的设备并保存
    const device = deviceList.value.find(device => device.door_qr_code === deviceNumber.value)
    if (device) {
      matchedDevice.value = device
    } else {
      uni.showToast({
        title: '未找到匹配的设备',
        icon: 'none'
      })
    }
  }
  console.log('设备列表:', deviceList.value)
  console.log('匹配的设备:', matchedDevice.value)
})

// 搜索设备
const searchDevice = async () => {
  if (!deviceNumber.value) {
    uni.showToast({
      title: '设备号不能为空',
      icon: 'none'
    })
    return
  }

  try {
    // 初始化蓝牙
    if (!doorBleUtils) {
      throw new Error('蓝牙模块未初始化')
    }
    await doorBleUtils.bleUtils.initBluetooth()
    
    // 开始搜索设备
    searchStatus.value = '点击下面按钮开门，正在搜索设备...'
    isDeviceFound.value = false
    
    await doorBleUtils.bleUtils.startBluetoothDevicesDiscovery()
    
    // 监听设备
    const targetDeviceName = 'BMXWL' + deviceNumber.value
    
    // 设置超时
    const timeout = setTimeout(() => {
      if (!isDeviceFound.value) {
        searchStatus.value = '未找到设备，请确保设备在范围内'
        doorBleUtils.bleUtils.stopBluetoothDevicesDiscovery()
      }
    }, 10000)
    
    uni.onBluetoothDeviceFound(res => {
      res.devices.forEach(device => {
        if (device.name === targetDeviceName || device.localName === targetDeviceName) {
          clearTimeout(timeout)
          isDeviceFound.value = true
          searchStatus.value = '点击下面按钮开门，蓝牙设备已找到'
          // 保存找到的设备信息
          if (!matchedDevice.value) {
            const foundDevice = deviceList.value.find(d => d.door_qr_code === deviceNumber.value)
            if (foundDevice) {
              matchedDevice.value = foundDevice
              // 找到设备后停止搜索
              doorBleUtils.bleUtils.stopBluetoothDevicesDiscovery()
            }
          }
        }
      })
    })
  } catch (error) {
    console.error('搜索设备失败:', error)
    searchStatus.value = '点击下面按钮开门'
    isDeviceFound.value = false
  }
}

// 页面加载时开始搜索
onMounted(() => {
  if (deviceNumber.value) {
    searchDevice()
  }
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
    if (!matchedDevice.value) {
      const device = deviceList.value.find(device => device.door_qr_code === deviceNumber.value)
      if (device) {
        matchedDevice.value = device
      }
    }

    if (!matchedDevice.value) {
      uni.showToast({
        title: '设备未授权',
        icon: 'none'
      })
      return
    }

    // 优先尝试网络开门
    try {
      console.log('尝试网络开门')
      uni.showLoading({
        title: '正在开门...',
        mask: true
      })
      await doorAccessUtils.openDoor(matchedDevice.value)
      uni.hideLoading()
      uni.showToast({
        title: '开门成功',
        icon: 'success'
      })
    } catch (networkError) {
      uni.hideLoading()
      console.error('网络开门失败:', networkError)
      console.log('尝试蓝牙开门')
      // 网络开门失败后尝试蓝牙开门
      if (!doorBleUtils) {
        throw new Error('蓝牙模块未初始化')
      }
      await doorBleUtils.openDoorWithBle(matchedDevice.value, userStore.userId)
    }
  } catch (error) {
    uni.hideLoading()
    console.error('开门失败:', error)
    uni.showToast({
      title: '开门失败，请重试',
      icon: 'none',
      duration: 2000
    })
  }
}

// 修改蓝牙开门函数
const openBleDoor = async () => {
  if (!isDeviceFound.value) {
    uni.showToast({
      title: '请等待设备搜索完成',
      icon: 'none'
    })
    return
  }
  
  if (!deviceNumber.value) {
    uni.showToast({
      title: '设备号不能为空',
      icon: 'none'
    })
    return
  }

  try {
    uni.showLoading({
      title: '正在开门...',
      mask: true
    })

    if (!doorBleUtils) {
      throw new Error('蓝牙模块未初始化')
    }
    await doorBleUtils.openDoorWithBle(matchedDevice.value, userStore.userId)
    
    uni.hideLoading()
    uni.showToast({
      title: '开门成功',
      icon: 'success'
    })
  } catch (error) {
    uni.hideLoading()
    console.error('蓝牙开门失败:', error)
    uni.showToast({
      title: '开门失败，请重试',
      icon: 'none',
      duration: 2000
    })
  }
}

// 验证访客密码
const verifyVisitorPassword = async () => {
  if (!deviceNumber.value) {
    uni.showToast({
      title: '设备号不能为空',
      icon: 'none'
    })
    return false
  }

  if (!visitorPassword.value) {
    uni.showToast({
      title: '请输入访客密码',
      icon: 'none'
    })
    return false
  }

  // 获取新的序列号
  const sn = deviceStore.getSerialNo()
  
  // 处理密码值：如果是0或'0'，转换为-1
  const password = visitorPassword.value === '0' || visitorPassword.value === 0 ? -1 : parseInt(visitorPassword.value)
  
  // 调用访客密码验证接口
  return await visitorPasswordUtils.verifyPassword({
    password: password,
    deviceNumber: deviceNumber.value,
    sn: sn
  })
}

// 使用访客密码开门
const openDoorWithPassword = async () => {
  const verifyResult = await verifyVisitorPassword()
  if (!verifyResult.success) return
  
  // 验证成功后，调用开门接口
  await visitorPasswordUtils.openDoor({
    deviceNumber: deviceNumber.value,
    sn: verifyResult.sn
  })
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
  background-image: url('/static/icons/icon_open_door.png'); 
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
  transform: scale(1);
  
  &:active {
    transform: scale(0.85);
  }
  
  text {
    color: #FFFFFF;
    font-size: 36rpx;
    font-weight: bold;
  }
}

.door-ble-button {
  margin-top: 20rpx;
  width: 250rpx !important;
  height: 250rpx !important;
  background-image: url('/static/icons/icon_o_door.png'); 
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
  transform: scale(1);
  
  &:active {
    transform: scale(0.85);
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