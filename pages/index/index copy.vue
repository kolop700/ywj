<template>
  <view class="page-container">
    <!-- 顶部用户信息 - 固定高度 -->
    <view class="user-header">
      <view class="avatar" @click="previewAvatar">
        <image v-if="userStore.avatarUrl" :src="userStore.avatarUrl" mode="aspectFill" class="avatar-img"></image>
        <up-icon v-else name="account" size="24"></up-icon>
      </view>
      <text>{{ userStore.userName || '未登录' }}</text>
      <view class="refresh-icon" :class="{ 'rotating': isRotating }" @click="handleRefresh">
        <image src="/static/icons/icon_refresh.png" mode="aspectFit"></image>
      </view>
    </view>

    <!-- 内容区域 - 自适应高度 -->
    <view class="content-wrapper">
      <!-- 公告横幅 -->
      <view class="notice-banner">
        <up-image
          src="/static/img/img_ad.png"
          width="100%"
          height="100%"
          shape="aspectFill"></up-image>
      </view>

      <!-- 功能按钮网格 -->
      <view class="grid-wrapper">
        <up-grid :border="false" :col="3">
          <up-grid-item
            v-for="(item, index) in menuList"
            :key="index"
            @click="handleGridItemClick(item)">
            <view class="grid-item">
              <image
                :src="item.icon"
                mode="aspectFit"
                class="grid-icon"></image>
              <text class="grid-text">{{ item.name }}</text>
            </view>
          </up-grid-item>
        </up-grid>
      </view>

      <!-- 底部按钮 -->
      <view class="bottom-btns">
        <view class="custom-btn" @click="handleScanCode">
          <image
            src="/static/icons/icon_opendoor_code.png"
            mode="aspectFit"
            class="btn-icon"></image>
          <text class="btn-text">扫码开门</text>
        </view>
        <view class="custom-btn" @click="handleRemoteOpen">
          <image
            src="/static/icons/icon_opendoor_one.png"
            mode="aspectFit"
            class="btn-icon"></image>
          <text class="btn-text">远程开门</text>
        </view>
      </view>
    </view>
    <!-- 远程开门弹框 -->
    <uni-popup ref="popup" type="center" :mask-click="true" @change="onPopupChange">
      <view class="device-popup">
        <view class="popup-header">
          <text>设备列表</text>
          <text class="close-icon" @click="closePopup">×</text>
        </view>
        <!-- 添加搜索框 -->
        <view class="search-box">
          <input 
            type="text" 
            v-model="searchKey" 
            placeholder="搜索设备名称" 
            placeholder-class="placeholder"
          />
        </view>
        <view class="device-list">
          <view 
            class="device-item" 
            v-for="(item, index) in filteredDevices" 
            :key="index"
            :class="[item.online !== '1' ? 'state' : '']"
            @click="handleDeviceClick(item)"
          >
            <view class="item-left">
              <text class="item-title" :class="{'state': item.online !== '1'}">
                {{ item.door_name }}
              </text>
              <view class="item-address" :class="{'state': item.online !== '1'}">
                <text>地址：{{ item.comm_name }}{{ item.unit_name }}</text>
              </view>
            </view>
            <view class="item-right">
              <text 
                class="status-text"
                :class="{'state': item.online !== '1'}"
              >
                {{ item.online === '1' ? '在线' : '离线' }}
              </text>
            </view>
          </view>
        </view>
        <view class="refresh-btn" @click="refreshDeviceList">刷新</view>
      </view>
    </uni-popup>

    <!-- 服务协议和隐私政策弹框 -->
    <uni-popup ref="agreementPopup" type="center" :mask-click="false">
      <view class="agreement-popup">
        <view class="agreement-title">服务协议和隐私政策</view>
        <view class="agreement-content">欢迎使用 APP。我们非常重视您的个人信息和隐私保护。在您使用"服务"之前，请务必仔细阅读<text class="link" @click="agreementStore.openUserAgreement()">《用户协议》</text><text>和</text><text class="link" @click="agreementStore.openPrivacyPolicy()">《隐私政策》</text>，并充分理解所有关于您的个人信息和隐私的内容。我们将严格按照您同意的各项条款使用您的个人信息，以便更好的为您提供服务。</view>
        <view class="agreement-buttons">
          <button class="btn-disagree register-btn" @click="handleDisagree">不同意</button>
          <button class="btn-agree login-btn" @click="handleAgree">同意并继续</button>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script setup>
import { ref, getCurrentInstance, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { onLoad } from '@dcloudio/uni-app'
import doorAccessUtils from '@/utils/doorAccessUtils'
const { proxy } = getCurrentInstance()
const userStore = proxy.$store.user.useUserStore()
const deviceStore = proxy.$store.device.useDeviceStore()
const agreementStore = proxy.$store.agreement.useAgreementStore()
const deviceApi = proxy.$api.device
import scanUtils from '@/utils/scanUtils'
import checkVersion from '@/pages/lq-upgrade/checkVersion.js'
// 使用 storeToRefs 获取需要的状态
const { avatarUrl, userName, userId } = storeToRefs(userStore)
const { deviceList } = storeToRefs(deviceStore)
// 菜单列表
const menuList = ref([
  {
    name: "用户登录",
    icon: "/static/icons/icon_user_login.png",
    url: "/user_package/pages/login/index",
  },
  { 
    name: "房屋申请", 
    icon: "/static/icons/icon_hous_application.png",
    url: "/pages/house/apply",
    needLogin: true
  },
  { 
    name: "访客密码", 
    icon: "/static/icons/icon_guest_password.png",
   	url: '/workbench_package/pages/visitor-password/index',
    needLogin: true
  },
  {
    name: "开门二维码",
    icon: "/static/icons/icon_opendoor_password.png",
    url: '/workbench_package/pages/qrcode/index',
    needLogin: true
  },
  { 
    name: "我的", 
    icon: "/static/icons/icon_my.png",
    url: '/workbench_package/pages/my/index',
    needLogin: true
  },
  { 
    name: "人脸上传", 
    icon: "/static/icons/icon_help.png",
    url: '/workbench_package/pages/face-upload/index',
    needLogin: true
 
  },
])

// 检查版本更新
const checkAppUpdate = () => {
  console.log('检查版本更新')
  const userApi = proxy.$api.user
  userApi.getAppVersion().then(res => {
    console.log('版本信息', res)
    if (res.code === '0' && res.data && res.data.length > 0) {
      const versionInfo = res.data[0]
      console.log('版本信息', versionInfo)
      // 检查是否需要更新
      checkVersion({
        name: versionInfo.ver_name,         // 版本名称
        code: parseInt(versionInfo.ver_no), // 版本号
        content: versionInfo.ver_des,       // 更新内容
        url: versionInfo.ver_link,          // 下载链接
        forceUpdate: versionInfo.ver_forced_update === '1'  // 是否强制更新
      })
    }
  }).catch(err => {
    console.error('获取版本信息失败:', err)
  })
}

// 页面加载时检查登录状态和版本更新
onLoad(() => {
  checkAppUpdate() // 检查版本更新
})

// 在组件挂载后检查首次打开状态
onMounted(() => {
  checkFirstOpen() // 检查是否首次打开
})

// 处理网格项点击
const handleGridItemClick = (item) => {
  // 检查是否同意了协议
  if (!agreementStore.checkAgreement()) {
    agreementPopup.value.open()
    return
  }
  if (item.needLogin && !userStore.checkLogin()) {
    return
  }
  if (item.url) {
    uni.navigateTo({
      url: item.url
    })
  }
}

// 处理登录按钮点击
const handleLoginClick = () => {
  if (!agreementStore.checkAgreement()) {
    // 如果没有同意协议，显示协议弹框
    agreementPopup.value.open()
  } else {
    // 如果已经同意协议，直接跳转到登录页面
    uni.navigateTo({
      url: '/user_package/pages/login/index'
    })
  }
}

// 处理扫码开门
const handleScanCode = async () => {
  if (!userStore.checkLogin()) return
  const result = await scanUtils.scanQRCode()
  console.log('扫码结果', result)
  // http://localhost:5173/#/pages/door/scan?device_number=YN11373
  if (result) {
    uni.navigateTo({
      url: `/pages/door/scan?device_number=${result}`
    })
  } else {
    uni.showToast({
      title: '扫码失败，请重试',
      icon: 'none',
      duration: 2000
    })
  }
}

// 设备列表弹框状态
const showDeviceList = ref(false)
const popup = ref(null)
// 处理远程开门
const handleRemoteOpen = () => {
  if (!userStore.checkLogin()) return
  popup.value.open()
}

// 关闭弹框
const closePopup = () => {
  popup.value.close()
}

// 弹框状态变化回调
const onPopupChange = (e) => {
  showDeviceList.value = e.show
}

// 刷新设备列表
const refreshDeviceList = async () => {
  console.log('刷新设备列表', userStore.userId)
  try {
    // 尝试从服务器获取最新数据
    const res = await deviceApi.getDoorList(userStore.userId)
    if (res.data) {
      // 直接更新 store 中的数据
      deviceStore.setDeviceList(res.data)
    }
  } catch (error) {
    console.error('获取设备列表失败', error)
    // 如果请求失败且没有数据，显示错误提示
    if (!deviceStore.deviceList.length) {
      uni.showToast({
        title: '获取设备列表失败',
        icon: 'none'
      })
    }
  }
}

// 处理设备点击
const handleDeviceClick = async (device) => {
  // 先检查登录状态
  if (!userStore.checkLogin()) {
    return
  }

  if (device.online === '1') {
    // 调用开门方法
    try {
      const success = await doorAccessUtils.openDoor(device)
      if (success) {
        console.log('开门成功:', device)
      }
    } catch (error) {
      console.error('开门操作失败:', error)
    }
  } else {
    uni.showToast({
      title: '设备离线',
      icon: 'none',
      duration: 3000
    })
  }
}

// 搜索关键词
const searchKey = ref('')

// 过滤后的设备列表
const filteredDevices = computed(() => {
  if (!searchKey.value) return deviceStore.filteredDevices
  return deviceStore.filteredDevices.filter(item => {
    const searchText = searchKey.value.toLowerCase()
    const nameMatch = item.door_name?.toLowerCase().includes(searchText)
    const addressMatch = `${item.comm_name || ''}${item.unit_name || ''}`
      .toLowerCase()
      .includes(searchText)
    return nameMatch || addressMatch
  })
})

// 添加刷新相关的状态
const isRotating = ref(false)

// 处理刷新点击
const handleRefresh = () => {
  if (isRotating.value) return
  isRotating.value = true
  userStore.login()
  // 1秒后停止旋转
  setTimeout(() => {
    isRotating.value = false
  }, 1000)
}

// 添加预览头像的方法
const previewAvatar = () => {
  if (userStore.avatarUrl) {
    uni.previewImage({
      urls: [userStore.avatarUrl],
      current: 0
    })
  }
}

// 服务协议弹框相关
const agreementPopup = ref(null)

// 检查是否首次打开应用
const checkFirstOpen = () => {
  if (!agreementStore.checkAgreement()) {
    agreementPopup.value.open()
  }
}

// 处理同意
const handleAgree = () => {
  agreementStore.setAgreement(true)
  agreementPopup.value.close()
}

// 处理不同意
const handleDisagree = () => {
  uni.showModal({
    title: '提示',
    content: '您需要同意服务协议和隐私政策才能使用本应用',
    showCancel: false,
    confirmText: '我知道了',
    success: () => {
      // 如果用户是第一次打开应用，点击不同意后退出应用
      if (!agreementStore.checkAgreement()) {
        // #ifdef APP-PLUS
        plus.runtime.quit()
        // #endif
        // #ifdef H5
        window.location.reload()
        // #endif
      }
    }
  })
}

</script>

<style lang="scss">
.page-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 10rpx;
  box-sizing: border-box;
  overflow: hidden;
}

.user-header {
  height: 6vh;
  min-height: 70rpx;
  flex: none;
  display: flex;
  align-items: center;
  padding-left: 20rpx;
  position: relative;

  .avatar {
    width: 5vh;
    height: 5vh;
    min-width: 50rpx;
    min-height: 50rpx;
    border-radius: 50%;
    background: #f5f5f5;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 20rpx;
    overflow: hidden;

    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  text {
    font-size: calc(12px + 0.5vh);
  }

  .refresh-icon {
    position: absolute;
    right: 20rpx;
    width: 80rpx;
    height: 80rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    
    image {
      width: 100%;
      height: 100%;
    }
    
    &.rotating {
      animation: rotate 1s linear;
    }
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.content-wrapper {
  height: calc(94vh - 200rpx - 20rpx);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  justify-content: center;
  gap: 20rpx;
}

.notice-banner {
  height: 20%;
  min-height: 90rpx;
  border-radius: 8rpx;
  overflow: hidden;
  margin: 0;
}

.grid-wrapper {
  height: 45%;
  overflow: hidden;
  margin: 0;

  .grid-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;

    .grid-icon {
      width: 150rpx;
      height: 150rpx;
    }

    .grid-text {
      font-size: 24rpx;
      margin-top: 10rpx;
    }
  }
}

.bottom-btns {
  height: 30%;
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 0 20rpx;

  .custom-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .btn-icon {
      width: 200rpx;
      height: 200rpx;
      margin-bottom: 10rpx;
    }

    .btn-text {
      font-size: 24rpx;
      color: #333;
    }
  }
}


.device-popup {
  width: 85vw;
  height: 75vh;
  background: #fff;
  border-radius: 20rpx;
  overflow: hidden;
  position: relative;
  z-index: 999;
  padding: 0 0 20rpx 0;
  display: flex;
  flex-direction: column;

  .popup-header {
    flex: none;
    padding: 30rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #eee;
    
    .close-icon {
      font-size: 40rpx;
      color: #999;
    }
  }

  .search-box {
    flex: none;
    margin: 20rpx;
    padding: 20rpx;
    background: #F8F8F8;
    border-radius: 12rpx;

    input {
      width: 100%;
      height: 64rpx;
      background: #FFFFFF;
      border-radius: 32rpx;
      padding: 0 30rpx;
      font-size: 28rpx;
      box-sizing: border-box;
    }

    .placeholder {
      color: #999;
    }
  }

  .device-list {
    flex: 1;
    margin: 0 20rpx;
    padding: 20rpx;
    overflow-y: auto;
    border-radius: 12rpx;
    background: #F8F8F8;

    .device-item {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 20rpx;
      margin-bottom: 20rpx;
      background: #FFFFFF;
      border-radius: 12rpx;
      transition: all 0.2s;
      
      &.state {
        background: #F5F5F5;
        
        &:active {
          background: #F5F5F5;
          opacity: 0.8;
        }
      }
      
      &:active {
        background: #FF0036;
        
        .item-left {
          .item-title {
            color: #FFFFFF;
          }
          
          .item-address {
            color: rgba(255, 255, 255, 0.8);
          }
        }
        
        .item-right {
          .status-text {
            color: #FFFFFF;
          }
        }
      }

      .item-left {
        flex: 1;
        
        .item-title {
          font-size: 28rpx;
          color: #333;
          font-weight: 500;
          margin-bottom: 8rpx;
          
          &.state {
            color: #999;
          }
        }
        
        .item-address {
          font-size: 24rpx;
          color: #666;
          line-height: 1.4;
          
          &.state {
            color: #999;
          }
        }
      }
      
      .item-right {
        .status-text {
          font-size: 24rpx;
          color: #FF0036;
          
          &.state {
            color: #999;
          }
        }
      }
    }
  }

  .refresh-btn {
    flex: none;
    margin: 40rpx 20rpx 20rpx;
    padding: 24rpx;
    text-align: center;
    background: #FF0036;
    color: #fff;
    font-size: 28rpx;
    border-radius: 12rpx;
  }

  .device-stats {
    display: flex;
    justify-content: space-around;
    padding: 20rpx;
    background: #f8f8f8;
    border-radius: 12rpx;
    margin: 20rpx;

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      
      .stat-label {
        font-size: 24rpx;
        color: #666;
        margin-bottom: 8rpx;
      }
      
      .stat-value {
        font-size: 32rpx;
        font-weight: bold;
        color: #333;
        
        &.online {
          color: #FF0036; // 在线设备数量显示红色
        }
        
        &.offline {
          color: #999; // 离线设备数量显示灰色
        }
      }
    }
  }
}

@media (min-width: 768px) {
  .content-wrapper {
    height: calc(94vh - 200rpx - 20rpx);
    
    .grid-wrapper {
      height: 100%;
    }
    
    .bottom-btns {
      height: 25%;
    }
  }
}

.agreement-popup {
  width: 600rpx;
  background: #FFFFFF;
  border-radius: 24rpx;
  padding: 40rpx;
  box-sizing: border-box;

  .agreement-title {
    font-size: 32rpx;
    font-weight: 500;
    color: #333;
    text-align: center;
    margin-bottom: 30rpx;
  }

  .agreement-content {
    font-size: 28rpx;
    color: #666;
    line-height: 1.6;
    margin-bottom: 40rpx;

    .link {
      color: #007AFF;
      padding: 0 4rpx;
    }
  }

  .agreement-buttons {
    display: flex;
    gap: 20rpx;

    button {
      flex: 1;
      height: 80rpx;
      line-height: 80rpx;
      text-align: center;
      border-radius: 40rpx;
      font-size: 28rpx;
      border: none;

      &.btn-disagree {
        background: #F5F5F5;
        color: #666;
      }

      &.btn-agree {
        background: #FF0036;
        color: #FFFFFF;
      }
    }
  }
}

.agreement-buttons {
  .btn-disagree,
  .btn-agree {
    margin-top: 30rpx;
    width: 100%;
    height: 110rpx;
    line-height: 110rpx;
    font-size: 36rpx;
    font-weight: 800;
    border-radius: 12rpx;
    margin-bottom: 30rpx;
    
    &::after {
      border: none;
    }
  }
  
  .btn-agree {
    background-color: #FF0036;
    color: #fff;
    
    &:active {
      opacity: 0.8;
    }
    
    &.btn-disabled {
      background-color: #FCA5A7;
      opacity: 1;
    }
  }
  
  .btn-disagree {
    background-color: #fff;
    color: #333;
    border: 1rpx solid #FF0036;
    
    &:active {
      background-color: #f5f5f5;
    }
  }

  background-color: #FFFFFF;
  margin-bottom: 10px;
}
</style>
