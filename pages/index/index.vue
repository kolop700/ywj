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
    <!-- 底部广告区域 -->
    <view class="ad-section">
      <view class="divider"></view>
      <view class="ad-view">
        <ad 
          v-if="bannerAdId"
          :adpid="bannerAdId" 
          @load="onAdLoad" 
          @close="onAdClose" 
          @error="onAdError">
        </ad>
      </view> 
    </view>

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
const adStore = proxy.$store.ad.useAdStore()
const deviceApi = proxy.$api.device
import scanUtils from '@/utils/scanUtils'
import checkVersion from '@/pages/lq-upgrade/checkVersion.js'
// 使用 storeToRefs 获取需要的状态
const { avatarUrl, userName, userId } = storeToRefs(userStore)
const { deviceList } = storeToRefs(deviceStore)
const isAdLoaded = ref(false) // 控制广告加载状态
const bannerAdId = ref('') // 横幅广告 ID
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
  bannerAdId.value = adStore.getBannerAdId() // 获取横幅广告 ID
  console.log('bannerAdId' ,bannerAdId)
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

// 处理远程开门
const handleRemoteOpen = () => {
  if (!userStore.checkLogin()) return
  
  uni.navigateTo({
    url: '/workbench_package/pages/door-list/index'
  })
}

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

// 广告相关的事件处理函数
const onAdLoad = (e) => {
  console.log('广告加载成功', e)
  isAdLoaded.value = true
}

const onAdClose = (e) => {
  console.log('广告关闭', e)
  isAdLoaded.value = false
}

const onAdError = (e) => {
  console.error('广告加载失败', e)
  isAdLoaded.value = false
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

.ad-section {
  width: 100%;
  height: 225rpx;
  flex: none;
  box-sizing: border-box;
  margin-top: 20rpx;

  .divider {
    height: 2rpx;
    background: #EEEEEE;
  }

  .ad-view {
    height: 220rpx;
    display: flex;
    justify-content: center;
    align-items: center;
    
    ad {
      width: 100%;
      height: 220rpx;
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
