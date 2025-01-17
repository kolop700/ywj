<template>
  <view class="container">
    <view class="title">设备</view>
    <!-- 滚动视图用于设备按钮 -->
    <scroll-view scroll-y="true" class="scroll-container">
      <view v-for="(item, index) in deviceList" :key="index" class="flex flex-direction">
        <button 
          :class="['cu-btn login-button', item.selected ? 'bg-red' : 'textsecondary']" 
          @tap="toggleSelection(item.id)"
        >{{ item.name }}</button>
      </view>
    </scroll-view>
    <view class="divider-botton"></view>
    <view class="divider_40rpx"></view>
    <view class="info-section">
      <view class="info-item" @click="showStartPicker = true">
        <text class="label">开始时间:</text>
        <text class="value">{{ formatDateTime(startDateTime) }}</text>
        <up-datetime-picker
          ref="startPickerRef"
          :show="showStartPicker"
          v-model="startDateTime"
          mode="datetime"
          :formatter="formatter"
          :min-date="currentTime"
          @confirm="onStartTimeConfirm"
          @cancel="showStartPicker = false"
          @close="showStartPicker = false"
          :show-seconds="true"
        ></up-datetime-picker>
      </view>
      <view class="divider"></view>
      <view class="info-item" @click="showEndPicker = true">
        <text class="label">结束时间:</text>
        <text class="value">{{ formatDateTime(endDateTime) }}</text>
        <up-datetime-picker
          ref="endPickerRef"
          :show="showEndPicker"
          v-model="endDateTime"
          mode="datetime"
          :formatter="formatter"
          :min-date="startDateTime"
          :max-date="maxEndTime"
          @confirm="onEndTimeConfirm"
          @cancel="showEndPicker = false"
          @close="showEndPicker = false"
          :show-seconds="true"
        ></up-datetime-picker>
      </view>
      <view class="divider"></view>
      <view class="info-item">
        <picker mode="selector" :range="validTimesRange" :value="validTimes" @change="bindValidTimesChange">
          <view class="picker">
            <text class="label">有效次数:</text>
            <text class="value">{{ validTimes }}</text>
            <text class="endlabel">(0表示无限次)</text>
          </view>
        </picker>
      </view>
      <view class="divider"></view>
      <view class="info-item">
        <text class="label">开门密码:</text>
        <text class="value">{{ doorPassword }}</text>
      </view>
      <view class="divider"></view>
    </view>
    <view class="flex flex-direction button-view">
      <button class="cu-btn line-red login-button" @tap="refresh">刷新</button>
      <button class="cu-btn bg-red login-button" @tap="shareKeys">保存并分享钥匙</button>
    </view>
  </view>
</template>

<script setup>
import { ref, getCurrentInstance, computed, onMounted } from 'vue'
import { onReady } from '@dcloudio/uni-app'

const { proxy } = getCurrentInstance()
const userStore = proxy.$store.user.useUserStore()
const deviceApi = proxy.$api.device

// 数据定义
const now = new Date()
const end = new Date(now.getTime() + 24 * 60 * 60 * 1000)

const deviceList = ref([])
const startDateTime = ref(now.getTime())
const endDateTime = ref(end.getTime())
const showStartPicker = ref(false)
const showEndPicker = ref(false)
const validTimesRange = ref(['0', '1', '2', '3', '4', '5'])
const validTimes = ref(0)
const doorPassword = ref(generateRandomPassword())
const startPickerRef = ref(null)
const endPickerRef = ref(null)

// 计算属性
const currentTime = computed(() => Date.now())
const maxEndTime = computed(() => startDateTime.value + (3 * 24 * 60 * 60 * 1000))

// 方法定义
const getDeviceList = async () => {
  try {
    const response = await deviceApi.getRemoteOpenDoorList(userStore.userId)
    if (response.data && Array.isArray(response.data)) {
      deviceList.value = response.data.map(item => ({
        id: item.door_id,
        name: item.door_name,
        selected: false
      }))
    }
  } catch (error) {
    console.error('获取设备列表失败:', error)
    uni.showToast({
      title: '获取设备列表失败',
      icon: 'none'
    })
  }
}

const toggleSelection = (id) => {
  const index = deviceList.value.findIndex(item => item.id === id)
  if (index !== -1) {
    deviceList.value[index].selected = !deviceList.value[index].selected
    deviceList.value = [...deviceList.value]
  }
}

const getSelectedDevices = () => {
  return deviceList.value.filter(item => item.selected)
}

const bindValidTimesChange = (e) => {
  validTimes.value = validTimesRange.value[e.detail.value]
}

const formatDateTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

const formatter = (type, value) => {
  if (type === 'year') return `${value}年`
  if (type === 'month') return `${value}月`
  if (type === 'day') return `${value}日`
  if (type === 'hour') return `${value}时`
  if (type === 'minute') return `${value}分`
  if (type === 'second') return `${value}秒`
  return value
}

function generateRandomPassword() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

const refresh = () => {
  doorPassword.value = generateRandomPassword()
}

const onStartTimeConfirm = (e) => {
  startDateTime.value = e.value
  showStartPicker.value = false
  
  if (endDateTime.value < startDateTime.value) {
    endDateTime.value = startDateTime.value + (24 * 60 * 60 * 1000)
  }
  if (endDateTime.value > maxEndTime.value) {
    endDateTime.value = maxEndTime.value
  }
}

const onEndTimeConfirm = (e) => {
  endDateTime.value = e.value
  showEndPicker.value = false
}

const shareKeys = async () => {
  if (endDateTime.value > maxEndTime.value) {
    uni.showToast({
      title: '结束时间不能超过开始时间后3天',
      icon: 'none'
    })
    return
  }
  
  const selectedDevices = getSelectedDevices()
  if (selectedDevices.length === 0) {
    uni.showToast({
      title: '请选择至少一个设备',
      icon: 'none'
    })
    return
  }

  try {
    // 处理设备ID列表
    const doorPhoneId = selectedDevices.map(device => device.id).join(',') + ','
    
    // 处理时间格式
    const startTime = formatDateTime(startDateTime.value)
    const endTime = formatDateTime(endDateTime.value)
    
    // 处理次数转换：0 转为 -1，其他数字保持不变
    const times = validTimes.value === '0' ? -1 : parseInt(validTimes.value)
    
    const params = {
      doorPhoneId,
      userId: userStore.userId,
      startTime,
      endTime,
      times,
      tempkey: parseInt(doorPassword.value)
    }
    const response = await deviceApi.saveTempKey(params)
    if (response.code === '0') {
      // 构建提示消息
      const message = `临时访客密码\n尊敬的访客朋友您好! 请您在规定的时间内,使用app扫描设备上的二维码并输入临时访问密钥,开启相应的通行权限。时间为${startTime}至${endTime}, 您的临时开门密码为:${doorPassword.value}`
      // 显示模态框
      uni.showModal({
        title: '临时访客密码',
        content: message,
        showCancel: true,
        cancelText: '关闭',
        confirmText: '复制内容',
        success: function (res) {
          if (res.confirm) {
            uni.setClipboardData({
              data: message,
              success: function () {
                uni.showToast({
                  title: '复制成功',
                  icon: 'success'
                })
              }
            })
          }
        }
      })
      refresh() // 刷新密码
    } else {
      throw new Error('保存失败')
    }
  } catch (error) {
    console.error('保存访客密码失败:', error)
    uni.showToast({
      title: '设置失败，请重试',
      icon: 'none'
    })
  }
}

// 生命周期钩子
onMounted(() => {
  getDeviceList()
})

onReady(() => {
  startPickerRef.value?.setFormatter?.(formatter)
  endPickerRef.value?.setFormatter?.(formatter)
})
</script>

<style scoped>
.nav-custom {
  padding: 20rpx;
  background-color: #fff;
}

.content {
  text-align: center;
  font-size: 32rpx;
  font-weight: 500;
}

.divider {
  height: 1rpx;
  background-color: #eee;
}

.divider_40rpx {
  height: 40rpx;
  background: #EEEEEE;
}

.title {
  background-color: white;
  padding-left: 24rpx;
  padding-top: 30rpx;
  font-family: PingFang SC, PingFang SC;
  font-weight: 800;
  font-size: 34rpx;
  color: #303030;
  line-height: 34rpx;
  text-align: left;
}

.scroll-container {
  max-height: 380rpx;
  background-color: white;
  padding: 20rpx 40rpx;
}

.flex {
  display: flex;
  justify-content: center;
  align-items: center;
}

.flex-direction {
  flex-direction: column;
}

.login-button {
  padding: 0 30rpx;
  height: 84rpx;
  width: 100%;
  margin-top: 17rpx;
  font-family: PingFang SC, PingFang SC;
  font-weight: 500;
  font-size: 28rpx;
  line-height: 28rpx;
}

.bg-red {
  background-color: #ff4d4f;
  color: white;
}

.line-red {
  border: 1px solid #ff4d4f;
  color: #ff4d4f;
  background-color: white;
}

.textsecondary {
  color: #ff4d4f;
  background-color: #EFEFEF;
  border: 1px solid #eee;
}

.divider-botton {
  background-color: white;
  width: 100%;
  height: 60rpx;
}

.info-section {
  background-color: white;
  border-radius: 10rpx;
  margin-top: 40rpx;
  padding: 0 40rpx;
}

.info-item {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  height: 80rpx;
  font-family: PingFang SC, PingFang SC;
  font-weight: 500;
  font-size: 30rpx;
  color: #303030;
  line-height: 30rpx;
}

.picker {
  width: 100%;
  display: flex;
  align-items: center;
}

.label {
  color: #888;
}

.endlabel {
  margin-left: 20rpx;
  color: #888;
}

.value {
  margin-left: 50rpx;
}

.button-view {
  background-color: white;
  margin: 40rpx;
}
</style>
