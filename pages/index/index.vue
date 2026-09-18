<template>
  <view class="page-container" :class="{ 'has-ad': bannerAdId }">
    <!-- 顶部品牌渐变区 -->
    <view class="idx-hero">
      <view class="wg-glow idx-glow-1"></view>
      <view class="wg-glow idx-glow-2"></view>
      <view class="hero-user">
        <view class="hero-avatar" @click="previewAvatar">
          <image v-if="userStore.avatarUrl" :src="userStore.avatarUrl" mode="aspectFill" class="hero-avatar-img"></image>
          <up-icon v-else name="account" size="26" color="#ffffff"></up-icon>
        </view>
        <view class="hero-text">
          <view class="hero-slogan">云卫家 · 智慧门禁</view>
          <view class="hero-name">{{ userStore.userName || '未登录' }}</view>
        </view>
        <view
          class="hero-refresh"
          :class="{ rotating: isRotating }"
          @click="handleRefresh"
        >
          <up-icon name="reload" size="19" color="#ffffff"></up-icon>
        </view>
      </view>
      <view class="hero-tip">守护每一扇门，欢迎回家</view>
    </view>

    <!-- 内容滚动区 -->
    <scroll-view class="idx-scroll" scroll-y>
      <view class="idx-body">
        <!-- 开门双按钮（渐变主卡） -->
        <view class="idx-door-card">
          <view class="wg-glow idx-door-glow"></view>
          <view class="door-action" @click="handleScanCode">
            <view class="door-action-icon">
              <up-icon name="scan" size="24" color="#ffffff"></up-icon>
            </view>
            <view class="door-action-text">
              <text class="door-action-title">扫码开门</text>
              <text class="door-action-sub">扫门禁二维码</text>
            </view>
          </view>
          <view class="door-split"></view>
          <view class="door-action" @click="handleRemoteOpen">
            <view class="door-action-icon">
              <up-icon name="home-fill" size="24" color="#ffffff"></up-icon>
            </view>
            <view class="door-action-text">
              <text class="door-action-title">远程开门</text>
              <text class="door-action-sub">选择设备开门</text>
            </view>
          </view>
        </view>

        <!-- 公告横幅 -->
        <view class="idx-banner">
          <up-image
            src="/static/img/img_ad.png"
            width="100%"
            height="100%"
            shape="aspectFill"></up-image>
        </view>

        <!-- 功能按钮网格 -->
        <view class="idx-grid wg-card">
          <up-grid :border="false" :col="3">
            <up-grid-item
              v-for="(item, index) in menuList"
              :key="index"
              @click="handleGridItemClick(item)">
              <view class="idx-grid-item">
                <view class="idx-grid-icon" :style="{ backgroundColor: item.bg }">
                  <up-icon :name="item.icon" size="23" :color="item.color"></up-icon>
                </view>
                <text class="idx-grid-text">{{ item.name }}</text>
              </view>
            </up-grid-item>
          </up-grid>
        </view>
        <view class="idx-bottom-space"></view>
      </view>
    </scroll-view>

    <!-- 底部横幅广告（Taku）：常驻页面底部（fixed，不随滚动移动） -->
    <view class="ad-section" v-if="bannerAdId">
      <view class="ad-divider"></view>
      <view class="ad-view">
        <taku-banner :placement-id="bannerAdId"></taku-banner>
      </view>
    </view>

    <!-- 服务协议和隐私政策弹框 -->
    <uni-popup ref="agreementPopup" type="center" :mask-click="false">
      <view class="agreement-popup">
        <view class="agreement-logo">
          <image src="/static/logo.png" mode="aspectFit"></image>
        </view>
        <view class="agreement-title">服务协议和隐私政策</view>
        <view class="agreement-content">欢迎使用云卫家。我们非常重视您的个人信息和隐私保护。在您使用“服务”之前，请务必仔细阅读<text class="link" @click="agreementStore.openUserAgreement()">《用户协议》</text><text>和</text><text class="link" @click="agreementStore.openPrivacyPolicy()">《隐私政策》</text>，并充分理解所有关于您的个人信息和隐私的内容。我们将严格按照您同意的各项条款使用您的个人信息，以便更好的为您提供服务。</view>
        <view class="agreement-buttons">
          <button class="wg-btn-outline pop-btn" @click="handleDisagree">不同意</button>
          <button class="wg-btn-primary pop-btn" @click="handleAgree">同意并继续</button>
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
import TakuAds, { TAKU_CONFIG } from '@/common/taku-sdk'
const { proxy } = getCurrentInstance()
const userStore = proxy.$store.user.useUserStore()
const deviceStore = proxy.$store.device.useDeviceStore()
const agreementStore = proxy.$store.agreement.useAgreementStore()
const deviceApi = proxy.$api.device
import scanUtils from '@/utils/scanUtils'
// 原生壳桥接（仅 H5）：用于「不同意协议」时退出应用
// #ifdef H5
import { isNativeShell, NativeApp } from '@/utils/h5-native-bridge'
// #endif
const adStore = proxy.$store.ad.useAdStore()
// 横幅广告位 ID（Taku placementId，空/全关时不展示）
// computed 响应 adControlStore.adType 变化（静默登录/登录成功后自动更新，无需手动刷新）
const bannerAdId = computed(() => adStore.getBannerAdId())
// 使用 storeToRefs 获取需要的状态
const { avatarUrl, userName, userId } = storeToRefs(userStore)
const { deviceList } = storeToRefs(deviceStore)
// 菜单列表（icon: uview-plus 图标名，bg/color: 图标底色与颜色）
const menuList = ref([
  {
    name: "用户登录",
    icon: "account",
    bg: "#E5EBFF",
    color: "#4A6CF7",
    url: "/user_package/pages/login/index",
  },
  { 
    name: "房屋申请", 
    icon: "home",
    bg: "#DEEFFF",
    color: "#3D7EFF",
    url: "/pages/house/apply",
    needLogin: true
  },
  // 【访客密码】功能入口已暂时隐藏，需要恢复时取消下面注释即可
  // { 
  //   name: "访客密码", 
  //   icon: "lock",
  //   bg: "#EFE9FF",
  //   color: "#8B5CF6",
  //   url: '/workbench_package/pages/visitor-password/index',
  //   needLogin: true
  // },
  {
    name: "开门二维码",
    icon: "share-square",
    bg: "#E2EAFF",
    color: "#4A6CF7",
    url: '/workbench_package/pages/qrcode/index',
    needLogin: true
  },
  { 
    name: "我的", 
    icon: "setting",
    bg: "#E9E7FF",
    color: "#6C63F0",
    url: '/workbench_package/pages/my/index',
    needLogin: true
  },
  { 
    name: "人脸上传", 
    icon: "camera",
    bg: "#F0EBFF",
    color: "#8B5CF6",
    url: '/workbench_package/pages/face-upload/index',
    needLogin: true
  },
])

// 页面加载时检查登录状态
onLoad(() => {
  console.log('onLoad', userStore)
  // 首页静默登录：未登录时 login() 会 reject('无登录数据')，此处吞掉避免未捕获拒绝
  userStore.login({ showLoading: false }).catch(() => {})
})

// 在组件挂载后检查首次打开状态
onMounted(() => {
  checkFirstOpen() // 检查是否首次打开
})

// 处理网格项点击
const handleGridItemClick = (item) => {
  // #ifdef APP-PLUS
  const platform = uni.getSystemInfoSync().osName
  if (platform === 'ios' && !agreementStore.checkAgreement()) {
    agreementPopup.value.open()
    return
  }
  // #endif
  
  // #ifdef H5
  if (!agreementStore.checkAgreement()) {
    agreementPopup.value.open()
    return
  }
  // #endif
  
  if (item.needLogin && !userStore.checkLogin()) {
    return
  }
  if (item.url) {
    uni.navigateTo({
      url: item.url
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
  userStore.login().catch(() => {})
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
  // #ifdef APP-PLUS
  const platform = uni.getSystemInfoSync().osName
  if (platform === 'ios' && !agreementStore.checkAgreement()) {
    agreementPopup.value.open()
  }
  // #endif
  
  // #ifdef H5
  if (!agreementStore.checkAgreement()) {
    agreementPopup.value.open()
  }
  // #endif
}

// 处理同意
const handleAgree = () => {
  agreementStore.setAgreement(true)
  agreementPopup.value.close()
  // 同意隐私后初始化 Taku 广告 SDK（iOS 此前未初始化；Android 系统弹窗已同意，重复调用幂等无副作用）
  // #ifdef APP-PLUS
  TakuAds.init(TAKU_CONFIG)
  // #endif
  // #ifdef H5
  TakuAds.init(TAKU_CONFIG)
  // #endif
  // 同意后停留在首页（不再强制跳转登录页）
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
        // 壳内调用原生能力退出应用；普通浏览器无退出能力，仅提示
        if (isNativeShell) {
          NativeApp.quit().catch(() => {})
        } else {
          uni.showToast({ title: '请在浏览器中关闭当前页面', icon: 'none' })
        }
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
  box-sizing: border-box;
  overflow: hidden;
  background: var(--pageBg);
}

/* ===== 顶部品牌渐变区 ===== */
.idx-hero {
  position: relative;
  flex: none;
  padding: 24rpx 30rpx 30rpx;
  background: var(--brand-grad-deep);
  overflow: hidden;
}

.idx-glow-1 {
  width: 300rpx;
  height: 300rpx;
  right: -80rpx;
  top: -120rpx;
}

.idx-glow-2 {
  width: 200rpx;
  height: 200rpx;
  left: -60rpx;
  bottom: -100rpx;
  background: rgba(255, 255, 255, 0.08);
}

.hero-user {
  position: relative;
  display: flex;
  align-items: center;
}

.hero-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: 3rpx solid rgba(255, 255, 255, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 22rpx;
  overflow: hidden;

  .hero-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.hero-text {
  flex: 1;
  min-width: 0;
}

.hero-slogan {
  font-size: 34rpx;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.3;
}

.hero-name {
  margin-top: 6rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.3;
}

.hero-refresh {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.16);
  border-radius: 50%;

  &.rotating {
    animation: idx-rotate 1s linear;
  }
}

.hero-tip {
  position: relative;
  margin-top: 20rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.75);
}

@keyframes idx-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* ===== 滚动内容 ===== */
.idx-scroll {
  flex: 1;
  min-height: 0;
}

.idx-body {
  padding: 24rpx 24rpx 0;
}

/* 开门渐变主卡 */
.idx-door-card {
  position: relative;
  display: flex;
  align-items: center;
  background-image: var(--brand-grad);
  border-radius: 28rpx;
  padding: 36rpx 10rpx;
  box-shadow: 0 16rpx 36rpx rgba(74, 108, 247, 0.32);
  overflow: hidden;
}

.idx-door-glow {
  width: 240rpx;
  height: 240rpx;
  right: -60rpx;
  top: -120rpx;
  background: rgba(255, 255, 255, 0.14);
}

.door-action {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8rpx 0;
}

.door-action-icon {
  width: 76rpx;
  height: 76rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 18rpx;
}

.door-action-text {
  display: flex;
  flex-direction: column;
}

.door-action-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #ffffff;
  line-height: 1.25;
}

.door-action-sub {
  margin-top: 4rpx;
  font-size: 21rpx;
  color: rgba(255, 255, 255, 0.8);
}

.door-split {
  width: 1rpx;
  height: 56rpx;
  background: rgba(255, 255, 255, 0.35);
}

/* 公告横幅 */
.idx-banner {
  margin-top: 24rpx;
  height: 200rpx;
  border-radius: 20rpx;
  overflow: hidden;
  box-shadow: 0 6rpx 24rpx rgba(74, 108, 247, 0.07);

  ::v-deep image,
  ::v-deep .u-image {
    border-radius: 20rpx;
  }
}

/* 功能宫格 */
.idx-grid {
  margin-top: 24rpx;
  padding: 20rpx 6rpx 10rpx;
  overflow: hidden;

  .idx-grid-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 14rpx 0 22rpx;
  }

  .idx-grid-icon {
    width: 96rpx;
    height: 96rpx;
    border-radius: 32rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14rpx;
  }

  .idx-grid-text {
    font-size: 26rpx;
    color: #2b2f3a;
  }
}

.idx-bottom-space {
  height: 30rpx;
}

/* ===== 协议弹窗 ===== */
.agreement-popup {
  width: 620rpx;
  background: #ffffff;
  border-radius: 28rpx;
  padding: 44rpx 40rpx 40rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;

  .agreement-logo {
    width: 96rpx;
    height: 96rpx;
    border-radius: 24rpx;
    overflow: hidden;
    margin-bottom: 24rpx;
    box-shadow: 0 8rpx 20rpx rgba(74, 108, 247, 0.18);

    image {
      width: 100%;
      height: 100%;
    }
  }

  .agreement-title {
    font-size: 34rpx;
    font-weight: 700;
    color: #232838;
    margin-bottom: 20rpx;
  }

  .agreement-content {
    font-size: 26rpx;
    color: #666a75;
    line-height: 1.7;
    text-align: justify;
    max-height: 420rpx;
    overflow-y: auto;

    .link {
      color: var(--brand);
    }
  }

  .agreement-buttons {
    margin-top: 36rpx;
    width: 100%;
    display: flex;

    .pop-btn {
      height: 80rpx;
      line-height: 80rpx;
      font-size: 29rpx;
      margin: 0 10rpx;
    }
  }
}

/* ===== 底部横幅广告（Taku）：常驻视口底部 ===== */
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

/* 有横幅广告时预留滚动内容底部空间，避免被悬浮横幅遮挡 */
.page-container.has-ad .idx-body {
  padding-bottom: 160rpx;
}
</style>
