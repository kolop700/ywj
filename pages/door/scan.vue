<template>
  <view class="container" :class="{ 'has-ad': bannerAdId }">
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
              class="cu-btn login-button"
              :class="{'secondary': !isFormValid}"
              @click="openDoorWithPassword"
              type="submit"
            >提交申请</button>
          </view>
    </view>

    <!-- 底部横幅广告（Taku）：常驻页面底部（fixed，不随滚动移动） -->
    <view class="ad-section" v-if="bannerAdId">
      <view class="ad-divider"></view>
      <view class="ad-view">
        <taku-banner :placement-id="bannerAdId"></taku-banner>
      </view>
    </view>
  </view>

  <!-- 脱机临时密码弹窗 -->
  <offline-pwd-popup
    :visible="showOfflinePwd"
    :device="offlineDevice"
    @close="showOfflinePwd = false"
  />
</template>

<script setup>
import { ref, getCurrentInstance, computed, inject, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
const { proxy } = getCurrentInstance()
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { adManager } from '@/utils/adUtils'
import doorAccessUtils from '@/utils/doorAccessUtils'
import visitorPasswordUtils from '@/utils/visitorPasswordUtils'
import OfflinePwdPopup from '@/components/offline-pwd-popup/offline-pwd-popup.vue'
// 注入蓝牙实例
const doorBleUtils = inject('doorBleUtils')

const deviceStore = proxy.$store.device.useDeviceStore()
const deviceApi = proxy.$api.device
const { deviceList } = storeToRefs(deviceStore)
const adStore = proxy.$store.ad.useAdStore()
const adControlStore = proxy.$store.adControl.useAdControlStore()
// 横幅广告位 ID（Taku placementId，空/全关时不展示；随 adType 自动响应更新）
const bannerAdId = computed(() => adStore.getBannerAdId())

const deviceNumber = ref('')
const visitorPassword = ref('')
const matchedDevice = ref(null)
// 预扫描找到的门锁蓝牙设备（传给 openDoorWithBle，避免开门时重复搜索）
const foundBleDevice = ref(null)

// 脱机密码弹窗状态
const showOfflinePwd = ref(false)
const offlineDevice = ref(null)

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
  // 初始化广告管理器（预加载激励/插屏广告）
  adManager.initStore(adStore, adControlStore)
  adManager.init()
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

// 蓝牙广播名归一化：去掉冒号/横线/空格等分隔符并转大写，规避 MAC 格式差异导致匹配失败
const normalizeBleName = (v) => String(v == null ? '' : v).replace(/[^0-9a-zA-Z]/g, '').toUpperCase()

// 目标门锁广播名（BMXWL + 门锁串号），用于界面提示与日志
const targetBleName = computed(() => `BMXWL${(matchedDevice.value && matchedDevice.value.door_mac) || deviceNumber.value || ''}`)

// 扫描定时器（模块级：开门时需要统一停止）
let bleDeadlineTimer = null
// 扫描代际：每轮搜索 +1；旧的 onBluetoothDeviceFound 监听器收到事件后直接忽略，
// 避免多次「重新扫描」累积的旧监听器用旧的匹配参数误判设备
let scanGen = 0

// 停止预扫描并清理定时器
const stopBleScan = () => {
  if (bleDeadlineTimer) { clearTimeout(bleDeadlineTimer); bleDeadlineTimer = null }
}

// 把 base64 广播数据（advertisData）解成可见字符，用于在「原始广播字节」里查找 BMXWL / 门锁串号
// （部分机型 device.name 拿不到名字，但名字其实以 ASCII 形式藏在广播数据里）
const advToVisibleText = (b64) => {
  if (!b64) return ''
  try {
    const raw = typeof atob === 'function' ? atob(b64) : ''
    let out = ''
    for (let i = 0; i < raw.length; i++) {
      const c = raw.charCodeAt(i)
      out += c >= 32 && c < 127 ? raw.charAt(i) : '.'
    }
    return out
  } catch (e) {
    return ''
  }
}

// 门锁命中判定：名字 / MAC / 原始广播字节 三重规则（任一命中即算）
const isDoorLockHit = (device, macNorm) => {
  const name = normalizeBleName(device.name)
  const localName = normalizeBleName(device.localName)
  const deviceIdNorm = normalizeBleName(device.deviceId)
  const advNorm = advToVisibleText(device.advertisData).toUpperCase().replace(/[^0-9A-Z]/g, '')
  return (
    name.startsWith('BMXWL') ||
    localName.startsWith('BMXWL') ||
    (macNorm.length >= 6 && (name.includes(macNorm) || localName.includes(macNorm))) ||
    (macNorm.length > 0 && deviceIdNorm === macNorm) ||
    advNorm.includes('BMXWL') ||
    (macNorm.length >= 6 && advNorm.includes(macNorm))
  )
}

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
    searchStatus.value = '正在搜索门锁，请保持靠近门锁...'
    isDeviceFound.value = false
    
    const seenIds = new Set()
    // 匹配依据：BMXWL 前缀 / 广播名含 door_mac / deviceId(MAC) 等于 door_mac / 原始广播字节含 BMXWL 或 door_mac
    const macNorm = normalizeBleName((matchedDevice.value && matchedDevice.value.door_mac) || deviceNumber.value)
    const myGen = ++scanGen
    stopBleScan()

    // 先注册监听、再启动扫描：避免开扫后最早上报的一批设备丢失
    // （原生可能在 startDiscovery 回包之前就开始上报事件）。
    // myGen 守卫：多次「重新扫描」后旧监听器被新代际取代，收到事件直接忽略，防止旧匹配参数误判。
    uni.onBluetoothDeviceFound(res => {
      if (myGen !== scanGen) return
      (res.devices || []).forEach(device => {
        if (!device || !device.deviceId) return
        seenIds.add(device.deviceId)
        const hit = isDoorLockHit(device, macNorm)
        console.log('[BLE] 发现设备:', {
          deviceId: device.deviceId,
          name: device.name,
          localName: device.localName,
          RSSI: device.RSSI,
          hit
        })
        if (isDeviceFound.value || !hit) return
        isDeviceFound.value = true
        // 保存找到的门锁蓝牙设备，开门时直接复用，避免重复搜索
        foundBleDevice.value = device
        // 保存匹配的业务设备信息
        if (!matchedDevice.value) {
          const foundDevice = deviceList.value.find(d => d.door_qr_code === deviceNumber.value)
          if (foundDevice) {
            matchedDevice.value = foundDevice
          }
        }
        // 找到设备后停止扫描并清理定时器
        if (bleDeadlineTimer) { clearTimeout(bleDeadlineTimer); bleDeadlineTimer = null }
        searchStatus.value = '点击下面按钮开门，蓝牙设备已找到'
        doorBleUtils.bleUtils.stopBluetoothDevicesDiscovery()
      })
    })

    // 持续扫描：一次开启、持续监听（与原版行为一致）。
    // 不再每 6 秒 stop/start 轮询重启：部分机型上频繁重启会导致系统残留扫描未清理，
    // startScan 触发 SCAN_FAILED_ALREADY_STARTED 后可能进入静默失败，JS 端以为在搜索实际已死。
    await doorBleUtils.bleUtils.startBluetoothDevicesDiscovery()
    console.log('[BLE] 开始搜索, 目标广播名:', targetBleName.value, ' macNorm:', macNorm)

    // 45 秒仍未命中：显示提示后自动开始下一轮搜索
    //（无需任何手动操作；离开页面或点击开门时由 stopBleScan 统一取消）
    bleDeadlineTimer = setTimeout(() => {
      if (isDeviceFound.value) return
      const noDevice = seenIds.size === 0
      searchStatus.value = noDevice
        ? '未找到设备，请确保已开启蓝牙/定位并授予「附近的设备」权限'
        : '尚未匹配到门锁，请保持靠近门锁...'
      doorBleUtils.bleUtils.stopBluetoothDevicesDiscovery()
      bleDeadlineTimer = setTimeout(() => {
        if (!isDeviceFound.value) searchDevice()
      }, noDevice ? 3000 : 800)
    }, 45000)
  } catch (error) {
    console.error('搜索设备失败:', error)
    // 权限被拒时给出明确指引，便于用户自查（Android 12+ 需要「附近的设备」权限）
    const msg = (error && (error.errMsg || error.msg || error.message)) || ''
    if (/权限|permission|auth/i.test(String(msg))) {
      searchStatus.value = '缺少蓝牙/「附近的设备」权限，请在系统设置中开启后重试'
    } else {
      searchStatus.value = '点击下面按钮开门'
    }
    isDeviceFound.value = false
  }
}

// 页面加载时开始搜索
onMounted(() => {
  if (deviceNumber.value) {
    searchDevice()
  }
})

// 离开页面时停止搜索并清理定时器，避免后台空转
onUnload(() => {
  stopBleScan()
  doorBleUtils?.bleUtils?.stopBluetoothDevicesDiscovery()
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
      // 开门成功后展示广告（Taku 激励/插屏，按 adType）
      try {
        const adResult = await adManager.showAd()
        if (!adResult) {
          console.log('广告展示受限：可能达到每日限制或间隔时间不足')
        }
      } catch (error) {
        console.error('广告展示失败:', error)
      }
    } catch (networkError) {
      uni.hideLoading()
      console.error('网络开门失败:', networkError)
      console.log('尝试蓝牙开门')
      // 网络开门失败后尝试蓝牙开门
      if (!doorBleUtils) {
        throw new Error('蓝牙模块未初始化')
      }
      await doorBleUtils.openDoorWithBle(matchedDevice.value, userStore.userId)
      // 蓝牙开门成功后显示成功提示
      uni.showToast({
        title: '开门成功',
        icon: 'success'
      })
      // 开门成功后展示广告（Taku 激励/插屏，按 adType）
      try {
        const adResult = await adManager.showAd()
        if (!adResult) {
          console.log('广告展示受限：可能达到每日限制或间隔时间不足')
        }
      } catch (error) {
        console.error('广告展示失败:', error)
      }
    }
  } catch (error) {
    uni.hideLoading()
    console.error('开门失败:', error)
    uni.showToast({
      title: '开门失败，请重试',
      icon: 'none',
      duration: 2000
    })
    // 网络开门与蓝牙开门均失败，弹出脱机临时密码
    showOfflinePwdPopup()
  }
}

// 开门失败时弹出脱机临时密码
const showOfflinePwdPopup = () => {
  if (!matchedDevice.value || !matchedDevice.value.factory_code) {
    uni.showToast({
      title: '该设备缺少出厂码，无法生成脱机密码',
      icon: 'none'
    })
    return
  }
  offlineDevice.value = matchedDevice.value
  showOfflinePwd.value = true
}

// 修改蓝牙开门函数
const openBleDoor = async () => {
  // 兜底查找匹配设备（不再依赖预扫描结果，openDoorWithBle 内部会自行搜索连接）
  if (!matchedDevice.value) {
    const device = deviceList.value.find(d => d.door_qr_code === deviceNumber.value)
    if (device) matchedDevice.value = device
  }
  if (!matchedDevice.value) {
    uni.showToast({
      title: '设备未授权',
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
    // 先停止后台预扫描（含轮询定时器），避免 Android 重复 startScan 触发 SCAN_FAILED_ALREADY_STARTED
    stopBleScan()
    try {
      await doorBleUtils.bleUtils.stopBluetoothDevicesDiscovery()
    } catch (e) {
      console.warn('停止预扫描失败:', e)
    }
    // 复用预扫描已找到的门锁蓝牙设备，避免重复搜索（重复 startScan 易触发系统限流/已启动错误）
    await doorBleUtils.openDoorWithBle(matchedDevice.value, userStore.userId, foundBleDevice.value || null)
    
    uni.hideLoading()
    uni.showToast({
      title: '开门成功',
      icon: 'success'
    })
    // 开门成功后展示广告（Taku 激励/插屏，按 adType）
    try {
      const adResult = await adManager.showAd()
      if (!adResult) {
        console.log('广告展示受限：可能达到每日限制或间隔时间不足')
      }
    } catch (error) {
      console.error('广告展示失败:', error)
    }
  } catch (error) {
    uni.hideLoading()
    console.error('蓝牙开门失败:', error)
    uni.showToast({
      title: '开门失败，请重试',
      icon: 'none',
      duration: 2000
    })
    // 蓝牙开门失败，弹出脱机临时密码
    showOfflinePwdPopup()
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
  
  try {
    uni.showLoading({
      title: '正在开门...',
      mask: true
    })
    // 验证成功后，调用开门接口
    await visitorPasswordUtils.openDoor({
      deviceNumber: deviceNumber.value,
      sn: verifyResult.sn
    })
    
    uni.hideLoading()
    uni.showToast({
      title: '开门成功',
      icon: 'success'
    })
    // 开门成功后展示广告（Taku 激励/插屏，按 adType）
    try {
      const adResult = await adManager.showAd()
      if (!adResult) {
        console.log('广告展示受限：可能达到每日限制或间隔时间不足')
      }
    } catch (error) {
      console.error('广告展示失败:', error)
    }
  } catch (error) {
    uni.hideLoading()
    console.error('访客密码开门失败:', error)
    uni.showToast({
      title: '开门失败，请重试',
      icon: 'none',
      duration: 2000
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
  padding: 40rpx 40rpx 0;
  box-sizing: border-box;
}

/* ===== 底部横幅广告（Taku）：常驻页面底部 ===== */
.ad-section {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  width: 100%;
  box-sizing: border-box;
  background: #ffffff;
  box-shadow: 0 -6rpx 20rpx rgba(31, 48, 152, 0.08);

  .ad-divider {
    height: 2rpx;
    background: #eeeeee;
  }

  .ad-view {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 120rpx;
    padding: 8rpx 0;
  }
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
  margin-bottom: auto;
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
  background-color: #B9C4FA;
}

/* ==================
        云卫家品牌改版覆盖
 ==================== */

.container {
  background-color: #f5f6fc;
  padding: 24rpx 30rpx 0;

  /* 有横幅广告时预留底部空间，避免内容被悬浮横幅遮挡 */
  &.has-ad {
    padding-bottom: 220rpx;
  }
}

.device-number {
  color: #1f2435;
  font-weight: 600;
}

.tip-text {
  color: #98a0b5;
}

/* 门控区：渐变大圆钮 + 光晕 */
.door-control {
  margin: 46rpx 0 8rpx;
}

.door-button {
  background-image: var(--brand-grad);
  background-color: #4a6cf7;
  border: none;
  box-shadow:
    0 0 0 18rpx rgba(74, 108, 247, 0.07),
    0 18rpx 56rpx rgba(74, 108, 247, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;

  text {
    color: #ffffff;
    font-size: 38rpx;
    font-weight: bold;
    line-height: normal;
  }
}

/* 蓝牙开门：白底描边小圆钮 */
.door-ble-button {
  margin-top: 34rpx;
  width: 190rpx !important;
  height: 190rpx !important;
  background: #ffffff;
  background-image: none;
  border: 2rpx solid var(--brand);
  box-shadow: 0 14rpx 36rpx rgba(74, 108, 247, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;

  text {
    color: var(--brand);
    font-size: 30rpx;
    line-height: normal;
  }
}

/* 访客密码白卡 */
.visitor-section {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 36rpx 30rpx;
  box-shadow: 0 8rpx 30rpx rgba(74, 108, 247, 0.08);
}

.section-title {
  color: #232838;
  font-weight: 700;
  margin-bottom: 24rpx;
}

.custom-input {
  border: none;
  border-radius: 50rpx;
  background: #f3f5fc;
  padding: 0 36rpx;
}

/* 提交按钮渐变 */
.login-button {
  background-image: var(--brand-grad);
  background-color: #4a6cf7;
  color: #ffffff;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 28rpx rgba(74, 108, 247, 0.28);
}

.login-button.secondary {
  background-image: none;
  background-color: #b9c4fa;
  color: #ffffff;
  box-shadow: none;
}



</style> 